const { normalizeAssistantEvent } = require("./assistant-events.cjs");

function registerAssistantIpc({ ipcMain, getControlWindow, getOverlayWindow }) {
  // A future Python transport should decode JSON and call this same entrypoint.
  function publishAssistantEvent(input) {
    const event = normalizeAssistantEvent(input);
    if (!event) return { ok: false, error: "Invalid assistant event." };

    const overlay = getOverlayWindow();
    if (!overlay || overlay.isDestroyed() || overlay.webContents.isLoadingMainFrame()) {
      return { ok: false, error: "Overlay is not ready." };
    }
    overlay.webContents.send("assistant:event", event);
    return { ok: true };
  }

  ipcMain.handle("assistant:publish", (ipcEvent, input) => {
    const control = getControlWindow();
    if (!control || control.isDestroyed() || ipcEvent.sender !== control.webContents) {
      return { ok: false, error: "Assistant simulations are only available in the editor." };
    }
    return publishAssistantEvent(input);
  });

  return publishAssistantEvent;
}

module.exports = { registerAssistantIpc };
