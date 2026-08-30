import { Component, Fragment } from "react";

import {
  ImageButton,
  KeypadWhiteImage,
  PauseWhiteImage,
} from '@webrcade/app-common';

import './style.scss'

// Two buttons only, always both present once shown -- unlike Apple II's
// TouchOverlay (the reference this is based on, same as Jaguar's own
// copy), there's no per-button condition here (that app's extra button
// only shows once keyboard use has been observed, via
// emulator.isKeyboardEvent() -- Coleco has no equivalent concept). The
// show/hide of the whole overlay is still driven by the same shared
// mechanism (see emulator/index.js's showCanvas + SCREEN_CONTROLS
// handling in @webrcade/app-common).
export class TouchOverlay extends Component {
  constructor() {
    super();

    this.state = {
      initialShow: true
    }
  }

  render() {
    const { show } = this.props;
    const { initialShow } = this.state;
    const { emulator } = window;

    if (!emulator || !show) return <></>;

    if (initialShow) {
      this.setState({ initialShow: false });
      setTimeout(() => {
        emulator.updateOnScreenControls(true);
      }, 0);
    }

    const app = emulator.app;

    const showKeypad = () => {
      if (emulator.pause(true)) {
        emulator.showControllers(0);
      }
    }

    const showPause = () => {
      if (!app.isShowOverlay() && emulator.pause(true)) {
        setTimeout(() => emulator.showPauseMenu(), 50);
      }
    }

    return (
      <Fragment>
        <div className="touch-overlay" id="touch-overlay">
          <div className="touch-overlay-buttons">
            <div className="touch-overlay-buttons-left"></div>
            <div className="touch-overlay-buttons-center"></div>
            <div className="touch-overlay-buttons-right">
              <ImageButton
                className="touch-overlay-button"
                imgSrc={KeypadWhiteImage}
                onClick={showKeypad}
                onFocus={(e) => { e.target.blur() }}
              />
              <ImageButton
                className="touch-overlay-button touch-overlay-button-last"
                onClick={showPause}
                imgSrc={PauseWhiteImage}
                onFocus={(e) => { e.target.blur() }}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}
