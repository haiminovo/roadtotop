const http = require("http");
const WebSocketServer = require("websocket").server;

const PORT = process.env.WS_PORT || 8080;

const httpServer = http.createServer();

httpServer.listen(PORT, () => {
  console.log(`WebSocket server listening on http://localhost:${PORT}`);
});

const websocketServer = new WebSocketServer({
  httpServer,
  autoAcceptConnections: false,
});

const connections = new Set();

websocketServer.on("request", (request) => {
  const connection = request.accept();
  connections.add(connection);

  connection.on("message", (message) => {
    if (message.type !== "utf8") {
      return;
    }

    for (const client of connections) {
      if (client !== connection) {
        client.send(message.utf8Data);
      }
    }
  });

  connection.on("close", () => {
    connections.delete(connection);
  });
});
