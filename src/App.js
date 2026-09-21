import React from "react";

import {
  blobToStr,
  md5,
  romNameScorer,
  setMessageAnchorId,
  settings,
  AppRegistry,
  AchievementToast,
  GamePlacard,
  FetchAppData,
  RadialKeypad,
  Resources,
  Unzip,
  UrlUtil,
  WebrcadeApp,
  APP_TYPE_KEYS,
  LOG,
  TEXT_IDS,
} from '@webrcade/app-common';
import { ControllersScreen } from './controllers';
import { Emulator } from './emulator';
import { EmulatorPauseScreen } from './pause';
import { TouchOverlay } from './touchoverlay';

import './App.scss';

// Clockwise from the top -- the grid keypad screen's own 4x3 layout
// ([1,2,3],[4,5,6],[7,8,9],[*,0,#]) flattened row-major onto the ring,
// so each row starts exactly on a clock cardinal: 1 at 12 o'clock, 4 at
// 3 o'clock, 7 at 6 o'clock, * at 9 o'clock. Matches spatial memory of
// the real controller's grid better than a plain 1-9,0,*,# count.
const RADIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// Maps a key label to the numeric input value the emulator expects
// (emulator.JST_1, etc. -- see emulator/index.js), the same values the
// grid keypad screen (controllers/index.js) sends via onSelect/onKeypad.
// Passed to the shared RadialKeypad component as its keyToValue prop.
const RADIAL_KEY_TO_VALUE = {
  "1": "JST_1", "2": "JST_2", "3": "JST_3", "4": "JST_4",
  "5": "JST_5", "6": "JST_6", "7": "JST_7", "8": "JST_8",
  "9": "JST_9", "0": "JST_0", "*": "JST_STAR", "#": "JST_POUND",
};

class App extends WebrcadeApp {
  emulator = null;

  CONTROLLERS_MODE = "controllers";

  radialKeypadRef = React.createRef();

  constructor() {
    super();
    this.state = {
      ...this.state,
      showCanvas: false,
    };
  }

  // Called once by Emulator.onStart() -- gates the upper-right touch
  // overlay (keypad/pause icons) so it doesn't render before the
  // emulator itself exists, same as Apple II/melonDS/Jaguar.
  showCanvas() {
    this.setState({ showCanvas: true });
  }

  // Called once per frame per controller from Emulator.pollControls() --
  // forwarded straight through as an imperative call (not setState) so
  // the update happens synchronously in the same frame, with no extra
  // polling or animation loop of its own.
  updateRadialStick(controller, x, y, confirmDown) {
    const { current } = this.radialKeypadRef;
    if (current) current.updateStick(controller, x, y, confirmDown);
  }

  // Called from Emulator.onPause() the instant pause starts (covers both
  // the real pause menu and the grid keypad screen -- both trigger via
  // the same pause(true) call). Needed because pausing only stops
  // updateRadialStick() from being called again going forward; it does
  // nothing about a ring that's already open at that exact moment, which
  // would otherwise stay frozen visible behind the screen that just
  // opened.
  hideRadialKeypad() {
    const { current } = this.radialKeypadRef;
    if (current) current.hide();
  }

  componentDidMount() {
    super.componentDidMount();

    setMessageAnchorId('canvas');

    const { appProps, ModeEnum } = this;

    // Determine extensions
    const exts = AppRegistry.instance.getExtensions(
      APP_TYPE_KEYS.COLEM,
      true,
      false,
    );
    const extsNotUnique = AppRegistry.instance.getExtensions(
      APP_TYPE_KEYS.COLEM,
      true,
      true,
    );

    try {
      // Get the ROM location that was specified
      const rom = appProps.rom;
      if (!rom) throw new Error('A ROM file was not specified.');
      // const pal = appProps.pal !== undefined ? appProps.pal === true : null;

      let descriptions = appProps.descriptions;
      if (!descriptions) {
        descriptions = {}
      }
      this.descriptions = descriptions;

      let mappings = appProps.mappings;
      if (!mappings) {
        mappings = {}
      }
      this.mappings = mappings;

      // Create the emulator
      if (this.emulator === null) {
        this.emulator = new Emulator(this, this.isDebug());
      }
      const emulator = this.emulator;

      // Load emscripten and the ROM
      const uz = new Unzip().setDebug(this.isDebug());
      let romBlob = null;
      let romMd5 = null;
      emulator
        .loadEmscriptenModule()
        .then(() => settings.load())
        // .then(() => settings.setBilinearFilterEnabled(true))
        // .then(() => settings.setVsyncEnabled(false))
        .then(() => new FetchAppData(rom).fetch())
        .then((response) => {
          LOG.info('downloaded.');
          return response.blob();
        })
        .then((blob) => uz.unzip(blob, extsNotUnique, exts, romNameScorer))
        .then((blob) => {
          romBlob = blob;
          return blob;
        })
        .then((blob) => blobToStr(blob))
        .then((str) => {
          romMd5 = md5(str);
        })
        .then(() => new Response(romBlob).arrayBuffer())
        .then((bytes) =>
          emulator.setRom(
            // pal,
            uz.getName() ? uz.getName() : UrlUtil.getFileName(rom),
            bytes,
            romMd5,
          ),
        )
        .then(() => this.setState({ mode: ModeEnum.LOADED }))
        .catch((msg) => {
          LOG.error(msg);
          this.exit(
            this.isDebug()
              ? msg
              : Resources.getText(TEXT_IDS.ERROR_RETRIEVING_GAME),
          );
        });
    } catch (e) {
      this.exit(e);
    }
  }

  async onPreExit() {
    try {
      await super.onPreExit();
      if (!this.isExitFromPause()) {
        //await this.emulator.saveState();
      }
    } catch (e) {
      LOG.error(e);
    }
  }

  componentDidUpdate() {
    const { mode } = this.state;
    const { canvas, emulator, ModeEnum } = this;

    if (mode === ModeEnum.LOADED) {
      window.focus();
      // Start the emulator
      emulator.start(canvas);
    }
  }

  renderPauseScreen() {
    const { appProps, emulator } = this;

    return (
      <EmulatorPauseScreen
        emulator={emulator}
        appProps={appProps}
        closeCallback={() => this.resume()}
        exitCallback={() => this.exitFromPause()}
        isEditor={this.isEditor}
        isStandalone={this.isStandalone}
      />
    );
  }

  renderControllersScreen() {
    const { controllerIndex } = this.state;
    const { CONTROLLERS_MODE, emulator, descriptions } = this;

    return (
      <ControllersScreen
        controllerIndex={controllerIndex}
        initialRow={this.lastKeyRow}
        initialCol={this.lastKeyCol}
        onSelect={(key, r, c, keyCode) => {
          this.lastKeyRow = r;
          this.lastKeyCol = c;
          emulator.onKeypad(controllerIndex, key, keyCode);
        }}
        closeCallback={(r, c) => {
          // WRC - closing without picking a key (cancel) used to leave
          // lastKeyRow/lastKeyCol at wherever the last actual selection
          // was, not wherever the cursor was just navigated to - reopening
          // the keypad would jump back to the old selection instead of
          // where the player had last been looking. ControllersScreen's
          // close() now always passes its current row/col here.
          if (r !== undefined && c !== undefined) {
            this.lastKeyRow = r;
            this.lastKeyCol = c;
          }
          this.resume(CONTROLLERS_MODE);
        }}
        descriptions={descriptions}
        emulator={emulator}
      />
    );
  }

  renderCanvas() {
    return (
      <canvas
        style={this.getCanvasStyles()}
        ref={(canvas) => {
          this.canvas = canvas;
        }}
        id="canvas"
      ></canvas>
    );
  }

  showControllers(index, resumeCallback) {
    const { mode } = this.state;
    const { CONTROLLERS_MODE } = this;

    if (mode !== CONTROLLERS_MODE) {
      this.setState({
        mode: CONTROLLERS_MODE,
        resumeCallback: resumeCallback,
        controllerIndex: index
      })
      return true;
    }
    return false;
  }

  isControllersScreen() {
    const { mode } = this.state;
    const { CONTROLLERS_MODE } = this;
    return mode === CONTROLLERS_MODE;
  }

  render() {
    const { mode, showCanvas } = this.state;
    const { ModeEnum, CONTROLLERS_MODE, emulator, descriptions } = this;

    return (
      <>
        {super.render()}
        {mode === ModeEnum.LOADING ? this.renderLoading() : null}
        {mode === ModeEnum.PAUSE ? this.renderPauseScreen() : null}
        {mode === CONTROLLERS_MODE ? this.renderControllersScreen() : null}
        {mode === ModeEnum.LOADED || mode === ModeEnum.PAUSE || mode === CONTROLLERS_MODE
          ? this.renderCanvas()
          : null}
        <AchievementToast />
        <GamePlacard />
        <TouchOverlay show={showCanvas} />
        <RadialKeypad
          ref={this.radialKeypadRef}
          emulator={emulator}
          descriptions={descriptions}
          keys={RADIAL_KEYS}
          keyToValue={RADIAL_KEY_TO_VALUE}
        />
      </>
    );
  }
}

export default App;
