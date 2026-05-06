import { readFile, writeFile, mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { jsonOk, optionsResponse } from "@/lib/server/http";

export const runtime = "nodejs";
const DEFAULT_PORT = Number(process.env.WS_PORT || 8080);
const MAX_PORT_ATTEMPTS = 20;

function getRuntimeConfigPath() {
  return path.join(process.cwd(), ".runtime", "ws.json");
}

function getRuntimeConfigDir() {
  return path.join(process.cwd(), ".runtime");
}

async function canConnectToPort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
    });

    const finalize = (error?: Error) => {
      socket.removeAllListeners();
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    socket.setTimeout(500);
    socket.once("connect", () => finalize());
    socket.once("timeout", () => finalize(new Error("timeout")));
    socket.once("error", (error) => finalize(error));
  });
}

async function discoverRuntimePort() {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    const port = DEFAULT_PORT + attempt;

    try {
      await canConnectToPort(port);
      return port;
    } catch {
      continue;
    }
  }

  return null;
}

async function persistRuntimePort(port: number) {
  await mkdir(getRuntimeConfigDir(), { recursive: true });
  await writeFile(
    getRuntimeConfigPath(),
    JSON.stringify({
      port,
      updatedAt: new Date().toISOString(),
    }),
    "utf8",
  );
}

export async function GET() {
  try {
    const raw = await readFile(getRuntimeConfigPath(), "utf8");
    const config = JSON.parse(raw) as { port?: number };
    const port = Number(config.port);

    if (Number.isFinite(port) && port > 0) {
      try {
        await canConnectToPort(port);

        return jsonOk({ port });
      } catch {
        // Fall through and try to rediscover a currently healthy websocket port.
      }
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      // Ignore malformed config and try discovery below.
    }
  }

  const discoveredPort = await discoverRuntimePort();

  if (discoveredPort) {
    await persistRuntimePort(discoveredPort);
  }

  return jsonOk({ port: discoveredPort });
}

export async function OPTIONS() {
  return optionsResponse();
}
