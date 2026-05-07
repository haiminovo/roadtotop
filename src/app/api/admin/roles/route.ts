import { ApiError, jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";
import {
  createAdminRole,
  deleteAdminRole,
  listAdminRoles,
  updateAdminRole,
  type AdminRoleCreateInput,
  type AdminRoleRecord,
} from "@/lib/server/admin-config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const roles = await listAdminRoles();
    return jsonOk({ roles });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readJson<AdminRoleRecord>(request);
    await updateAdminRole(body);
    const roles = await listAdminRoles();
    return jsonOk({ roles });
  } catch (error) {
    return jsonError(error);
  }
}

type DeleteBody = {
  roleId?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<AdminRoleCreateInput>(request);
    await createAdminRole(body);
    const roles = await listAdminRoles();
    return jsonOk({ roles });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readJson<DeleteBody>(request);

    if (!body.roleId?.trim()) {
      throw new ApiError("缺少角色标识。", 400);
    }

    await deleteAdminRole(body.roleId.trim());
    const roles = await listAdminRoles();
    return jsonOk({ roles });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
