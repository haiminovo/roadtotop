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
  gold BIGINT NOT NULL DEFAULT 0,
  aether_crystal BIGINT NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL,
  agility INTEGER NOT NULL,
  intelligence INTEGER NOT NULL,
  vitality INTEGER NOT NULL,
  avatar_seed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  slot TEXT NOT NULL,
  description TEXT NOT NULL,
  sell_price INTEGER NOT NULL DEFAULT 0,
  stat_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backpack (
  backpack_id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES "role"(role_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, item_id)
);

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

INSERT INTO item (item_id, name, rarity, slot, description, sell_price, stat_json, updated_at)
VALUES
  (
    'rusty-blade',
    '生锈短剑',
    'white',
    'weapon',
    '开荒时勉强能用的短剑。',
    12,
    '{"strength": 2}'::jsonb,
    NOW()
  ),
  (
    'oak-staff',
    '橡木法杖',
    'white',
    'weapon',
    '粗糙的入门法杖，适合法师起步。',
    12,
    '{"intelligence": 2}'::jsonb,
    NOW()
  ),
  (
    'field-hoe',
    '旧铁锄',
    'white',
    'weapon',
    '农活与近身防卫两不误的旧工具。',
    10,
    '{"vitality": 1, "agility": 1}'::jsonb,
    NOW()
  ),
  (
    'forest-cloak',
    '林地披风',
    'green',
    'armor',
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
    '会在冒险者启程时发放的基础指环。',
    36,
    '{"strength": 1, "intelligence": 1, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'training-bow',
    '练习短弓',
    'white',
    'weapon',
    '拉力一般，但足够让新手学会瞄准与走位。',
    18,
    '{"agility": 2}'::jsonb,
    NOW()
  ),
  (
    'leather-cap',
    '皮质便帽',
    'white',
    'armor',
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
    '轻量护腕，让抬手与闪避动作更利落。',
    16,
    '{"agility": 1, "intelligence": 1}'::jsonb,
    NOW()
  ),
  (
    'bronze-longsword',
    '青铜长剑',
    'green',
    'weapon',
    '保养得当的军用品，劈砍手感远胜生锈短剑。',
    48,
    '{"strength": 3, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'whisper-wand',
    '低语木杖',
    'green',
    'weapon',
    '杖身会在夜里发出轻鸣，能稳定初阶法术。',
    46,
    '{"intelligence": 3, "agility": 1}'::jsonb,
    NOW()
  ),
  (
    'hunter-leathers',
    '猎人皮甲',
    'green',
    'armor',
    '柔韧结实，适合长时间追踪与奔行。',
    54,
    '{"agility": 2, "vitality": 2}'::jsonb,
    NOW()
  ),
  (
    'amber-charm',
    '琥珀护符',
    'green',
    'accessory',
    '封着温热树脂的护符，能让心神更稳定。',
    52,
    '{"intelligence": 2, "vitality": 1}'::jsonb,
    NOW()
  ),
  (
    'moonshadow-dagger',
    '月影短匕',
    'blue',
    'weapon',
    '刀锋轻薄如月光，适合迅捷而精准的出手。',
    96,
    '{"agility": 4, "intelligence": 1}'::jsonb,
    NOW()
  ),
  (
    'runic-vest',
    '符纹战衣',
    'blue',
    'armor',
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
    '粗犷却实用的护符，佩戴后胆气更足。',
    98,
    '{"strength": 2, "agility": 2}'::jsonb,
    NOW()
  ),
  (
    'stormglass-staff',
    '风暴晶杖',
    'purple',
    'weapon',
    '杖芯封着风暴碎晶，能显著放大施法者感知。',
    188,
    '{"intelligence": 5, "agility": 2}'::jsonb,
    NOW()
  ),
  (
    'knightwatch-mail',
    '守夜骑士甲',
    'purple',
    'armor',
    '历经修补的厚重甲胄，仍保留着可靠的守护感。',
    210,
    '{"strength": 3, "vitality": 5}'::jsonb,
    NOW()
  ),
  (
    'dawnfire-pendant',
    '晨焰坠饰',
    'orange',
    'accessory',
    '内部像封着一缕朝阳，能同时提振体魄与精神。',
    320,
    '{"strength": 2, "intelligence": 3, "vitality": 3}'::jsonb,
    NOW()
  )
ON CONFLICT (item_id) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  slot = EXCLUDED.slot,
  description = EXCLUDED.description,
  sell_price = EXCLUDED.sell_price,
  stat_json = EXCLUDED.stat_json,
  updated_at = NOW();
