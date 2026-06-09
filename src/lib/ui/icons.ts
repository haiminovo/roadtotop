// ============================================================
// 游戏图标映射
// ============================================================

import {
  GiBroadsword, GiShield, GiCrown, GiRunningShoe, GiDaggers,
  GiBookCover, GiCrystalBall, GiFangs, GiPear, GiDragonBalls,
  GiSloth, GiLoincloth, GiNecklace, GiPotionBall,
  GiTreasureMap, GiDungeonGate, GiForestCamp, GiMountainCave,
  GiVolcano, GiCastle, GiCrossedSwords, GiFishing, GiMining,
  GiChestArmor, GiHelmet, GiGauntlet, GiBootKick,
} from 'react-icons/gi';

export const ICON_MAP: Record<string, unknown> = {
  GiBroadsword, GiShield, GiCrown, GiRunningShoe, GiDaggers,
  GiBookCover, GiCrystalBall, GiFangs, GiPear, GiDragonBalls,
  GiSloth, GiLoincloth, GiNecklace, GiPotionBall,
  GiTreasureMap, GiDungeonGate, GiForestCamp, GiMountainCave,
  GiVolcano, GiCastle, GiCrossedSwords, GiFishing, GiMining,
  GiChestArmor, GiHelmet, GiGauntlet, GiBootKick,
};

export function getIcon(iconKey?: string) {
  if (!iconKey) return GiCrystalBall;
  return (ICON_MAP[iconKey] || GiCrystalBall) as typeof GiCrystalBall;
}
