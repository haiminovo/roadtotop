-- ============================================================
-- Road To Top - 数据库初始化
-- 放置 MMORPG 核心表 + 种子数据
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS "user" (
  user_id       SERIAL PRIMARY KEY,
  guest_token   VARCHAR(128) UNIQUE,
  account_type  VARCHAR(16) NOT NULL DEFAULT 'guest', -- guest | registered
  username      VARCHAR(32) UNIQUE,
  password_hash VARCHAR(128),
  password_salt VARCHAR(32),
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_guest_token ON "user"(guest_token) WHERE guest_token IS NOT NULL;
CREATE UNIQUE INDEX idx_user_username ON "user"(username) WHERE username IS NOT NULL;

-- 角色表（每个用户一个角色）
CREATE TABLE IF NOT EXISTS role (
  role_id          SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL UNIQUE REFERENCES "user"(user_id),
  name             VARCHAR(32) NOT NULL,
  race_key         VARCHAR(32) NOT NULL,
  class_key        VARCHAR(32) NOT NULL,
  level            INTEGER NOT NULL DEFAULT 1,
  exp              INTEGER NOT NULL DEFAULT 0,
  gold             INTEGER NOT NULL DEFAULT 0,
  aether_crystal   INTEGER NOT NULL DEFAULT 0,
  strength         INTEGER NOT NULL DEFAULT 5,
  intelligence     INTEGER NOT NULL DEFAULT 5,
  agility          INTEGER NOT NULL DEFAULT 5,
  vitality         INTEGER NOT NULL DEFAULT 5,
  current_health   INTEGER NOT NULL DEFAULT 100,
  avatar_seed      VARCHAR(64) NOT NULL DEFAULT 'default',
  skill_state      JSONB NOT NULL DEFAULT '{"equippedSkills":[],"learnedSkills":[]}'::jsonb,
  pvp_rating       INTEGER NOT NULL DEFAULT 1000,
  pvp_wins         INTEGER NOT NULL DEFAULT 0,
  pvp_losses       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_user_id ON role(user_id);

-- 物品目录（全服共享配置）
CREATE TABLE IF NOT EXISTS item (
  item_id      SERIAL PRIMARY KEY,
  name         VARCHAR(64) NOT NULL,
  rarity       VARCHAR(16) NOT NULL DEFAULT 'white', -- white/green/blue/purple/orange
  item_type    VARCHAR(32) NOT NULL,                  -- equipment/skill_book/material
  skill_key    VARCHAR(32),
  icon_key     VARCHAR(64),
  slot         VARCHAR(32),                           -- head/hand/torso/legs/feet/neck/accessory
  slot_usage   INTEGER NOT NULL DEFAULT 1,
  sell_price   INTEGER NOT NULL DEFAULT 0,
  description  TEXT NOT NULL DEFAULT '',
  stat_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  level_requirement INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 背包（玩家库存）
CREATE TABLE IF NOT EXISTS backpack (
  backpack_id          SERIAL PRIMARY KEY,
  role_id              INTEGER NOT NULL REFERENCES role(role_id),
  item_id              INTEGER NOT NULL REFERENCES item(item_id),
  quantity             INTEGER NOT NULL DEFAULT 1,
  equipped             BOOLEAN NOT NULL DEFAULT FALSE,
  equipped_slot_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, item_id)
);

CREATE INDEX idx_backpack_role_id ON backpack(role_id);

-- 挂机状态
CREATE TABLE IF NOT EXISTS afk (
  afk_id              SERIAL PRIMARY KEY,
  role_id             INTEGER NOT NULL UNIQUE REFERENCES role(role_id),
  status              VARCHAR(16) NOT NULL DEFAULT 'idle', -- idle | afk | battle
  activity_key        VARCHAR(32) NOT NULL DEFAULT 'combat',
  map_key             VARCHAR(32) NOT NULL DEFAULT 'plains',
  pending_gold        INTEGER NOT NULL DEFAULT 0,
  pending_aether      INTEGER NOT NULL DEFAULT 0,
  pending_exp         INTEGER NOT NULL DEFAULT 0,
  accrued_seconds     INTEGER NOT NULL DEFAULT 0,
  last_settled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recent_encounters   JSONB NOT NULL DEFAULT '[]'::jsonb,
  battle_state        JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_afk_role_id ON afk(role_id);

-- 游戏配置（动态键值对）
CREATE TABLE IF NOT EXISTS game_config (
  config_key   VARCHAR(64) PRIMARY KEY,
  config_type  VARCHAR(32) NOT NULL,
  value        JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 交易市场
CREATE TABLE IF NOT EXISTS market_listing (
  listing_id          SERIAL PRIMARY KEY,
  seller_role_id      INTEGER NOT NULL REFERENCES role(role_id),
  item_id             INTEGER NOT NULL REFERENCES item(item_id),
  category_key        VARCHAR(32) NOT NULL,
  price               INTEGER NOT NULL,
  status              VARCHAR(16) NOT NULL DEFAULT 'active', -- active | sold | cancelled
  buyer_role_id       INTEGER REFERENCES role(role_id),
  sold_price          INTEGER,
  fee_amount          INTEGER,
  seller_receive_amount INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_status_price ON market_listing(status, price);
CREATE INDEX idx_market_seller ON market_listing(seller_role_id, status);

-- 聊天记录
CREATE TABLE IF NOT EXISTS chat_log (
  chat_id      SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES "user"(user_id),
  role_id      INTEGER REFERENCES role(role_id),
  channel_key  VARCHAR(32) NOT NULL DEFAULT 'world',
  sender_name  VARCHAR(32) NOT NULL,
  content      VARCHAR(256) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_created ON chat_log(created_at DESC);
CREATE INDEX idx_chat_channel ON chat_log(channel_key, created_at DESC);

-- PVP 战斗记录
CREATE TABLE IF NOT EXISTS pvp_battle (
  battle_id        SERIAL PRIMARY KEY,
  challenger_id    INTEGER NOT NULL REFERENCES role(role_id),
  defender_id      INTEGER NOT NULL REFERENCES role(role_id),
  winner_id        INTEGER REFERENCES role(role_id),
  battle_log       JSONB NOT NULL DEFAULT '[]'::jsonb,
  rating_change    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pvp_challenger ON pvp_battle(challenger_id, created_at DESC);
CREATE INDEX idx_pvp_defender ON pvp_battle(defender_id, created_at DESC);

-- ============================================================
-- 种子数据
-- ============================================================

-- 种族配置
INSERT INTO game_config (config_key, config_type, value) VALUES
('races', 'array', '[
  {"key":"human","name":"人类","description":"均衡型种族，全面发展","statBonus":{"strength":1,"intelligence":1,"agility":1,"vitality":1}},
  {"key":"elf","name":"精灵","description":"敏捷聪慧，擅长魔法","statBonus":{"strength":0,"intelligence":3,"agility":2,"vitality":-1}},
  {"key":"dwarf","name":"矮人","description":"强壮坚韧，天生战士","statBonus":{"strength":3,"intelligence":0,"agility":-1,"vitality":3}},
  {"key":"orc","name":"兽人","description":"力量惊人，近战之王","statBonus":{"strength":4,"intelligence":-2,"agility":1,"vitality":2}},
  {"key":"lizardfolk","name":"蜥蜴人","description":"灵活多变，适应力强","statBonus":{"strength":1,"intelligence":1,"agility":3,"vitality":0}},
  {"key":"moonkin","name":"月灵","description":"神秘优雅，魔法天赋","statBonus":{"strength":-1,"intelligence":4,"agility":1,"vitality":1}}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 职业配置
INSERT INTO game_config (config_key, config_type, value) VALUES
('classes', 'array', '[
  {"key":"warrior","name":"战士","description":"近战物理输出，高生命","baseStats":{"strength":8,"intelligence":2,"agility":4,"vitality":8}},
  {"key":"mage","name":"法师","description":"远程魔法输出，高伤害","baseStats":{"strength":2,"intelligence":9,"agility":3,"vitality":4}},
  {"key":"farmer","name":"农夫","description":"采集专家，高产出","baseStats":{"strength":5,"intelligence":4,"agility":3,"vitality":7}},
  {"key":"ranger","name":"游侠","description":"均衡输出，高敏捷","baseStats":{"strength":5,"intelligence":4,"agility":8,"vitality":5}},
  {"key":"priest","name":"牧师","description":"治疗辅助，高智力","baseStats":{"strength":3,"intelligence":8,"agility":3,"vitality":7}},
  {"key":"rogue","name":"盗贼","description":"高爆发，高暴击","baseStats":{"strength":6,"intelligence":3,"agility":9,"vitality":3}}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 活动类型配置
INSERT INTO game_config (config_key, config_type, value) VALUES
('activities', 'array', '[
  {"key":"combat","name":"战斗","description":"与怪物战斗，获取经验和战利品"},
  {"key":"gathering","name":"采集","description":"采集资源，获取材料"},
  {"key":"fishing","name":"钓鱼","description":"悠闲钓鱼，获取稀有物品"}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 地图配置
INSERT INTO game_config (config_key, config_type, value) VALUES
('maps', 'array', '[
  {"key":"plains","name":"翡翠平原","description":"新手村外的绿色草原","levelRequired":1,"goldPerTask":5,"expPerTask":8,"aetherPerTask":0},
  {"key":"forest","name":"迷雾森林","description":"古老的森林深处","levelRequired":5,"goldPerTask":12,"expPerTask":18,"aetherPerTask":0},
  {"key":"cave","name":"水晶洞穴","description":"闪耀着光芒的地下洞窟","levelRequired":10,"goldPerTask":25,"expPerTask":35,"aetherPerTask":1},
  {"key":"volcano","name":"烈焰火山","description":"炽热的岩浆地带","levelRequired":15,"goldPerTask":45,"expPerTask":60,"aetherPerTask":2},
  {"key":"ruins","name":"远古遗迹","description":"沉睡着强大守卫的废墟","levelRequired":20,"goldPerTask":80,"expPerTask":100,"aetherPerTask":3},
  {"key":"void","name":"虚空裂隙","description":"维度之间的混沌空间","levelRequired":25,"goldPerTask":150,"expPerTask":180,"aetherPerTask":5}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 技能模板
INSERT INTO game_config (config_key, config_type, value) VALUES
('skills', 'array', '[
  {"key":"slash","name":"斩击","category":"attack","description":"基础物理攻击","baseDamage":10,"levelGrowth":2,"maxUses":99,"cooldown":0,"effects":[]},
  {"key":"fireball","name":"火球术","category":"spell","description":"发射一枚火球","baseDamage":15,"levelGrowth":3,"maxUses":5,"cooldown":2,"effects":[{"type":"damage_over_time","chance":0.3,"value":3,"duration":3}]},
  {"key":"heal","name":"治愈术","category":"spell","description":"恢复生命值","baseDamage":-12,"levelGrowth":2,"maxUses":3,"cooldown":3,"effects":[]},
  {"key":"shield_bash","name":"盾击","category":"attack","description":"用盾牌猛击敌人","baseDamage":8,"levelGrowth":1,"maxUses":3,"cooldown":2,"effects":[{"type":"stun","chance":0.4,"duration":1}]},
  {"key":"poison_blade","name":"毒刃","category":"attack","description":"涂毒的武器攻击","baseDamage":7,"levelGrowth":1,"maxUses":3,"cooldown":2,"effects":[{"type":"damage_over_time","chance":0.6,"value":4,"duration":4}]},
  {"key":"guard","name":"防御姿态","category":"guard","description":"进入防御状态减少伤害","baseDamage":0,"levelGrowth":0,"maxUses":2,"cooldown":4,"effects":[{"type":"defense_up","value":0.5,"duration":2}]},
  {"key":"lightning","name":"闪电链","category":"spell","description":"释放连锁闪电","baseDamage":18,"levelGrowth":4,"maxUses":3,"cooldown":3,"effects":[]},
  {"key":"backstab","name":"背刺","category":"attack","description":"从背后偷袭","baseDamage":20,"levelGrowth":3,"maxUses":2,"cooldown":3,"effects":[]},
  {"key":"bandage","name":"包扎","category":"spell","description":"简单包扎伤口","baseDamage":-8,"levelGrowth":1,"maxUses":5,"cooldown":1,"effects":[]},
  {"key":"war_cry","name":"战吼","category":"attack","description":"鼓舞士气","baseDamage":5,"levelGrowth":1,"maxUses":2,"cooldown":4,"effects":[{"type":"attack_up","value":0.3,"duration":3}]}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 怪物模板
INSERT INTO game_config (config_key, config_type, value) VALUES
('enemies', 'array', '[
  {"key":"slime","name":"史莱姆","mapKey":"plains","baseHealth":30,"statWeights":{"strength":0.5,"intelligence":0.2,"agility":0.3,"vitality":0.5},"fixedSkillKeys":["slash"],"skillCaps":{"attack":2,"spell":0,"guard":0},"goldDrop":3,"expDrop":5},
  {"key":"wolf","name":"灰狼","mapKey":"plains","baseHealth":50,"statWeights":{"strength":0.8,"intelligence":0.1,"agility":0.7,"vitality":0.6},"fixedSkillKeys":["slash"],"skillCaps":{"attack":3,"spell":0,"guard":0},"goldDrop":6,"expDrop":10},
  {"key":"goblin","name":"哥布林","mapKey":"forest","baseHealth":80,"statWeights":{"strength":0.6,"intelligence":0.4,"agility":0.8,"vitality":0.7},"fixedSkillKeys":["slash","poison_blade"],"skillCaps":{"attack":3,"spell":1,"guard":0},"goldDrop":12,"expDrop":18},
  {"key":"bear","name":"黑熊","mapKey":"forest","baseHealth":120,"statWeights":{"strength":1.0,"intelligence":0.1,"agility":0.4,"vitality":1.2},"fixedSkillKeys":["slash","shield_bash"],"skillCaps":{"attack":3,"spell":0,"guard":1},"goldDrop":18,"expDrop":25},
  {"key":"skeleton","name":"骷髅战士","mapKey":"cave","baseHealth":150,"statWeights":{"strength":0.9,"intelligence":0.3,"agility":0.6,"vitality":1.0},"fixedSkillKeys":["slash","shield_bash"],"skillCaps":{"attack":3,"spell":0,"guard":2},"goldDrop":25,"expDrop":35},
  {"key":"fire_elemental","name":"火元素","mapKey":"volcano","baseHealth":200,"statWeights":{"strength":0.3,"intelligence":1.2,"agility":0.5,"vitality":0.8},"fixedSkillKeys":["fireball","lightning"],"skillCaps":{"attack":1,"spell":4,"guard":0},"goldDrop":45,"expDrop":60},
  {"key":"dragon_whelp","name":"幼龙","mapKey":"ruins","baseHealth":350,"statWeights":{"strength":1.2,"intelligence":0.8,"agility":0.7,"vitality":1.5},"fixedSkillKeys":["slash","fireball","shield_bash"],"skillCaps":{"attack":3,"spell":2,"guard":1},"goldDrop":80,"expDrop":100},
  {"key":"void_walker","name":"虚空行者","mapKey":"void","baseHealth":500,"statWeights":{"strength":1.0,"intelligence":1.5,"agility":1.0,"vitality":1.8},"fixedSkillKeys":["lightning","fireball","backstab","guard"],"skillCaps":{"attack":3,"spell":3,"guard":2},"goldDrop":150,"expDrop":180}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 事件规则配置
INSERT INTO game_config (config_key, config_type, value) VALUES
('event_rules', 'array', '[
  {"key":"common_drop","trigger":{"type":"enemy_kill","mapKey":null},"encounter":{"tier":"common","title":"战斗胜利","description":"击败了敌人"},"actions":[{"type":"grant_gold","chance":1.0,"min":1,"max":3},{"type":"grant_exp","chance":1.0,"min":2,"max":5}]},
  {"key":"rare_material","trigger":{"type":"enemy_kill","mapKey":null},"encounter":{"tier":"rare","title":"稀有掉落！","description":"发现了稀有材料"},"actions":[{"type":"grant_item","chance":0.1,"itemType":"material","rarity":"green"}]},
  {"key":"legendary_find","trigger":{"type":"afk_tick","mapKey":null},"encounter":{"tier":"legendary","title":"传说发现！","description":"偶然发现了传说级宝物"},"actions":[{"type":"grant_item","chance":0.01,"itemType":"equipment","rarity":"purple"},{"type":"grant_aether","chance":0.05,"min":1,"max":3}]},
  {"key":"combat_encounter","trigger":{"type":"afk_tick","activityKey":"combat"},"encounter":{"tier":"common","title":"遭遇战斗","description":"遇到了敌人"},"actions":[{"type":"start_battle","chance":0.3}]},
  {"key":"gathering_bonus","trigger":{"type":"afk_tick","activityKey":"gathering"},"encounter":{"tier":"common","title":"采集收获","description":"采集到了资源"},"actions":[{"type":"grant_gold","chance":0.8,"min":2,"max":8},{"type":"grant_item","chance":0.15,"itemType":"material","rarity":"white"}]},
  {"key":"fishing_treasure","trigger":{"type":"afk_tick","activityKey":"fishing"},"encounter":{"tier":"rare","title":"钓鱼宝箱！","description":"钓上来一个宝箱"},"actions":[{"type":"grant_gold","chance":0.5,"min":10,"max":50},{"type":"grant_aether","chance":0.08,"min":1,"max":2}]}
]'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 系统平衡参数
INSERT INTO game_config (config_key, config_type, value) VALUES
('system_balance', 'object', '{
  "maxOfflineSeconds": 86400,
  "afkTaskSeconds": 10,
  "levelCap": 50,
  "expPerLevel": 100,
  "expGrowthPerLevel": 10,
  "baseHealth": 50,
  "healthPerVitality": 12,
  "healthPerLevel": 2,
  "baseSkillSlots": 4,
  "skillSlotsPer5Int": 1,
  "baseSkillUsesPerBattle": 3,
  "skillUsesPer5Int": 1,
  "maxActionPoints": 100,
  "baseActionSpeed": 10,
  "actionSpeedPer5Agi": 1,
  "marketFeePercent": 10,
  "pvpRatingKFactor": 32,
  "pvpGoldReward": 50,
  "chatMaxLen": 160,
  "chatCooldownSeconds": 3,
  "chatHistoryLimit": 80
}'::jsonb)
ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value;

-- 初始物品数据
INSERT INTO item (name, rarity, item_type, icon_key, slot, slot_usage, sell_price, description, stat_json, level_requirement) VALUES
-- 白色装备
('木剑', 'white', 'equipment', 'GiBroadsword', 'hand', 1, 5, '新手用的木剑', '{"strength":2}', 1),
('布甲', 'white', 'equipment', 'GiLoincloth', 'torso', 1, 8, '简单的布制护甲', '{"vitality":2}', 1),
('皮靴', 'white', 'equipment', 'GiRunningShoe', 'feet', 1, 6, '轻便的皮靴', '{"agility":1}', 1),
('铁盾', 'white', 'equipment', 'GiShield', 'hand', 1, 10, '基础铁盾', '{"vitality":3}', 1),
-- 绿色装备
('精钢长剑', 'green', 'equipment', 'GiBroadsword', 'hand', 1, 25, '精心锻造的长剑', '{"strength":5,"agility":1}', 5),
('链甲', 'green', 'equipment', 'GiLoincloth', 'torso', 1, 30, '环环相扣的链甲', '{"vitality":6,"strength":1}', 5),
('猎人之靴', 'green', 'equipment', 'GiRunningShoe', 'feet', 1, 22, '猎人穿的靴子', '{"agility":4,"vitality":1}', 5),
('精灵头冠', 'green', 'equipment', 'GiCrown', 'head', 1, 28, '精灵族的头冠', '{"intelligence":5,"agility":1}', 5),
('银项链', 'green', 'equipment', 'GiNecklace', 'neck', 1, 20, '银制项链', '{"intelligence":3,"vitality":2}', 5),
-- 蓝色装备
('炎龙剑', 'blue', 'equipment', 'GiBroadsword', 'hand', 1, 80, '蕴含火焰之力的剑', '{"strength":10,"agility":3}', 10),
('秘银铠甲', 'blue', 'equipment', 'GiLoincloth', 'torso', 1, 90, '轻而坚固的秘银甲', '{"vitality":12,"strength":3}', 10),
('疾风之靴', 'blue', 'equipment', 'GiRunningShoe', 'feet', 1, 70, '疾风般的速度', '{"agility":8,"intelligence":2}', 10),
('贤者之冠', 'blue', 'equipment', 'GiCrown', 'head', 1, 85, '贤者戴过的帽子', '{"intelligence":10,"vitality":3}', 10),
('龙牙匕首', 'blue', 'equipment', 'GiDagger', 'hand', 1, 75, '用龙牙打造的匕首', '{"agility":8,"strength":5}', 10),
-- 紫色装备
('雷霆之怒', 'purple', 'equipment', 'GiBroadsword', 'hand', 1, 200, '雷神之锤的仿制品', '{"strength":18,"agility":5,"intelligence":3}', 20),
('暗影斗篷', 'purple', 'equipment', 'GiLoincloth', 'torso', 1, 220, '暗影编织的斗篷', '{"vitality":15,"agility":8,"intelligence":5}', 20),
('虚空之冠', 'purple', 'equipment', 'GiCrown', 'head', 1, 210, '来自虚空的王冠', '{"intelligence":18,"vitality":8}', 20),
('凤凰之靴', 'purple', 'equipment', 'GiRunningShoe', 'feet', 1, 190, '凤凰羽毛编织', '{"agility":15,"vitality":5,"strength":3}', 20),
-- 橙色装备
('天罚之剑', 'orange', 'equipment', 'GiBroadsword', 'hand', 1, 500, '传说中的神剑', '{"strength":30,"agility":10,"intelligence":8}', 30),
('神圣铠甲', 'orange', 'equipment', 'GiLoincloth', 'torso', 1, 550, '天使穿过的铠甲', '{"vitality":30,"strength":10,"agility":5}', 30),
-- 技能书
('火球术秘籍', 'green', 'skill_book', 'GiBookCover', NULL, 0, 30, '学习火球术', '{}', 5),
('治愈术秘籍', 'green', 'skill_book', 'GiBookCover', NULL, 0, 35, '学习治愈术', '{}', 5),
('盾击秘籍', 'blue', 'skill_book', 'GiBookCover', NULL, 0, 60, '学习盾击', '{}', 10),
('毒刃秘籍', 'blue', 'skill_book', 'GiBookCover', NULL, 0, 65, '学习毒刃', '{}', 10),
('闪电链秘籍', 'purple', 'skill_book', 'GiBookCover', NULL, 0, 150, '学习闪电链', '{}', 15),
('背刺秘籍', 'purple', 'skill_book', 'GiBookCover', NULL, 0, 140, '学习背刺', '{}', 15),
-- 材料
('破旧的布料', 'white', 'material', 'GiCloth', NULL, 0, 2, '普通的布料碎片', '{}', 1),
('狼牙', 'white', 'material', 'GiFang', NULL, 0, 3, '灰狼的牙齿', '{}', 1),
('哥布林耳朵', 'green', 'material', 'GiEar', NULL, 0, 8, '哥布林的耳朵作为证明', '{}', 5),
('龙鳞碎片', 'blue', 'material', 'GiDragonScales', NULL, 0, 25, '龙鳞的碎片', '{}', 10),
('虚空精华', 'purple', 'material', 'GiCrystalBall', NULL, 0, 60, '来自虚空的能量精华', '{}', 20);
