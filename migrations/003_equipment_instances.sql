-- ============================================================
-- 装备实例化：装备不再按 item_id 堆叠，每件装备拥有独立耐久
-- ============================================================

ALTER TABLE backpack
  ADD COLUMN IF NOT EXISTS current_durability NUMERIC(8,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_durability NUMERIC(8,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS repair_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE market_listing
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_durability NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS max_durability NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS repair_count INTEGER;

ALTER TABLE backpack
  ALTER COLUMN current_durability TYPE NUMERIC(8,2) USING current_durability::NUMERIC(8,2),
  ALTER COLUMN max_durability TYPE NUMERIC(8,2) USING max_durability::NUMERIC(8,2);

ALTER TABLE market_listing
  ALTER COLUMN current_durability TYPE NUMERIC(8,2) USING current_durability::NUMERIC(8,2),
  ALTER COLUMN max_durability TYPE NUMERIC(8,2) USING max_durability::NUMERIC(8,2);

ALTER TABLE backpack DROP CONSTRAINT IF EXISTS backpack_role_id_item_id_key;

INSERT INTO backpack (
  role_id, item_id, quantity, equipped, equipped_slot_groups,
  current_durability, max_durability, repair_count, created_at
)
SELECT
  b.role_id, b.item_id, 1, false, '[]'::jsonb,
  b.current_durability, b.max_durability, b.repair_count, b.created_at
FROM backpack b
JOIN item i ON i.item_id = b.item_id
CROSS JOIN generate_series(2, b.quantity)
WHERE i.item_type = 'equipment' AND b.quantity > 1;

UPDATE backpack
SET quantity = 1
WHERE item_id IN (SELECT item_id FROM item WHERE item_type = 'equipment')
  AND quantity <> 1;

ALTER TABLE backpack
  DROP CONSTRAINT IF EXISTS backpack_quantity_positive,
  ADD CONSTRAINT backpack_quantity_positive CHECK (quantity >= 1);

ALTER TABLE backpack
  DROP CONSTRAINT IF EXISTS backpack_durability_non_negative,
  ADD CONSTRAINT backpack_durability_non_negative CHECK (current_durability >= 0);

ALTER TABLE backpack
  DROP CONSTRAINT IF EXISTS backpack_max_durability_positive,
  ADD CONSTRAINT backpack_max_durability_positive CHECK (max_durability >= 1);

CREATE INDEX IF NOT EXISTS idx_backpack_role_item ON backpack(role_id, item_id);
