-- ============================================================
-- 平衡三种活动的产出价值
-- 目标：每 task 期望产出大致相当，各有特色
--   战斗：金币+经验为主，风险高（可能战败）
--   采集：材料为主+经验，稳定但材料需要卖才有金币
--   钓鱼：金币为主+水晶，运气波动大
-- ============================================================

-- 调整地图基础产出：采集和钓鱼的地图产出和战斗分开
-- 当前所有活动共享同一套地图产出，这是合理的基准线
-- 通过事件规则来差异化

-- ============================================================
-- 采集事件：提高金币/经验，保持材料掉落
-- ============================================================

-- 删除旧的采集事件重新插入
UPDATE game_config SET value = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(value) elem
  WHERE elem->>'key' NOT IN (
    'gathering_herbs', 'gathering_mushroom', 'gathering_mineral',
    'gathering_berries', 'gathering_wood', 'gathering_rare_flower',
    'gathering_crystal_vein', 'gathering_ancient_ruins', 'gathering_spirit_tree'
  )
) WHERE config_key = 'event_rules';

WITH ids AS (SELECT name, item_id FROM item),
rules(rule_obj) AS (VALUES
  (
    (SELECT jsonb_build_object(
      'key','gathering_herbs','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','采集草药','description','发现了一丛新鲜的药草，小心翼翼地摘下'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','新鲜药草'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',3,'max',8)
      )) FROM ids i WHERE i.name='新鲜药草')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_mushroom','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','蘑菇丛','description','潮湿的树根旁长满了色彩斑斓的蘑菇'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','彩色蘑菇'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',3,'max',10)
      )) FROM ids i WHERE i.name='彩色蘑菇')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_mineral','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','矿石露头','description','岩壁上露出一小截矿脉，用力敲下几块矿石'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','铜矿石'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',5,'max',12)
      )) FROM ids i WHERE i.name='铜矿石')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_berries','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','浆果丛','description','灌木丛中挂满了成熟的浆果，酸甜可口'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','甜浆果'),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',3,'max',8)
      )) FROM ids i WHERE i.name='甜浆果')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_wood','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','common','title','伐木','description','找到一棵干枯的老树，收集了不少可用的木材'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','硬木'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',4,'max',10)
      )) FROM ids i WHERE i.name='硬木')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_rare_flower','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','rare','title','稀有花卉！','description','在隐蔽的山谷中发现了一株散发微光的月见草'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','月见草'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',15,'max',35),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',5,'max',15)
      )) FROM ids i WHERE i.name='月见草')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_crystal_vein','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','rare','title','水晶矿脉！','description','脚下传来异样的光芒，竟然是一条水晶矿脉'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','水晶碎片'),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',3,'max',8),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',20,'max',40)
      )) FROM ids i WHERE i.name='水晶碎片')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_ancient_ruins','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','rare','title','古代遗迹','description','在藤蔓覆盖的石墙后发现了一处古代遗迹，角落里有一块刻满符文的石板'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','古代石板'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',25,'max',50),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',10,'max',25)
      )) FROM ids i WHERE i.name='古代石板')
  ),
  (
    (SELECT jsonb_build_object(
      'key','gathering_spirit_tree','trigger',jsonb_build_object('type','afk_tick','activityKey','gathering'),
      'encounter',jsonb_build_object('tier','legendary','title','精灵古树！','description','一棵参天古树突然发出柔和的光芒，精灵的低语在耳边回荡……树洞中留下了几滴精灵露水'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','精灵露水'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',60,'max',120),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',5,'max',12),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',20,'max',50)
      )) FROM ids i WHERE i.name='精灵露水')
  )
)
UPDATE game_config
SET value = value || (SELECT jsonb_agg(rule_obj) FROM rules)
WHERE config_key = 'event_rules';

-- ============================================================
-- 钓鱼事件：提高金币奖励，补充普通事件
-- ============================================================

UPDATE game_config SET value = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(value) elem
  WHERE elem->>'key' NOT IN (
    'fishing_carp', 'fishing_seaweed', 'fishing_turtle', 'fishing_boot',
    'fishing_school', 'fishing_golden_fish', 'fishing_treasure_chest',
    'fishing_mermaid', 'fishing_kraken', 'fishing_ancient_idol'
  )
) WHERE config_key = 'event_rules';

WITH ids AS (SELECT name, item_id FROM item),
rules(rule_obj) AS (VALUES
  (
    (SELECT jsonb_build_object(
      'key','fishing_carp','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','钓到鲤鱼','description','鱼竿一沉，一条肥美的鲤鱼上钩了'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','肥美鲤鱼'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',4,'max',10)
      )) FROM ids i WHERE i.name='肥美鲤鱼')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_seaweed','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','捞到水草','description','拉上来一团湿漉漉的水草……虽然不是鱼，但也许能卖几个铜板'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','水草束'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',2,'max',5)
      )) FROM ids i WHERE i.name='水草束')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_turtle','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','遇到老龟','description','一只老龟慢悠悠地游过，对你点了点头，似乎在祝福你'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_exp','chance',1.0,'min',5,'max',12),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',3,'max',8)
      ))
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_boot','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','一只旧靴子','description','费了好大力气拉上来……是一只破旧的靴子。嗯，至少能卖两个铜板？'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_gold','chance',1.0,'min',3,'max',8)
      ))
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_school','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','common','title','鱼群过境','description','一大群银色小鱼游过，鱼竿都快忙不过来了！'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_gold','chance',1.0,'min',8,'max',20),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',5,'max',10)
      ))
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_golden_fish','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','rare','title','金色鲤鱼！','description','水面金光一闪，一条罕见的金色鲤鱼跃出水面！传说它能带来好运'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','金色鲤鱼'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',15,'max',35),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',1,'max',3)
      )) FROM ids i WHERE i.name='金色鲤鱼')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_treasure_chest','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','rare','title','海底宝箱！','description','鱼钩挂住了什么沉重的东西……竟然是一只沉入水底的宝箱！里面装满了金币'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','海底宝箱'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',30,'max',70)
      )) FROM ids i WHERE i.name='海底宝箱')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_mermaid','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','rare','title','人鱼的馈赠','description','一位人鱼浮出水面，将一颗珍珠放在你的鱼篓里，微笑着沉入水中'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','人鱼珍珠'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',20,'max',45),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',2,'max',5)
      )) FROM ids i WHERE i.name='人鱼珍珠')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_kraken','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','legendary','title','海怪出没！','description','海面突然剧烈翻涌，一只巨大的触手从水下伸出！你拼命收线，竟然从触手上扯下了一块宝石……'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','海蓝宝石'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',60,'max',130),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',5,'max',12)
      )) FROM ids i WHERE i.name='海蓝宝石')
  ),
  (
    (SELECT jsonb_build_object(
      'key','fishing_ancient_idol','trigger',jsonb_build_object('type','afk_tick','activityKey','fishing'),
      'encounter',jsonb_build_object('tier','legendary','title','远古神像','description','鱼线缠住了一个沉在水底的神秘雕像，上面刻满了看不懂的符文。靠近时，你感到一股强大的力量涌入体内……'),
      'actions',jsonb_build_array(
        jsonb_build_object('type','grant_item','chance',1.0,'itemId',i.item_id,'itemName','远古神像'),
        jsonb_build_object('type','grant_gold','chance',1.0,'min',80,'max',150),
        jsonb_build_object('type','grant_aether','chance',1.0,'min',6,'max',15),
        jsonb_build_object('type','grant_exp','chance',1.0,'min',20,'max',50)
      )) FROM ids i WHERE i.name='远古神像')
  )
)
UPDATE game_config
SET value = value || (SELECT jsonb_agg(rule_obj) FROM rules)
WHERE config_key = 'event_rules';
