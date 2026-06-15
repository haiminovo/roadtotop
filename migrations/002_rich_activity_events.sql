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
-- 2. 删除旧事件 + 旧版本可能已插入的新事件
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
-- 3. 用 CTE 按名字查 itemId，构建事件规则
-- ============================================================

WITH ids AS (SELECT name, item_id FROM item),
rules(rule_obj) AS (VALUES
  -- ===== 采集 =====
  (
    (SELECT jsonb_build_object(
      'key','gathering_herbs','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','采集草药','description','发现了一丛新鲜的药草，小心翼翼地摘下'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','新鲜药草'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',1,'max',3)
      )) FROM ids i WHERE i.name='新鲜药草')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_mushroom','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','蘑菇丛','description','潮湿的树根旁长满了色彩斑斓的蘑菇'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','彩色蘑菇'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',1,'max',4)
      )) FROM ids i WHERE i.name='彩色蘑菇')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_mineral','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','矿石露头','description','岩壁上露出一小截矿脉，用力敲下几块矿石'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','铜矿石'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',2,'max',6)
      )) FROM ids i WHERE i.name='铜矿石')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_berries','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','浆果丛','description','灌木丛中挂满了成熟的浆果，酸甜可口'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','甜浆果'),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',1,'max',2)
      )) FROM ids i WHERE i.name='甜浆果')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_wood','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','伐木','description','找到一棵干枯的老树，收集了不少可用的木材'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','硬木'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',1,'max',5)
      )) FROM ids i WHERE i.name='硬木')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_rare_flower','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','rare','title','稀有花卉！','description','在隐蔽的山谷中发现了一株散发微光的月见草'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','月见草'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',10,'max',25)
      )) FROM ids i WHERE i.name='月见草')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_crystal_vein','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','rare','title','水晶矿脉！','description','脚下传来异样的光芒，竟然是一条水晶矿脉'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','水晶碎片'),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',2,'max',5)
      )) FROM ids i WHERE i.name='水晶碎片')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_ancient_ruins','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','rare','title','古代遗迹','description','在藤蔓覆盖的石墙后发现了一处古代遗迹，角落里有一块刻满符文的石板'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','古代石板'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',15,'max',30),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',5,'max',15)
      )) FROM ids i WHERE i.name='古代石板')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_spirit_tree','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','legendary','title','精灵古树！','description','一棵参天古树突然发出柔和的光芒，精灵的低语在耳边回荡……树洞中留下了几滴精灵露水'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','精灵露水'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',50,'max',100),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',3,'max',8)
      )) FROM ids i WHERE i.name='精灵露水')
  ),
  -- ===== 钓鱼 =====
  (
    (SELECT jsonb_build_object(
      'key','fishing_carp','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','钓到鲤鱼','description','鱼竿一沉，一条肥美的鲤鱼上钩了'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','肥美鲤鱼'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',1,'max',3)
      )) FROM ids i WHERE i.name='肥美鲤鱼')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_seaweed','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','捞到水草','description','拉上来一团湿漉漉的水草……虽然不是鱼，但也许能卖几个铜板'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','水草束')
      )) FROM ids i WHERE i.name='水草束')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_turtle','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','遇到老龟','description','一只老龟慢悠悠地游过，对你点了点头，似乎在祝福你'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_exp','chance',1.0,'min',3,'max',6)
      )))
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_boot','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','一只旧靴子','description','费了好大力气拉上来……是一只破旧的靴子。嗯，至少能卖两个铜板？'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_gold','chance',1.0,'min',1,'max',2)
      )))
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_school','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','鱼群过境','description','一大群银色小鱼游过，鱼竿都快忙不过来了！'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_gold','chance',1.0,'min',5,'max',15),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',2,'max',4)
      )))
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_golden_fish','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','rare','title','金色鲤鱼！','description','水面金光一闪，一条罕见的金色鲤鱼跃出水面！传说它能带来好运'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','金色鲤鱼'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',10,'max',30)
      )) FROM ids i WHERE i.name='金色鲤鱼')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_treasure_chest','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','rare','title','海底宝箱！','description','鱼钩挂住了什么沉重的东西……竟然是一只沉入水底的宝箱！里面装满了金币'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','海底宝箱'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',30,'max',60)
      )) FROM ids i WHERE i.name='海底宝箱')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_mermaid','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','rare','title','人鱼的馈赠','description','一位人鱼浮出水面，将一颗珍珠放在你的鱼篓里，微笑着沉入水中'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','人鱼珍珠'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',10,'max',25)
      )) FROM ids i WHERE i.name='人鱼珍珠')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_kraken','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','legendary','title','海怪出没！','description','海面突然剧烈翻涌，一只巨大的触手从水下伸出！你拼命收线，竟然从触手上扯下了一块宝石……'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','海蓝宝石'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',50,'max',100),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',3,'max',8)
      )) FROM ids i WHERE i.name='海蓝宝石')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_ancient_idol','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','legendary','title','远古神像','description','鱼线缠住了一个沉在水底的神秘雕像，上面刻满了看不懂的符文。靠近时，你感到一股强大的力量涌入体内……'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','远古神像'),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',30,'max',60),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',5,'max',10)
      )) FROM ids i WHERE i.name='远古神像')
  )
)
UPDATE game_config
SET value = value || (SELECT jsonb_agg(rule_obj) FROM rules)
WHERE config_key = 'event_rules';
