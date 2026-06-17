-- ============================================================
-- 1. 新增采集/钓鱼专属物品
-- ============================================================

INSERT INTO item (name, rarity, item_type, icon_key, slot, slot_usage, sell_price, description, stat_json, level_requirement) VALUES
('新鲜药草', 'white', 'material', 'GiHerbsBundle', NULL, 0, 3, '带着晨露的药草，散发淡淡清香', '{}', 1),
('彩色蘑菇', 'white', 'material', 'GiMushroom', NULL, 0, 4, '颜色鲜艳的蘑菇，看起来很美味', '{}', 1),
('铜矿石', 'white', 'material', 'GiStoneBlock', NULL, 0, 5, '含有少量铜的矿石', '{}', 1),
('甜浆果', 'white', 'material', 'GiFruitBowl', NULL, 0, 3, '一捧酸甜可口的浆果', '{}', 1),
('硬木', 'white', 'material', 'GiWoodBeam', NULL, 0, 4, '质地坚硬的木材', '{}', 1),
('月见草', 'green', 'material', 'GiFlowerPot', NULL, 0, 15, '只在月光下盛开的稀有花卉', '{}', 5),
('水晶碎片', 'green', 'material', 'GiCrystalBars', NULL, 0, 20, '闪烁着微光的水晶碎片', '{}', 5),
('古代石板', 'green', 'material', 'GiStoneTablet', NULL, 0, 25, '刻有神秘符文的石板碎片', '{}', 5),
('精灵露水', 'blue', 'material', 'GiDewDrop', NULL, 0, 50, '古树精灵留下的露水，蕴含自然之力', '{}', 10),
('肥美鲤鱼', 'white', 'material', 'GiFishBucket', NULL, 0, 5, '新鲜的鲤鱼，可以卖个好价钱', '{}', 1),
('水草束', 'white', 'material', 'GiSeaweed', NULL, 0, 2, '一束湿漉漉的水草', '{}', 1),
('金色鲤鱼', 'green', 'material', 'GiFishEscape', NULL, 0, 30, '罕见的金色鲤鱼，传说能带来好运', '{}', 5),
('海底宝箱', 'green', 'material', 'GiLockedChest', NULL, 0, 40, '从海底打捞上来的古老宝箱', '{}', 5),
('人鱼珍珠', 'blue', 'material', 'GiPearlNecklace', NULL, 0, 60, '人鱼赠予的珍珠，散发着柔和的光芒', '{}', 10),
('海蓝宝石', 'blue', 'material', 'GiAquamarine', NULL, 0, 80, '从海怪触手上扯下的蓝色宝石', '{}', 10),
('远古神像', 'purple', 'material', 'GiMoai', NULL, 0, 150, '刻满符文的神秘雕像，蕴含远古之力', '{}', 20)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. 删除旧事件
-- ============================================================

UPDATE game_config SET value = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(value) elem
  WHERE elem->>'key' NOT IN (
    'gathering_bonus', 'fishing_treasure',
    'gathering_herbs', 'gathering_mushroom', 'gathering_mineral',
    'gathering_berries', 'gathering_wood', 'gathering_rare_flower',
    'gathering_crystal_vein', 'gathering_ancient_ruins', 'gathering_spirit_tree',
    'fishing_carp', 'fishing_seaweed', 'fishing_turtle', 'fishing_boot',
    'fishing_school', 'fishing_golden_fish', 'fishing_treasure_chest',
    'fishing_mermaid', 'fishing_kraken', 'fishing_ancient_idol'
  )
) WHERE config_key = 'event_rules';

-- ============================================================
-- 3. 用子查询按名字查 itemId，构建事件规则
-- ============================================================

WITH ids AS (SELECT name, item_id FROM item)
UPDATE game_config SET value = value || (
  SELECT jsonb_agg(rule_obj) FROM (
    SELECT jsonb_build_object(
      'key', ekey, 'trigger', jsonb_build_object('type','afk_tick','activityKey', eactivity),
      'encounter', jsonb_build_object('tier', etier, 'title', etitle, 'description', edesc),
      'actions', (
        SELECT jsonb_agg(a) FROM (
          SELECT jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName',i.name) AS a
          FROM ids i WHERE i.name = eitem_name AND eitem_name IS NOT NULL
          UNION ALL
          SELECT jsonb_build_object('type', atype, 'chance', 1.0, 'min', amin, 'max', amax)
          WHERE atype IS NOT NULL
        ) sub
      )
    ) AS rule_obj
    FROM (VALUES
      ('gathering_herbs',      'common',    '采集草药',   '发现了一丛新鲜的药草，小心翼翼地摘下',                            'gathering', '新鲜药草', 'grant_gold',   3,  8),
      ('gathering_mushroom',   'common',    '蘑菇丛',     '潮湿的树根旁长满了色彩斑斓的蘑菇',                                'gathering', '彩色蘑菇', 'grant_gold',   3, 10),
      ('gathering_mineral',    'common',    '矿石露头',   '岩壁上露出一小截矿脉，用力敲下几块矿石',                          'gathering', '铜矿石',   'grant_gold',   5, 12),
      ('gathering_berries',    'common',    '浆果丛',     '灌木丛中挂满了成熟的浆果，酸甜可口',                                'gathering', '甜浆果',   'grant_exp',    3,  8),
      ('gathering_wood',       'common',    '伐木',       '找到一棵干枯的老树，收集了不少可用的木材',                          'gathering', '硬木',     'grant_gold',   4, 10),
      ('gathering_rare_flower','rare',      '稀有花卉！', '在隐蔽的山谷中发现了一株散发微光的月见草',                          'gathering', '月见草',   'grant_gold',  15, 35),
      ('gathering_crystal_vein','rare',     '水晶矿脉！', '脚下传来异样的光芒，竟然是一条水晶矿脉',                            'gathering', '水晶碎片', 'grant_aether',  3,  8),
      ('gathering_ancient_ruins','rare',    '古代遗迹',   '在藤蔓覆盖的石墙后发现了一处古代遗迹，角落里有一块刻满符文的石板',  'gathering', '古代石板', 'grant_gold',  25, 50),
      ('gathering_spirit_tree','legendary', '精灵古树！', '一棵参天古树突然发出柔和的光芒，精灵的低语在耳边回荡……树洞中留下了几滴精灵露水','gathering','精灵露水','grant_gold',60,120),
      ('fishing_carp',         'common',    '钓到鲤鱼',   '鱼竿一沉，一条肥美的鲤鱼上钩了',                                    'fishing',   '肥美鲤鱼', 'grant_gold',   4, 10),
      ('fishing_seaweed',      'common',    '捞到水草',   '拉上来一团湿漉漉的水草……虽然不是鱼，但也许能卖几个铜板',            'fishing',   '水草束',   'grant_gold',   2,  5),
      ('fishing_turtle',       'common',    '遇到老龟',   '一只老龟慢悠悠地游过，对你点了点头，似乎在祝福你',                    'fishing',   NULL,       'grant_exp',    5, 12),
      ('fishing_boot',         'common',    '一只旧靴子', '费了好大力气拉上来……是一只破旧的靴子。嗯，至少能卖两个铜板？',        'fishing',   NULL,       'grant_gold',   3,  8),
      ('fishing_school',       'common',    '鱼群过境',   '一大群银色小鱼游过，鱼竿都快忙不过来了！',                            'fishing',   NULL,       'grant_gold',   8, 20),
      ('fishing_golden_fish',  'rare',      '金色鲤鱼！', '水面金光一闪，一条罕见的金色鲤鱼跃出水面！传说它能带来好运',          'fishing',   '金色鲤鱼', 'grant_gold',  15, 35),
      ('fishing_treasure_chest','rare',     '海底宝箱！', '鱼钩挂住了什么沉重的东西……竟然是一只沉入水底的宝箱！里面装满了金币',  'fishing',   '海底宝箱', 'grant_gold',  30, 70),
      ('fishing_mermaid',      'rare',      '人鱼的馈赠', '一位人鱼浮出水面，将一颗珍珠放在你的鱼篓里，微笑着沉入水中',          'fishing',   '人鱼珍珠', 'grant_gold',  20, 45),
      ('fishing_kraken',       'legendary', '海怪出没！', '海面突然剧烈翻涌，一只巨大的触手从水下伸出！你拼命收线，竟然从触手上扯下了一块宝石……','fishing','海蓝宝石','grant_gold',60,130),
      ('fishing_ancient_idol', 'legendary', '远古神像',   '鱼线缠住了一个沉在水底的神秘雕像，上面刻满了看不懂的符文。靠近时，你感到一股强大的力量涌入体内……','fishing','远古神像','grant_gold',80,150)
    ) AS t(ekey, etier, etitle, edesc, eactivity, eitem_name, atype, amin, amax)
  ) AS all_rules
) WHERE config_key = 'event_rules';

-- ============================================================
-- 4. 追加额外 action（以太/经验）给部分事件
-- ============================================================

-- gathering_rare_flower: +exp
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'gathering_rare_flower' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_exp','chance',1.0,'min',5,'max',15)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- gathering_crystal_vein: +gold
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'gathering_crystal_vein' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_gold','chance',1.0,'min',20,'max',40)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- gathering_ancient_ruins: +exp
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'gathering_ancient_ruins' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_exp','chance',1.0,'min',10,'max',25)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- gathering_spirit_tree: +aether +exp
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'gathering_spirit_tree' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(
        jsonb_build_object('type','grant_aether','chance',1.0,'min',5,'max',12),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',20,'max',50)
      ))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- fishing_golden_fish: +aether
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'fishing_golden_fish' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_aether','chance',1.0,'min',1,'max',3)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- fishing_mermaid: +aether
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'fishing_mermaid' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_aether','chance',1.0,'min',2,'max',5)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- fishing_kraken: +aether
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'fishing_kraken' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_aether','chance',1.0,'min',5,'max',12)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- fishing_ancient_idol: +exp +aether
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'fishing_ancient_idol' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(
        jsonb_build_object('type','grant_exp','chance',1.0,'min',20,'max',50),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',6,'max',15)
      ))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- fishing_turtle: +gold
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'fishing_turtle' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_gold','chance',1.0,'min',3,'max',8)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';

-- fishing_school: +exp
UPDATE game_config SET value = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'key' = 'fishing_school' THEN
      jsonb_set(elem, '{actions}', elem->'actions' || jsonb_build_array(jsonb_build_object('type','grant_exp','chance',1.0,'min',5,'max',10)))
    ELSE elem END
  )
  FROM jsonb_array_elements(value) elem
) WHERE config_key = 'event_rules';
