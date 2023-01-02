import {
  blobToStr,
  md5,
  romNameScorer,
  setMessageAnchorId,
  settings,
  AppRegistry,
  FetchAppData,
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

import './App.scss';

class App extends WebrcadeApp {
  emulator = null;

  CONTROLLERS_MODE = "controllers";

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
        onSelect={(key, keyCode) => {emulator.onKeypad(controllerIndex, key, keyCode)}}
        closeCallback={() => { this.resume(CONTROLLERS_MODE) }}
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
    const { mode } = this.state;
    const { ModeEnum, CONTROLLERS_MODE } = this;

    return (
      <>
        {super.render()}
        {mode === ModeEnum.LOADING ? this.renderLoading() : null}
        {mode === ModeEnum.PAUSE ? this.renderPauseScreen() : null}
        {mode === CONTROLLERS_MODE ? this.renderControllersScreen() : null}
        {mode === ModeEnum.LOADED || mode === ModeEnum.PAUSE || mode === CONTROLLERS_MODE
          ? this.renderCanvas()
          : null}
      </>
    );
  }
}

export default App;
