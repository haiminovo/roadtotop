import { NextRequest } from 'next/server';
import { ensureDatabaseInitialized, query } from '@/lib/server/db';
import { jsonOk, jsonError } from '@/lib/server/http';
import { getSessionSnapshot } from '@/../../server/game-service';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const url = new URL(request.url);
    const guestToken = url.searchParams.get('token');
    if (!guestToken) return jsonError(400, '缺少 token');

    const userResult = await query('SELECT user_id FROM "user" WHERE guest_token=$1', [guestToken]);
    if (userResult.rows.length === 0) return jsonError(404, '用户不存在');

    const snapshot = await getSessionSnapshot(userResult.rows[0].user_id);
    if (!snapshot) return jsonOk({ needCreateRole: true });

    return jsonOk(snapshot);
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}
