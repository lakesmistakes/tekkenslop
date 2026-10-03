const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { registerAssistantIpc } = require("../src/assistant-ipc.cjs");

test("the overlay never captures clicks at startup, through IPC, or after visibility changes", async () => {
  const windows = [];
  const listeners = new Map();
  const handlers = new Map();
  const shortcuts = new Map();

  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.mouseCalls = [];
      this.visible = true;
      this.webContents = { send() {} };
      windows.push(this);
    }
    loadFile() {}
    on() {}
    isDestroyed() { return false; }
    setIgnoreMouseEvents(...args) { this.mouseCalls.push(args); }
    setAlwaysOnTop() {}
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
  }

  const electron = {
    app: { whenReady: () => Promise.resolve(), on() {}, quit() {}, getPath: () => "unused-in-this-test" },
    BrowserWindow,
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      on: (channel, listener) => listeners.set(channel, listener),
    },
    screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
    globalShortcut: { register: (key, callback) => shortcuts.set(key, callback), unregisterAll() {} },
  };
  const mainPath = path.join(__dirname, "../src/main.cjs");
  vm.runInNewContext(fs.readFileSync(mainPath, "utf8"), {
    __dirname: path.dirname(mainPath),
    process: { platform: "win32", env: {} },
    require: (name) => {
      if (name === "electron") return electron;
      if (name === "path") return path;
      if (name === "./assistant-ipc.cjs") return { registerAssistantIpc };
      if (name === "./assistant-service.cjs") return { createAssistantService: () => ({ getStatus: () => ({}) }) };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  await Promise.resolve();

  const overlay = windows.find((window) => window.options.transparent);
  assert.ok(overlay);
  assert.equal(overlay.mouseCalls[0][0], true);

  const update = listeners.get("state:set");
  update({}, { clickThrough: false, notation: "df+2", opacity: 75 });
  const state = handlers.get("state:get")();
  assert.equal(state.clickThrough, true);
  assert.equal(state.notation, "df+2");
  assert.equal(state.opacity, 75);

  update({}, { overlayVisible: false, clickThrough: false });
  assert.equal(overlay.visible, false);
  update({}, { overlayVisible: true, clickThrough: false });
  assert.equal(overlay.visible, true);
  const toggle = shortcuts.get("CommandOrControl+Shift+F12");
  toggle();
  assert.equal(overlay.visible, false);
  toggle();
  assert.equal(overlay.visible, true);
  assert.ok(overlay.mouseCalls.every(([ignore, options]) => ignore === true && options.forward === true));
});
