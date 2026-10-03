export function createAssistantControls(api) {
  let status = null;

  function render() {
    const start = document.getElementById("assistant-start");
    if (!start) return;
    start.disabled = !status?.canStart;
    document.getElementById("assistant-stop").disabled = !status?.canStop;
    document.getElementById("assistant-python-status").textContent = status
      ? `${status.state} · ${status.connected ? "connected to Electron" : "disconnected"}` : "Loading status…";
    document.getElementById("assistant-capture-status").textContent = status?.width
      ? `${status.capture} · ${status.width} × ${status.height} · ${status.fps} fresh frames/s`
      : status?.capture || "idle";
    document.getElementById("assistant-process-error").textContent = status?.error || "";
  }

  const unsubscribe = api.onAssistantStatus((value) => { status = value; render(); });
  api.getAssistantStatus().then((value) => { status = value; render(); }).catch((error) => {
    status = { error: error.message }; render();
  });
  window.addEventListener("beforeunload", unsubscribe, { once: true });

  return {
    bind() {
      for (const [id, action] of [["assistant-start", () => api.startAssistant()], ["assistant-stop", () => api.stopAssistant()]]) {
        document.getElementById(id).addEventListener("click", async () => {
          try { await action(); }
          catch (error) { document.getElementById("assistant-process-error").textContent = error.message; }
        });
      }
      render();
    },
  };
}
