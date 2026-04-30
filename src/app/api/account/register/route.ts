import { registerGuestAccount } from "@/lib/server/game-session-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type RegisterAccountBody = {
  confirmPassword?: string;
  guestToken?: string;
  password?: string;
  username?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<RegisterAccountBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("游客会话不存在，请重新登录。", 401);
    }

    if (!body.username?.trim() || !body.password || !body.confirmPassword) {
      throw new ApiError("请完整填写账号和密码。");
    }

    if (body.password !== body.confirmPassword) {
      throw new ApiError("两次输入的密码不一致。");
    }

    const snapshot = await registerGuestAccount({
      guestToken: body.guestToken.trim(),
      password: body.password,
      username: body.username,
    });

    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
