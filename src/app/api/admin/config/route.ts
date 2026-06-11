import { NextRequest } from 'next/server';
import { ensureDatabaseInitialized, query } from '@/lib/server/db';
import { jsonOk, jsonError } from '@/lib/server/http';
import { getDynamicGameConfig, saveAdminGameConfig } from '@/lib/server/admin-config';

export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'stats': {
        const users = await query('SELECT COUNT(*) as cnt FROM "user"');
        const roles = await query('SELECT COUNT(*) as cnt FROM role');
        const items = await query('SELECT COUNT(*) as cnt FROM item');
        const afk = await query("SELECT COUNT(*) as cnt FROM afk WHERE status='afk'");
        return jsonOk({
          totalUsers: users.rows[0].cnt,
          totalRoles: roles.rows[0].cnt,
          totalItems: items.rows[0].cnt,
          activeAfk: afk.rows[0].cnt,
        });
      }
      case 'items': {
        const config = await getDynamicGameConfig();
        return jsonOk({ items: config.itemCatalog });
      }
      case 'system_balance': {
        const config = await getDynamicGameConfig();
        return jsonOk({ balance: config.systemBalance });
      }
      case 'accounts': {
        const { listAdminAccounts } = await import('@/lib/server/admin-config');
        const accounts = await listAdminAccounts();
        return jsonOk({ accounts });
      }
      default:
        return jsonError(400, '未知 action');
    }
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const body = await request.json();

    switch (body.action) {
      case 'save_item': {
        const item = body.item;
        if (item.itemId > 0) {
          await query(
            `UPDATE item SET name=$1, rarity=$2, item_type=$3, slot=$4, sell_price=$5,
             description=$6, stat_json=$7::jsonb, level_requirement=$8 WHERE item_id=$9`,
            [item.name, item.rarity, item.itemType, item.slot || null, item.sellPrice,
             item.description, JSON.stringify(item.statJson), item.levelRequirement, item.itemId]
          );
        } else {
          await query(
            `INSERT INTO item (name, rarity, item_type, slot, sell_price, description, stat_json, level_requirement)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
            [item.name, item.rarity, item.itemType, item.slot || null, item.sellPrice,
             item.description, JSON.stringify(item.statJson), item.levelRequirement]
          );
        }
        return jsonOk({ success: true });
      }
      case 'delete_item': {
        await query('DELETE FROM item WHERE item_id=$1', [body.itemId]);
        return jsonOk({ success: true });
      }
      case 'save_system_balance': {
        await saveAdminGameConfig({ systemBalance: body.balance });
        return jsonOk({ success: true });
      }
      default:
        return jsonError(400, '未知 action');
    }
  } catch (err: unknown) {
    return jsonError(500, err instanceof Error ? err.message : '未知错误');
  }
}
