import { NextRequest } from 'next/server';
import { query, ensureDatabaseInitialized } from '@/lib/server/db';
import { jsonOk, jsonError } from '@/lib/server/http';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const { username, password } = await request.json();
    if (!username || !password) return jsonError(400, '用户名和密码不能为空');

    const result = await query('SELECT * FROM "user" WHERE username=$1', [username]);
    if (result.rows.length === 0) return jsonError(401, '用户名或密码错误');

    const user = result.rows[0];
    const hash = crypto.createHash('sha256').update(password + user.password_salt).digest('hex');
    if (hash !== user.password_hash) return jsonError(401, '用户名或密码错误');

    return jsonOk({
      userId: user.user_id,
      username: user.username,
      accountType: user.account_type,
      isAdmin: user.is_admin,
    });
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}
