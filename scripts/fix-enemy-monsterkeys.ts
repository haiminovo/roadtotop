
// 修复敌人 monsterKey 的脚本
import { ensureDatabaseInitialized, query } from '../src/lib/server/db';

function inferMonsterKey(enemyKey: string): string {
  const key = enemyKey.toLowerCase();
  if (key.includes('slime')) return 'slime';
  if (key.includes('goblin')) return 'goblin';
  if (key.includes('skeleton') || key.includes('skull')) return 'skeleton';
  if (key.includes('wolf')) return 'wolf';
  if (key.includes('bear')) return 'bear';
  if (key.includes('fire') || key.includes('elemental')) return 'fire_elemental';
  if (key.includes('dragon')) return 'dragon_whelp';
  if (key.includes('void') || key.includes('shadow')) return 'void_walker';
  return 'slime';
}

async function fixEnemyMonsterKeys() {
  await ensureDatabaseInitialized();

  const result = await query("SELECT value FROM game_config WHERE config_key='enemies'");
  if (result.rows.length === 0) {
    console.log('没有找到敌人配置');
    return;
  }

  const enemies = typeof result.rows[0].value === 'string'
    ? JSON.parse(result.rows[0].value)
    : result.rows[0].value;

  console.log(`找到 ${enemies.length} 个敌人`);

  // 给每个敌人添加 monsterKey
  const updatedEnemies = enemies.map((enemy: any) => {
    if (!enemy.monsterKey) {
      const monsterKey = inferMonsterKey(enemy.key);
      console.log(`- ${enemy.key} (${enemy.name}) -> ${monsterKey}`);
      return { ...enemy, monsterKey };
    }
    console.log(`- ${enemy.key} (${enemy.name}) -> ${enemy.monsterKey} (已存在)`);
    return enemy;
  });

  // 保存回数据库
  await query(
    `INSERT INTO game_config (config_key, config_type, value, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    ['enemies', 'array', JSON.stringify(updatedEnemies)]
  );

  console.log('✅ 已更新敌人配置');
}

fixEnemyMonsterKeys().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
