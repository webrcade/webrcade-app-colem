import {
  AppWrapper,
  DisplayLoop,
  FetchAppData,
  ScriptAudioProcessor,
  Unzip,
  CIDS,
  LOG,
} from '@webrcade/app-common';

export class Emulator extends AppWrapper {
  constructor(app, debug = false) {
    super(app, debug);

    window.emulator = this;
    this.romBytes = null;
    this.romMd5 = null;
    this.romName = null;

    this.width = 272;
    this.height = 200;
  }

  createAudioProcessor() {
    return new ScriptAudioProcessor(1, 48000).setDebug(this.debug);
  }

  setRom(name, bytes, md5) {
    if (bytes.byteLength === 0) {
      throw new Error('The size is invalid (0 bytes).');
    }
    this.romName = name;
    this.romMd5 = md5;
    this.romBytes = bytes;
    LOG.info('name: ' + this.romName);
    LOG.info('md5: ' + this.romMd5);
  }

  async onShowPauseMenu() {
    await this.saveState();
  }

  pollControls() {
    const { controllers } = this;

    controllers.poll();

    for (let i = 0; i < 2; i++) {
      if (controllers.isControlDown(i, CIDS.ESCAPE)) {
        if (this.pause(true)) {
          controllers
            .waitUntilControlReleased(i, CIDS.ESCAPE)
            .then(() => this.showPauseMenu());
          return;
        }
      }
    }
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
            console.log(colemModule);
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

  async loadState() {
  }

  async saveState() {
  }

  async onStart(canvas) {
    const { app, debug, romBytes } =
    this;
    const Module = this.colemModule;
    const FS = Module.FS;

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
