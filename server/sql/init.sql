CREATE TABLE IF NOT EXISTS "user" (
  user_id TEXT PRIMARY KEY,
  guest_token TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'guest',
  username TEXT,
  password_hash TEXT,
  password_salt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS password_salt TEXT;

CREATE TABLE IF NOT EXISTS "role" (
  role_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  race_key TEXT NOT NULL,
  class_key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  exp_curve_version INTEGER NOT NULL DEFAULT 2,
  gold BIGINT NOT NULL DEFAULT 0,
  aether_crystal BIGINT NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL,
  agility INTEGER NOT NULL,
  intelligence INTEGER NOT NULL,
  vitality INTEGER NOT NULL,
  current_health INTEGER NOT NULL DEFAULT 1,
  avatar_seed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "role"
ADD COLUMN IF NOT EXISTS current_health INTEGER;

ALTER TABLE "role"
ADD COLUMN IF NOT EXISTS exp_curve_version INTEGER;

UPDATE "role"
SET exp_curve_version = 1
WHERE exp_curve_version IS NULL;

ALTER TABLE "role"
ALTER COLUMN exp_curve_version SET DEFAULT 2;

ALTER TABLE "role"
ALTER COLUMN exp_curve_version SET NOT NULL;

UPDATE "role"
SET current_health = GREATEST(1, 50 + vitality * 12 + level * 2)
WHERE current_health IS NULL;

ALTER TABLE "role"
ALTER COLUMN current_health SET DEFAULT 1;

ALTER TABLE "role"
ALTER COLUMN current_health SET NOT NULL;

CREATE TABLE IF NOT EXISTS item (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  slot TEXT NOT NULL,
  slot_usage INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  sell_price INTEGER NOT NULL DEFAULT 0,
  stat_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE item
ADD COLUMN IF NOT EXISTS slot_usage INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS backpack (
  backpack_id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES "role"(role_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  equipped_slot_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, item_id)
);

ALTER TABLE backpack
ADD COLUMN IF NOT EXISTS equipped_slot_groups JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS market_listing (
  listing_id TEXT PRIMARY KEY,
  seller_role_id TEXT NOT NULL REFERENCES "role"(role_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES item(item_id) ON DELETE RESTRICT,
  category_key TEXT NOT NULL DEFAULT 'equipment',
  price BIGINT NOT NULL CHECK (price > 0),
  status TEXT NOT NULL DEFAULT 'active',
  buyer_role_id TEXT REFERENCES "role"(role_id) ON DELETE SET NULL,
  sold_price BIGINT,
  fee_amount BIGINT NOT NULL DEFAULT 0,
  seller_receive_amount BIGINT NOT NULL DEFAULT 0,
  seller_notice_seen BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS category_key TEXT NOT NULL DEFAULT 'equipment';

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS buyer_role_id TEXT REFERENCES "role"(role_id) ON DELETE SET NULL;

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS sold_price BIGINT;

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS fee_amount BIGINT NOT NULL DEFAULT 0;

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS seller_receive_amount BIGINT NOT NULL DEFAULT 0;

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS seller_notice_seen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

ALTER TABLE market_listing
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS afk (
  afk_id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL UNIQUE REFERENCES "role"(role_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle',
  map_key TEXT,
  started_at TIMESTAMPTZ,
  last_settled_at TIMESTAMPTZ,
  pending_gold BIGINT NOT NULL DEFAULT 0,
  pending_aether_crystal BIGINT NOT NULL DEFAULT 0,
  pending_exp BIGINT NOT NULL DEFAULT 0,
  accrued_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE afk
ADD COLUMN IF NOT EXISTS recent_encounters JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'chat_logs'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_logs'
      AND column_name = 'channel_key'
  ) THEN
    EXECUTE 'DROP TABLE chat_logs';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS chat_logs (
  chat_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES "role"(role_id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_user_id ON "role" (user_id);
CREATE INDEX IF NOT EXISTS idx_backpack_role_id ON backpack (role_id);
CREATE INDEX IF NOT EXISTS idx_market_listing_status_price ON market_listing (status, item_id, price, created_at);
CREATE INDEX IF NOT EXISTS idx_market_listing_seller_role_id ON market_listing (seller_role_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_afk_role_id ON afk (role_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_channel_key ON chat_logs (channel_key, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username_unique ON "user" (username) WHERE username IS NOT NULL;

DROP TABLE IF EXISTS task;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role'
      AND column_name = 'bound_gold'
  ) THEN
    EXECUTE 'UPDATE "role" SET gold = gold + COALESCE(bound_gold, 0)';
    EXECUTE 'ALTER TABLE "role" DROP COLUMN bound_gold';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'afk'
      AND column_name = 'pending_bound_gold'
  ) THEN
    EXECUTE 'UPDATE afk SET pending_gold = pending_gold + COALESCE(pending_bound_gold, 0)';
    EXECUTE 'ALTER TABLE afk DROP COLUMN pending_bound_gold';
  END IF;
END $$;

UPDATE afk
SET map_key = 'palmia-wilds'
WHERE map_key IS NOT NULL AND map_key <> 'palmia-wilds';

INSERT INTO item (item_id, name, rarity, slot, slot_usage, description, sell_price, stat_json, updated_at)
VALUES
  (
    'rusty-blade',
    '生锈短剑',
    'white',
    'hand',
    1,
    '开荒时勉强能用的短剑。',
    12,
    '{"strength": 2}'::jsonb,
    NOW()
  ),
  (
    'oak-staff',
    '橡木法杖',
    'white',
    'hand',
    2,
    '粗糙的入门法杖，适合法师起步。',
    12,
    '{"intelligence": 2}'::jsonb,
    NOW()
  ),
  (
    'field-hoe',
    '旧铁锄',
    'white',
    'hand',
    2,
    '农活与近身防卫两不误的旧工具。',
    10,
    '{"vitality": 1, "agility": 1}'::jsonb,
    NOW()
  ),
  (
    'forest-cloak',
    '林地披风',
    'green',
    'neck',
    1,
    '轻便耐磨，适合野外挂机。',
    30,
    '{"agility": 2, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'traveler-ring',
    '旅者戒指',
    'green',
    'accessory',
    1,
    '会在冒险者启程时发放的基础指环。',
    36,
    '{"strength": 1, "intelligence": 1, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'training-bow',
    '练习短弓',
    'white',
    'hand',
    2,
    '拉力一般，但足够让新手学会瞄准与走位。',
    18,
    '{"agility": 2}'::jsonb,
    NOW()
  ),
  (
    'leather-cap',
    '皮质便帽',
    'white',
    'head',
    1,
    '不起眼的小帽子，能挡一点风沙与碎石。',
    14,
    '{"vitality": 1, "agility": 1}'::jsonb,
    NOW()
  ),
  (
    'scout-bracers',
    '斥候护腕',
    'white',
    'accessory',
    1,
    '轻量护腕，让抬手与闪避动作更利落。',
    16,
    '{"agility": 1, "intelligence": 1}'::jsonb,
    NOW()
  ),
  (
    'bronze-longsword',
    '青铜长剑',
    'green',
    'hand',
    1,
    '保养得当的军用品，劈砍手感远胜生锈短剑。',
    48,
    '{"strength": 3, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'whisper-wand',
    '低语木杖',
    'green',
    'hand',
    1,
    '杖身会在夜里发出轻鸣，能稳定初阶法术。',
    46,
    '{"intelligence": 3, "agility": 1}'::jsonb,
    NOW()
  ),
  (
    'hunter-leathers',
    '猎人皮甲',
    'green',
    'torso',
    1,
    '柔韧结实，适合长时间追踪与奔行。',
    54,
    '{"agility": 2, "vitality": 2}'::jsonb,
    NOW()
  ),
  (
    'amber-charm',
    '琥珀护符',
    'green',
    'neck',
    1,
    '封着温热树脂的护符，能让心神更稳定。',
    52,
    '{"intelligence": 2, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'moonshadow-dagger',
    '月影短匕',
    'blue',
    'hand',
    1,
    '刀锋轻薄如月光，适合迅捷而精准的出手。',
    96,
    '{"agility": 4, "intelligence": 1}'::jsonb,
    NOW()
  ),
  (
    'runic-vest',
    '符纹战衣',
    'blue',
    'torso',
    1,
    '内衬刻着细密符纹，兼顾防护与法感引导。',
    104,
    '{"intelligence": 3, "vitality": 2}'::jsonb,
    NOW()
  ),
  (
    'wolfbone-talisman',
    '狼骨符坠',
    'blue',
    'accessory',
    1,
    '粗犷却实用的护符，佩戴后胆气更足。',
    98,
    '{"strength": 2, "agility": 2}'::jsonb,
    NOW()
  ),
  (
    'stormglass-staff',
    '风暴晶杖',
    'purple',
    'hand',
    2,
    '杖芯封着风暴碎晶，能显著放大施法者感知。',
    188,
    '{"intelligence": 5, "agility": 2}'::jsonb,
    NOW()
  ),
  (
    'knightwatch-mail',
    '守夜骑士甲',
    'purple',
    'torso',
    1,
    '历经修补的厚重甲胄，仍保留着可靠的守护感。',
    210,
    '{"strength": 3, "vitality": 5}'::jsonb,
    NOW()
  ),
  (
    'dawnfire-pendant',
    '晨焰坠饰',
    'orange',
    'neck',
    1,
    '内部像封着一缕朝阳，能同时提振体魄与精神。',
    320,
    '{"strength": 2, "intelligence": 3, "vitality": 3}'::jsonb,
    NOW()
  )
ON CONFLICT (item_id) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  slot = EXCLUDED.slot,
  slot_usage = EXCLUDED.slot_usage,
  description = EXCLUDED.description,
  sell_price = EXCLUDED.sell_price,
  stat_json = EXCLUDED.stat_json,
  updated_at = NOW();

UPDATE backpack
SET equipped_slot_groups = CASE item_id
  WHEN 'rusty-blade' THEN '[["hand-1"]]'::jsonb
  WHEN 'oak-staff' THEN '[["hand-1","hand-2"]]'::jsonb
  WHEN 'field-hoe' THEN '[["hand-1","hand-2"]]'::jsonb
  WHEN 'training-bow' THEN '[["hand-1","hand-2"]]'::jsonb
  WHEN 'bronze-longsword' THEN '[["hand-1"]]'::jsonb
  WHEN 'whisper-wand' THEN '[["hand-1"]]'::jsonb
  WHEN 'moonshadow-dagger' THEN '[["hand-1"]]'::jsonb
  WHEN 'stormglass-staff' THEN '[["hand-1","hand-2"]]'::jsonb
  WHEN 'forest-cloak' THEN '[["neck-1"]]'::jsonb
  WHEN 'traveler-ring' THEN '[["accessory-1"]]'::jsonb
  WHEN 'leather-cap' THEN '[["head-1"]]'::jsonb
  WHEN 'hunter-leathers' THEN '[["torso-1"]]'::jsonb
  WHEN 'amber-charm' THEN '[["neck-1"]]'::jsonb
  WHEN 'runic-vest' THEN '[["torso-1"]]'::jsonb
  WHEN 'wolfbone-talisman' THEN '[["accessory-1"]]'::jsonb
  WHEN 'knightwatch-mail' THEN '[["torso-1"]]'::jsonb
  WHEN 'dawnfire-pendant' THEN '[["neck-1"]]'::jsonb
  WHEN 'scout-bracers' THEN '[["accessory-1"]]'::jsonb
  ELSE COALESCE(equipped_slot_groups, '[]'::jsonb)
END
WHERE equipped = TRUE
  AND COALESCE(equipped_slot_groups, '[]'::jsonb) = '[]'::jsonb;

UPDATE backpack
SET equipped = jsonb_array_length(COALESCE(equipped_slot_groups, '[]'::jsonb)) > 0;
