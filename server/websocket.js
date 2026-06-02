const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const WebSocketServer = require("websocket").server;
const {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  validateClientMessage,
} = require("../shared/realtime-protocol");
const {
  CHAT_CHANNELS,
  createChatMessageForGuest,
  getRecentChatMessages,
} = require("./chat-service");
const { closeDatabase, initDatabase } = require("./db");
const {
  AFK_TASK_SECONDS,
  buyMarketListingForGuest,
  cancelMarketListingForGuest,
  claimAfkRewardForGuest,
  createMarketListingForGuest,
  dismissMarketSoldNotificationForGuest,
  dropBackpackItemForGuest,
  equipBackpackItemForGuest,
  configureSkillLoadoutForGuest,
  getSessionSnapshot,
  learnSkillBookForGuest,
  startPvpBattleForGuest,
  startAfkForGuest,
  stopAfkForGuest,
  unequipBackpackItemForGuest,
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

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function send(connection, message) {
  if (connection.connected) {
    connection.sendUTF(JSON.stringify(message));
  }
}

function sendError(connection, content) {
  send(connection, {
    type: SERVER_MESSAGE_TYPES.ERROR,
    payload: { content, status: 400 },
  });
}

function sendErrorWithStatus(connection, content, status = 400) {
  send(connection, {
    type: SERVER_MESSAGE_TYPES.ERROR,
    payload: { content, status },
  });
}

function sendChatHistory(connection, messages) {
  send(connection, {
    type: SERVER_MESSAGE_TYPES.CHAT_HISTORY,
    payload: {
      channels: CHAT_CHANNELS,
      messages,
    },
  });
}

function broadcastChatMessage(message) {
  for (const connection of sessions.keys()) {
    send(connection, {
      type: SERVER_MESSAGE_TYPES.CHAT_MESSAGE,
      payload: { message },
    });
  }
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

function sendSnapshot(connection, snapshot, reason, messageType = SERVER_MESSAGE_TYPES.STATE_UPDATE) {
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
      accruedSeconds: snapshot.afk.battle?.active ? snapshot.afk.accruedSeconds : progressSeconds,
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

  throw createServiceError(`无法为 WebSocket 服务找到可用端口，起始端口 ${startPort}，最多尝试 ${MAX_PORT_ATTEMPTS} 个端口。`, 500);
}

async function handleSessionStart(connection, packet) {
  const guestToken = typeof packet.payload?.guestToken === "string"
    ? packet.payload.guestToken.trim()
    : "";

  if (!guestToken) {
    throw createServiceError("缺少游客 token。", 400);
  }

  const snapshot = await getSessionSnapshot(guestToken);
  const chatMessages = await getRecentChatMessages();
  setSession(connection, guestToken, snapshot);
  sendSnapshot(connection, snapshot, "ready", SERVER_MESSAGE_TYPES.SESSION_READY);
  sendChatHistory(connection, chatMessages);
}

async function handleAfkStart(connection, session, packet) {
  const activityKey = typeof packet.payload?.activityKey === "string"
    ? packet.payload.activityKey
    : undefined;
  const mapKey = typeof packet.payload?.mapKey === "string"
    ? packet.payload.mapKey
    : undefined;
  const snapshot = await startAfkForGuest(session.guestToken, activityKey, mapKey);
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

async function handleBackpackEquip(connection, session, packet) {
  const backpackId = typeof packet.payload?.backpackId === "string"
    ? packet.payload.backpackId
    : "";
  const snapshot = await equipBackpackItemForGuest(session.guestToken, backpackId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "equip");
}

async function handleBackpackUnequip(connection, session, packet) {
  const backpackId = typeof packet.payload?.backpackId === "string"
    ? packet.payload.backpackId
    : "";
  const snapshot = await unequipBackpackItemForGuest(session.guestToken, backpackId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "unequip");
}

async function handleBackpackLearnSkillBook(connection, session, packet) {
  const backpackId = typeof packet.payload?.backpackId === "string"
    ? packet.payload.backpackId
    : "";
  const snapshot = await learnSkillBookForGuest(session.guestToken, backpackId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "learn-skill-book");
}

async function handleSkillConfigureLoadout(connection, session, packet) {
  const skillKey = typeof packet.payload?.skillKey === "string"
    ? packet.payload.skillKey
    : "";
  const action = packet.payload?.action === "unequip" ? "unequip" : "equip";
  const snapshot = await configureSkillLoadoutForGuest(session.guestToken, skillKey, action);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "skill-configure-loadout");
}

async function handleMarketCreate(connection, session, packet) {
  const backpackId = typeof packet.payload?.backpackId === "string"
    ? packet.payload.backpackId
    : "";
  const price = Number(packet.payload?.price ?? 0);
  const quantity = Number(packet.payload?.quantity ?? 0);
  const snapshot = await createMarketListingForGuest(session.guestToken, backpackId, price, quantity);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "market-create");
}

async function handleMarketCancel(connection, session, packet) {
  const listingId = typeof packet.payload?.listingId === "string"
    ? packet.payload.listingId
    : "";
  const snapshot = await cancelMarketListingForGuest(session.guestToken, listingId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "market-cancel");
}

async function handleMarketBuy(connection, session, packet) {
  const listingId = typeof packet.payload?.listingId === "string"
    ? packet.payload.listingId
    : "";
  const snapshot = await buyMarketListingForGuest(session.guestToken, listingId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "market-buy");
}

async function handleMarketSoldDismiss(connection, session, packet) {
  const listingId = typeof packet.payload?.listingId === "string"
    ? packet.payload.listingId
    : "";
  const snapshot = await dismissMarketSoldNotificationForGuest(session.guestToken, listingId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "market-sold-dismiss");
}

async function handleChatSend(session, packet) {
  const channelKey = typeof packet.payload?.channelKey === "string"
    ? packet.payload.channelKey
    : "";
  const content = typeof packet.payload?.content === "string"
    ? packet.payload.content
    : "";
  const message = await createChatMessageForGuest(session.guestToken, channelKey, content);
  broadcastChatMessage(message);
}

async function handlePvpChallenge(connection, session, packet) {
  const targetRoleId = typeof packet.payload?.targetRoleId === "string"
    ? packet.payload.targetRoleId
    : "";
  const snapshot = await startPvpBattleForGuest(session.guestToken, targetRoleId);
  setSession(connection, session.guestToken, snapshot);
  sendSnapshot(connection, snapshot, "pvp-start");
}

async function handlePacket(connection, packet) {
  if (packet.type === CLIENT_MESSAGE_TYPES.SESSION_START) {
    await handleSessionStart(connection, packet);
    return;
  }

  const session = getSession(connection);

  if (!session) {
    throw createServiceError("会话尚未初始化。", 401);
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.AFK_START) {
    await handleAfkStart(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.AFK_STOP) {
    await handleAfkStop(connection, session);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.AFK_CLAIM) {
    await handleAfkClaim(connection, session);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.BACKPACK_DROP) {
    await handleBackpackDrop(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.BACKPACK_EQUIP) {
    await handleBackpackEquip(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.BACKPACK_UNEQUIP) {
    await handleBackpackUnequip(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.BACKPACK_LEARN_SKILL_BOOK) {
    await handleBackpackLearnSkillBook(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.SKILL_CONFIGURE_LOADOUT) {
    await handleSkillConfigureLoadout(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.MARKET_CREATE) {
    await handleMarketCreate(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.MARKET_CANCEL) {
    await handleMarketCancel(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.MARKET_BUY) {
    await handleMarketBuy(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.MARKET_SOLD_DISMISS) {
    await handleMarketSoldDismiss(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.PVP_CHALLENGE) {
    await handlePvpChallenge(connection, session, packet);
    return;
  }

  if (packet.type === CLIENT_MESSAGE_TYPES.CHAT_SEND) {
    await handleChatSend(session, packet);
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

  const validation = validateClientMessage(packet);

  if (!validation.ok) {
    sendError(connection, validation.error);
    return;
  }

  try {
    await handlePacket(connection, validation.message);
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error
      ? Number(error.status) || 500
      : 500;
    sendErrorWithStatus(connection, error instanceof Error ? error.message : "服务端处理请求时出错。", status);
  }
}

async function pushProgressUpdate(connection, session) {
  const snapshot = session.snapshot;

  if (!snapshot?.role) {
    return;
  }

  if (snapshot.afk.battle?.active) {
    const nextSnapshot = await getSessionSnapshot(session.guestToken);
    session.snapshot = nextSnapshot;
    session.lastProgressSecond = nextSnapshot.afk.accruedSeconds;
    sendSnapshot(connection, nextSnapshot, "battle");
    return;
  }

  if (snapshot.afk.status !== "active") {
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
        sendError(connection, error instanceof Error ? error.message : "同步行动进度失败。");
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
