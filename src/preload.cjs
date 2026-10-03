const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("comboOverlay", {
  getState: () => ipcRenderer.invoke("state:get"),
  setState: (patch) => ipcRenderer.send("state:set", patch),
  quit: () => ipcRenderer.send("app:quit"),
  sendAssistantEvent: (event) => ipcRenderer.invoke("assistant:publish", event),
  startAssistant: () => ipcRenderer.invoke("assistant:start"),
  stopAssistant: () => ipcRenderer.invoke("assistant:stop"),
  getAssistantStatus: () => ipcRenderer.invoke("assistant:status:get"),
  onAssistantStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("assistant:status", handler);
    return () => ipcRenderer.removeListener("assistant:status", handler);
  },
  onAssistantEvent: (callback) => {
    const handler = (_event, event) => callback(event);
    ipcRenderer.on("assistant:event", handler);
    return () => ipcRenderer.removeListener("assistant:event", handler);
  },
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("state:update", handler);
    return () => ipcRenderer.removeListener("state:update", handler);
  },
});
