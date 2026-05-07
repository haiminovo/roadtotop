import { getAdminStaticMeta, getDynamicGameConfig, saveAdminGameConfig, validateAdminGameConfig } from "@/lib/server/admin-config";
import { refreshRuntimeGameConfig } from "@/lib/server/dynamic-game-config";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [config, meta] = await Promise.all([
      getDynamicGameConfig(),
      Promise.resolve(getAdminStaticMeta()),
    ]);

    return jsonOk({ config, meta });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readJson<Partial<Parameters<typeof saveAdminGameConfig>[0]>>(request);
    const currentConfig = await getDynamicGameConfig();
    const nextConfig = {
      ...currentConfig,
      ...body,
      levelTable: currentConfig.levelTable,
    };
    const validation = validateAdminGameConfig(nextConfig);

    if (!validation.isValid) {
      throw new ApiError("配置校验失败。", 400, {
        fieldErrors: validation.fieldErrors,
      });
    }

    await saveAdminGameConfig(nextConfig);
    await refreshRuntimeGameConfig();
    const config = await getDynamicGameConfig();
    return jsonOk({ config });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
