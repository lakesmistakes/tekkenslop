const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");
const { openAssistantTransport } = require("./assistant-transport.cjs");

function createAssistantService({ scriptPath, connectionPath, publishAssistantEvent, onStatus, pythonPath, spawnProcess = spawn }) {
  let child = null;
  let closed = null;
  let starting = null;
  let stopping = null;
  let transport = null;
  let transportError = "";
  let disposing = false;
  let status = { state: "stopped", connected: false, capture: "idle", fps: 0, width: 0, height: 0, error: "" };
  const getStatus = () => ({ ...status, canStart: !child && !starting && !stopping && !disposing && status.state !== "starting", canStop: !!child && !stopping });
  const update = (patch) => { status = { ...status, ...patch }; onStatus(getStatus()); };
  const ready = openAssistantTransport({ connectionPath, publishAssistantEvent })
    .then((value) => { transport = value; return true; })
    .catch((error) => { transportError = `Local transport: ${error.message}`; update({ state: "error", error: transportError }); return false; });

  function forceKill(processChild) {
    // Windows venv launchers can have an interpreter child. Terminate only the
    // process tree owned by this service, rather than leaving capture behind.
    if (process.platform === "win32" && Number.isInteger(processChild.pid)) {
      const killer = spawn("taskkill", ["/PID", String(processChild.pid), "/T", "/F"], { windowsHide: true, shell: false, stdio: "ignore" });
      killer.once("error", () => processChild.kill());
    } else processChild.kill();
  }

  function start() {
    if (starting) return starting;
    if (child || stopping || disposing) return Promise.resolve(getStatus());
    starting = (async () => {
      update({ state: "starting", capture: "starting", connected: false, error: "", fps: 0, width: 0, height: 0 });
      if (!await ready) { update({ state: "error", capture: "error", error: transportError }); return getStatus(); }
      if (disposing) return getStatus();
      const venvPython = path.join(path.dirname(scriptPath), "..", ".venv", "Scripts", "python.exe");
      const executable = pythonPath || (fs.existsSync(venvPython) ? venvPython : "python");
      const args = ["-u", scriptPath, "capture", "--connection", connectionPath];
      for (const [flag, variable] of [["--output", "TEKKEN_CAPTURE_OUTPUT"], ["--device", "TEKKEN_CAPTURE_DEVICE"], ["--fps", "TEKKEN_CAPTURE_FPS"]]) {
        if (process.env[variable]) args.push(flag, process.env[variable]);
      }
      try {
        child = spawnProcess(executable, args, {
          windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, TEKKEN_ASSISTANT_CONNECTION_DATA: JSON.stringify(transport.connection) },
        });
      } catch (error) {
        update({ state: "error", capture: "error", error: `Could not launch Python: ${error.message}` });
        return getStatus();
      }
      const processChild = child;
      let stderr = "";
      const startupTimer = setTimeout(() => {
        update({ state: "error", capture: "error", error: "Python capture did not become ready within 15 seconds." });
        forceKill(processChild);
      }, 15000);
      processChild.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-1500); });
      processChild.stdin.on("error", () => {});
      const lines = createInterface({ input: processChild.stdout });
      lines.on("line", (line) => {
        if (line.length > 8192 || stopping || status.state === "error") return;
        let message;
        try { message = JSON.parse(line); } catch { return; }
        if (message?.type !== "status") return;
        if (message.capture === "connected") update({ connected: true });
        else if (["capturing", "waiting"].includes(message.capture)) {
          clearTimeout(startupTimer);
          const size = (value) => Number.isInteger(value) && value > 0 && value <= 32768 ? value : 0;
          update({ state: "running", connected: true, capture: message.capture, width: size(message.width), height: size(message.height), fps: Number.isFinite(message.fps) ? Math.max(0, Math.min(240, message.fps)) : 0 });
        } else if (message.capture === "error") {
          clearTimeout(startupTimer);
          update({ state: "error", capture: "error", error: String(message.error || "Python capture failed.").slice(0, 500) });
        }
      });
      processChild.once("error", (error) => update({ state: "error", capture: "error", error: `Could not launch Python: ${error.message}` }));
      closed = new Promise((resolve) => processChild.once("close", (code) => {
        clearTimeout(startupTimer);
        lines.close();
        child = null;
        if (stopping) update({ state: "stopped", connected: false, capture: "idle", fps: 0, width: 0, height: 0, error: "" });
        else update({ state: "error", connected: false, capture: "error", error: status.error || stderr.trim().slice(-500) || `Python exited unexpectedly (${code}).` });
        resolve();
      }));
      return getStatus();
    })().finally(() => { starting = null; onStatus(getStatus()); });
    return starting;
  }

  function stop() {
    if (stopping) return stopping;
    // Delay one microtask so the stopping flag is set before child callbacks run.
    stopping = Promise.resolve().then(async () => {
      if (starting) await starting;
      if (child) {
        update({ state: "stopping" });
        const processChild = child;
        const killTimer = setTimeout(() => forceKill(processChild), 2000);
        processChild.stdin.end(`${JSON.stringify({ command: "stop" })}\n`);
        await closed;
        clearTimeout(killTimer);
      }
      update({ state: "stopped", connected: false, capture: "idle", fps: 0, width: 0, height: 0, error: "" });
    }).finally(() => { stopping = null; onStatus(getStatus()); });
    return stopping;
  }

  return {
    getStatus, start, stop,
    async dispose() {
      disposing = true;
      await stop();
      await ready;
      if (transport) await transport.close();
    },
  };
}

module.exports = { createAssistantService };
