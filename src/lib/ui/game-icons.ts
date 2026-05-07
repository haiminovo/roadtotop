import type { IconType } from "react-icons";
import {
  GiArmorVest,
  GiArrowhead,
  GiBattleAxe,
  GiBilledCap,
  GiBracer,
  GiBroadsword,
  GiCharm,
  GiCloak,
  GiCrystalCluster,
  GiCrystalWand,
  GiCurvyKnife,
  GiDaggers,
  GiDwarfFace,
  GiElfEar,
  GiFarmer,
  GiGemPendant,
  GiHelp,
  GiHumanTarget,
  GiLeatherArmor,
  GiLizardman,
  GiMinerals,
  GiMoon,
  GiOrcHead,
  GiPitchfork,
  GiPocketBow,
  GiPowder,
  GiPrayer,
  GiRing,
  GiScrollUnfurled,
  GiShield,
  GiSpellBook,
  GiStonePile,
  GiSwordman,
  GiWizardStaff,
} from "react-icons/gi";

const GAME_ICON_MAP = {
  GiArmorVest,
  GiArrowhead,
  GiBattleAxe,
  GiBilledCap,
  GiBracer,
  GiBroadsword,
  GiCharm,
  GiCloak,
  GiCrystalCluster,
  GiCrystalWand,
  GiCurvyKnife,
  GiDaggers,
  GiDwarfFace,
  GiElfEar,
  GiFarmer,
  GiGemPendant,
  GiHelp,
  GiHumanTarget,
  GiLeatherArmor,
  GiLizardman,
  GiMinerals,
  GiMoon,
  GiOrcHead,
  GiPitchfork,
  GiPocketBow,
  GiPowder,
  GiPrayer,
  GiRing,
  GiScrollUnfurled,
  GiShield,
  GiSpellBook,
  GiStonePile,
  GiSwordman,
  GiWizardStaff,
} satisfies Record<string, IconType>;

export type GameIconKey = keyof typeof GAME_ICON_MAP;

export type GameIconOption = {
  key: GameIconKey;
  label: string;
  group: "class" | "item" | "race" | "utility";
};

export const GAME_ICON_OPTIONS: GameIconOption[] = [
  { key: "GiHumanTarget", label: "人类", group: "race" },
  { key: "GiElfEar", label: "精灵", group: "race" },
  { key: "GiDwarfFace", label: "矮人", group: "race" },
  { key: "GiOrcHead", label: "兽人", group: "race" },
  { key: "GiLizardman", label: "蜥蜴人", group: "race" },
  { key: "GiMoon", label: "月裔", group: "race" },
  { key: "GiBroadsword", label: "战士", group: "class" },
  { key: "GiWizardStaff", label: "法师", group: "class" },
  { key: "GiPitchfork", label: "农民", group: "class" },
  { key: "GiArrowhead", label: "游侠", group: "class" },
  { key: "GiPrayer", label: "祭司", group: "class" },
  { key: "GiDaggers", label: "潜行者", group: "class" },
  { key: "GiFarmer", label: "默认职业", group: "class" },
  { key: "GiSwordman", label: "剑类装备", group: "item" },
  { key: "GiBattleAxe", label: "斧类装备", group: "item" },
  { key: "GiPocketBow", label: "弓类装备", group: "item" },
  { key: "GiBilledCap", label: "帽类装备", group: "item" },
  { key: "GiBracer", label: "护腕装备", group: "item" },
  { key: "GiCloak", label: "披风装备", group: "item" },
  { key: "GiLeatherArmor", label: "护甲装备", group: "item" },
  { key: "GiArmorVest", label: "战衣装备", group: "item" },
  { key: "GiGemPendant", label: "坠饰装备", group: "item" },
  { key: "GiRing", label: "戒指装备", group: "item" },
  { key: "GiCharm", label: "护符装备", group: "item" },
  { key: "GiCurvyKnife", label: "匕首装备", group: "item" },
  { key: "GiCrystalWand", label: "法杖装备", group: "item" },
  { key: "GiSpellBook", label: "技能书", group: "item" },
  { key: "GiMinerals", label: "材料矿石", group: "item" },
  { key: "GiCrystalCluster", label: "结晶材料", group: "item" },
  { key: "GiPowder", label: "粉尘材料", group: "item" },
  { key: "GiShield", label: "装备默认", group: "utility" },
  { key: "GiScrollUnfurled", label: "技能书默认", group: "utility" },
  { key: "GiStonePile", label: "材料默认", group: "utility" },
  { key: "GiHelp", label: "通用默认", group: "utility" },
];

export function getGameIconByKey(iconKey: string | null | undefined, fallbackKey: GameIconKey = "GiHelp"): IconType {
  if (iconKey && Object.prototype.hasOwnProperty.call(GAME_ICON_MAP, iconKey)) {
    return GAME_ICON_MAP[iconKey as GameIconKey];
  }

  return GAME_ICON_MAP[fallbackKey];
}

export function getRaceFallbackIconKey(raceKey: string): GameIconKey {
  const fallbackMap: Partial<Record<string, GameIconKey>> = {
    human: "GiHumanTarget",
    elf: "GiElfEar",
    dwarf: "GiDwarfFace",
    orc: "GiOrcHead",
    lizardfolk: "GiLizardman",
    moonkin: "GiMoon",
  };

  return fallbackMap[raceKey] ?? "GiHumanTarget";
}

export function getClassFallbackIconKey(classKey: string): GameIconKey {
  const fallbackMap: Partial<Record<string, GameIconKey>> = {
    warrior: "GiBroadsword",
    mage: "GiWizardStaff",
    farmer: "GiPitchfork",
    ranger: "GiArrowhead",
    priest: "GiPrayer",
    rogue: "GiDaggers",
  };

  return fallbackMap[classKey] ?? "GiFarmer";
}

export function getItemTypeFallbackIconKey(itemType: "equipment" | "skill_book" | "material"): GameIconKey {
  if (itemType === "skill_book") {
    return "GiScrollUnfurled";
  }

  if (itemType === "material") {
    return "GiStonePile";
  }

  return "GiShield";
}
