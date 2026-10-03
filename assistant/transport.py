"""Small synchronous JSON client; no capture dependencies needed."""
import json
import os
from pathlib import Path
import socket


def default_connection_path():
    if os.environ.get("TEKKEN_ASSISTANT_CONNECTION"):
        return Path(os.environ["TEKKEN_ASSISTANT_CONNECTION"])
    return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Tekken8ComboOverlay" / "assistant-connection.json"


class AssistantClient:
    def __init__(self, connection_path=None):
        # Electron supplies its own endpoint in the owned child's environment;
        # external test clients discover the most recently opened app via file.
        supplied = os.environ.get("TEKKEN_ASSISTANT_CONNECTION_DATA")
        connection = json.loads(supplied or Path(connection_path or default_connection_path()).read_text(encoding="utf-8"))
        if connection["host"] != "127.0.0.1":
            raise ValueError("Assistant transport must use loopback.")
        self.token = connection["token"]
        self.socket = socket.create_connection((connection["host"], connection["port"]), timeout=5)
        self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        self.reader = self.socket.makefile("rb")

    def request(self, kind, **payload):
        message = json.dumps({"token": self.token, "kind": kind, **payload}, ensure_ascii=False).encode("utf-8")
        if len(message) > 8192:
            raise ValueError("Assistant message is too large.")
        self.socket.sendall(message + b"\n")
        response = self.reader.readline(8193)
        if not response or not response.endswith(b"\n"):
            raise ConnectionError("Electron disconnected or returned an invalid response.")
        result = json.loads(response)
        if not result.get("ok"):
            raise ValueError(result.get("error", "Event rejected by Electron."))
        return result

    def send_event(self, event):
        return self.request("event", event=event)

    def close(self):
        self.reader.close()
        self.socket.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
