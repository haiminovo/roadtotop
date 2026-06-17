-- ============================================================
-- 平衡收益数值
--
-- 主要调整：
-- 1. 降低物品掉落概率（避免背包太容易满）
-- 2. 降低金币/经验/以太奖励幅度
-- 3. 添加概率机制，不是每次事件都奖励物品
-- ============================================================

-- 先完全重置事件规则，保留基础规则
WITH preserved AS (
  SELECT value
  FROM game_config
  WHERE config_key = 'event_rules'
),
filtered AS (
  SELECT jsonb_agg(elem) AS value
  FROM preserved, jsonb_array_elements(preserved.value) elem
  WHERE elem->>'key' IN ('common_drop', 'rare_material', 'legendary_find', 'combat_encounter')
)
UPDATE game_config
SET value = COALESCE((SELECT value FROM filtered), '[]'::jsonb)
WHERE config_key = 'event_rules';

-- 添加新的平衡后的采集事件
WITH ids AS (SELECT name, item_id FROM item WHERE name IN ('新鲜药草', '彩色蘑菇', '铜矿石', '甜浆果', '硬木', '月见草', '水晶碎片', '古代石板', '精灵露水'))
UPDATE game_config SET value = value || jsonb_build_array(
  jsonb_build_object(
    'key', 'gathering_herbs',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '采集草药', 'description', '发现了一丛新鲜的药草'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '新鲜药草'), 'itemName', '新鲜药草')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_mushroom',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '蘑菇丛', 'description', '潮湿的树根旁长满了色彩斑斓的蘑菇'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '彩色蘑菇'), 'itemName', '彩色蘑菇')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_mineral',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '矿石露头', 'description', '岩壁上露出一小截矿脉'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 2, 'max', 4),
      jsonb_build_object('type', 'grant_item', 'chance', 0.4, 'itemId', (SELECT item_id FROM ids WHERE name = '铜矿石'), 'itemName', '铜矿石')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_berries',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '浆果丛', 'description', '灌木丛中挂满了成熟的浆果'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_exp', 'chance', 1.0, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '甜浆果'), 'itemName', '甜浆果')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_wood',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '伐木', 'description', '收集了一些可用的木材'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '硬木'), 'itemName', '硬木')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_rare_flower',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'rare', 'title', '稀有花卉！', 'description', '在隐蔽的山谷中发现了一株散发微光的月见草'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 3, 'max', 8),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.5, 'min', 2, 'max', 4),
      jsonb_build_object('type', 'grant_item', 'chance', 0.6, 'itemId', (SELECT item_id FROM ids WHERE name = '月见草'), 'itemName', '月见草')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_crystal_vein',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'rare', 'title', '水晶矿脉！', 'description', '脚下传来异样的光芒'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_aether', 'chance', 1.0, 'min', 1, 'max', 2),
      jsonb_build_object('type', 'grant_gold', 'chance', 0.6, 'min', 3, 'max', 6),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '水晶碎片'), 'itemName', '水晶碎片')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_ancient_ruins',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'rare', 'title', '古代遗迹', 'description', '在藤蔓覆盖的石墙后发现了一处古代遗迹'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 5, 'max', 10),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.5, 'min', 3, 'max', 6),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '古代石板'), 'itemName', '古代石板')
    )
  ),
  jsonb_build_object(
    'key', 'gathering_spirit_tree',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'gathering'),
    'encounter', jsonb_build_object('tier', 'legendary', 'title', '精灵古树！', 'description', '一棵参天古树突然发出柔和的光芒，精灵的低语在耳边回荡'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 10, 'max', 20),
      jsonb_build_object('type', 'grant_aether', 'chance', 0.8, 'min', 2, 'max', 4),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.8, 'min', 8, 'max', 15),
      jsonb_build_object('type', 'grant_item', 'chance', 1.0, 'itemId', (SELECT item_id FROM ids WHERE name = '精灵露水'), 'itemName', '精灵露水')
    )
  )
) WHERE config_key = 'event_rules';

-- 添加新的平衡后的钓鱼事件
WITH ids AS (SELECT name, item_id FROM item WHERE name IN ('肥美鲤鱼', '水草束', '金色鲤鱼', '海底宝箱', '人鱼珍珠', '海蓝宝石', '远古神像'))
UPDATE game_config SET value = value || jsonb_build_array(
  jsonb_build_object(
    'key', 'fishing_carp',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '钓到鲤鱼', 'description', '鱼竿一沉，一条肥美的鲤鱼上钩了'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '肥美鲤鱼'), 'itemName', '肥美鲤鱼')
    )
  ),
  jsonb_build_object(
    'key', 'fishing_seaweed',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '捞到水草', 'description', '拉上来一团湿漉漉的水草'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 1, 'max', 2),
      jsonb_build_object('type', 'grant_item', 'chance', 0.5, 'itemId', (SELECT item_id FROM ids WHERE name = '水草束'), 'itemName', '水草束')
    )
  ),
  jsonb_build_object(
    'key', 'fishing_turtle',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '遇到老龟', 'description', '一只老龟慢悠悠地游过，对你点了点头'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_exp', 'chance', 1.0, 'min', 2, 'max', 4),
      jsonb_build_object('type', 'grant_gold', 'chance', 0.4, 'min', 1, 'max', 2)
    )
  ),
  jsonb_build_object(
    'key', 'fishing_boot',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '一只旧靴子', 'description', '费了好大力气拉上来……是一只破旧的靴子'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 1, 'max', 2)
    )
  ),
  jsonb_build_object(
    'key', 'fishing_school',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'common', 'title', '鱼群过境', 'description', '一大群银色小鱼游过'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 2, 'max', 5),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.4, 'min', 2, 'max', 4)
    )
  ),
  jsonb_build_object(
    'key', 'fishing_golden_fish',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'rare', 'title', '金色鲤鱼！', 'description', '水面金光一闪，一条罕见的金色鲤鱼跃出水面'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 5, 'max', 12),
      jsonb_build_object('type', 'grant_aether', 'chance', 0.6, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.7, 'itemId', (SELECT item_id FROM ids WHERE name = '金色鲤鱼'), 'itemName', '金色鲤鱼')
    )
  ),
  jsonb_build_object(
    'key', 'fishing_treasure_chest',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'rare', 'title', '海底宝箱！', 'description', '鱼钩挂住了什么沉重的东西……竟然是一只沉入水底的宝箱'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 8, 'max', 15),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.5, 'min', 2, 'max', 4),
      jsonb_build_object('type', 'grant_item', 'chance', 0.6, 'itemId', (SELECT item_id FROM ids WHERE name = '海底宝箱'), 'itemName', '海底宝箱')
    )
  ),
  jsonb_build_object(
    'key', 'fishing_mermaid',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'rare', 'title', '人鱼的馈赠', 'description', '一位人鱼浮出水面，将一颗珍珠放在你的鱼篓里'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 6, 'max', 12),
      jsonb_build_object('type', 'grant_aether', 'chance', 0.5, 'min', 1, 'max', 3),
      jsonb_build_object('type', 'grant_item', 'chance', 0.6, 'itemId', (SELECT item_id FROM ids WHERE name = '人鱼珍珠'), 'itemName', '人鱼珍珠')
    )
  ),
  jsonb_build_object(
    'key', 'fishing_kraken',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'legendary', 'title', '海怪出没！', 'description', '海面突然剧烈翻涌，一只巨大的触手从水下伸出'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 15, 'max', 30),
      jsonb_build_object('type', 'grant_aether', 'chance', 0.7, 'min', 2, 'max', 5),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.7, 'min', 10, 'max', 20),
      jsonb_build_object('type', 'grant_item', 'chance', 1.0, 'itemId', (SELECT item_id FROM ids WHERE name = '海蓝宝石'), 'itemName', '海蓝宝石')
    )
  ),
  jsonb_build_object(
    'key', 'fishing_ancient_idol',
    'trigger', jsonb_build_object('type', 'afk_tick', 'activityKey', 'fishing'),
    'encounter', jsonb_build_object('tier', 'legendary', 'title', '远古神像', 'description', '鱼线缠住了一个沉在水底的神秘雕像'),
    'actions', jsonb_build_array(
      jsonb_build_object('type', 'grant_gold', 'chance', 1.0, 'min', 20, 'max', 35),
      jsonb_build_object('type', 'grant_aether', 'chance', 0.8, 'min', 3, 'max', 6),
      jsonb_build_object('type', 'grant_exp', 'chance', 0.8, 'min', 15, 'max', 30),
      jsonb_build_object('type', 'grant_item', 'chance', 1.0, 'itemId', (SELECT item_id FROM ids WHERE name = '远古神像'), 'itemName', '远古神像')
    )
  )
) WHERE config_key = 'event_rules';

-- 更新地图收益
UPDATE game_config SET value = jsonb_build_array(
  jsonb_build_object('key', 'plains', 'name', '翡翠平原', 'description', '新手村外的绿色草原', 'levelRequired', 1, 'goldPerTask', 2, 'expPerTask', 3, 'aetherPerTask', 0),
  jsonb_build_object('key', 'forest', 'name', '迷雾森林', 'description', '古老的森林深处', 'levelRequired', 5, 'goldPerTask', 4, 'expPerTask', 6, 'aetherPerTask', 0),
  jsonb_build_object('key', 'cave', 'name', '水晶洞穴', 'description', '闪耀着光芒的地下洞窟', 'levelRequired', 10, 'goldPerTask', 8, 'expPerTask', 12, 'aetherPerTask', 1),
  jsonb_build_object('key', 'volcano', 'name', '烈焰火山', 'description', '炽热的岩浆地带', 'levelRequired', 15, 'goldPerTask', 15, 'expPerTask', 20, 'aetherPerTask', 1),
  jsonb_build_object('key', 'ruins', 'name', '远古遗迹', 'description', '沉睡着强大守卫的废墟', 'levelRequired', 20, 'goldPerTask', 25, 'expPerTask', 35, 'aetherPerTask', 2),
  jsonb_build_object('key', 'void', 'name', '虚空裂隙', 'description', '维度之间的混沌空间', 'levelRequired', 25, 'goldPerTask', 40, 'expPerTask', 50, 'aetherPerTask', 3)
) WHERE config_key = 'maps';
