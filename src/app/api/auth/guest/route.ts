import { NextRequest } from 'next/server';
import { query, ensureDatabaseInitialized } from '@/lib/server/db';
import { jsonOk, jsonError } from '@/lib/server/http';

export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const { guestToken } = await request.json();
    if (!guestToken) return jsonError(400, '缺少 guestToken');

    let result = await query('SELECT * FROM "user" WHERE guest_token=$1', [guestToken]);
    if (result.rows.length === 0) {
      result = await query(
        `INSERT INTO "user" (guest_token, account_type) VALUES ($1, 'guest') RETURNING *`,
        [guestToken]
      );
    }
    const user = result.rows[0];
    return jsonOk({ userId: user.user_id, guestToken: user.guest_token, accountType: user.account_type });
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}
