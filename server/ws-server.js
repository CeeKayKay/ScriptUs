// ============================================
// SCRIPTUS — WebSocket Server for Yjs
// ============================================
// Handles real-time document sync and awareness (cursor positions, presence)
// Run standalone: node server/ws-server.js

const http = require("http");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const { setupWSConnection } = require("y-websocket/bin/utils");

const PORT = process.env.PORT || process.env.WS_PORT || 1234;
const HOST = process.env.WS_HOST || "0.0.0.0";

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", connections: wss.clients.size }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ScriptUs WebSocket Server");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  // Extract room name from URL path: /project-{id}
  const roomName = req.url?.slice(1) || "default";

  console.log(
    `[${new Date().toISOString()}] Client connected to room: ${roomName} ` +
      `(${wss.clients.size} total)`
  );

  // y-websocket handles sync protocol, awareness, and document state
  setupWSConnection(ws, req, {
    docName: roomName,
    gc: true, // Enable garbage collection for deleted content
  });

  ws.on("close", () => {
    console.log(
      `[${new Date().toISOString()}] Client disconnected from room: ${roomName} ` +
        `(${wss.clients.size} total)`
    );
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n🎭 ScriptUs WebSocket Server`);
  console.log(`   Listening on ws://${HOST}:${PORT}`);
  console.log(`   Health check: http://${HOST}:${PORT}/health\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\nShutting down WebSocket server...");
  wss.clients.forEach((client) => client.close());
  server.close(() => process.exit(0));
});
