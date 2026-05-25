import type { ActivityKey, MapKey } from "@/lib/game-config";
import { startAfk } from "@/lib/server/game-session-service";
import { isValidMapKeyRuntime } from "@/lib/server/dynamic-game-config";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type StartAfkBody = {
  guestToken?: string;
  activityKey?: string;
  mapKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<StartAfkBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("缺少游客 token。", 401);
    }

    if (!body.mapKey || !(await isValidMapKeyRuntime(body.mapKey))) {
      throw new ApiError("请选择有效挂机地图。");
    }

    const activityKey = (body.activityKey || "combat") as ActivityKey;
    const snapshot = await startAfk(body.guestToken.trim(), activityKey, body.mapKey as MapKey);
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
