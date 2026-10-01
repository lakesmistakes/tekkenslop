export const assistantDemos = [
  {
    label: "Jin d+2 blocked → -14 → Bryan f,b+2",
    event: { type: "punish", opponent: "Jin", move: "d+2", onBlock: -14, response: { character: "Bryan", move: "f,b+2" } },
  },
  {
    label: "King string → DUCK SECOND HIT",
    event: { type: "matchup_tip", opponent: "King", move: "string", advice: "DUCK SECOND HIT" },
  },
  {
    label: "King throw → 1+2 BREAK",
    event: { type: "throw_break", opponent: "King", breakInput: "1+2" },
  },
];

function notificationText(event) {
  switch (event.type) {
    case "punish":
      return { label: "Punish", context: `${event.opponent} ${event.move} blocked · ${event.onBlock}`, action: `${event.response.character} ${event.response.move}` };
    case "matchup_tip":
      return { label: "Matchup tip", context: `${event.opponent} ${event.move}`, action: event.advice };
    case "throw_break":
      return { label: "Throw break", context: `${event.opponent} throw`, action: `${event.breakInput} BREAK` };
  }
}

export class AssistantHud {
  constructor() {
    this.event = null;
    this.expiresAt = 0;
    this.timer = null;
  }

  show(event) {
    clearTimeout(this.timer);
    this.event = event;
    this.expiresAt = Date.now() + event.durationMs;
    this.render();
    this.timer = setTimeout(() => {
      this.event = null;
      this.render();
    }, event.durationMs);
  }

  // Combo state updates rebuild the overlay DOM; retain the cue and its deadline.
  render() {
    const host = document.getElementById("assistant-hud");
    if (!host) return;
    host.replaceChildren();
    host.hidden = !this.event || Date.now() >= this.expiresAt;
    if (host.hidden) return;

    const text = notificationText(this.event);
    host.dataset.type = this.event.type;
    for (const [name, value] of Object.entries(text)) {
      const line = document.createElement(name === "action" ? "strong" : "div");
      line.className = `assistant-${name}`;
      line.textContent = value;
      host.append(line);
    }
  }
}
