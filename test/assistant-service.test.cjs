const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createAssistantService } = require("../src/assistant-service.cjs");

async function fixture(t, { ignoreStop = false } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tekken-service-test-"));
  const processes = [];
  const service = createAssistantService({
    connectionPath: path.join(directory, "connection.json"), scriptPath: path.join(__dirname, "../assistant/main.py"),
    pythonPath: "test-python", onStatus() {}, publishAssistantEvent: () => ({ ok: true }),
    spawnProcess(executable, args, options) {
      const child = new EventEmitter();
      child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.kill = () => { child.killed = true; child.emit("close", 1); };
      child.stdin.on("data", (data) => { child.stopCommand = JSON.parse(data); });
      child.stdin.on("finish", () => { if (!ignoreStop) child.emit("close", 0); });
      processes.push({ child, executable, args, options });
      return child;
    },
  });
  t.after(async () => { await service.dispose(); await fs.rmdir(directory); });
  return { service, processes };
}

test("duplicate starts launch one hidden Python process and capture status is reported", async (t) => {
  const { service, processes } = await fixture(t);
  await Promise.all([service.start(), service.start()]);
  assert.equal(processes.length, 1);
  const { child, executable, args, options } = processes[0];
  assert.equal(executable, "test-python");
  assert.ok(args.includes("capture"));
  assert.equal(options.windowsHide, true);
  assert.equal(options.shell, false);
  child.stdout.write('not JSON\n{"type":"status","capture":"connected"}\n');
  child.stdout.write('{"type":"status","capture":"capturing","fps":59.5,"width":1920,"height":1080}\n');
  assert.equal(service.getStatus().state, "running");
  assert.equal(service.getStatus().connected, true);
  assert.equal(service.getStatus().fps, 59.5);
  await Promise.all([service.stop(), service.stop()]);
  assert.deepEqual(child.stopCommand, { command: "stop" });
  assert.equal(service.getStatus().state, "stopped");
  assert.equal(service.getStatus().canStart, true);
  await service.start();
  assert.equal(processes.length, 2);
});

test("Python dependency errors and unexpected exits remain visible and allow restart", async (t) => {
  const { service, processes } = await fixture(t);
  await service.start();
  processes[0].child.stdout.write('{"type":"status","capture":"error","error":"Missing dxcam"}\n');
  processes[0].child.emit("close", 1);
  assert.equal(service.getStatus().state, "error");
  assert.equal(service.getStatus().error, "Missing dxcam");
  assert.equal(service.getStatus().connected, false);
  assert.equal(service.getStatus().canStart, true);
  await service.start();
  processes[1].child.stderr.write("Capture device failed");
  processes[1].child.emit("close", 2);
  assert.match(service.getStatus().error, /Capture device failed/);
});

test("stopping a starting sidecar releases it, with forced termination for a hung process", async (t) => {
  const { service, processes } = await fixture(t, { ignoreStop: true });
  const started = service.start();
  const stopped = service.stop();
  await Promise.all([started, stopped]);
  assert.equal(processes[0].child.killed, true);
  assert.equal(service.getStatus().state, "stopped");
});

test("spawn failures do not leave an indefinitely starting assistant", async (t) => {
  const { service, processes } = await fixture(t);
  await service.start();
  const error = Object.assign(new Error("python not found"), { code: "ENOENT" });
  processes[0].child.emit("error", error);
  processes[0].child.emit("close", -2);
  assert.equal(service.getStatus().state, "error");
  assert.equal(service.getStatus().canStart, true);
  assert.match(service.getStatus().error, /python not found/);
});
