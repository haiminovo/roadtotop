const { query, withTransaction } = require("./db");

const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
const AFK_TASK_SECONDS = 10;
const LEVEL_CAP = 30;
const EXP_PER_LEVEL = 100;
const BASE_HEALTH = 50;
const HEALTH_PER_VITALITY = 12;
const HEALTH_PER_LEVEL = 2;
const DEFAULT_BODY_SLOT_CAPACITIES = {
  head: 1,
  hand: 2,
  torso: 1,
  legs: 1,
  feet: 1,
  neck: 1,
  accessory: 2,
};
const OFFLINE_MODAL_THRESHOLD_MS = 45 * 1000;
const MAX_RECENT_ENCOUNTERS = 8;
const MARKET_FEE_RATE_PERCENT = 10;
const MARKET_CATEGORY_OPTIONS = [{ key: "equipment", label: "装备" }];
const itemSeeds = [
  { itemId: "rusty-blade", name: "生锈短剑", rarity: "white", slot: "hand", slotUsage: 1, description: "开荒时勉强能用的短剑。", sellPrice: 12, stats: { strength: 2 } },
  { itemId: "oak-staff", name: "橡木法杖", rarity: "white", slot: "hand", slotUsage: 2, description: "粗糙的入门法杖，适合法师起步。", sellPrice: 12, stats: { intelligence: 2 } },
  { itemId: "field-hoe", name: "旧铁锄", rarity: "white", slot: "hand", slotUsage: 2, description: "农活与近身防卫两不误的旧工具。", sellPrice: 10, stats: { vitality: 1, agility: 1 } },
  { itemId: "forest-cloak", name: "林地披风", rarity: "green", slot: "neck", slotUsage: 1, description: "轻便耐磨，适合野外挂机。", sellPrice: 30, stats: { agility: 2, vitality: 1 } },
  { itemId: "traveler-ring", name: "旅者戒指", rarity: "green", slot: "accessory", slotUsage: 1, description: "会在冒险者启程时发放的基础指环。", sellPrice: 36, stats: { strength: 1, intelligence: 1, vitality: 1 } },
  { itemId: "training-bow", name: "练习短弓", rarity: "white", slot: "hand", slotUsage: 2, description: "拉力一般，但足够让新手学会瞄准与走位。", sellPrice: 18, stats: { agility: 2 } },
  { itemId: "leather-cap", name: "皮质便帽", rarity: "white", slot: "head", slotUsage: 1, description: "不起眼的小帽子，能挡一点风沙与碎石。", sellPrice: 14, stats: { vitality: 1, agility: 1 } },
  { itemId: "scout-bracers", name: "斥候护腕", rarity: "white", slot: "accessory", slotUsage: 1, description: "轻量护腕，让抬手与闪避动作更利落。", sellPrice: 16, stats: { agility: 1, intelligence: 1 } },
  { itemId: "bronze-longsword", name: "青铜长剑", rarity: "green", slot: "hand", slotUsage: 1, description: "保养得当的军用品，劈砍手感远胜生锈短剑。", sellPrice: 48, stats: { strength: 3, vitality: 1 } },
  { itemId: "whisper-wand", name: "低语木杖", rarity: "green", slot: "hand", slotUsage: 1, description: "杖身会在夜里发出轻鸣，能稳定初阶法术。", sellPrice: 46, stats: { intelligence: 3, agility: 1 } },
  { itemId: "hunter-leathers", name: "猎人皮甲", rarity: "green", slot: "torso", slotUsage: 1, description: "柔韧结实，适合长时间追踪与奔行。", sellPrice: 54, stats: { agility: 2, vitality: 2 } },
  { itemId: "amber-charm", name: "琥珀护符", rarity: "green", slot: "neck", slotUsage: 1, description: "封着温热树脂的护符，能让心神更稳定。", sellPrice: 52, stats: { intelligence: 2, vitality: 1 } },
  { itemId: "moonshadow-dagger", name: "月影短匕", rarity: "blue", slot: "hand", slotUsage: 1, description: "刀锋轻薄如月光，适合迅捷而精准的出手。", sellPrice: 96, stats: { agility: 4, intelligence: 1 } },
  { itemId: "runic-vest", name: "符纹战衣", rarity: "blue", slot: "torso", slotUsage: 1, description: "内衬刻着细密符纹，兼顾防护与法感引导。", sellPrice: 104, stats: { intelligence: 3, vitality: 2 } },
  { itemId: "wolfbone-talisman", name: "狼骨符坠", rarity: "blue", slot: "accessory", slotUsage: 1, description: "粗犷却实用的护符，佩戴后胆气更足。", sellPrice: 98, stats: { strength: 2, agility: 2 } },
  { itemId: "stormglass-staff", name: "风暴晶杖", rarity: "purple", slot: "hand", slotUsage: 2, description: "杖芯封着风暴碎晶，能显著放大施法者感知。", sellPrice: 188, stats: { intelligence: 5, agility: 2 } },
  { itemId: "knightwatch-mail", name: "守夜骑士甲", rarity: "purple", slot: "torso", slotUsage: 1, description: "历经修补的厚重甲胄，仍保留着可靠的守护感。", sellPrice: 210, stats: { strength: 3, vitality: 5 } },
  { itemId: "dawnfire-pendant", name: "晨焰坠饰", rarity: "orange", slot: "neck", slotUsage: 1, description: "内部像封着一缕朝阳，能同时提振体魄与精神。", sellPrice: 320, stats: { strength: 2, intelligence: 3, vitality: 3 } },
];
const itemSeedById = new Map(itemSeeds.map((item) => [item.itemId, item]));

const raceConfigs = [
  {
    key: "human",
    label: "人类",
    summary: "四维均衡，最适合当前版本的万能开荒模版。",
    stats: { strength: 5, agility: 5, intelligence: 5, vitality: 5 },
    bodySlotAdjustments: {},
  },
  {
    key: "elf",
    label: "精灵",
    summary: "速度和法感更高，挂机效率偏灵巧与法术。",
    stats: { strength: 3, agility: 7, intelligence: 7, vitality: 3 },
    bodySlotAdjustments: { accessory: 1 },
  },
  {
    key: "dwarf",
    label: "矮人",
    summary: "更硬更稳，适合站桩和长期刷图。",
    stats: { strength: 7, agility: 3, intelligence: 3, vitality: 7 },
    bodySlotAdjustments: { accessory: -1 },
  },
];

const classConfigs = [
  {
    key: "warrior",
    label: "战士",
    summary: "近战起步快，初始金币与白装最实用。",
    starterItemId: "rusty-blade",
    stats: { strength: 4, agility: 2, intelligence: 0, vitality: 3 },
  },
  {
    key: "mage",
    label: "法师",
    summary: "智力成长高，预计收益里的经验占比更高。",
    starterItemId: "oak-staff",
    stats: { strength: 0, agility: 2, intelligence: 5, vitality: 2 },
  },
  {
    key: "farmer",
    label: "农民",
    summary: "务实稳定，适合当前版本的挂机与资源周转。",
    starterItemId: "field-hoe",
    stats: { strength: 2, agility: 2, intelligence: 1, vitality: 4 },
  },
];

const mapConfigs = [
  {
    key: "palmia-wilds",
    label: "野外",
    summary: "收益平衡，适合刚创角时开第一张图。",
    goldPerMinute: 20,
    aetherPerMinute: 0.25,
    expPerMinute: 10,
  },
];

const afkEncounterChances = {
  common: 0.1,
  rare: 0.01,
  legendary: 0.001,
};

const afkEncounterPool = [
  {
    key: "wanderer-cache",
    tier: "common",
    title: "拾荒者的暗袋",
    description: "你在枯树根下翻出一只旧布袋，却被藏着的铁夹划伤了手，好在还能顺走一点物资。",
    reward: { gold: 28, aetherCrystal: 0, exp: 8, healthDelta: -10, items: [{ itemId: "scout-bracers", quantity: 1 }] },
  },
  {
    key: "mossy-altar",
    tier: "common",
    title: "长苔石坛",
    description: "路边石坛上还留着未散的微光，你靠近后精神为之一振。",
    reward: { gold: 12, aetherCrystal: 1, exp: 10, healthDelta: 12, items: [{ itemId: "leather-cap", quantity: 1 }] },
  },
  {
    key: "merchant-clue",
    tier: "common",
    title: "流商的线索",
    description: "你追上了匆匆离开的行商，从他手里换到了一点便宜补给。",
    reward: { gold: 36, aetherCrystal: 0, exp: 6, items: [{ itemId: "training-bow", quantity: 1 }] },
  },
  {
    key: "windfall-fruit",
    tier: "common",
    title: "风落浆果",
    description: "你尝到一串罕见野果，体力恢复不少，连动作都轻快了些。",
    reward: { gold: 0, aetherCrystal: 1, exp: 14, healthDelta: 18 },
  },
  {
    key: "crystal-burrow",
    tier: "rare",
    title: "隐晶兽巢",
    description: "灌木后藏着一处被废弃的兽巢，残留的晶刺划破了你的护具，但你也捡到了完整结晶。",
    reward: { gold: 120, aetherCrystal: 4, exp: 36, healthDelta: -22, items: [{ itemId: "amber-charm", quantity: 1 }] },
  },
  {
    key: "forgotten-caravan",
    tier: "rare",
    title: "失落商队",
    description: "你在旧车辙旁找到半埋的补给箱，却也顺手赶跑了几只扑上来的鬣犬。",
    reward: { gold: 168, aetherCrystal: 2, exp: 28, healthDelta: -14, items: [{ itemId: "hunter-leathers", quantity: 1 }] },
  },
  {
    key: "moonlit-guidance",
    tier: "rare",
    title: "月影指引",
    description: "短暂闪过的银白轨迹为你指明了近路，也让你看清了更多细节。",
    reward: { gold: 88, aetherCrystal: 3, exp: 56, healthDelta: 20, items: [{ itemId: "moonshadow-dagger", quantity: 1 }] },
  },
  {
    key: "dragonbone-relic",
    tier: "legendary",
    title: "龙骨遗辉",
    description: "你在荒野深处碰见一截仍在低鸣的龙骨，其残响将力量灌入你的血脉。",
    reward: { gold: 888, aetherCrystal: 18, exp: 220, healthDelta: 40, items: [{ itemId: "knightwatch-mail", quantity: 1 }] },
  },
  {
    key: "starlight-vault",
    tier: "legendary",
    title: "星辉秘匣",
    description: "古老封印在你面前自行开启，匣中溢出的星光化作了惊人的收获。",
    reward: { gold: 1280, aetherCrystal: 12, exp: 188, healthDelta: 32, items: [{ itemId: "dawnfire-pendant", quantity: 1 }] },
  },
];

const afkEncounterPoolByTier = afkEncounterPool.reduce((accumulator, encounter) => {
  accumulator[encounter.tier].push(encounter);
  return accumulator;
}, {
  common: [],
  rare: [],
  legendary: [],
});

const levelTable = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: index * EXP_PER_LEVEL,
}));

function toMillis(value) {
  return value ? new Date(value).getTime() : null;
}

function normalizeNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function normalizeSignedNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
}

function calculateMarketFee(price) {
  const normalizedPrice = normalizeNumber(price);
  const feeAmount = Math.floor((normalizedPrice * MARKET_FEE_RATE_PERCENT) / 100);
  return {
    feeAmount,
    sellerReceiveAmount: Math.max(0, normalizedPrice - feeAmount),
  };
}

function getRarityRank(rarity) {
  return {
    white: 1,
    green: 2,
    blue: 3,
    purple: 4,
    orange: 5,
  }[rarity] || 0;
}

function sortBackpackRows(backpack) {
  backpack.sort((left, right) => {
    const leftEquippedCount = (left.equipped_slot_groups || []).length;
    const rightEquippedCount = (right.equipped_slot_groups || []).length;

    if (leftEquippedCount !== rightEquippedCount) {
      return rightEquippedCount - leftEquippedCount;
    }

    const rarityDelta = getRarityRank(right.rarity) - getRarityRank(left.rarity);

    if (rarityDelta !== 0) {
      return rarityDelta;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function buildMarketSnapshot(roleId, activeListings, ownListings) {
  return {
    feeRatePercent: MARKET_FEE_RATE_PERCENT,
    categoryOptions: [...MARKET_CATEGORY_OPTIONS],
    rarityOptions: ["white", "green", "blue", "purple", "orange"],
    slotOptions: ["head", "hand", "torso", "legs", "feet", "neck", "accessory"],
    listings: activeListings.map((listing) => ({
      listingId: listing.listing_id,
      itemId: listing.item_id,
      categoryKey: listing.category_key,
      name: listing.name,
      rarity: listing.rarity,
      slot: listing.slot,
      slotUsage: listing.slot_usage,
      description: listing.description,
      sellPrice: listing.sell_price,
      stats: listing.stat_json || {},
      price: listing.price,
      sellerName: listing.seller_name,
      availableCount: normalizeNumber(listing.available_count),
      createdAt: toMillis(listing.created_at) || Date.now(),
      isOwnListing: roleId === listing.seller_role_id,
    })),
    myListings: ownListings.map((listing) => ({
      listingId: listing.listing_id,
      itemId: listing.item_id,
      categoryKey: listing.category_key,
      name: listing.name,
      rarity: listing.rarity,
      slot: listing.slot,
      slotUsage: listing.slot_usage,
      description: listing.description,
      sellPrice: listing.sell_price,
      stats: listing.stat_json || {},
      price: listing.price,
      status: listing.status,
      createdAt: toMillis(listing.created_at) || Date.now(),
      soldAt: toMillis(listing.sold_at),
      cancelledAt: toMillis(listing.cancelled_at),
      buyerRoleId: listing.buyer_role_id || null,
      sellerReceiveAmount: listing.seller_receive_amount || 0,
      feeAmount: listing.fee_amount || 0,
      quantity: normalizeNumber(listing.listing_count || 0),
      sellerNoticeSeen: Boolean(listing.seller_notice_seen),
    })),
  };
}

function getBodySlotCapacities(raceKey) {
  const race = raceConfigs.find((item) => item.key === raceKey) || null;
  const adjustments = race?.bodySlotAdjustments || {};

  return {
    head: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.head + (adjustments.head || 0)),
    hand: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.hand + (adjustments.hand || 0)),
    torso: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.torso + (adjustments.torso || 0)),
    legs: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.legs + (adjustments.legs || 0)),
    feet: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.feet + (adjustments.feet || 0)),
    neck: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.neck + (adjustments.neck || 0)),
    accessory: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.accessory + (adjustments.accessory || 0)),
  };
}

function getBodySlotTypeLabel(slotType) {
  return {
    head: "头部",
    hand: "手部",
    torso: "上身",
    legs: "下身",
    feet: "脚部",
    neck: "脖颈",
    accessory: "饰品",
  }[slotType] || slotType;
}

function getBackpackEquippedCount(backpackRow) {
  return (backpackRow.equipped_slot_groups || []).length;
}

function getRoleEffectiveStats(role, backpack = []) {
  const nextStats = {
    strength: normalizeNumber(role.strength),
    agility: normalizeNumber(role.agility),
    intelligence: normalizeNumber(role.intelligence),
    vitality: normalizeNumber(role.vitality),
  };

  backpack.forEach((item) => {
    const equippedCount = getBackpackEquippedCount(item);

    if (equippedCount <= 0 || !item.stat_json) {
      return;
    }

    nextStats.strength += normalizeNumber(item.stat_json.strength) * equippedCount;
    nextStats.agility += normalizeNumber(item.stat_json.agility) * equippedCount;
    nextStats.intelligence += normalizeNumber(item.stat_json.intelligence) * equippedCount;
    nextStats.vitality += normalizeNumber(item.stat_json.vitality) * equippedCount;
  });

  return nextStats;
}

function normalizeEquippedSlotGroups(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => {
      if (!Array.isArray(group)) {
        return null;
      }

      const normalizedGroup = group
        .filter((slotKey) => typeof slotKey === "string" && slotKey.trim().length > 0)
        .map((slotKey) => slotKey.trim());

      return normalizedGroup.length > 0 ? normalizedGroup : null;
    })
    .filter(Boolean);
}

function buildBodySlotKeys(capacities) {
  return [
    ["head", capacities.head],
    ["hand", capacities.hand],
    ["torso", capacities.torso],
    ["legs", capacities.legs],
    ["feet", capacities.feet],
    ["neck", capacities.neck],
    ["accessory", capacities.accessory],
  ].flatMap(([slotType, count]) =>
    Array.from({ length: Math.max(0, count) }, (_, index) => `${slotType}-${index + 1}`),
  );
}

function buildAvailableBodySlotKeys(capacities, slotType) {
  const count = Math.max(0, capacities[slotType] || 0);
  return Array.from({ length: count }, (_, index) => `${slotType}-${index + 1}`);
}

function getBodySlotIndex(slotKey) {
  return Number(slotKey.split("-")[1]) || 0;
}

function allocateEquipmentSlots(role, backpack, item) {
  if (item.quantity <= getBackpackEquippedCount(item)) {
    throw new Error("这件物品已经没有可装备的数量了。");
  }

  const capacities = getBodySlotCapacities(role.race_key);
  const candidateSlotKeys = buildAvailableBodySlotKeys(capacities, item.slot);

  if (candidateSlotKeys.length < item.slot_usage) {
    throw new Error("当前种族没有足够的对应肢体槽位。");
  }

  const occupiedSlots = new Set(
    backpack.flatMap((entry) => (entry.equipped_slot_groups || []).flatMap((group) => group)),
  );
  const freeSlots = candidateSlotKeys.filter((slotKey) => !occupiedSlots.has(slotKey));

  if (freeSlots.length >= item.slot_usage) {
    const allocatedSlots = freeSlots.slice(0, item.slot_usage);
    item.equipped_slot_groups.push(allocatedSlots);
    item.equipped = item.equipped_slot_groups.length > 0;
    return allocatedSlots;
  }

  const releasedSlots = [...freeSlots];
  const groupsToRelease = [];
  const slotOwners = new Map();

  backpack.forEach((entry) => {
    (entry.equipped_slot_groups || []).forEach((group) => {
      if (!group.every((slotKey) => candidateSlotKeys.includes(slotKey))) {
        return;
      }

      group.forEach((slotKey) => {
        slotOwners.set(slotKey, { entry, group });
      });
    });
  });

  const candidateSlotsByPriority = [...candidateSlotKeys].sort((left, right) => getBodySlotIndex(right) - getBodySlotIndex(left));
  const markedGroups = new Set();

  for (const slotKey of candidateSlotsByPriority) {
    if (releasedSlots.length >= item.slot_usage) {
      break;
    }

    const owner = slotOwners.get(slotKey);

    if (!owner || markedGroups.has(owner.group)) {
      continue;
    }

    markedGroups.add(owner.group);
    groupsToRelease.push(owner);
    releasedSlots.push(...owner.group);
  }

  if (releasedSlots.length < item.slot_usage) {
    throw new Error("对应肢体部位已经被占满，无法继续装备。");
  }

  const groupsMarkedForRelease = new Set(groupsToRelease.map((entry) => entry.group));
  const touchedEntries = new Set(groupsToRelease.map((entry) => entry.entry));

  touchedEntries.forEach((entry) => {
    entry.equipped_slot_groups = (entry.equipped_slot_groups || []).filter((group) => !groupsMarkedForRelease.has(group));
    entry.equipped = entry.equipped_slot_groups.length > 0;
  });

  const availableAfterRelease = candidateSlotKeys.filter((slotKey) => releasedSlots.includes(slotKey));
  const allocatedSlots = availableAfterRelease.slice(0, item.slot_usage);
  item.equipped_slot_groups.push(allocatedSlots);
  item.equipped = item.equipped_slot_groups.length > 0;

  return allocatedSlots;
}

function removeOneEquippedGroup(backpackItem) {
  if (!backpackItem.equipped_slot_groups || backpackItem.equipped_slot_groups.length === 0) {
    throw new Error("这件物品当前没有处于装备状态。");
  }

  backpackItem.equipped_slot_groups.shift();
  backpackItem.equipped = backpackItem.equipped_slot_groups.length > 0;
}

function buildRoleBodySlots(role, backpack) {
  const capacities = getBodySlotCapacities(role.race_key);
  const bodySlotKeys = buildBodySlotKeys(capacities);
  const equippedBySlotKey = new Map();

  for (const item of backpack) {
    for (const group of item.equipped_slot_groups || []) {
      for (const slotKey of group) {
        equippedBySlotKey.set(slotKey, item);
      }
    }
  }

  return bodySlotKeys.map((slotKey) => {
    const [slotType, indexText] = slotKey.split("-");
    const equippedItem = equippedBySlotKey.get(slotKey) || null;
    const capacity = capacities[slotType];
    const index = Number(indexText);
    const label = capacity > 1 && Number.isFinite(index)
      ? `${getBodySlotTypeLabel(slotType)} ${index}`
      : getBodySlotTypeLabel(slotType);

    return {
      key: slotKey,
      label,
      slotType,
      item: equippedItem
        ? {
            backpackId: equippedItem.backpack_id,
            itemId: equippedItem.item_id,
            name: equippedItem.name,
            rarity: equippedItem.rarity,
          }
        : null,
    };
  });
}

function resolveEncounterRewardItems(reward) {
  return (reward.items || [])
    .map((itemReward) => {
      const quantity = normalizeNumber(itemReward.quantity);
      const itemSeed = itemSeedById.get(itemReward.itemId);

      if (!itemSeed || quantity <= 0) {
        return null;
      }

      return {
        itemId: itemSeed.itemId,
        quantity,
        name: itemSeed.name,
        rarity: itemSeed.rarity,
        slot: itemSeed.slot,
        slotUsage: itemSeed.slotUsage,
        description: itemSeed.description,
        sellPrice: itemSeed.sellPrice,
        stats: itemSeed.stats,
      };
    })
    .filter(Boolean);
}

function applyEncounterItemsToBackpack(backpack, itemDrops) {
  if (!itemDrops.length) {
    return false;
  }

  let didMutate = false;

  for (const itemDrop of itemDrops) {
    const existing = backpack.find((entry) => entry.item_id === itemDrop.itemId);

    if (existing) {
      existing.quantity += itemDrop.quantity;
      didMutate = true;
      continue;
    }

    backpack.push({
      backpack_id: `bag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      item_id: itemDrop.itemId,
      quantity: itemDrop.quantity,
      equipped: false,
      equipped_slot_groups: [],
      name: itemDrop.name,
      rarity: itemDrop.rarity,
      slot: itemDrop.slot,
      slot_usage: itemDrop.slotUsage,
      description: itemDrop.description,
      sell_price: itemDrop.sellPrice,
      stat_json: itemDrop.stats,
    });
    didMutate = true;
  }

  if (didMutate) {
    sortBackpackRows(backpack);
  }

  return didMutate;
}

function makeEncounterId() {
  return `encounter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getLevelBaseExp(level) {
  const safeLevel = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  return (safeLevel - 1) * EXP_PER_LEVEL;
}

function getMaxHealth(vitality, level) {
  return (
    BASE_HEALTH
    + Math.max(0, Math.floor(vitality)) * HEALTH_PER_VITALITY
    + Math.max(1, Math.floor(level)) * HEALTH_PER_LEVEL
  );
}

function normalizeEncounterLog(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      if (
        typeof entry.id !== "string"
        || typeof entry.key !== "string"
        || typeof entry.title !== "string"
        || typeof entry.description !== "string"
        || !["common", "rare", "legendary"].includes(entry.tier)
      ) {
        return null;
      }

      const reward = entry.reward && typeof entry.reward === "object" ? entry.reward : {};
      const triggeredAt = Number(entry.triggeredAt);

      if (!Number.isFinite(triggeredAt)) {
        return null;
      }

      return {
        id: entry.id,
        key: entry.key,
        tier: entry.tier,
        title: entry.title,
        description: entry.description,
        reward: {
          gold: normalizeNumber(reward.gold),
          aetherCrystal: normalizeNumber(reward.aetherCrystal),
          exp: normalizeNumber(reward.exp),
          healthDelta: normalizeSignedNumber(reward.healthDelta),
          items: Array.isArray(reward.items)
            ? reward.items
              .map((itemReward) => {
                if (!itemReward || typeof itemReward !== "object") {
                  return null;
                }

                const quantity = normalizeNumber(itemReward.quantity);

                if (typeof itemReward.itemId !== "string" || quantity <= 0) {
                  return null;
                }

                return {
                  itemId: itemReward.itemId,
                  quantity,
                  name: typeof itemReward.name === "string" ? itemReward.name : undefined,
                  rarity: ["white", "green", "blue", "purple", "orange"].includes(itemReward.rarity)
                    ? itemReward.rarity
                    : undefined,
                };
              })
              .filter(Boolean)
            : [],
        },
        triggeredAt,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_RECENT_ENCOUNTERS);
}

function pickRandomEncounter(tier) {
  const pool = afkEncounterPoolByTier[tier];

  if (!pool || pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function resolveEncounterTierByRoll(roll) {
  if (roll < afkEncounterChances.legendary) {
    return "legendary";
  }

  if (roll < afkEncounterChances.legendary + afkEncounterChances.rare) {
    return "rare";
  }

  if (roll < afkEncounterChances.legendary + afkEncounterChances.rare + afkEncounterChances.common) {
    return "common";
  }

  return null;
}

function buildEncounterDelta(executions, settledAt) {
  const delta = {
    aetherCrystal: 0,
    encounters: [],
    exp: 0,
    gold: 0,
    itemDrops: [],
  };

  for (let index = 0; index < executions; index += 1) {
    const tier = resolveEncounterTierByRoll(Math.random());

    if (!tier) {
      continue;
    }

    const encounter = pickRandomEncounter(tier);

    if (!encounter) {
      continue;
    }

    const reward = {
      gold: normalizeNumber(encounter.reward.gold),
      aetherCrystal: normalizeNumber(encounter.reward.aetherCrystal),
      exp: normalizeNumber(encounter.reward.exp),
      ...(normalizeSignedNumber(encounter.reward.healthDelta) !== 0
        ? { healthDelta: normalizeSignedNumber(encounter.reward.healthDelta) }
        : {}),
      items: resolveEncounterRewardItems(encounter.reward).map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        name: item.name,
        rarity: item.rarity,
      })),
    };

    delta.gold += reward.gold;
    delta.aetherCrystal += reward.aetherCrystal;
    delta.exp += reward.exp;
    delta.itemDrops.push(
      ...reward.items.map((itemReward) => {
        const itemSeed = itemSeedById.get(itemReward.itemId);

        if (!itemSeed) {
          return null;
        }

        return {
          itemId: itemSeed.itemId,
          quantity: itemReward.quantity,
          name: itemSeed.name,
          rarity: itemSeed.rarity,
          slot: itemSeed.slot,
          description: itemSeed.description,
          sellPrice: itemSeed.sellPrice,
          stats: itemSeed.stats,
        };
      }).filter(Boolean),
    );
    delta.encounters.push({
      id: makeEncounterId(),
      key: encounter.key,
      tier,
      title: encounter.title,
      description: encounter.description,
      reward,
      triggeredAt: settledAt,
    });
  }

  return delta;
}

function getLevelFromExp(exp) {
  return Math.min(LEVEL_CAP, Math.floor(Math.max(0, exp) / EXP_PER_LEVEL) + 1);
}

function getCurrentLevelProgress(exp) {
  const currentLevel = getLevelFromExp(exp);
  const currentBase = (currentLevel - 1) * EXP_PER_LEVEL;
  const nextRequirement = currentLevel >= LEVEL_CAP ? currentBase : currentLevel * EXP_PER_LEVEL;

  return {
    currentLevel,
    currentLevelExp: Math.max(0, exp - currentBase),
    nextLevelExp: currentLevel >= LEVEL_CAP ? 0 : nextRequirement - currentBase,
  };
}

function getMapConfig(mapKey) {
  return mapConfigs.find((item) => item.key === mapKey) || null;
}

function buildHourlyReward(mapKey) {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds: 3600,
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds: 3600,
    gold: map.goldPerMinute * 60,
    aetherCrystal: Math.floor(map.aetherPerMinute * 60),
    exp: map.expPerMinute * 60,
  };
}

function buildRewardForSeconds(mapKey, seconds) {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds,
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds,
    gold: Math.floor((seconds * map.goldPerMinute) / 60),
    aetherCrystal: Math.floor((seconds * map.aetherPerMinute) / 60),
    exp: Math.floor((seconds * map.expPerMinute) / 60),
  };
}

function buildRewardDeltaForExecutions(mapKey, previousExecutions, nextExecutions) {
  const previousReward = buildRewardForSeconds(mapKey, previousExecutions * AFK_TASK_SECONDS);
  const nextReward = buildRewardForSeconds(mapKey, nextExecutions * AFK_TASK_SECONDS);

  return {
    aetherCrystal: Math.max(0, nextReward.aetherCrystal - previousReward.aetherCrystal),
    encounters: [],
    exp: Math.max(0, nextReward.exp - previousReward.exp),
    itemDrops: [],
    executions: Math.max(0, nextExecutions - previousExecutions),
    gold: Math.max(0, nextReward.gold - previousReward.gold),
  };
}

function getRoleMaxHealth(role, backpack = []) {
  return getMaxHealth(getRoleEffectiveStats(role, backpack).vitality, role.level);
}

function normalizeRoleHealth(role, backpack = []) {
  const maxHealth = getRoleMaxHealth(role, backpack);
  const rawHealth = Number(role.current_health);
  const nextHealth = Number.isFinite(rawHealth) && rawHealth > 0
    ? Math.min(maxHealth, Math.floor(rawHealth))
    : maxHealth;

  if (nextHealth === role.current_health) {
    return false;
  }

  role.current_health = nextHealth;
  return true;
}

function applyEncounterEffectsToRole(role, encounters, backpack = []) {
  let didMutate = false;

  for (const encounter of encounters) {
    const healthDelta = normalizeSignedNumber(encounter.reward.healthDelta);

    if (healthDelta === 0) {
      continue;
    }

    didMutate = true;

    if (healthDelta > 0) {
      role.current_health = Math.min(getRoleMaxHealth(role, backpack), role.current_health + healthDelta);
      continue;
    }

    role.current_health += healthDelta;

    if (role.current_health > 0) {
      continue;
    }

    const nextLevel = Math.max(1, role.level - 1);
    role.level = nextLevel;
    role.exp = getLevelBaseExp(nextLevel);
    role.current_health = getRoleMaxHealth(role, backpack);
  }

  return didMutate;
}

function applyRewardToRole(role, reward, backpack = []) {
  if (reward.gold <= 0 && reward.aetherCrystal <= 0 && reward.exp <= 0) {
    return false;
  }

  const previousLevel = role.level;
  const previousMaxHealth = getRoleMaxHealth(role, backpack);
  role.gold += reward.gold;
  role.aether_crystal += reward.aetherCrystal;
  role.exp += reward.exp;
  role.level = getLevelFromExp(role.exp);
  const nextMaxHealth = getRoleMaxHealth(role, backpack);

  if (role.level > previousLevel) {
    role.current_health = Math.min(
      nextMaxHealth,
      role.current_health + Math.max(0, nextMaxHealth - previousMaxHealth),
    );
  } else {
    role.current_health = Math.min(nextMaxHealth, role.current_health);
  }

  return true;
}

function applyPendingRewardToRole(role, afk, backpack = []) {
  return applyRewardToRole(role, {
    aetherCrystal: afk.pending_aether_crystal,
    encounters: [],
    exp: afk.pending_exp,
    itemDrops: [],
    executions: 0,
    gold: afk.pending_gold,
  }, backpack);
}

function settleAfkState(afk, options = {}) {
  const now = options.now || Date.now();
  const emptyReward = { aetherCrystal: 0, encounters: [], exp: 0, itemDrops: [], executions: 0, gold: 0 };

  if (afk.status !== "active" || !afk.map_key || !afk.last_settled_at) {
    return emptyReward;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(afk.last_settled_at).getTime()) / 1000),
  );

  if (elapsedSeconds <= 0) {
    return emptyReward;
  }

  const grantedSeconds = options.capSeconds === undefined
    ? elapsedSeconds
    : Math.min(elapsedSeconds, Math.max(0, options.capSeconds));
  const previousTotalSeconds = Math.max(0, afk.accrued_seconds);
  const nextTotalSeconds = previousTotalSeconds + grantedSeconds;
  const previousExecutions = Math.floor(previousTotalSeconds / AFK_TASK_SECONDS);
  const nextExecutions = Math.floor(nextTotalSeconds / AFK_TASK_SECONDS);
  const rewardDelta = buildRewardDeltaForExecutions(afk.map_key, previousExecutions, nextExecutions);
  const encounterDelta = buildEncounterDelta(rewardDelta.executions, now);

  rewardDelta.gold += encounterDelta.gold;
  rewardDelta.aetherCrystal += encounterDelta.aetherCrystal;
  rewardDelta.exp += encounterDelta.exp;
  rewardDelta.encounters = encounterDelta.encounters;
  rewardDelta.itemDrops = encounterDelta.itemDrops;
  afk.pending_gold += rewardDelta.gold;
  afk.pending_aether_crystal += rewardDelta.aetherCrystal;
  afk.pending_exp += rewardDelta.exp;
  afk.recent_encounters = [
    ...encounterDelta.encounters.slice().reverse(),
    ...normalizeEncounterLog(afk.recent_encounters),
  ].slice(0, MAX_RECENT_ENCOUNTERS);
  afk.accrued_seconds = nextTotalSeconds % AFK_TASK_SECONDS;
  afk.last_settled_at = new Date(now);

  return rewardDelta;
}

function consumePendingReward(afk, reward) {
  afk.pending_gold = Math.max(0, afk.pending_gold - reward.gold);
  afk.pending_aether_crystal = Math.max(0, afk.pending_aether_crystal - reward.aetherCrystal);
  afk.pending_exp = Math.max(0, afk.pending_exp - reward.exp);
}

function discardCurrentTaskProgress(afk) {
  afk.accrued_seconds = 0;
}

async function persistRole(client, role) {
  await client.query(
    `
      UPDATE "role"
      SET
        level = $2,
        exp = $3,
        gold = $4,
        aether_crystal = $5,
        current_health = $6,
        updated_at = NOW()
      WHERE role_id = $1
    `,
    [
      role.role_id,
      role.level,
      normalizeNumber(role.exp),
      normalizeNumber(role.gold),
      normalizeNumber(role.aether_crystal),
      normalizeNumber(role.current_health),
    ],
  );
}

async function persistAfk(client, afk) {
  await client.query(
    `
      UPDATE afk
      SET
        status = $2,
        map_key = $3,
        started_at = $4,
        last_settled_at = $5,
        pending_gold = $6,
        pending_aether_crystal = $7,
        pending_exp = $8,
        accrued_seconds = $9,
        recent_encounters = $10::jsonb,
        updated_at = NOW()
      WHERE afk_id = $1
    `,
    [
      afk.afk_id,
      afk.status,
      afk.map_key,
      afk.started_at,
      afk.last_settled_at,
      normalizeNumber(afk.pending_gold),
      normalizeNumber(afk.pending_aether_crystal),
      normalizeNumber(afk.pending_exp),
      normalizeNumber(afk.accrued_seconds),
      JSON.stringify(normalizeEncounterLog(afk.recent_encounters)),
    ],
  );
}

async function persistBackpackItemRewards(client, roleId, itemDrops) {
  if (!itemDrops.length) {
    return;
  }

  const itemDropsById = itemDrops.reduce((accumulator, itemDrop) => {
    accumulator.set(itemDrop.itemId, (accumulator.get(itemDrop.itemId) || 0) + itemDrop.quantity);
    return accumulator;
  }, new Map());

  for (const [itemId, quantity] of itemDropsById.entries()) {
    await client.query(
      `
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, equipped_slot_groups, created_at, updated_at)
        VALUES ($1, $2, $3, $4, FALSE, '[]'::jsonb, NOW(), NOW())
        ON CONFLICT (role_id, item_id)
        DO UPDATE SET
          quantity = backpack.quantity + EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [`bag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, roleId, itemId, quantity],
    );
  }
}

async function persistBackpackEquipState(client, backpack) {
  for (const item of backpack) {
    await client.query(
      `
        UPDATE backpack
        SET
          equipped = $2,
          equipped_slot_groups = $3::jsonb,
          updated_at = NOW()
        WHERE backpack_id = $1
      `,
      [
        item.backpack_id,
        (item.equipped_slot_groups || []).length > 0,
        JSON.stringify(item.equipped_slot_groups || []),
      ],
    );
  }
}

async function upsertBackpackItemQuantity(client, roleId, itemId, quantity) {
  const normalizedQuantity = normalizeNumber(quantity);

  if (normalizedQuantity <= 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, equipped_slot_groups, created_at, updated_at)
      VALUES ($1, $2, $3, $4, FALSE, '[]'::jsonb, NOW(), NOW())
      ON CONFLICT (role_id, item_id)
      DO UPDATE SET
        quantity = backpack.quantity + EXCLUDED.quantity,
        updated_at = NOW()
    `,
    [`bag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, roleId, itemId, normalizedQuantity],
  );
}

async function getMarketActiveSummaryRows() {
  const result = await query(
    `
      WITH ranked_listings AS (
        SELECT
          market_listing.listing_id,
          market_listing.seller_role_id,
          seller_role.name AS seller_name,
          market_listing.item_id,
          market_listing.category_key,
          market_listing.price,
          market_listing.status,
          market_listing.buyer_role_id,
          market_listing.sold_price,
          market_listing.fee_amount,
          market_listing.seller_receive_amount,
          market_listing.created_at,
          market_listing.updated_at,
          market_listing.sold_at,
          market_listing.cancelled_at,
          item.name,
          item.rarity,
          item.slot,
          item.slot_usage,
          item.description,
          item.sell_price,
          item.stat_json,
          ROW_NUMBER() OVER (
            PARTITION BY market_listing.item_id
            ORDER BY market_listing.price ASC, market_listing.created_at ASC, market_listing.listing_id ASC
          ) AS row_number,
          COUNT(*) OVER (PARTITION BY market_listing.item_id) AS available_count
        FROM market_listing
        JOIN item ON item.item_id = market_listing.item_id
        JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
        WHERE market_listing.status = 'active'
      )
      SELECT
        listing_id,
        seller_role_id,
        seller_name,
        item_id,
        category_key,
        price,
        status,
        buyer_role_id,
        sold_price,
        fee_amount,
        seller_receive_amount,
        created_at,
        updated_at,
        sold_at,
        cancelled_at,
        name,
        rarity,
        slot,
        slot_usage,
        description,
        sell_price,
        stat_json,
        available_count
      FROM ranked_listings
      WHERE row_number = 1
      ORDER BY price ASC, rarity DESC, name ASC
    `,
  );

  return result.rows;
}

async function getMarketOwnListingRows(roleId) {
  const result = await query(
    `
      SELECT
        MIN(market_listing.listing_id) AS listing_id,
        market_listing.seller_role_id,
        seller_role.name AS seller_name,
        market_listing.item_id,
        market_listing.category_key,
        market_listing.price,
        market_listing.status,
        MIN(market_listing.buyer_role_id) AS buyer_role_id,
        MIN(market_listing.sold_price) AS sold_price,
        SUM(market_listing.fee_amount) AS fee_amount,
        SUM(market_listing.seller_receive_amount) AS seller_receive_amount,
        BOOL_AND(market_listing.seller_notice_seen) AS seller_notice_seen,
        MIN(market_listing.created_at) AS created_at,
        MAX(market_listing.updated_at) AS updated_at,
        MAX(market_listing.sold_at) AS sold_at,
        MAX(market_listing.cancelled_at) AS cancelled_at,
        item.name,
        item.rarity,
        item.slot,
        item.slot_usage,
        item.description,
        item.sell_price,
        item.stat_json,
        COUNT(*)::INTEGER AS listing_count
      FROM market_listing
      JOIN item ON item.item_id = market_listing.item_id
      JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
      WHERE
        market_listing.seller_role_id = $1
        AND NOT (market_listing.status = 'sold' AND market_listing.seller_notice_seen = TRUE)
      GROUP BY
        market_listing.seller_role_id,
        seller_role.name,
        market_listing.item_id,
        market_listing.category_key,
        market_listing.price,
        market_listing.status,
        item.name,
        item.rarity,
        item.slot,
        item.slot_usage,
        item.description,
        item.sell_price,
        item.stat_json
      ORDER BY
        CASE market_listing.status
          WHEN 'sold' THEN CASE WHEN BOOL_AND(market_listing.seller_notice_seen) THEN 1 ELSE 0 END
          WHEN 'active' THEN 2
          ELSE 3
        END,
        COALESCE(MAX(market_listing.sold_at), MIN(market_listing.created_at)) DESC
      LIMIT 24
    `,
    [roleId],
  );

  return result.rows;
}

async function getMarketSnapshotForRole(roleId) {
  const [activeListings, ownListings] = await Promise.all([
    getMarketActiveSummaryRows(),
    roleId ? getMarketOwnListingRows(roleId) : Promise.resolve([]),
  ]);

  return buildMarketSnapshot(roleId || null, activeListings, ownListings);
}

async function deleteBackpackEntry(client, roleId, backpackId) {
  const result = await client.query(
    `
      DELETE FROM backpack
      WHERE role_id = $1 AND backpack_id = $2
    `,
    [roleId, backpackId],
  );

  return result.rowCount > 0;
}

async function findUserByGuestToken(guestToken) {
  const result = await query(
    `
      SELECT
        user_id,
        guest_token,
        account_type,
        username,
        last_login_at,
        last_seen_at
      FROM "user"
      WHERE guest_token = $1
    `,
    [guestToken],
  );

  return result.rows[0] || null;
}

async function findRoleByUserId(userId) {
  const result = await query(
    `
      SELECT
        role_id,
        user_id,
        name,
        race_key,
        class_key,
        level,
        exp,
        gold,
        aether_crystal,
        strength,
        agility,
        intelligence,
        vitality,
        current_health,
        avatar_seed
      FROM "role"
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

async function requireDashboardData(guestToken) {
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw new Error("角色不存在，请先创建角色。");
  }

  const [afkResult, backpackResult] = await Promise.all([
    query(
      `
        SELECT
          afk_id,
          role_id,
          status,
          map_key,
          started_at,
          last_settled_at,
          pending_gold,
          pending_aether_crystal,
          pending_exp,
          accrued_seconds,
          recent_encounters
        FROM afk
        WHERE role_id = $1
      `,
      [role.role_id],
    ),
    query(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
          item.slot,
          item.slot_usage,
          item.description,
          item.sell_price,
          item.stat_json
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = $1
        ORDER BY backpack.equipped DESC, item.rarity DESC, item.name ASC
      `,
      [role.role_id],
    ),
  ]);

  const afk = afkResult.rows[0];

  if (!afk) {
    throw new Error("挂机状态不存在，请重新创建角色。");
  }

  afk.recent_encounters = normalizeEncounterLog(afk.recent_encounters);
  backpackResult.rows.forEach((item) => {
    const itemSeed = itemSeedById.get(item.item_id);
    if (itemSeed) {
      item.slot = itemSeed.slot;
      item.slot_usage = itemSeed.slotUsage;
    }
    item.equipped_slot_groups = normalizeEquippedSlotGroups(item.equipped_slot_groups);
    item.equipped = item.equipped_slot_groups.length > 0;
  });
  sortBackpackRows(backpackResult.rows);
  const market = await getMarketSnapshotForRole(role.role_id);

  return {
    afk,
    backpack: backpackResult.rows,
    market,
    role,
    user,
  };
}

function buildSnapshot(data, options = {}) {
  const progress = getCurrentLevelProgress(data.role.exp);
  const currentMap = data.afk.map_key ? getMapConfig(data.afk.map_key) : null;
  const bodySlotCapacities = getBodySlotCapacities(data.role.race_key);
  const bodySlots = buildRoleBodySlots(data.role, data.backpack);
  const effectiveStats = getRoleEffectiveStats(data.role, data.backpack);
  const maxHealth = getRoleMaxHealth(data.role, data.backpack);
  const currentHealth = Math.min(maxHealth, normalizeNumber(data.role.current_health));

  return {
    serverTime: Date.now(),
    account: {
      guestToken: data.user.guest_token,
      hasRole: true,
      mode: data.user.account_type || "guest",
      username: data.user.username || null,
      userId: data.user.user_id,
    },
    config: {
      classes: classConfigs,
      levels: levelTable,
      maps: mapConfigs,
      races: raceConfigs,
    },
    role: {
      roleId: data.role.role_id,
      name: data.role.name,
      raceKey: data.role.race_key,
      classKey: data.role.class_key,
      level: data.role.level,
      exp: data.role.exp,
      currentLevelExp: progress.currentLevelExp,
      nextLevelExp: progress.nextLevelExp,
      currentHealth,
      maxHealth,
      gold: data.role.gold,
      aetherCrystal: data.role.aether_crystal,
      avatarSeed: data.role.avatar_seed,
      stats: effectiveStats,
      bodySlotCapacities,
      bodySlots,
    },
    backpack: data.backpack.map((item) => ({
      backpackId: item.backpack_id,
      itemId: item.item_id,
      quantity: item.quantity,
      equipped: item.equipped,
      equippedCount: getBackpackEquippedCount(item),
      equippedSlotGroups: item.equipped_slot_groups || [],
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
      slotUsage: item.slot_usage,
      description: item.description,
      sellPrice: item.sell_price,
      stats: item.stat_json || {},
    })),
    afk: {
      status: data.afk.status,
      mapKey: data.afk.map_key,
      startedAt: toMillis(data.afk.started_at),
      lastSettledAt: toMillis(data.afk.last_settled_at),
      shouldShowOfflineRewardModal: options.shouldShowOfflineRewardModal || false,
      accruedSeconds: data.afk.accrued_seconds,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap,
      pendingReward: {
        seconds: data.afk.accrued_seconds,
        gold: data.afk.pending_gold,
        aetherCrystal: data.afk.pending_aether_crystal,
        exp: data.afk.pending_exp,
      },
      estimatedHourlyReward: buildHourlyReward(data.afk.map_key),
      encounterRates: afkEncounterChances,
      recentEncounters: normalizeEncounterLog(data.afk.recent_encounters),
    },
    market: data.market,
  };
}

function buildBootstrapSnapshot(user, market) {
  return {
    account: {
      guestToken: user.guest_token,
      hasRole: false,
      mode: user.account_type || "guest",
      username: user.username || null,
      userId: user.user_id,
    },
    afk: {
      status: "idle",
      mapKey: null,
      startedAt: null,
      lastSettledAt: null,
      shouldShowOfflineRewardModal: false,
      accruedSeconds: 0,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap: null,
      pendingReward: {
        seconds: 0,
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
      },
      estimatedHourlyReward: {
        seconds: 3600,
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
      },
      encounterRates: afkEncounterChances,
      recentEncounters: [],
    },
    market,
    backpack: [],
    config: {
      classes: classConfigs,
      levels: levelTable,
      maps: mapConfigs,
      races: raceConfigs,
    },
    role: null,
    serverTime: Date.now(),
  };
}

async function getSessionSnapshot(guestToken) {
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    return buildBootstrapSnapshot(user, await getMarketSnapshotForRole(null));
  }

  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: wasOffline ? MAX_OFFLINE_SECONDS : undefined,
    now,
  });
  const didApplyEncounterEffects = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack);
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);

  const didAutoSettleOnlineReward = !wasOffline && applyRewardToRole(data.role, rewardDelta, data.backpack);

  if (didAutoSettleOnlineReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  const shouldShowOfflineRewardModal =
    wasOffline &&
    (data.afk.pending_gold > 0 || data.afk.pending_aether_crystal > 0 || data.afk.pending_exp > 0);

  await withTransaction(async (client) => {
    await client.query(`UPDATE "user" SET last_seen_at = NOW() WHERE user_id = $1`, [data.user.user_id]);
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didAutoSettleOnlineReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal });
}

async function startAfkForGuest(guestToken, mapKey) {
  const map = getMapConfig(mapKey);

  if (!map) {
    throw new Error("地图不存在。");
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, { now });

  if (data.afk.status === "active") {
    throw new Error("当前已经处于挂机中，请先停止。");
  }

  data.afk.status = "active";
  data.afk.map_key = mapKey;
  data.afk.started_at = new Date(now);
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistAfk(client, data.afk);
  });

  return getSessionSnapshot(guestToken);
}

async function stopAfkForGuest(guestToken) {
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, { now });

  if (data.afk.status === "idle") {
    return buildSnapshot(data);
  }

  const didApplyEncounterEffects = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack);
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);
  const didApplyReward = applyRewardToRole(data.role, rewardDelta, data.backpack);

  if (didApplyReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  data.afk.status = "idle";
  data.afk.last_settled_at = new Date(now);
  discardCurrentTaskProgress(data.afk);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  return getSessionSnapshot(guestToken);
}

async function claimAfkRewardForGuest(guestToken) {
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: MAX_OFFLINE_SECONDS,
    now,
  });
  const didApplyEncounterEffects = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack);
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);

  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;

  const didApplyOnlineReward = !wasOffline && applyRewardToRole(data.role, rewardDelta, data.backpack);

  if (didApplyOnlineReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  if (
    data.afk.pending_gold <= 0 &&
    data.afk.pending_aether_crystal <= 0 &&
    data.afk.pending_exp <= 0
  ) {
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyOnlineReward || didApplyEncounterItems) {
      await withTransaction(async (client) => {
        if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyOnlineReward) {
          await persistRole(client, data.role);
        }
        if (didApplyEncounterItems) {
          await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
        }
        await persistAfk(client, data.afk);
      });
    }
    return buildSnapshot(data);
  }

  const didClaimPendingReward = applyPendingRewardToRole(data.role, data.afk, data.backpack);
  data.afk.pending_gold = 0;
  data.afk.pending_aether_crystal = 0;
  data.afk.pending_exp = 0;
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyOnlineReward || didClaimPendingReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  return getSessionSnapshot(guestToken);
}

async function dropBackpackItemForGuest(guestToken, backpackId) {
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要丢弃的物品不存在。");
  }

  await withTransaction(async (client) => {
    const deleted = await deleteBackpackEntry(client, data.role.role_id, normalizedBackpackId);

    if (!deleted) {
      throw new Error("物品丢弃失败，请稍后重试。");
    }
  });

  return getSessionSnapshot(guestToken);
}

async function equipBackpackItemForGuest(guestToken, backpackId) {
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要装备的物品不存在。");
  }

  allocateEquipmentSlots(data.role, data.backpack, matchedItem);
  sortBackpackRows(data.backpack);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth) {
      await persistRole(client, data.role);
    }
    await persistBackpackEquipState(client, data.backpack);
  });

  return getSessionSnapshot(guestToken);
}

async function unequipBackpackItemForGuest(guestToken, backpackId) {
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要脱下的物品不存在。");
  }

  removeOneEquippedGroup(matchedItem);
  sortBackpackRows(data.backpack);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth) {
      await persistRole(client, data.role);
    }
    await persistBackpackEquipState(client, data.backpack);
  });

  return getSessionSnapshot(guestToken);
}

async function createMarketListingForGuest(guestToken, backpackId, price, quantity) {
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";
  const normalizedPrice = normalizeNumber(price);
  const normalizedQuantity = normalizeNumber(quantity);

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  if (normalizedPrice <= 0) {
    throw new Error("上架价格必须大于 0。");
  }

  if (normalizedQuantity <= 0) {
    throw new Error("上架数量必须大于 0。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要上架的物品不存在。");
  }

  if (matchedItem.quantity <= (matchedItem.equipped_slot_groups || []).length) {
    throw new Error("这件物品没有可上架的剩余数量。");
  }

  await withTransaction(async (client) => {
    const backpackResult = await client.query(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
          item.slot,
          item.slot_usage,
          item.description,
          item.sell_price,
          item.stat_json
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = $1 AND backpack.backpack_id = $2
        FOR UPDATE
      `,
      [data.role.role_id, normalizedBackpackId],
    );
    const lockedBackpackItem = backpackResult.rows[0];

    if (!lockedBackpackItem) {
      throw new Error("要上架的物品不存在。");
    }

    lockedBackpackItem.equipped_slot_groups = normalizeEquippedSlotGroups(lockedBackpackItem.equipped_slot_groups);
    const sellableQuantity = Math.max(0, lockedBackpackItem.quantity - getBackpackEquippedCount(lockedBackpackItem));

    if (sellableQuantity <= 0) {
      throw new Error("这件物品没有可上架的剩余数量。");
    }

    if (normalizedQuantity > sellableQuantity) {
      throw new Error("上架数量超过了当前可出售数量。");
    }

    if (lockedBackpackItem.quantity <= normalizedQuantity) {
      const deleted = await deleteBackpackEntry(client, data.role.role_id, lockedBackpackItem.backpack_id);

      if (!deleted) {
        throw new Error("上架失败，请稍后重试。");
      }
    } else {
      await client.query(
        `
          UPDATE backpack
          SET quantity = quantity - $3, updated_at = NOW()
          WHERE backpack_id = $1 AND role_id = $2 AND quantity >= $3
        `,
        [lockedBackpackItem.backpack_id, data.role.role_id, normalizedQuantity],
      );
    }

    for (let index = 0; index < normalizedQuantity; index += 1) {
      await client.query(
        `
          INSERT INTO market_listing (
            listing_id,
            seller_role_id,
            item_id,
            category_key,
            price,
            status,
            fee_amount,
            seller_receive_amount,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, 'equipment', $4, 'active', 0, 0, NOW(), NOW())
        `,
        [`listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index}`, data.role.role_id, lockedBackpackItem.item_id, normalizedPrice],
      );
    }
  });

  return getSessionSnapshot(guestToken);
}

async function cancelMarketListingForGuest(guestToken, listingId) {
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query(
      `
        SELECT listing_id, seller_role_id, item_id, status
        FROM market_listing
        WHERE listing_id = $1
        FOR UPDATE
      `,
      [normalizedListingId],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.seller_role_id !== data.role.role_id) {
      throw new Error("要下架的挂单不存在。");
    }

    if (listing.status !== "active") {
      throw new Error("该挂单当前不能下架。");
    }

    const siblingResult = await client.query(
      `
        SELECT COUNT(*)::INTEGER AS listing_count
        FROM market_listing
        WHERE
          seller_role_id = $1
          AND item_id = $2
          AND price = $3
          AND status = 'active'
      `,
      [data.role.role_id, listing.item_id, listing.price],
    );
    const listingCount = normalizeNumber(siblingResult.rows[0]?.listing_count || 0);

    await client.query(
      `
        UPDATE market_listing
        SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
        WHERE
          seller_role_id = $1
          AND item_id = $2
          AND price = $3
          AND status = 'active'
      `,
      [data.role.role_id, listing.item_id, listing.price],
    );

    await upsertBackpackItemQuantity(client, data.role.role_id, listing.item_id, Math.max(1, listingCount));
  });

  return getSessionSnapshot(guestToken);
}

async function buyMarketListingForGuest(guestToken, listingId) {
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query(
      `
        SELECT listing_id, seller_role_id, item_id, price, status, created_at
        FROM market_listing
        WHERE listing_id = $1
        FOR UPDATE
      `,
      [normalizedListingId],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.status !== "active") {
      throw new Error("这件商品已经被买走或下架了。");
    }

    if (listing.seller_role_id === data.role.role_id) {
      throw new Error("不能购买自己上架的物品。");
    }

    const cheapestResult = await client.query(
      `
        SELECT listing_id
        FROM market_listing
        WHERE item_id = $1 AND status = 'active'
        ORDER BY price ASC, created_at ASC, listing_id ASC
        LIMIT 1
      `,
      [listing.item_id],
    );

    if (cheapestResult.rows[0]?.listing_id !== listing.listing_id) {
      throw new Error("当前只能购买这件商品中最便宜的那一件。");
    }

    const [buyerRoleResult, sellerRoleResult, sellerAfkResult] = await Promise.all([
      client.query(`SELECT role_id, gold, level, exp, aether_crystal, current_health FROM "role" WHERE role_id = $1 FOR UPDATE`, [data.role.role_id]),
      client.query(`SELECT role_id, gold, level, exp, aether_crystal, current_health FROM "role" WHERE role_id = $1 FOR UPDATE`, [listing.seller_role_id]),
      client.query(
        `
          SELECT
            afk_id,
            role_id,
            status,
            map_key,
            started_at,
            last_settled_at,
            pending_gold,
            pending_aether_crystal,
            pending_exp,
            accrued_seconds,
            recent_encounters
          FROM afk
          WHERE role_id = $1
          FOR UPDATE
        `,
        [listing.seller_role_id],
      ),
    ]);

    const buyerRole = buyerRoleResult.rows[0];
    const sellerRole = sellerRoleResult.rows[0];
    const sellerAfk = sellerAfkResult.rows[0];

    if (!buyerRole || !sellerRole || !sellerAfk) {
      throw new Error("交易角色不存在，请稍后重试。");
    }

    if (buyerRole.gold < listing.price) {
      throw new Error("金币不足，无法购买这件商品。");
    }

    const { feeAmount, sellerReceiveAmount } = calculateMarketFee(listing.price);

    await client.query(`UPDATE "role" SET gold = gold - $2, updated_at = NOW() WHERE role_id = $1`, [buyerRole.role_id, listing.price]);
    sellerAfk.pending_gold += sellerReceiveAmount;
    await persistAfk(client, sellerAfk);
    await upsertBackpackItemQuantity(client, buyerRole.role_id, listing.item_id, 1);
    await client.query(
      `
        UPDATE market_listing
        SET
          status = 'sold',
          buyer_role_id = $2,
          sold_price = $3,
          fee_amount = $4,
          seller_receive_amount = $5,
          seller_notice_seen = FALSE,
          sold_at = NOW(),
          updated_at = NOW()
        WHERE listing_id = $1 AND status = 'active'
      `,
      [listing.listing_id, buyerRole.role_id, listing.price, feeAmount, sellerReceiveAmount],
    );
  });

  return getSessionSnapshot(guestToken);
}

async function dismissMarketSoldNotificationForGuest(guestToken, listingId) {
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query(
      `
        SELECT listing_id, seller_role_id, item_id, price, status
        FROM market_listing
        WHERE listing_id = $1
        FOR UPDATE
      `,
      [normalizedListingId],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.seller_role_id !== data.role.role_id || listing.status !== "sold") {
      throw new Error("要处理的出售通知不存在。");
    }

    await client.query(
      `
        UPDATE market_listing
        SET
          seller_notice_seen = TRUE,
          updated_at = NOW()
        WHERE
          seller_role_id = $1
          AND item_id = $2
          AND price = $3
          AND status = 'sold'
          AND seller_notice_seen = FALSE
      `,
      [data.role.role_id, listing.item_id, listing.price],
    );
  });

  return getSessionSnapshot(guestToken);
}

module.exports = {
  AFK_TASK_SECONDS,
  buyMarketListingForGuest,
  cancelMarketListingForGuest,
  dismissMarketSoldNotificationForGuest,
  getSessionSnapshot,
  createMarketListingForGuest,
  startAfkForGuest,
  stopAfkForGuest,
  claimAfkRewardForGuest,
  dropBackpackItemForGuest,
  equipBackpackItemForGuest,
  unequipBackpackItemForGuest,
};
