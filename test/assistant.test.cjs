const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAssistantEvent } = require("../src/assistant-events.cjs");
const { registerAssistantIpc } = require("../src/assistant-ipc.cjs");

const punish = { type: "punish", opponent: "Jin", move: "d+2", onBlock: -14, response: { character: "Bryan", move: "f,b+2" } };
const tip = { type: "matchup_tip", opponent: "King", move: "string", advice: "DUCK SECOND HIT" };
const throwBreak = { type: "throw_break", opponent: "King", breakInput: "1+2" };

test("all three JSON event types normalize with a default duration", () => {
  for (const event of [punish, tip, throwBreak]) {
    assert.deepEqual(normalizeAssistantEvent(JSON.parse(JSON.stringify(event))), { ...event, durationMs: 4000 });
  }
  for (const breakInput of ["1", "2", "1+2"]) {
    assert.ok(normalizeAssistantEvent({ ...throwBreak, breakInput }));
  }
});

test("invalid events are rejected at the main-process boundary", () => {
  const invalid = [
    null, [], "punish", {}, { ...tip, type: "unknown" },
    { ...tip, opponent: " " }, { ...tip, advice: "x".repeat(161) },
    { ...punish, onBlock: "-14" }, { ...punish, onBlock: 0 },
    { ...punish, onBlock: -14.5 }, { ...punish, response: null },
    { ...punish, response: { character: "Bryan" } },
    { ...throwBreak, breakInput: "3" },
    ...[0, 249, 10001, Infinity, "4000", null].map((durationMs) => ({ ...tip, durationMs })),
  ];
  for (const input of invalid) assert.equal(normalizeAssistantEvent(input), null);
});

test("normalization strips extra fields and makes an independent payload", () => {
  const input = { ...punish, opponent: " Jin ", response: { ...punish.response }, durationMs: 250, extra: "ignored" };
  const result = normalizeAssistantEvent(input);
  input.response.move = "changed";
  assert.deepEqual(result, { ...punish, durationMs: 250 });
});

function bridge() {
  const handlers = new Map();
  const sent = [];
  const control = { isDestroyed: () => false, webContents: {} };
  const overlay = {
    isDestroyed: () => false,
    webContents: { isLoadingMainFrame: () => false, send: (...args) => sent.push(args) },
  };
  const publish = registerAssistantIpc({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    getControlWindow: () => control,
    getOverlayWindow: () => overlay,
  });
  return { control, overlay, sent, publish, receive: handlers.get("assistant:publish") };
}

test("editor IPC forwards validated events to the overlay without touching combo state", () => {
  const { control, sent, receive } = bridge();
  for (const input of [punish, tip, throwBreak]) {
    assert.deepEqual(receive({ sender: control.webContents }, input), { ok: true });
  }
  assert.deepEqual(sent, [punish, tip, throwBreak].map((event) => ["assistant:event", { ...event, durationMs: 4000 }]));
});

test("invalid payloads, other renderers, and unavailable overlays do not broadcast", () => {
  const { control, overlay, sent, receive, publish } = bridge();
  assert.equal(receive({ sender: {} }, tip).ok, false);
  assert.equal(receive({ sender: control.webContents }, { ...tip, advice: "" }).ok, false);
  overlay.webContents.isLoadingMainFrame = () => true;
  assert.equal(publish(tip).ok, false);
  overlay.webContents.isLoadingMainFrame = () => false;
  overlay.isDestroyed = () => true;
  assert.equal(publish(tip).ok, false);
  assert.deepEqual(sent, []);
});

test("a future main-process transport can use the same publisher directly", () => {
  const { sent, publish } = bridge();
  assert.deepEqual(publish({ ...throwBreak, durationMs: 10000 }), { ok: true });
  assert.deepEqual(sent, [["assistant:event", { ...throwBreak, durationMs: 10000 }]]);
});
