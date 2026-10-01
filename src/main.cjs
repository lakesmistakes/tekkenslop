const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const path = require("path");

let controlWindow;
let overlayWindow;

const overlayState = {
  notation:
    '"EWGF x3" > f,n,d,df+2 > tornado > dash > sprint > hb > wb > F,F+2',
  opacity: 92,
  scale: 100,
  clickThrough: true,
  alwaysOnTop: true,
  overlayVisible: true,
  position: "top",
};

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 940,
    minHeight: 640,
    title: "Tekken 8 Combo Overlay",
    backgroundColor: "#10151f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  controlWindow.loadFile(path.join(__dirname, "..", "index.html"), {
    query: { window: "control" },
  });

  controlWindow.on("closed", () => {
    controlWindow = null;
    app.quit();
  });
}

function createOverlayWindow() {
  const primary = screen.getPrimaryDisplay().workArea;

  overlayWindow = new BrowserWindow({
    x: primary.x,
    y: primary.y,
    width: primary.width,
    height: primary.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: overlayState.alwaysOnTop,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "Tekken 8 Combo Overlay Display",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setIgnoreMouseEvents(overlayState.clickThrough, { forward: true });
  overlayWindow.setAlwaysOnTop(overlayState.alwaysOnTop, "screen-saver");
  overlayWindow.loadFile(path.join(__dirname, "..", "index.html"), {
    query: { window: "overlay" },
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function applyOverlayWindowState() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.setIgnoreMouseEvents(overlayState.clickThrough, { forward: true });
  overlayWindow.setAlwaysOnTop(overlayState.alwaysOnTop, "screen-saver");
  if (overlayState.overlayVisible) overlayWindow.showInactive();
  else overlayWindow.hide();
}

function broadcastState() {
  for (const win of [controlWindow, overlayWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("state:update", overlayState);
    }
  }
}

app.whenReady().then(() => {
  createControlWindow();
  createOverlayWindow();
  globalShortcut.register("CommandOrControl+Shift+F12", () => {
    overlayState.overlayVisible = !overlayState.overlayVisible;
    applyOverlayWindowState();
    broadcastState();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
      createOverlayWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("state:get", () => overlayState);

ipcMain.on("state:set", (_event, patch) => {
  Object.assign(overlayState, patch);
  applyOverlayWindowState();
  broadcastState();
});

ipcMain.on("app:quit", () => {
  app.quit();
});
