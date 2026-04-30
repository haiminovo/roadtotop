CREATE TABLE IF NOT EXISTS "user" (
  user_id TEXT PRIMARY KEY,
  guest_token TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'guest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_role_user_id ON "role" (user_id);
CREATE INDEX IF NOT EXISTS idx_backpack_role_id ON backpack (role_id);
CREATE INDEX IF NOT EXISTS idx_afk_role_id ON afk (role_id);

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
  )
ON CONFLICT (item_id) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  slot = EXCLUDED.slot,
  description = EXCLUDED.description,
  sell_price = EXCLUDED.sell_price,
  stat_json = EXCLUDED.stat_json,
  updated_at = NOW();
