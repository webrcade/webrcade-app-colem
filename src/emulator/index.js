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

const CV_SGM     = 0x00001000;  /* Super Game Module */
const CV_EEPROM  = 0x00006000;  /* Serial EEPROMs:   */
const CV_24C08   = 0x00002000;  /*   256-byte EEPROM */
const CV_24C256  = 0x00004000;  /*   32kB EEPROM     */
const CV_SRAM    = 0x00008000;  /* 2kB battery-backed SRAM */

const JST_NONE      = 0x0000;
const JST_KEYPAD    = 0x000F;
const JST_UP        = 0x0100;
const JST_RIGHT     = 0x0200;
const JST_DOWN      = 0x0400;
const JST_LEFT      = 0x0800;
const JST_FIRER     = 0x0040;
const JST_FIREL     = 0x4000;
const JST_0         = 0x0005;
const JST_1         = 0x0002;
const JST_2         = 0x0008;
const JST_3         = 0x0003;
const JST_4         = 0x000D;
const JST_5         = 0x000C;
const JST_6         = 0x0001;
const JST_7         = 0x000A;
const JST_8         = 0x000E;
const JST_9         = 0x0004;
const JST_STAR      = 0x0006;
const JST_POUND     = 0x0009;

const KEY_FLAG = 0x8000;
const SPACE_BAR = KEY_FLAG | 1;
const DIGIT_0 = KEY_FLAG | 2;
const DIGIT_1 = KEY_FLAG | 3;
const DIGIT_2 = KEY_FLAG | 4;
const DIGIT_3 = KEY_FLAG | 5;
const DIGIT_4 = KEY_FLAG | 6;
const DIGIT_5 = KEY_FLAG | 7;
const DIGIT_6 = KEY_FLAG | 8;
const DIGIT_7 = KEY_FLAG | 9;
const DIGIT_8 = KEY_FLAG | 10;
const DIGIT_9 = KEY_FLAG | 11;
const MINUS = KEY_FLAG | 12;
const EQUAL = KEY_FLAG | 13;

const BUTTONS = [
  {button: "a", cid: CIDS.A},
  {button: "b", cid: CIDS.B},
  {button: "x", cid: CIDS.X},
  {button: "y", cid: CIDS.Y},
  {button: "lb", cid: CIDS.LBUMP},
  {button: "rb", cid: CIDS.RBUMP},
  {button: "lt", cid: CIDS.LTRIG},
  {button: "rt", cid: CIDS.RTRIG},
];

const INPUTS = {
  "0": JST_0,
  "1": JST_1,
  "2": JST_2,
  "3": JST_3,
  "4": JST_4,
  "5": JST_5,
  "6": JST_6,
  "7": JST_7,
  "8": JST_8,
  "9": JST_9,
  "*": JST_STAR,
  "#": JST_POUND,
  "firel": JST_FIREL,
  "firer": JST_FIRER
}

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
      [KCODES.SPACE_BAR]: SPACE_BAR,
      [KCODES.DIGIT_0]: DIGIT_0,
      [KCODES.DIGIT_1]: DIGIT_1,
      [KCODES.DIGIT_2]: DIGIT_2,
      [KCODES.DIGIT_3]: DIGIT_3,
      [KCODES.DIGIT_4]: DIGIT_4,
      [KCODES.DIGIT_5]: DIGIT_5,
      [KCODES.DIGIT_6]: DIGIT_6,
      [KCODES.DIGIT_7]: DIGIT_7,
      [KCODES.DIGIT_8]: DIGIT_8,
      [KCODES.DIGIT_9]: DIGIT_9,
      [KCODES.MINUS]: MINUS,
      [KCODES.EQUAL]: EQUAL,
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

    // Set defaults if applicable
    if (Object.keys(app.mappings) === 0) {
      this.mappings = {
        "a": "firel",
        "b": "firer"
      }
    } else {
      this.mappings = app.mappings;
    }
  }

  JST_NONE      = JST_NONE;
  JST_KEYPAD    = JST_KEYPAD;
  JST_UP        = JST_UP;
  JST_RIGHT     = JST_RIGHT;
  JST_DOWN      = JST_DOWN;
  JST_LEFT      = JST_LEFT;
  JST_FIRER     = JST_FIRER;
  JST_FIREL     = JST_FIREL;
  JST_0         = JST_0;
  JST_1         = JST_1;
  JST_2         = JST_2;
  JST_3         = JST_3;
  JST_4         = JST_4;
  JST_5         = JST_5;
  JST_6         = JST_6;
  JST_7         = JST_7;
  JST_8         = JST_8;
  JST_9         = JST_9;
  JST_STAR      = JST_STAR;
  JST_POUND     = JST_POUND;

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
    this.keypadCount[index] = 10;
  }

  pollControls() {
    const { colemModule, controllers, keyToControlMapping, mappings } = this;

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
          // console.log(i + ", " + val);
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
          input |= JST_UP;
        } else if (controllers.isControlDown(i, CIDS.DOWN)) {
          input |= JST_DOWN;
        }

        if (controllers.isControlDown(i, CIDS.RIGHT)) {
          input |= JST_RIGHT;
        } else if (controllers.isControlDown(i, CIDS.LEFT)) {
          input |= JST_LEFT;
        }

        for (let b = 0; b < BUTTONS.length; b++) {
          const button = BUTTONS[b];
          if (controllers.isControlDown(i, button.cid)) {
            const mapping = mappings[button.button];
            if (mapping) {
              input |= INPUTS[mapping];
            }
          }
        }

        if (i === 0) {
          if (keyToControlMapping.isControlDown(DIGIT_0)) {
            input |= JST_0;
          } else if (keyToControlMapping.isControlDown(DIGIT_1)) {
            input |= JST_1;
          } else if (keyToControlMapping.isControlDown(DIGIT_2)) {
            input |= JST_2;
          } else if (keyToControlMapping.isControlDown(DIGIT_3)) {
            input |= JST_3;
          } else if (keyToControlMapping.isControlDown(DIGIT_4)) {
            input |= JST_4;
          } else if (keyToControlMapping.isControlDown(DIGIT_5)) {
            input |= JST_5;
          } else if (keyToControlMapping.isControlDown(DIGIT_6)) {
            input |= JST_6;
          } else if (keyToControlMapping.isControlDown(DIGIT_7)) {
            input |= JST_7;
          } else if (keyToControlMapping.isControlDown(DIGIT_8)) {
            input |= JST_8;
          } else if (keyToControlMapping.isControlDown(DIGIT_9)) {
            input |= JST_9;
          } else if (keyToControlMapping.isControlDown(MINUS)) {
            input |= JST_STAR;
          } else if (keyToControlMapping.isControlDown(EQUAL)) {
            input |= JST_POUND;
          }
        }
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

      // Set options
      Module._EmSetOpts(CV_SGM);

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

