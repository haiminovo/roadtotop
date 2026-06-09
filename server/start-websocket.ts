// ============================================================
// WebSocket 服务入口
// ============================================================

import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

import { ensureDatabaseInitialized } from './db.js';
import { startWebSocketServer } from './websocket-server.js';

const PORT = parseInt(process.env.WS_PORT || '8080', 10);

async function main() {
  await ensureDatabaseInitialized();
  startWebSocketServer(PORT);
}

main().catch((err) => {
  console.error('[WS] Failed to start:', err);
  process.exit(1);
});
