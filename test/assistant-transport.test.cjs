const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { promisify } = require("node:util");
const { execFile } = require("node:child_process");
const { openAssistantTransport, MAX_MESSAGE_BYTES } = require("../src/assistant-transport.cjs");
const { registerAssistantIpc } = require("../src/assistant-ipc.cjs");

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "tekken-transport-test-"));
  const sent = [];
  const publishAssistantEvent = registerAssistantIpc({
    ipcMain: { handle() {} }, getControlWindow: () => null,
    getOverlayWindow: () => ({ isDestroyed: () => false, webContents: { isLoadingMainFrame: () => false, send: (...args) => sent.push(args) } }),
  });
  const connectionPath = path.join(directory, "connection.json");
  const transport = await openAssistantTransport({ connectionPath, publishAssistantEvent });
  t.after(async () => { await transport.close(); await fs.rmdir(directory); });
  return { ...transport, sent, connectionPath };
}

async function client(connection) {
  const socket = net.createConnection({ host: connection.host, port: connection.port });
  await once(socket, "connect");
  socket.setEncoding("utf8");
  return socket;
}

test("loopback transport handles fragmented UTF-8 and several messages in one packet", async (t) => {
  const { connection, sent } = await fixture(t);
  assert.equal(connection.host, "127.0.0.1");
  const socket = await client(connection);
  const event = { type: "matchup_tip", opponent: "King", move: "string", advice: "DUCK → SECOND HIT" };
  const message = Buffer.from(JSON.stringify({ token: connection.token, kind: "event", event }) + "\n");
  const split = message.indexOf(Buffer.from("→")) + 1;
  const replies = [];
  let pending = "";
  const done = new Promise((resolve) => socket.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split("\n"); pending = lines.pop();
    replies.push(...lines.map(JSON.parse));
    if (replies.length === 2) resolve();
  }));
  socket.write(message.subarray(0, split));
  socket.write(Buffer.concat([message.subarray(split), Buffer.from(JSON.stringify({ token: connection.token, kind: "ping" }) + "\n")]));
  await done;
  assert.deepEqual(replies, [{ ok: true }, { ok: true }]);
  assert.deepEqual(sent, [["assistant:event", { ...event, durationMs: 4000 }]]);
  socket.destroy();
});

test("unauthorized and oversized messages cannot reach the publisher", async (t) => {
  const { connection, sent } = await fixture(t);
  const unauthorized = await client(connection);
  const result = once(unauthorized, "data");
  unauthorized.write(JSON.stringify({ token: "wrong", kind: "event", event: {} }) + "\n");
  assert.equal(JSON.parse((await result)[0]).ok, false);
  unauthorized.destroy();
  const oversized = await client(connection);
  const close = once(oversized, "close");
  oversized.write("x".repeat(MAX_MESSAGE_BYTES + 1));
  await close;
  assert.deepEqual(sent, []);
});

test("malformed JSON and invalid event contracts are rejected without broadcasting", async (t) => {
  const { connection, sent } = await fixture(t);
  for (const message of ["{invalid", JSON.stringify({ token: connection.token, kind: "event", event: { type: "throw_break", opponent: "King", breakInput: "3" } })]) {
    const socket = await client(connection);
    const result = once(socket, "data");
    socket.write(message + "\n");
    assert.equal(JSON.parse((await result)[0]).ok, false);
    socket.destroy();
  }
  assert.deepEqual(sent, []);
});

test("the Python test command sends all three events through the existing Electron publisher", async (t) => {
  const { connectionPath, sent } = await fixture(t);
  const { stdout } = await promisify(execFile)(process.env.TEKKEN_ASSISTANT_PYTHON || "python", ["assistant/main.py", "test-events", "--connection", connectionPath, "--interval", "0"], { cwd: path.join(__dirname, ".."), windowsHide: true });
  assert.match(stdout, /Sent punish/);
  assert.match(stdout, /Sent matchup_tip/);
  assert.match(stdout, /Sent throw_break/);
  assert.deepEqual(sent.map(([channel, event]) => [channel, event.type]), [["assistant:event", "punish"], ["assistant:event", "matchup_tip"], ["assistant:event", "throw_break"]]);
  assert.deepEqual(sent[0][1].response, { character: "Bryan", move: "f,b+2" });
});

test("closing the transport removes discovery credentials and closes connected clients", async (t) => {
  const { connection, connectionPath, close } = await fixture(t);
  const socket = await client(connection);
  const disconnected = once(socket, "close");
  await close();
  await disconnected;
  await assert.rejects(fs.access(connectionPath), { code: "ENOENT" });
});
