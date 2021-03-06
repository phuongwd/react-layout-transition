import * as React from 'react';

function childrenToMap(children?: any): Map<string, React.ReactElement<any>> {
    const childMap: Map<string, React.ReactElement<any>> = new Map();
    if (!children) {
        return childMap;
    }
    React.Children.map(children, child => child).forEach(child => {
        if (React.isValidElement(child)) {
            childMap.set(child.key as string, child);
        }
    });
    return childMap;
}

function compareChildren(
    children1: Map<string, React.ReactNode>,
    children2: Map<string, React.ReactNode>,
): boolean {
    const keys1 = Array.from(children1.keys());
    const keys2 = Array.from(children2.keys());

    return keys1 === keys2;
}

export {childrenToMap, compareChildren};
