'use client';

import { GameSessionProvider } from '@/features/game/context/game-session-provider';
import { GameDashboard } from '@/features/game/components/game-dashboard';

export default function HomePage() {
  return (
    <GameSessionProvider>
      <GameDashboard />
    </GameSessionProvider>
  );
}
