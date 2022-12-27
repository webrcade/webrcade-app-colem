import {
  AppWrapper,
  Controller,
  Controllers,
  DisplayLoop,
  FetchAppData,
  KeyCodeToControlMapping,
  ScriptAudioProcessor,
  Unzip,
  VisibilityChangeMonitor,
  CIDS,
  LOG,
  KCODES,
} from '@webrcade/app-common';

const KEY_FLAG = 0x8000;
const SPACE_BAR = KEY_FLAG | 1;

class ColecoKeyCodeToControlMapping extends KeyCodeToControlMapping {
  constructor() {
    super({
      [KCODES.ARROW_UP]: CIDS.UP,
      [KCODES.ARROW_DOWN]: CIDS.DOWN,
      [KCODES.ARROW_RIGHT]: CIDS.RIGHT,
      [KCODES.ARROW_LEFT]: CIDS.LEFT,
      [KCODES.Z]: CIDS.A,
      [KCODES.A]: CIDS.X,
      [KCODES.X]: CIDS.B,
      [KCODES.S]: CIDS.Y,
      [KCODES.Q]: CIDS.LBUMP,
      [KCODES.W]: CIDS.RBUMP,
      [KCODES.SHIFT_RIGHT]: CIDS.SELECT,
      [KCODES.ENTER]: CIDS.START,
      [KCODES.ESCAPE]: CIDS.ESCAPE,
      // Direct keyboard mappings
      [KCODES.SPACE_BAR]: SPACE_BAR
    });
  }
}

export class Emulator extends AppWrapper {
  constructor(app, debug = false) {
    super(app, debug);

    window.emulator = this;
    this.romBytes = null;
    this.romMd5 = null;
    this.romName = null;
    this.saveStatePrefix = null;

    this.width = 272;
    this.height = 200;

    this.keypad = [0, 0];
    this.keypadCount = [0, 0];
    this.keypadDown = [false, false];
  }

  JST_NONE      = 0x0000;
  JST_KEYPAD    = 0x000F;
  JST_UP        = 0x0100;
  JST_RIGHT     = 0x0200;
  JST_DOWN      = 0x0400;
  JST_LEFT      = 0x0800;
  JST_FIRER     = 0x0040;
  JST_FIREL     = 0x4000;
  JST_0         = 0x0005;
  JST_1         = 0x0002;
  JST_2         = 0x0008;
  JST_3         = 0x0003;
  JST_4         = 0x000D;
  JST_5         = 0x000C;
  JST_6         = 0x0001;
  JST_7         = 0x000A;
  JST_8         = 0x000E;
  JST_9         = 0x0004;
  JST_STAR      = 0x0006;
  JST_POUND     = 0x0009;

  createControllers() {
    this.keyToControlMapping = new ColecoKeyCodeToControlMapping();
    return new Controllers([
      new Controller(this.keyToControlMapping),
      new Controller(),
    ]);
  }

  createAudioProcessor() {
    return new ScriptAudioProcessor(1, 48000).setDebug(this.debug);
  }

  createVisibilityMonitor() {
    const { app } = this;

    return new VisibilityChangeMonitor((p) => {
      if (!app.isPauseScreen() && !app.isControllersScreen()) {
        this.pause(p);
      }
    });
  }

  setRom(name, bytes, md5) {
    if (bytes.byteLength === 0) {
      throw new Error('The size is invalid (0 bytes).');
    }
    this.romName = name;
    this.romMd5 = md5;
    this.romBytes = bytes;
    this.saveStatePrefix = this.app.getStoragePath(`${md5}/`)

    LOG.info('name: ' + this.romName);
    LOG.info('md5: ' + this.romMd5);
  }

  async onShowPauseMenu() {
    // await this.saveState();
  }

  showControllers(index) {
    const { app, controllers } = this;

    if (controllers) {
      controllers.setEnabled(false);

      // Total hack to allow spacebar to repeat keypress
      // TODO: Fix this in the future
      controllers.addFakeKeyEvent(KCODES.SPACE_BAR, false);
      controllers.addFakeKeyEvent(KCODES.ENTER, false);
    }

    setTimeout(() => {
      this.showPauseDelay = 0;
      app.showControllers(index, () => {
        if (controllers) {
          controllers.setEnabled(true);
        }
        this.pause(false, true);
      })
    }, this.showPauseDelay);
  }

  onKeypad(index, key, keyPressed = null) {
    const { controllers } = this;

    // Total hack to allow spacebar to repeat keypress
    // TODO: Fix this in the future
    if (keyPressed) {
      controllers.addFakeKeyEvent(keyPressed, true);
    }

    this.keypad[index] = key;
    this.keypadDown[index] = true;
    this.keypadCount[index] = 15;
  }

  pollControls() {
    const { colemModule, controllers, keyToControlMapping } = this;

    controllers.poll();

    // 8   4    2 1 8 4 2 1 8   4    2 1 8  4  2  1
    // x.FIRE-B.x.x.L.D.R.U.x.FIRE-A.x.x.N3.N2.N1.N0
    let combined = 0;

    for (let i = 0; i < 2; i++) {
      let input = 0;


      let keyboardPressed = false;
      if (i === 0 && (
          keyToControlMapping.isControlDown(SPACE_BAR) ||
          controllers.isControlDown(i, CIDS.START))) {
        //console.log('space bar!')
        keyboardPressed = true;
      }

      let keypadInput = false;
      if (this.keypad[i]) {
        const val = this.keypad[i];

        this.keypadCount[i]--;

        if (this.keypadDown[i]) {
          this.keypadDown[i] = (controllers.isControlDown(i, CIDS.A) || keyboardPressed);
        }

        if (this.keypadCount[i] <= 0 && !this.keypadDown[i]) {
          this.keypad[i] = 0;
          this.keypadCount[i] = 0;
          this.keypadDown[i] = false;
        }

        if (val) {
          //console.log(i + ", " + val);
          keypadInput = true;

          if (i === 0) {
            combined |= val;
          } else {
            combined = (combined | (val << 16));
          }
        }
      }

      if (!keypadInput) {
        if (controllers.isControlDown(i, CIDS.ESCAPE)) {
          if (this.pause(true)) {
            controllers
              .waitUntilControlReleased(i, CIDS.ESCAPE)
              .then(() => this.showPauseMenu());
            return;
          }
        }

        if (controllers.isControlDown(i, CIDS.START)) {
          if (this.pause(true)) {
            controllers
              .waitUntilControlReleased(i, CIDS.START)
              .then(() => this.showControllers(i));
            return;
          }
        }

        if (controllers.isControlDown(i, CIDS.UP)) {
          input |= this.JST_UP;
        } else if (controllers.isControlDown(i, CIDS.DOWN)) {
          input |= this.JST_DOWN;
        }

        if (controllers.isControlDown(i, CIDS.RIGHT)) {
          input |= this.JST_RIGHT;
        } else if (controllers.isControlDown(i, CIDS.LEFT)) {
          input |= this.JST_LEFT;
        }

        if (
          controllers.isControlDown(i, CIDS.B) ||
          controllers.isControlDown(i, CIDS.X)
        ) {
          input |= this.JST_FIRER;
        }
        if (
          controllers.isControlDown(i, CIDS.A) ||
          controllers.isControlDown(i, CIDS.Y)
        ) {
          input |= this.JST_FIREL;
        }
        if (controllers.isControlDown(i, CIDS.SELECT)) {
          input |= this.JST_1;
        }
        // if (controllers.isControlDown(i, CIDS.START)) {
        //   input |= JST_1;
        // }
      }

      if (i === 0) {
        combined |= input;
      } else {
        combined = (combined | (input << 16));
      }
    }

    colemModule._EmSetInput(combined);
  }

  loadEmscriptenModule() {
    const { app } = this;

    window.Module = {
      preRun: [],
      postRun: [],
      onAbort: (msg) => app.exit(msg),
      onExit: () => app.exit(),
    };

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);

      script.src = 'js/colem.js';
      script.async = true;
      script.onload = () => {
        LOG.info('Script loaded.');
        if (window.colem) {
          window.colem().then((colemModule) => {
            colemModule.onAbort = (msg) => app.exit(msg);
            colemModule.onExit = () => app.exit();
            this.colemModule = colemModule;
            resolve();
          });
        } else {
          reject('An error occurred attempting to load the mednafen engine.');
        }
      };
    });
  }

  async getStateSlots(showStatus = true) {
    return await this.getSaveManager().getStateSlots(
      this.saveStatePrefix, showStatus ? this.saveMessageCallback : null
    );
  }

  async saveStateForSlot(slot) {
    const { colemModule } = this;
    const Module = this.colemModule;
    const FS = Module.FS;

    colemModule._EmSaveState();

    let s = null;
    try {

      try {
        s = FS.readFile("/freeze.sta");
      } catch (e) {}

      if (s) {
        await this.getSaveManager().saveState(
          this.saveStatePrefix, slot, s,
          this.canvas,
          this.saveMessageCallback, null,
          {aspectRatio: "1.333"});
      }
    } catch (e) {
      LOG.error('Error saving state: ' + e);
    }

    return true;
  }

  async loadStateForSlot(slot) {
    const { colemModule } = this;
    const Module = this.colemModule;
    const FS = Module.FS;

    try {
      const state = await this.getSaveManager().loadState(
        this.saveStatePrefix, slot, this.saveMessageCallback);

      if (state) {
        FS.writeFile("/freeze.sta", state);
        colemModule._EmLoadState();
      }
    } catch (e) {
      LOG.error('Error loading state: ' + e);
    }
    return true;
  }

  async deleteStateForSlot(slot, showStatus = true) {
    try {
      await this.getSaveManager().deleteState(
        this.saveStatePrefix, slot, showStatus ? this.saveMessageCallback : null);
    } catch (e) {
      LOG.error('Error deleting state: ' + e);
    }
    return true;
  }

  async onStart(canvas) {
    const { app, debug, romBytes } = this;
    const Module = this.colemModule;
    const FS = Module.FS;

    // Check cloud storage (eliminate delay when showing settings)
    try {
      await this.getSaveManager().isCloudEnabled(this.loadMessageCallback);
    } finally {
      this.loadMessageCallback(null);
    }

    try {
      this.initVideo(canvas);

      const colecoRom = this.getProps().coleco_rom;
      if (!colecoRom) {
        throw new Error(
          'A Coleco Boot ROM was not specified, refer to documentation:\n' +
            '(https://docs.webrcade.com/apps/emulators/coleco/)',
        );
      }

      // Coleco ROM
      const uz = new Unzip().setDebug(true);
      const res = await new FetchAppData(colecoRom).fetch();
      let blob = await res.blob();
      // Unzip it
      blob = await uz.unzip(blob, ['.bin', '.rom']);
      // Convert to array buffer
      const arrayBuffer = await new Response(blob).arrayBuffer();
      // Write to file system
      let u8array = new Uint8Array(arrayBuffer);
      FS.writeFile('/coleco.rom', u8array);

      // Set the canvas for the module
      Module.canvas = canvas;

      // Load the ROM
      const filename = '/rom.col';
      u8array = new Uint8Array(romBytes);
      FS.writeFile(filename, u8array);

      // Create display loop
      this.displayLoop = new DisplayLoop(/*isPal ? 50 :*/ 60, true, debug);

      // Start the emulator
      Module._EmStart();

      // frame step method
      const frame = Module._EmStep;

      let audioArray = null;
      this.audioCallback = (offset, length) => {
        audioArray = new Int16Array(Module.HEAP16.buffer, offset, 4096);
        this.audioProcessor.storeSoundCombinedInput(
          audioArray, 1, length, 0, 32768,
        );
      };

      // Enable showing messages
      this.setShowMessageEnabled(true);

      let audioStarted = 0;

      // Start the display loop
      this.displayLoop.start(() => {
        this.pollControls();
        frame();

        if (audioStarted !== -1) {
          if (audioStarted > 1) {
            audioStarted = -1;
            // Start the audio processor
            this.audioProcessor.start();
          } else {
            audioStarted++;
          }
        }
      });
    } catch (e) {
      app.exit(e)
    }
  }

  clearImageData(image, imageData, pixelCount) {
    for (var i = 0; i < pixelCount * 4; ) {
      imageData[i++] = 0;
      imageData[i++] = 0;
      imageData[i++] = 0;
      imageData[i++] = 0xff;
    }
    this.context.putImageData(image, 0, 0);
  }

  setVisibleSize(width, height) {
    const { canvas } = this;
    LOG.info('### visible size: ' + width + 'x' + height);
    canvas.width = width;
    canvas.height = height;
    this.pixelCount = width*height;
  }

  initVideo(canvas) {
    let { width, height } = this;
    this.canvas = canvas;
    this.context = this.canvas.getContext('2d');
    this.image = this.context.getImageData(0, 0, width, height);
    this.imageData = this.image.data;
    this.clearImageData(this.image, this.imageData, width*height);
    this.setVisibleSize(width, height);
  }

  drawScreen(buff, width, height) {
    // TODO: Check width and height changes?
    const { colemModule, image, imageData, pixelCount } = this;
    const b = new Uint8Array(colemModule.HEAP8.buffer, buff, pixelCount << 2);
    let index = 0;
    for (let i = 0; i < pixelCount; i++) {
      const offset = i << 2;
      imageData[index++] = b[offset + 2];
      imageData[index++] = b[offset + 1];
      imageData[index++] = b[offset];
      index++;
    }
    this.context.putImageData(image, 0, 0);
  }
}
