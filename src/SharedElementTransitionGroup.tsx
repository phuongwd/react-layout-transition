import * as React from 'react';

import fireOnce from './utils/fireOnce';
import {childrenToMap, compareChildren} from './utils/children';

export interface SharedElementTransitionGroupProps {
    children: React.ReactChild,
}

export interface SharedElementTransitionGroupState {
    outgoingShow: boolean,
    incomingShow: boolean,
    children: Map<string, React.ReactChild>,
    transitionPending: boolean,
}

class SharedElementTransitionGroup extends React.Component<SharedElementTransitionGroupProps, SharedElementTransitionGroupState> {
    outgoingSharedElements: Array<Element>
    outgoingRef?: HTMLElement
    incomingSharedElements: Array<Element>;
    incomingRef?: HTMLElement;
    containerRef: HTMLElement;
    
    constructor(props) {
        super();

        this.state = {
            outgoingShow: true,
            incomingShow: false,
            children: childrenToMap(props.children),
            transitionPending: false,
        };
    }

    getSharedElements = (): {
        outgoingSharedElements?: Array<Element>,
        incomingSharedElements?: Array<Element>,
    } => {
        if (this.outgoingSharedElements && this.incomingSharedElements) {
            return {
                outgoingSharedElements: this.outgoingSharedElements,
                incomingSharedElements: this.incomingSharedElements
            };
        }
        if (!this.outgoingRef || !this.incomingRef) {
            return {
                outgoingSharedElements: undefined,
                incomingSharedElements: undefined,
            };
        }

        this.outgoingSharedElements = [];
        this.incomingSharedElements = [];

        const outgoingMarkedEls = Array.from(this.outgoingRef.querySelectorAll('[id]'));
        const incomingMarkedEls = Array.from(this.incomingRef.querySelectorAll('[id]'));

        const outgoingSet = new Set(Array.from(outgoingMarkedEls).map((el) => el.id));
        const incomingSet = new Set(Array.from(incomingMarkedEls).map((el) => el.id));

        for (let element of outgoingMarkedEls) {
            if (incomingSet.has(element.id)) {
                this.outgoingSharedElements.push(element);
            }
        }
        for (let element of incomingMarkedEls) {
            if (outgoingSet.has(element.id)) {
                this.incomingSharedElements.push(element);
            }
        }

        return {outgoingSharedElements: this.outgoingSharedElements, incomingSharedElements: this.incomingSharedElements};
    }

    getSharedDimens = () => {
        const initialDimensArr = this.outgoingSharedElements.map((element) => element.getBoundingClientRect());
        const finalDimensArr = this.incomingSharedElements.map((element) => element.getBoundingClientRect());

        return {initialDimensArr, finalDimensArr};
    };

    componentWillReceiveProps(nextProps) {
        const prevChildren = this.state.children;
        const newChildren = childrenToMap(nextProps.children);

        const allChildren: Map<string, React.ReactChild> = new Map([
            ...Array.from(prevChildren),
            ...Array.from(newChildren)
        ]);

        allChildren.forEach((value, key) => {
            const outgoing = prevChildren.has(key);
            const incoming = newChildren.has(key);

            if (outgoing) {
                allChildren.set(key, React.cloneElement(
                    value,
                    {
                        exit: () => {
                            this.exit(key);
                        },
                        innerRef: (ref) => {
                            this.outgoingRef = ref;
                        },
                        outgoing: true,
                    }
                ));
            } else if (incoming) {
                allChildren.set(key, React.cloneElement(
                    value,
                    {
                        innerRef: (ref) => {
                            this.incomingRef = ref;
                        },
                        incoming: true,
                    }
                ));
            }
        });

        this.setState((prevState) => ({
            ...prevState,
            children: allChildren,
            transitionPending: true,
        }));
    }

    createElementsForTransition(outgoingSharedElements, initialDimensArr) {
        const newElements: Array<HTMLElement> = [];
        outgoingSharedElements.forEach((sharedEl, idx) => {
            const element = sharedEl.cloneNode();
            element.style.position = 'absolute';
            element.style.top = initialDimensArr[idx].top + window.scrollY - this.containerRef.offsetTop;
            element.style.left = initialDimensArr[idx].left + window.scrollX - this.containerRef.offsetLeft;
            element.style.height = initialDimensArr[idx].height;
            element.style.width = initialDimensArr[idx].width;
            element.style.transformOrigin = '0 0';
            element.style.transition = 'transform 300ms ease-in-out';
            newElements.push(element);
        });

        return newElements;
    }

    componentDidUpdate(prevProps, prevState) {
        if (!this.state.transitionPending) return;
        if (compareChildren(this.state.children, prevState.children)) return;
        if (!this.incomingRef || !this.outgoingRef) return;

        this.setState((state) => ({
            transitionPending: false,
        }));

        const {outgoingSharedElements} = this.getSharedElements();
        const {initialDimensArr, finalDimensArr} = this.getSharedDimens();
        const allChildren = this.state.children;

        const newElements = this.createElementsForTransition(outgoingSharedElements, initialDimensArr);
        fireOnce(newElements, 'transitionend', (events) => {
            if (!this.incomingRef) return;

            this.incomingRef.addEventListener('transitionend', () => {
                events.forEach((event) => {
                    event.target.remove();
                });
                for (let [key, value] of allChildren.entries()) {
                    let changedChildren = new Map();
                    let element;
                    if (value.props.incoming) {
                        element = React.cloneElement(value, {ref: undefined, incoming: undefined});
                        changedChildren.set(key, element);
                    }
                    this.outgoingRef = undefined;
                    this.incomingRef = undefined;
                    this.outgoingSharedElements = [];
                    this.incomingSharedElements = [];
                    this.setState((prevState) => ({
                        ...prevState,
                        children: changedChildren,
                        incomingShow: false,
                        outgoingShow: false,
                    }));
                }
            });
            this.setState((prevState) => ({
                ...prevState,
                incomingShow: true,
            }));
        });

        const invert: Array<{
            sx: number,
            sy: number,
            x: number,
            y: number,
        }> = [];

        newElements.forEach((element, idx) => {
            this.containerRef.appendChild(element);
            invert[idx].sx = finalDimensArr[idx].width / initialDimensArr[idx].width;
            invert[idx].sy = finalDimensArr[idx].height / initialDimensArr[idx].height;
            invert[idx].x = finalDimensArr[idx].left - initialDimensArr[idx].left;
            invert[idx].y = finalDimensArr[idx].top - initialDimensArr[idx].top;
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!this.outgoingRef) return;

                this.outgoingRef.addEventListener('transitionend', () => {
                    newElements.forEach((element, idx) => {
                        element.style.transform = `translate(${invert[idx].x}px, ${invert[idx].y}px) scale(${invert[idx].sx}, ${invert[idx].sy})`;
                    });
                });
                this.setState((prevState) => ({
                    ...prevState,
                    outgoingShow: false,
                }));
            });
        });
    }

    exit = (key) => {
        this.setState((prevState) => ({
            ...prevState,
            children: prevState.children.delete(key),
        }));
    };

    render() {
        const outgoingStyles = {
            position: 'absolute',
            transition: 'opacity 300ms ease-out',
            opacity: this.state.outgoingShow ? 1 : 0,
        };
        const incomingStyles = {
            position: 'absolute',
            transition: 'opacity 300ms ease-out',
            opacity: this.state.incomingShow ? 1 : 0,
        };
        const normalStyles = {
            position: 'absolute',
        };
        const containerStyles = {
            position: 'relative',
        };

        return (
            <div
                ref={(ref) => {
                    this.containerRef = ref;
                }}
                style={containerStyles}
            >
                {Array.from(this.state.children.values()).map((child) => {
                    if (child.props.outgoing) {
                        return React.cloneElement(child, {style: outgoingStyles});
                    } else if (child.props.incoming) {
                        return React.cloneElement(child, {style: incomingStyles});
                    } else {
                        return React.cloneElement(child, {style: normalStyles});
                    }
                })}
            </div>
        );
    }
}

export default SharedElementTransitionGroup;