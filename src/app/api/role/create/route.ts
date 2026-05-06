import type { ClassKey, RaceKey } from "@/lib/game-config";
import { createRoleForGuest } from "@/lib/server/game-session-service";
import { isValidClassKeyRuntime, isValidRaceKeyRuntime } from "@/lib/server/dynamic-game-config";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type CreateRoleBody = {
  guestToken?: string;
  classKey?: string;
  name?: string;
  raceKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<CreateRoleBody>(request);

    if (!body.guestToken?.trim()) {
      throw new ApiError("缺少游客 token。", 401);
    }

    if (!body.name?.trim()) {
      throw new ApiError("角色名不能为空。");
    }

    if (!body.raceKey || !(await isValidRaceKeyRuntime(body.raceKey))) {
      throw new ApiError("请选择有效种族。");
    }

    if (!body.classKey || !(await isValidClassKeyRuntime(body.classKey))) {
      throw new ApiError("请选择有效职业。");
    }

    const snapshot = await createRoleForGuest({
      classKey: body.classKey as ClassKey,
      guestToken: body.guestToken.trim(),
      name: body.name.trim(),
      raceKey: body.raceKey as RaceKey,
    });

    return jsonOk({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
