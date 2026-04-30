import { claimAfkReward } from "@/lib/server/day0-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type ClaimAfkBody = {
  guestToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<ClaimAfkBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("缺少游客 token。", 401);
    }

    const snapshot = await claimAfkReward(body.guestToken.trim());
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
