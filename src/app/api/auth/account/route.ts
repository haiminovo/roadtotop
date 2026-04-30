import { loginAccount } from "@/lib/server/game-session-service";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type AccountLoginBody = {
  password?: string;
  username?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<AccountLoginBody>(request);

    if (!body.username?.trim() || !body.password) {
      throw new ApiError("请输入账号和密码。");
    }

    const account = await loginAccount({
      password: body.password,
      username: body.username,
    });

    return jsonOk({ account });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
