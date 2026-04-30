import { dropBackpackItem } from "@/lib/server/game-session-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type DropBackpackBody = {
  backpackId?: string;
  guestToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<DropBackpackBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("缺少游客 token。", 401);
    }

    if (!body.backpackId?.trim()) {
      throw new ApiError("缺少背包物品标识。");
    }

    const snapshot = await dropBackpackItem(body.guestToken.trim(), body.backpackId.trim());
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
