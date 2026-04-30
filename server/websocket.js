const http = require("http");
const WebSocketServer = require("websocket").server;
const { closeDatabase, initDatabase } = require("./db");
const {
  appendChatLog,
  loadOrCreatePlayer,
  persistPlayer,
  snapshotPlayer,
  syncPlayer,
} = require("./player-store");

const PORT = process.env.WS_PORT || 8080;
const TICK_INTERVAL_MS = 3000;

const httpServer = http.createServer();
const sessions = new Map();

function send(connection, message) {
  if (connection.connected) {
    connection.sendUTF(JSON.stringify(message));
  }
}

function broadcast(message) {
  for (const connection of sessions.keys()) {
    send(connection, message);
  }
}

async function sendState(connection, player, reason) {
  const now = Date.now();
  const { adventureFinished } = syncPlayer(player, now);

  if (adventureFinished) {
    await persistPlayer(player);
  }

  send(connection, {
    type: "state:update",
    payload: {
      onlineCount: sessions.size,
      reason,
      serverTime: now,
      snapshot: snapshotPlayer(player),
    },
  });

  if (adventureFinished) {
    send(connection, {
      type: "system:notice",
      payload: {
        content: "酒馆委托已经完成，冒险奖励已由服务端结算。",
      },
    });
  }
}

function getSession(connection) {
  return sessions.get(connection) || null;
}

async function handleSessionStart(connection, packet) {
  const player = await loadOrCreatePlayer(packet.payload?.playerId, packet.payload?.characterName);
  sessions.set(connection, { player });

  send(connection, {
    type: "session:ready",
    payload: {
      onlineCount: sessions.size,
      serverTime: Date.now(),
      snapshot: snapshotPlayer(player),
    },
  });

  send(connection, {
    type: "system:notice",
    payload: {
      content: "当前原型已接入 PostgreSQL 存档，刷新页面也会尝试回到原来的旅人。",
    },
  });
}

async function handleChatSend(player, packet) {
  const content = typeof packet.payload?.content === "string" ? packet.payload.content.trim() : "";

  if (!content) {
    return;
  }

  const message = {
    characterName: player.characterName,
    content,
    createdAt: Date.now(),
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    playerId: player.playerId,
  };

  await appendChatLog(message);

  broadcast({
    type: "chat:message",
    payload: message,
  });
}

async function handleCollect(connection, player) {
  syncPlayer(player);
  player.silver += player.unclaimedSilver;
  player.stamina += player.unclaimedStamina;
  player.unclaimedSilver = 0;
  player.unclaimedStamina = 0;
  await persistPlayer(player);
  await sendState(connection, player, "collect");
}

async function handleAdventureStart(connection, player) {
  syncPlayer(player);

  if (player.adventureEndsAt) {
    send(connection, {
      type: "error",
      payload: {
        content: "已有酒馆委托正在进行中。",
      },
    });
    return;
  }

  if (player.stamina < 120) {
    send(connection, {
      type: "error",
      payload: {
        content: "体力不足，无法派出冒险小队。",
      },
    });
    return;
  }

  player.stamina -= 120;
  player.adventureEndsAt = Date.now() + 15 * 60 * 1000;
  player.adventureRewardIngots = 40 + Math.floor(Math.random() * 20);
  await persistPlayer(player);
  await sendState(connection, player, "adventure");
  send(connection, {
    type: "system:notice",
    payload: {
      content: "冒险委托已被酒馆登记，归来时间与奖励已锁定。",
    },
  });
}

async function handlePacket(connection, packet) {
  if (packet.type === "session:start") {
    await handleSessionStart(connection, packet);
    return;
  }

  const session = getSession(connection);

  if (!session) {
    send(connection, {
      type: "error",
      payload: {
        content: "会话尚未初始化。",
      },
    });
    return;
  }

  const { player } = session;

  if (packet.type === "chat:send") {
    await handleChatSend(player, packet);
    return;
  }

  if (packet.type === "resource:collect") {
    await handleCollect(connection, player);
    return;
  }

  if (packet.type === "adventure:start") {
    await handleAdventureStart(connection, player);
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
    send(connection, {
      type: "error",
      payload: {
        content: "消息格式错误，服务端拒绝处理。",
      },
    });
    return;
  }

  try {
    await handlePacket(connection, packet);
  } catch (error) {
    console.error("Failed to process websocket packet.", error);
    send(connection, {
      type: "error",
      payload: {
        content: "服务端处理请求时出错，请稍后再试。",
      },
    });
  }
}

async function main() {
  await initDatabase();

  httpServer.listen(PORT, () => {
    console.log(`WebSocket server listening on http://localhost:${PORT}`);
  });

  const websocketServer = new WebSocketServer({
    httpServer,
    autoAcceptConnections: false,
  });

  const tickTimer = setInterval(() => {
    for (const [connection, session] of sessions.entries()) {
      void sendState(connection, session.player, "tick").catch((error) => {
        console.error("Failed to push tick state.", error);
      });
    }
  }, TICK_INTERVAL_MS);

  websocketServer.on("request", (request) => {
    const connection = request.accept();

    connection.on("message", (message) => {
      void handleIncomingMessage(connection, message);
    });

    connection.on("close", () => {
      const session = sessions.get(connection);

      if (session) {
        void persistPlayer(session.player).catch((error) => {
          console.error("Failed to persist player on disconnect.", error);
        });
        sessions.delete(connection);
      }
    });
  });

  const shutdown = async () => {
    clearInterval(tickTimer);

    for (const session of sessions.values()) {
      try {
        await persistPlayer(session.player);
      } catch (error) {
        console.error("Failed to persist player during shutdown.", error);
      }
    }

    await closeDatabase();
    process.exit(0);
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
