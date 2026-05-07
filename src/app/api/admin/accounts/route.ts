import {
  createAdminAccount,
  deleteAdminAccount,
  listAdminAccounts,
  updateAdminAccount,
  type AdminAccountUpsertInput,
} from "@/lib/server/admin-config";
import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type DeleteBody = {
  userId?: string;
};

export async function GET() {
  try {
    const accounts = await listAdminAccounts();
    return jsonOk({ accounts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<AdminAccountUpsertInput>(request);
    await createAdminAccount(body);
    const accounts = await listAdminAccounts();
    return jsonOk({ accounts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readJson<AdminAccountUpsertInput & { userId?: string }>(request);

    if (!body.userId?.trim()) {
      throw new ApiError("缺少账号标识。", 400);
    }

    await updateAdminAccount({
      ...body,
      userId: body.userId.trim(),
    });
    const accounts = await listAdminAccounts();
    return jsonOk({ accounts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readJson<DeleteBody>(request);

    if (!body.userId?.trim()) {
      throw new ApiError("缺少账号标识。", 400);
    }

    await deleteAdminAccount(body.userId.trim());
    const accounts = await listAdminAccounts();
    return jsonOk({ accounts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
