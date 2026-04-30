import { getGuestBootstrap } from "@/lib/server/game-session-service";
import { ApiError, getTokenFromRequest, jsonError, jsonOk, optionsResponse } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const guestToken = getTokenFromRequest(request);

    if (!guestToken) {
      throw new ApiError("缺少游客 token。", 401);
    }

    const snapshot = await getGuestBootstrap(guestToken);
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
