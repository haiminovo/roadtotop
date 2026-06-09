import { NextRequest } from 'next/server';
import { query, ensureDatabaseInitialized } from '@/lib/server/db';
import { jsonOk, jsonError } from '@/lib/server/http';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const { username, password, guestToken } = await request.json();
    if (!username || !password) return jsonError(400, '用户名和密码不能为空');
    if (username.length < 2 || username.length > 16) return jsonError(400, '用户名长度 2-16 字符');

    // 检查用户名是否已存在
    const existing = await query('SELECT user_id FROM "user" WHERE username=$1', [username]);
    if (existing.rows.length > 0) return jsonError(409, '用户名已存在');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

    if (guestToken) {
      // 升级游客账号
      await query(
        `UPDATE "user" SET username=$1, password_hash=$2, password_salt=$3, account_type='registered', updated_at=NOW()
         WHERE guest_token=$4`,
        [username, hash, salt, guestToken]
      );
      const user = await query('SELECT * FROM "user" WHERE guest_token=$1', [guestToken]);
      return jsonOk({ userId: user.rows[0].user_id, username });
    } else {
      // 新建账号
      const result = await query(
        `INSERT INTO "user" (username, password_hash, password_salt, account_type) VALUES ($1,$2,$3,'registered') RETURNING *`,
        [username, hash, salt]
      );
      return jsonOk({ userId: result.rows[0].user_id, username });
    }
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}
