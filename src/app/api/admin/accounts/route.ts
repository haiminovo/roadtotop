import { NextRequest } from 'next/server';
import { ensureDatabaseInitialized } from '@/lib/server/db';
import { jsonOk, jsonError } from '@/lib/server/http';
import { updateAdminAccount, deleteAdminAccount } from '@/lib/server/admin-config';

export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const body = await request.json();

    switch (body.action) {
      case 'toggle_admin': {
        await updateAdminAccount(body.userId, { isAdmin: body.isAdmin });
        return jsonOk({ success: true });
      }
      case 'delete': {
        await deleteAdminAccount(body.userId);
        return jsonOk({ success: true });
      }
      default:
        return jsonError(400, '未知 action');
    }
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}
