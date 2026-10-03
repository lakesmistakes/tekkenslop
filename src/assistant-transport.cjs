const net = require("node:net");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const MAX_MESSAGE_BYTES = 8192;

async function openAssistantTransport({ connectionPath, publishAssistantEvent }) {
  const token = randomBytes(32).toString("hex");
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setNoDelay(true);
    socket.setTimeout(10000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    let pending = Buffer.alloc(0);
    const reply = (result) => socket.write(`${JSON.stringify(result)}\n`);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      let newline;
      while ((newline = pending.indexOf(10)) !== -1) {
        if (newline > MAX_MESSAGE_BYTES) return socket.destroy();
        const line = pending.subarray(0, newline).toString("utf8");
        pending = pending.subarray(newline + 1);
        let message;
        try { message = JSON.parse(line); }
        catch { reply({ ok: false, error: "Invalid JSON." }); continue; }
        if (!message || message.token !== token) {
          socket.end(`${JSON.stringify({ ok: false, error: "Unauthorized connection." })}\n`);
          return;
        }
        socket.setTimeout(0);
        if (message.kind === "ping") reply({ ok: true });
        else if (message.kind === "event") reply(publishAssistantEvent(message.event));
        else reply({ ok: false, error: "Unknown message kind." });
      }
      if (pending.length > MAX_MESSAGE_BYTES) socket.destroy();
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const connection = { host: "127.0.0.1", port: server.address().port, token };
  try {
    await fs.mkdir(path.dirname(connectionPath), { recursive: true });
    await fs.writeFile(connectionPath, JSON.stringify(connection), { mode: 0o600 });
  } catch (error) {
    server.close();
    throw error;
  }
  return {
    connection,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
      // A second app instance may have replaced its own discovery file.
      try {
        if (JSON.parse(await fs.readFile(connectionPath, "utf8")).token === token) {
          await fs.unlink(connectionPath);
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
  };
}

module.exports = { openAssistantTransport, MAX_MESSAGE_BYTES };
