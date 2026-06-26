
// 查看当前敌人数据
import { ensureDatabaseInitialized, query } from '../src/lib/server/db';

async function checkEnemies() {
  await ensureDatabaseInitialized();

  const result = await query("SELECT value FROM game_config WHERE config_key='enemies'");
  if (result.rows.length === 0) {
    console.log('没有找到敌人配置');
    return;
  }

  const enemies = typeof result.rows[0].value === 'string'
    ? JSON.parse(result.rows[0].value)
    : result.rows[0].value;

  console.log(`找到 ${enemies.length} 个敌人:\n`);
  enemies.forEach((enemy: any, index: number) => {
    console.log(`${index + 1}. ${enemy.key} (${enemy.name})`);
    console.log(`   monsterKey: ${enemy.monsterKey || '❌ 未设置'}`);
    console.log(`   地图: ${enemy.mapKey}`);
    console.log();
  });
}

checkEnemies().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
