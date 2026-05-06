import { jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";
import { listAdminRoles, updateAdminRole, type AdminRoleRecord } from "@/lib/server/admin-config";

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

export async function OPTIONS() {
  return optionsResponse();
}
