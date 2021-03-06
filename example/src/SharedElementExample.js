import React from 'react';

import {SharedElementTransitionGroup} from '../../src/index';
import Page1 from './Page1';
import Page2 from './Page2';

class SharedElementExample extends React.Component {
    state = {
        switch: true,
    };

    toggle = () => {
        this.setState((prevState) => ({
            switch: !prevState.switch,
        }));
    };

    render() {
        return (
            <div>
                <button onClick={this.toggle}>Click Me</button>
                <SharedElementTransitionGroup>
                    {this.state.switch && <Page1 />}
                    {!this.state.switch && <Page2 />}
                </SharedElementTransitionGroup>
            </div>
        );
    }
}

export default SharedElementExample;
