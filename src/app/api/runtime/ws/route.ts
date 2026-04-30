import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsonOk, optionsResponse } from "@/lib/server/http";

export const runtime = "nodejs";

function getRuntimeConfigPath() {
  return path.join(process.cwd(), ".runtime", "ws.json");
}

export async function GET() {
  try {
    const raw = await readFile(getRuntimeConfigPath(), "utf8");
    const config = JSON.parse(raw) as { port?: number };
    const port = Number(config.port);

    return jsonOk({
      port: Number.isFinite(port) && port > 0 ? port : null,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return jsonOk({ port: null });
    }

    return jsonOk({ port: null });
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
