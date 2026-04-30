import { stopAfk } from "@/lib/server/day0-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type StopAfkBody = {
  guestToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<StopAfkBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("缺少游客 token。", 401);
    }

    const snapshot = await stopAfk(body.guestToken.trim());
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
