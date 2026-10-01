/**
 * JSON event contract for developer simulations and a future Python adapter.
 * @typedef {{character: string, move: string}} PunishResponse
 * @typedef {{type: "punish", opponent: string, move: string, onBlock: number, response: PunishResponse, durationMs?: number} |
 * {type: "matchup_tip", opponent: string, move: string, advice: string, durationMs?: number} |
 * {type: "throw_break", opponent: string, breakInput: "1" | "2" | "1+2", durationMs?: number}} AssistantEvent
 */

const DEFAULT_DURATION_MS = 4000;

function isText(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 160;
}

/** Validate untrusted input and copy only contract fields. Returns null on failure. */
function normalizeAssistantEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (!isText(input.opponent)) return null;

  const durationMs = input.durationMs === undefined ? DEFAULT_DURATION_MS : input.durationMs;
  if (!Number.isInteger(durationMs) || durationMs < 250 || durationMs > 10000) return null;
  const base = { type: input.type, opponent: input.opponent.trim(), durationMs };

  switch (input.type) {
    case "punish":
      if (!isText(input.move) || !Number.isInteger(input.onBlock) || input.onBlock >= 0 || input.onBlock < -99) return null;
      if (!isText(input.response?.character) || !isText(input.response?.move)) return null;
      return {
        ...base,
        move: input.move.trim(),
        onBlock: input.onBlock,
        response: { character: input.response.character.trim(), move: input.response.move.trim() },
      };
    case "matchup_tip":
      if (!isText(input.move) || !isText(input.advice)) return null;
      return { ...base, move: input.move.trim(), advice: input.advice.trim() };
    case "throw_break":
      if (!["1", "2", "1+2"].includes(input.breakInput)) return null;
      return { ...base, breakInput: input.breakInput };
    default:
      return null;
  }
}

module.exports = { DEFAULT_DURATION_MS, normalizeAssistantEvent };
