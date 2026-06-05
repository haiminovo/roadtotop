-- Buy orders: users place bids to purchase items at a specified price.
-- When a sell listing is created at price <= highest buy order, auto-match executes.

CREATE TABLE IF NOT EXISTS market_buy_order (
  order_id TEXT PRIMARY KEY,
  buyer_role_id TEXT NOT NULL REFERENCES "role"(role_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES item(item_id) ON DELETE RESTRICT,
  category_key TEXT NOT NULL DEFAULT 'equipment',
  price BIGINT NOT NULL CHECK (price > 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  filled_quantity INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_buy_order_active
  ON market_buy_order (item_id, price DESC, created_at ASC)
  WHERE status = 'active';
