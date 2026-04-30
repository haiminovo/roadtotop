import { isValidMapKey, startAfk } from "@/lib/server/day0-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type StartAfkBody = {
  guestToken?: string;
  mapKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<StartAfkBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("缺少游客 token。", 401);
    }

    if (!body.mapKey || !isValidMapKey(body.mapKey)) {
      throw new ApiError("请选择有效挂机地图。");
    }

    const snapshot = await startAfk(body.guestToken.trim(), body.mapKey);
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
