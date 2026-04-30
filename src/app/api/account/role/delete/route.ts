import { deleteAccountRole } from "@/lib/server/game-session-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type DeleteRoleBody = {
  guestToken?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<DeleteRoleBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("账号会话不存在，请重新登录。", 401);
    }

    const snapshot = await deleteAccountRole(body.guestToken.trim());
    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
