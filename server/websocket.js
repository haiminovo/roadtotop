const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const WebSocketServer = require("websocket").server;
const { closeDatabase, initDatabase } = require("./db");
const {
  AFK_TASK_SECONDS,
  claimAfkRewardForGuest,
  dropBackpackItemForGuest,
  getSessionSnapshot,
  startAfkForGuest,
  stopAfkForGuest,
} = require("./game-service");

const DEFAULT_PORT = Number(process.env.WS_PORT || 8080);
const MAX_PORT_ATTEMPTS = 20;
const PROGRESS_PUSH_MS = 1000;
const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const RUNTIME_PATH = path.join(RUNTIME_DIR, "ws.json");

const httpServer = http.createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false }));
});

const sessions = new Map();

function send(connection, message) {
  if (connection.connected) {
    connection.sendUTF(JSON.stringify(message));
  }
}

function sendError(connection, content) {
  send(connection, {
    type: "game:error",
    payload: { content },
  });
}

function getSession(connection) {
  return sessions.get(connection) || null;
}

function setSession(connection, guestToken, snapshot) {
  sessions.set(connection, {
    guestToken,
    lastProgressSecond: snapshot?.afk?.accruedSeconds || 0,
    snapshot,
  });
}

function sendSnapshot(connection, snapshot, reason, messageType = "game:state:update") {
  send(connection, {
    type: messageType,
    payload: {
      reason,
      snapshot,
    },
  });
}

function buildProgressSnapshot(snapshot, progressSeconds) {
  return {
    ...snapshot,
    serverTime: Date.now(),
    afk: {
      ...snapshot.afk,
      accruedSeconds: progressSeconds,
    },
  };
}

async function writeRuntimePort(port) {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  await fs.writeFile(
    RUNTIME_PATH,
    JSON.stringify({
      port,
      updatedAt: new Date().toISOString(),
    }),
    "utf8",
  );
}

async function clearRuntimePort(port) {
  try {
    const raw = await fs.readFile(RUNTIME_PATH, "utf8");
    const config = JSON.parse(raw);

    if (Number(config?.port) !== port) {
      return;
    }

    await fs.unlink(RUNTIME_PATH);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
  }
}

async function listenOnAvailablePort(server, startPort) {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    const port = startPort + attempt;

    try {
      await new Promise((resolve, reject) => {
        const handleListening = () => {
          server.off("error", handleError);
          resolve();
        };

        const handleError = (error) => {
          server.off("listening", handleListening);
          reject(error);
        };

        server.once("listening", handleListening);
        server.once("error", handleError);
        server.listen(port);
      });

      return port;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`无法为 WebSocket 服务找到可用端口，起始端口 ${startPort}，最多尝试 ${MAX_PORT_ATTEMPTS} 个端口。`);
}

async function handleSessionStart(connection, packet) {
  const guestToken = typeof packet.payload?.guestToken === "string"
    ? packet.payload.guestToken.trim()
    : "";

  if (!guestToken) {
    throw new Error("缺少游客 token。");
  }

  const snapshot = await getSessionSnapshot(guestToken);
  setSession(connection, guestToken, snapshot);
  sendSnapshot(connection, snapshot, "ready", "game:session:ready");
}

async function handleAfkStart(connection, session, packet) {
  const mapKey = typeof packet.payload?.mapKey === "string"
    ? packet.payload.mapKey
    : undefined;
  const snapshot = await startAfkForGuest(session.guestToken, mapKey);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "start");
}

async function handleAfkStop(connection, session) {
  const snapshot = await stopAfkForGuest(session.guestToken);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "stop");
}

async function handleAfkClaim(connection, session) {
  const snapshot = await claimAfkRewardForGuest(session.guestToken);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "claim");
}

async function handleBackpackDrop(connection, session, packet) {
  const backpackId = typeof packet.payload?.backpackId === "string"
    ? packet.payload.backpackId
    : "";
  const snapshot = await dropBackpackItemForGuest(session.guestToken, backpackId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "drop");
}

async function handlePacket(connection, packet) {
  if (packet.type === "game:session:start") {
    await handleSessionStart(connection, packet);
    return;
  }

  const session = getSession(connection);

  if (!session) {
    throw new Error("会话尚未初始化。");
  }

  if (packet.type === "game:afk:start") {
    await handleAfkStart(connection, session, packet);
    return;
  }

  if (packet.type === "game:afk:stop") {
    await handleAfkStop(connection, session);
    return;
  }

  if (packet.type === "game:afk:claim") {
    await handleAfkClaim(connection, session);
    return;
  }

  if (packet.type === "game:backpack:drop") {
    await handleBackpackDrop(connection, session, packet);
  }
}

async function handleIncomingMessage(connection, message) {
  if (message.type !== "utf8") {
    return;
  }

  let packet;

  try {
    packet = JSON.parse(message.utf8Data);
  } catch {
    sendError(connection, "消息格式错误，服务端拒绝处理。");
    return;
  }

  try {
    await handlePacket(connection, packet);
  } catch (error) {
    sendError(connection, error instanceof Error ? error.message : "服务端处理请求时出错。");
  }
}

async function pushProgressUpdate(connection, session) {
  const snapshot = session.snapshot;

  if (!snapshot?.role || snapshot.afk.status !== "active") {
    return;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - snapshot.serverTime) / 1000));
  const taskDurationSeconds = snapshot.afk.taskDurationSeconds || AFK_TASK_SECONDS;
  const nextProgressSeconds = snapshot.afk.accruedSeconds + elapsedSeconds;

  if (nextProgressSeconds >= taskDurationSeconds) {
    const nextSnapshot = await getSessionSnapshot(session.guestToken);
    session.snapshot = nextSnapshot;
    session.lastProgressSecond = nextSnapshot.afk.accruedSeconds;
    sendSnapshot(connection, nextSnapshot, "execution");
    return;
  }

  if (nextProgressSeconds === session.lastProgressSecond) {
    return;
  }

  session.lastProgressSecond = nextProgressSeconds;
  sendSnapshot(connection, buildProgressSnapshot(snapshot, nextProgressSeconds), "progress");
}

async function main() {
  await initDatabase();

  const port = await listenOnAvailablePort(httpServer, DEFAULT_PORT);
  await writeRuntimePort(port);

  if (port !== DEFAULT_PORT) {
    console.warn(`Port ${DEFAULT_PORT} is already in use. WebSocket server switched to http://localhost:${port}`);
  } else {
    console.log(`WebSocket server listening on http://localhost:${port}`);
  }

  const websocketServer = new WebSocketServer({
    autoAcceptConnections: false,
    httpServer,
  });

  const tickTimer = setInterval(() => {
    for (const [connection, session] of sessions.entries()) {
      void pushProgressUpdate(connection, session).catch((error) => {
        sendError(connection, error instanceof Error ? error.message : "同步挂机进度失败。");
      });
    }
  }, PROGRESS_PUSH_MS);

  websocketServer.on("request", (request) => {
    const connection = request.accept();

    connection.on("message", (message) => {
      void handleIncomingMessage(connection, message);
    });

    connection.on("close", () => {
      const session = sessions.get(connection);

      if (session?.guestToken) {
        void getSessionSnapshot(session.guestToken).catch((error) => {
          console.error("Failed to persist game snapshot on disconnect.", error);
        });
      }

      sessions.delete(connection);
    });
  });

  let shutdownPromise = null;

  const shutdown = async () => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      clearInterval(tickTimer);

      for (const session of sessions.values()) {
        if (!session.guestToken) {
          continue;
        }

        try {
          await getSessionSnapshot(session.guestToken);
        } catch (error) {
          console.error("Failed to persist game snapshot during shutdown.", error);
        }
      }

      await clearRuntimePort(port);
      httpServer.close();
      await closeDatabase();
      process.exit(0);
    })();

    return shutdownPromise;
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error("Failed to start websocket server.");
  console.error(error);
  process.exit(1);
});
