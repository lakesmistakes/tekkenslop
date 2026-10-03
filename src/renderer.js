import { AssistantHud, assistantDemos } from "./assistant-hud.js";
import { createAssistantControls } from "./assistant-controls.js";

const params = new URLSearchParams(window.location.search);
const mode = params.get("window") === "overlay" ? "overlay" : "control";
const assistantHud = mode === "overlay" ? new AssistantHud() : null;
const assistantControls = mode === "control" ? createAssistantControls(window.comboOverlay) : null;

const directions = {
  ub: "↖",
  u: "↑",
  uf: "↗",
  b: "←",
  n: "•",
  f: "→",
  db: "↙",
  d: "↓",
  df: "↘",
};

const numpadDirections = {
  "7": "ub",
  "8": "u",
  "9": "uf",
  "4": "b",
  "5": "n",
  "6": "f",
  "1": "db",
  "2": "d",
  "3": "df",
};

const attacks = {
  "1": [1],
  "2": [2],
  "3": [3],
  "4": [4],
  lp: [1],
  rp: [2],
  lk: [3],
  rk: [4],
};

const properties = {
  t: { label: "Tornado", className: "tornado", asset: "tornado" },
  tornado: { label: "Tornado", className: "tornado", asset: "tornado" },
  hb: { label: "Heat Burst", className: "heat" },
  heatburst: { label: "Heat Burst", className: "heat" },
  hd: { label: "Heat Dash", className: "heat", asset: "heatdash" },
  heatdash: { label: "Heat Dash", className: "heat", asset: "heatdash" },
  he: { label: "Heat Engager", className: "heat" },
  heatengager: { label: "Heat Engager", className: "heat" },
  wb: { label: "Wall Break", className: "break", asset: "wallbreak" },
  wbr: { label: "Wall Break", className: "break", asset: "wallbreak" },
  wallbreak: { label: "Wall Break", className: "break", asset: "wallbreak" },
  wbl: { label: "Wall Blast", className: "break", asset: "wallblast" },
  wallblast: { label: "Wall Blast", className: "break", asset: "wallblast" },
  fb: { label: "Floor Break", className: "break", asset: "floorbreak" },
  fbr: { label: "Floor Break", className: "break", asset: "floorbreak" },
  floorbreak: { label: "Floor Break", className: "break", asset: "floorbreak" },
  fbl: { label: "Floor Blast", className: "break", asset: "floorblast" },
  floorblast: { label: "Floor Blast", className: "break", asset: "floorblast" },
  bb: { label: "Balcony Break", className: "break", asset: "balconybreak" },
  balconybreak: { label: "Balcony Break", className: "break", asset: "balconybreak" },
  dash: { label: "Dash", className: "dash", icon: "↗" },
  ss: { label: "Sidestep", className: "move", icon: "↕" },
  sprint: { label: "Sprint", className: "sprint", icon: "⇥" },
};

const samples = [
  '"EWGF x3" > f,n,d,df+2 > tornado > dash > sprint > hb > wb > F,F+2',
  '"Fujin route" df+2 > f+3,1 > tornado > dash > 2,3 > wallbreak > d,df+1+2',
  '"Heat sample" 1,1 > heatburst > F+4 > heatdash > sprint > df+2',
];

function normalizeRawToken(raw) {
  return raw.trim().replace(/\s+/g, "").toLowerCase();
}

function splitNotation(input) {
  const tokens = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== "\\") {
      quoted = !quoted;
      current += char;
      continue;
    }

    if (!quoted && (char === "," || char === ">")) {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(">");
      current = "";
      continue;
    }

    if (!quoted && /\s/.test(char)) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseToken(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === ">") return { type: "separator" };
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return { type: "text", value: trimmed.slice(1, -1).replace(/\\"/g, '"') };
  }

  const hold = /[A-Z]|\*/.test(trimmed);
  const token = normalizeRawToken(trimmed).replace(/\*/g, "");

  if (properties[token]) {
    return { type: "property", ...properties[token] };
  }

  const parts = token.split("+").filter(Boolean);
  const directionParts = [];
  const attackButtons = [];

  for (const part of parts) {
    if (attacks[part]) {
      attackButtons.push(...attacks[part]);
      continue;
    }

    const direction = directions[part] ? part : numpadDirections[part];
    if (direction) {
      directionParts.push(direction);
      continue;
    }

    if (/^[1-4]{2,4}$/.test(part)) {
      attackButtons.push(...part.split("").map(Number));
      continue;
    }

    return { type: "text", value: trimmed };
  }

  if (directionParts.length || attackButtons.length) {
    return { type: "input", directions: directionParts, attacks: attackButtons, hold };
  }

  return { type: "text", value: trimmed };
}

function parseNotation(input) {
  return splitNotation(input).map(parseToken).filter(Boolean);
}

function attackMarkup(buttons) {
  const assetName = [...new Set(buttons)].sort().join("");
  return `<img class="notation-img attack-img" src="./src/assets/${assetName}.webp" alt="${assetName}">`;
}

function tokenMarkup(token) {
  if (token.type === "separator") {
    return `<img class="notation-img sep-img" src="./src/assets/next.webp" alt="next">`;
  }

  if (token.type === "text") {
    return `<span class="word-chip">${escapeHtml(token.value)}</span>`;
  }

  if (token.type === "property") {
    if (token.asset) {
      return `<img class="notation-img property-img" src="./src/assets/${token.asset}.webp" alt="${escapeHtml(token.label)}">`;
    }
    const icon = token.icon ? `<span class="property-icon">${token.icon}</span>` : "";
    return `<span class="property-chip ${token.className}">${icon}${escapeHtml(token.label)}</span>`;
  }

  const direction = token.directions
    .map((dir) => {
      const asset = token.hold && dir !== "n" ? `${dir}_h` : dir;
      return `<img class="notation-img direction-img" src="./src/assets/${asset}.webp" alt="${dir}${token.hold ? " hold" : ""}">`;
    })
    .join("");
  const attacksMarkup = token.attacks.length ? attackMarkup(token.attacks) : "";
  const hold = token.hold ? `<span class="hold-mark">HOLD</span>` : "";
  return `<span class="input-chip">${hold}${direction}${attacksMarkup}</span>`;
}

function renderNotation(input) {
  return `<div class="combo-line">${parseNotation(input).map(tokenMarkup).join("")}</div>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function movementButton(value, label = value) {
  return `<button class="palette-button" data-insert="${value}">${label}</button>`;
}

function renderControl(state) {
  document.body.className = "control-body";
  document.getElementById("app").innerHTML = `
    <main class="control-shell">
      <section class="editor-pane">
        <div class="app-title">
          <div class="mark">T8</div>
          <div>
            <h1>Combo Overlay</h1>
            <p>Tekken-style notation editor with a live transparent game overlay.</p>
          </div>
        </div>

        <label class="field-label" for="notation">Combo notation</label>
        <textarea id="notation" spellcheck="false">${escapeHtml(state.notation)}</textarea>

        <div class="toolbar">
          ${samples
            .map((sample, index) => `<button data-sample="${index}">Sample ${index + 1}</button>`)
            .join("")}
          <button data-clear>Clear</button>
          <button data-toggle-overlay>${state.overlayVisible ? "Hide Overlay" : "Show Overlay"}</button>
          <button data-quit>Exit App</button>
        </div>

        <div class="preview-card">
          <div class="preview-header">
            <span>Overlay Preview</span>
            <span>${parseNotation(state.notation).length} blocks</span>
          </div>
          <div class="overlay-preview">${renderNotation(state.notation)}</div>
        </div>

        <section class="assistant-test-panel" aria-labelledby="assistant-title">
          <h2 id="assistant-title">Training assistant</h2>
          <p class="pane-note">Local screen capture only. Move recognition is not enabled.</p>
          <div class="toolbar assistant-actions">
            <button id="assistant-start" disabled>Start Assistant</button>
            <button id="assistant-stop" disabled>Stop Assistant</button>
          </div>
          <div class="assistant-process-status" role="status" aria-live="polite">
            <p>Python: <span id="assistant-python-status"></span></p>
            <p>Capture: <span id="assistant-capture-status"></span></p>
            <p id="assistant-process-error"></p>
          </div>
        </section>

        <section class="assistant-test-panel" aria-labelledby="assistant-test-title">
          <h2 id="assistant-test-title">Developer assistant test</h2>
          <p class="pane-note">Simulate a training cue on the overlay. Each lasts 4 seconds; a new cue replaces the previous one.</p>
          <div class="assistant-test-buttons">
            ${assistantDemos.map((demo, index) => `<button data-assistant-demo="${index}">${escapeHtml(demo.label)}</button>`).join("")}
          </div>
          <p id="assistant-test-status" class="pane-note" role="status"></p>
        </section>
      </section>

      <aside class="palette-pane">
        <section>
          <h2>Movement</h2>
          <p class="pane-note">Regular and HOLD inputs are both visible.</p>
          <div class="numpad-grid">
            ${movementButton("ub", "↖")}
            ${movementButton("u", "↑")}
            ${movementButton("uf", "↗")}
            ${movementButton("b", "←")}
            ${movementButton("n", "•")}
            ${movementButton("f", "→")}
            ${movementButton("db", "↙")}
            ${movementButton("d", "↓")}
            ${movementButton("df", "↘")}
          </div>
          <div class="numpad-grid hold-grid">
            ${movementButton("UB", "H ↖")}
            ${movementButton("U", "H ↑")}
            ${movementButton("UF", "H ↗")}
            ${movementButton("B", "H ←")}
            ${movementButton("N", "H •")}
            ${movementButton("F", "H →")}
            ${movementButton("DB", "H ↙")}
            ${movementButton("D", "H ↓")}
            ${movementButton("DF", "H ↘")}
          </div>
        </section>

        <section>
          <h2>Buttons</h2>
          <div class="button-grid">
            ${["1", "2", "3", "4", "1+2", "3+4", "1+4", "2+3", "1+2+3+4"]
              .map((value) => `<button class="palette-button button-token" data-insert="${value}">${attackMarkup(value.split("+").map(Number))}</button>`)
              .join("")}
          </div>
        </section>

        <section>
          <h2>Properties</h2>
          <div class="property-grid">
            ${[
              ["tornado", "Tornado"],
              ["heatburst", "Heat Burst"],
              ["heatdash", "Heat Dash"],
              ["heatengager", "Heat Engager"],
              ["wallbreak", "Wall Break"],
              ["wallblast", "Wall Blast"],
              ["floorbreak", "Floor Break"],
              ["balconybreak", "Balcony Break"],
              ["dash", "Dash"],
              ["sprint", "Sprint"],
            ]
              .map(([value, label]) => `<button class="palette-button" data-insert="${value}">${label}</button>`)
              .join("")}
          </div>
        </section>

        <section>
          <h2>Overlay</h2>
          <div class="setting-row">
            <label for="opacity">Opacity</label>
            <input id="opacity" type="range" min="40" max="100" value="${state.opacity}">
          </div>
          <div class="setting-row">
            <label for="scale">Scale</label>
            <input id="scale" type="range" min="70" max="150" value="${state.scale}">
          </div>
          <div class="segmented">
            ${["top", "center", "bottom"]
              .map((position) => `<button class="${state.position === position ? "active" : ""}" data-position="${position}">${position}</button>`)
              .join("")}
          </div>
          <p class="pane-note">The overlay always lets mouse clicks pass through. Use this editor to change it.</p>
          <label class="check-row">
            <input id="overlayVisible" type="checkbox" ${state.overlayVisible ? "checked" : ""}>
            Show overlay
          </label>
          <label class="check-row">
            <input id="alwaysOnTop" type="checkbox" ${state.alwaysOnTop ? "checked" : ""}>
            Keep overlay on top
          </label>
          <p class="pane-note shortcut-note">Ctrl+Shift+F12 toggles the overlay from anywhere.</p>
        </section>
      </aside>
    </main>
  `;

  bindControlEvents();
}

function renderOverlay(state) {
  document.body.className = "overlay-body";
  document.documentElement.className = "overlay-root";
  document.getElementById("app").innerHTML = `
    <main class="overlay-stage overlay-${state.position}" style="--overlay-opacity:${state.opacity / 100}; --overlay-scale:${state.scale / 100}">
      <section class="game-overlay">
        ${renderNotation(state.notation)}
        <div id="assistant-hud" class="assistant-hud" role="status" aria-live="polite" aria-atomic="true" hidden></div>
      </section>
    </main>
  `;
  assistantHud.render();
}

function bindControlEvents() {
  assistantControls.bind();
  document.querySelectorAll("[data-assistant-demo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = document.getElementById("assistant-test-status");
      try {
        const result = await window.comboOverlay.sendAssistantEvent(assistantDemos[Number(button.dataset.assistantDemo)].event);
        status.textContent = result.ok
          ? (document.getElementById("overlayVisible").checked ? "Cue sent to overlay." : "Cue sent. Show the overlay to see it before it expires.")
          : result.error;
      } catch {
        status.textContent = "Could not send the assistant cue.";
      }
    });
  });

  const notation = document.getElementById("notation");
  notation.addEventListener("input", () => setState({ notation: notation.value }));

  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
      insertAtCursor(notation, button.dataset.insert);
      setState({ notation: notation.value });
    });
  });

  document.querySelectorAll("[data-sample]").forEach((button) => {
    button.addEventListener("click", () => setState({ notation: samples[Number(button.dataset.sample)] }));
  });

  document.querySelector("[data-clear]").addEventListener("click", () => setState({ notation: "" }));
  document.querySelector("[data-toggle-overlay]").addEventListener("click", () => setState({ overlayVisible: !document.getElementById("overlayVisible").checked }));
  document.querySelector("[data-quit]").addEventListener("click", () => window.comboOverlay.quit());
  document.getElementById("opacity").addEventListener("input", (event) => setState({ opacity: Number(event.target.value) }));
  document.getElementById("scale").addEventListener("input", (event) => setState({ scale: Number(event.target.value) }));
  document.getElementById("overlayVisible").addEventListener("change", (event) => setState({ overlayVisible: event.target.checked }));
  document.getElementById("alwaysOnTop").addEventListener("change", (event) => setState({ alwaysOnTop: event.target.checked }));
  document.querySelectorAll("[data-position]").forEach((button) => {
    button.addEventListener("click", () => setState({ position: button.dataset.position }));
  });
}

function insertAtCursor(textarea, value) {
  const spacer = textarea.value && !/\s$/.test(textarea.value.slice(0, textarea.selectionStart)) ? " " : "";
  const insert = `${spacer}${value} `;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, start) + insert + textarea.value.slice(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + insert.length;
}

function setState(patch) {
  window.comboOverlay.setState(patch);
}

window.comboOverlay.onState((state) => {
  if (mode === "overlay") renderOverlay(state);
  else renderControl(state);
});

if (assistantHud) {
  const unsubscribe = window.comboOverlay.onAssistantEvent((event) => assistantHud.show(event));
  window.addEventListener("beforeunload", () => unsubscribe(), { once: true });
}

window.comboOverlay.getState().then((state) => {
  if (mode === "overlay") renderOverlay(state);
  else renderControl(state);
});
