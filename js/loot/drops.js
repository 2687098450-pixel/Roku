/** 战斗掉落：等级=层数；品质决定词条数；Boss 按层专属 */

import {
  makeItem,
  toBagEquip,
  RARITY_ORDER,
  normalizeRarity,
  floorItemLevel,
  affixCountForRarity,
  makeUniqueAffix,
  rollAffixes,
} from "../characters/omni/equipment.js?v=63";
import { getFloorDef } from "../map/floors.js?v=63";

const NORMAL_POOL = [
  { name: "皮帽", slot: "helmet", base: { def: 1 }, icon: "hat.png" },
  { name: "铜坠", slot: "necklace", base: { hp: 8 }, icon: "pendant.png" },
  { name: "布衣", slot: "armor", base: { def: 2, hp: 10 }, icon: "cloth.png" },
  { name: "草鞋", slot: "shoes", base: { spd: 1 }, icon: "sandals.png" },
  { name: "木戒", slot: "ringL", base: { atk: 1 }, icon: "ring.png" },
  { name: "短剑", slot: "weapon", base: { atk: 4 }, icon: "sword.png", kind: "剑" },
  { name: "木盾", slot: "shield", base: { def: 2 }, icon: "wood_shield.png" },
  { name: "手枪", slot: "weapon", base: { atk: 5, spd: 1 }, icon: "pistol.png", kind: "手枪" },
  { name: "法杖", slot: "weapon", base: { atk: 2, hp: 12 }, icon: "staff.png", kind: "法杖" },
];

/**
 * 各层 Boss 专属掉落（技能装）
 * 每层独立池：打哪个关口，掉哪套主题装备
 */
/** 3/5/6 层必掉的唯一红装（可多层数组；仅对应角色装备时生效） */
export const UNIQUE_BOSS_BY_FLOOR = {
  3: [
    {
      name: "冠廊爆裂枪",
      slot: "weapon",
      base: { atk: 8, spd: 2 },
      icon: "pistol.png",
      kind: "手枪",
      uniqueId: "pink_burst_echo",
      skillOwner: "pink",
      uniqueText: "强化爆裂矢：三连射半伤·击杀加射",
      desc: "潮汐冠廊守护者掉落。唯一词条强化小粉二技能；仅小粉装备时生效。",
    },
    {
      name: "冠廊反伤盾",
      slot: "shield",
      base: { def: 6, hp: 22 },
      icon: "wood_shield.png",
      kind: "Boss",
      uniqueId: "yellow_reflect_shield",
      skillOwner: "yellow",
      uniqueText: "强化反伤：友军比例再 -10%",
      desc: "潮汐冠廊守护者掉落。唯一词条强化反伤；仅小黄装备时生效。",
    },
  ],
  5: [
    {
      name: "雾林灵衡坠",
      slot: "necklace",
      base: { hp: 28, def: 2 },
      icon: "pendant.png",
      kind: "Boss",
      uniqueId: "omni_balance_spirit",
      skillOwner: "omni",
      uniqueText: "强化均衡：十字共享·灵体化",
      desc: "十字雾林守护者掉落。唯一词条强化均衡；仅全能装备时生效。",
    },
    {
      name: "雾林治愈戒",
      slot: "ringL",
      base: { hp: 16, atk: 1 },
      icon: "ring.png",
      kind: "Boss",
      uniqueId: "green_mend_pulse",
      skillOwner: "",
      uniqueText: "强化治愈之触",
      desc: "十字雾林守护者掉落。唯一词条强化治愈之触。",
    },
  ],
  6: [
    {
      name: "环礁生机杖",
      slot: "weapon",
      base: { atk: 4, hp: 26 },
      icon: "staff.png",
      kind: "法杖",
      uniqueId: "green_life_flow",
      skillOwner: "green",
      uniqueText: "强化生机流转：治疗提升友军伤害",
      desc: "环礁秘径守护者掉落。唯一词条强化生机流转；仅小绿装备时生效。",
    },
  ],
};

const BOSS_LOOT_BY_FLOOR = {
  1: [
    {
      name: "海岛短剑",
      slot: "weapon",
      base: { atk: 5 },
      icon: "sword.png",
      kind: "剑",
      rarity: "purple",
      skillMods: { powerFlat: 6 },
      skillAffixText: "技能伤害 +6",
      desc: "阳光海岛守护者掉落。锋利而轻巧。",
    },
    {
      name: "潮光坠",
      slot: "necklace",
      base: { hp: 14 },
      icon: "pendant.png",
      rarity: "purple",
      skillMods: { healMult: 0.12 },
      skillAffixText: "治疗效果 +12%",
      desc: "阳光海岛守护者掉落。微弱的治愈潮汐。",
    },
  ],
  2: [
    {
      name: "沙洲手枪",
      slot: "weapon",
      base: { atk: 6, spd: 1 },
      icon: "pistol.png",
      kind: "手枪",
      rarity: "purple",
      skillMods: { powerMult: 0.12 },
      skillAffixText: "技能伤害 +12%",
      desc: "弯角沙洲守护者掉落。适合远程连射。",
    },
    {
      name: "风蚀草鞋",
      slot: "shoes",
      base: { spd: 2 },
      icon: "sandals.png",
      rarity: "purple",
      skillMods: { hitBonus: 1 },
      skillAffixText: "技能段数 +1",
      desc: "弯角沙洲守护者掉落。脚下生风。",
    },
  ],
  3: [
    {
      name: "冠廊法杖",
      slot: "weapon",
      base: { atk: 3, hp: 18 },
      icon: "staff.png",
      kind: "法杖",
      rarity: "orange",
      skillMods: { healMult: 0.2 },
      skillAffixText: "治疗效果 +20%",
      desc: "潮汐冠廊守护者掉落。滋养队友的翠绿。",
    },
    {
      name: "浪纹盾",
      slot: "shield",
      base: { def: 3, hp: 12 },
      icon: "wood_shield.png",
      rarity: "purple",
      skillMods: { powerFlat: 4 },
      skillAffixText: "技能伤害 +4",
      desc: "潮汐冠廊守护者掉落。以守为攻。",
    },
  ],
  4: [
    {
      name: "港湾佩枪",
      slot: "weapon",
      base: { atk: 7, spd: 1 },
      icon: "pistol.png",
      kind: "手枪",
      rarity: "orange",
      skillMods: { powerMult: 0.15, powerFlat: 4 },
      skillAffixText: "技能伤害 +15%，额外 +4",
      desc: "双湾港守护者掉落。港口走私货。",
    },
    {
      name: "缆绳之戒",
      slot: "ringL",
      base: { atk: 2 },
      icon: "ring.png",
      rarity: "purple",
      skillMods: { hitBonus: 1 },
      skillAffixText: "技能段数 +1",
      desc: "双湾港守护者掉落。勒紧再释放。",
    },
  ],
  5: [
    {
      name: "雾林翠枝盾",
      slot: "shield",
      base: { def: 3, hp: 20 },
      icon: "vine_shield.png",
      rarity: "orange",
      skillMods: { healMult: 0.25 },
      skillAffixText: "治疗效果 +25%",
      desc: "十字雾林守护者掉落。雾气中的生机。",
    },
    {
      name: "迷踪布衣",
      slot: "armor",
      base: { def: 3, hp: 22 },
      icon: "cloth.png",
      rarity: "purple",
      skillMods: { powerMult: 0.1 },
      skillAffixText: "技能伤害 +10%",
      desc: "十字雾林守护者掉落。难被锁定的剪影。",
    },
  ],
  6: [
    {
      name: "环礁连击戒",
      slot: "ringL",
      base: { atk: 3 },
      icon: "ring.png",
      rarity: "orange",
      skillMods: { hitBonus: 1, powerMult: 0.08 },
      skillAffixText: "技能段数 +1，伤害 +8%",
      desc: "环礁秘径守护者掉落。一击之后还有余韵。",
    },
    {
      name: "珊瑚坠",
      slot: "necklace",
      base: { hp: 24 },
      icon: "pendant.png",
      rarity: "orange",
      skillMods: { powerFlat: 8 },
      skillAffixText: "技能伤害 +8",
      desc: "环礁秘径守护者掉落。坚硬却带着锋芒。",
    },
  ],
  7: [
    {
      name: "双殿穿心剑",
      slot: "weapon",
      base: { atk: 8 },
      icon: "sword.png",
      kind: "剑",
      rarity: "orange",
      skillMods: { powerFlat: 10, powerMult: 0.12 },
      skillAffixText: "技能伤害 +12%，额外 +10",
      desc: "双殿甬道守护者掉落。专破防护的一剑。",
    },
    {
      name: "石殿盔",
      slot: "helmet",
      base: { def: 4, hp: 16 },
      icon: "hat.png",
      rarity: "orange",
      skillMods: { powerMult: 0.18 },
      skillAffixText: "技能伤害 +18%",
      desc: "双殿甬道守护者掉落。沉重而专注。",
    },
  ],
  8: [
    {
      name: "遗迹爆裂符",
      slot: "necklace",
      base: { hp: 20 },
      icon: "pendant.png",
      rarity: "red",
      skillMods: { powerMult: 0.28 },
      skillAffixText: "技能伤害 +28%",
      desc: "退台遗迹守护者掉落。古老的引爆咒文。",
    },
    {
      name: "齐射徽章",
      slot: "ringR",
      base: { spd: 2, atk: 1 },
      icon: "ring.png",
      rarity: "orange",
      skillMods: { hitBonus: 1, powerMult: 0.12 },
      skillAffixText: "技能段数 +1，伤害 +12%",
      desc: "退台遗迹守护者掉落。箭雨的节奏。",
    },
  ],
  9: [
    {
      name: "锯齿怒枪",
      slot: "weapon",
      base: { atk: 9, spd: 2 },
      icon: "pistol.png",
      kind: "手枪",
      rarity: "red",
      skillMods: { powerMult: 0.22, powerFlat: 8 },
      skillAffixText: "技能伤害 +22%，额外 +8",
      desc: "锯齿海湾守护者掉落。连续爆发的火舌。",
    },
    {
      name: "回春翠枝",
      slot: "shield",
      base: { def: 4, hp: 28 },
      icon: "vine_shield.png",
      rarity: "red",
      skillMods: { healMult: 0.3 },
      skillAffixText: "治疗效果 +30%",
      desc: "锯齿海湾守护者掉落。风暴中的绿意。",
    },
  ],
  10: [
    {
      name: "终焉法冠",
      slot: "helmet",
      base: { def: 5, hp: 30 },
      icon: "hat.png",
      rarity: "red",
      skillMods: { powerMult: 0.35, powerFlat: 10 },
      skillAffixText: "技能伤害大幅提升",
      desc: "终焉爪屿守护者掉落。终结之战的冠冕。",
    },
    {
      name: "爪屿誓戒",
      slot: "ringR",
      base: { atk: 4, spd: 2 },
      icon: "ring.png",
      rarity: "red",
      skillMods: { hitBonus: 1, powerMult: 0.2 },
      skillAffixText: "技能段数 +1，伤害 +20%",
      desc: "终焉爪屿守护者掉落。最后的契约。",
    },
    {
      name: "深渊穿心剑",
      slot: "weapon",
      base: { atk: 10 },
      icon: "sword.png",
      kind: "剑",
      rarity: "red",
      skillMods: { powerFlat: 14, powerMult: 0.18 },
      skillAffixText: "技能伤害 +18%，额外 +14",
      desc: "终焉爪屿守护者掉落。贯穿一切的终剑。",
    },
  ],
};

/** 各层 Boss 额外「普通装」小池（造型主题不同，无技能词条） */
const BOSS_NORMAL_BY_FLOOR = {
  1: [
    { name: "海滩皮帽", slot: "helmet", base: { def: 2 }, icon: "hat.png" },
    { name: "贝壳坠", slot: "necklace", base: { hp: 12 }, icon: "pendant.png" },
  ],
  2: [
    { name: "沙纹布衣", slot: "armor", base: { def: 2, hp: 14 }, icon: "cloth.png" },
    { name: "干裂草鞋", slot: "shoes", base: { spd: 2 }, icon: "sandals.png" },
  ],
  3: [
    { name: "潮木盾", slot: "shield", base: { def: 3 }, icon: "wood_shield.png" },
    { name: "海藻戒", slot: "ringL", base: { atk: 2 }, icon: "ring.png" },
  ],
  4: [
    { name: "锚链坠", slot: "necklace", base: { hp: 16 }, icon: "pendant.png" },
    { name: "码头短剑", slot: "weapon", base: { atk: 5 }, icon: "sword.png", kind: "剑" },
  ],
  5: [
    { name: "雾丝衣", slot: "armor", base: { def: 3, hp: 18 }, icon: "cloth.png" },
    { name: "苔环", slot: "ringL", base: { atk: 2, hp: 6 }, icon: "ring.png" },
  ],
  6: [
    { name: "礁石盔", slot: "helmet", base: { def: 3, hp: 10 }, icon: "hat.png" },
    { name: "暗潮鞋", slot: "shoes", base: { spd: 2 }, icon: "sandals.png" },
  ],
  7: [
    { name: "殿卫盾", slot: "shield", base: { def: 4 }, icon: "wood_shield.png" },
    { name: "甬道杖", slot: "weapon", base: { atk: 4, hp: 14 }, icon: "staff.png", kind: "法杖" },
  ],
  8: [
    { name: "残阶袍", slot: "armor", base: { def: 4, hp: 20 }, icon: "cloth.png" },
    { name: "遗火坠", slot: "necklace", base: { hp: 18, atk: 1 }, icon: "pendant.png" },
  ],
  9: [
    { name: "海湾枪套", slot: "shield", base: { def: 3, spd: 1 }, icon: "holster.png" },
    { name: "浪刃戒", slot: "ringR", base: { atk: 3 }, icon: "ring.png" },
  ],
  10: [
    { name: "终焉披风", slot: "armor", base: { def: 5, hp: 26 }, icon: "cloth.png" },
    { name: "深渊鞋", slot: "shoes", base: { spd: 3 }, icon: "sandals.png" },
  ],
};

function floorName(floor) {
  try {
    return getFloorDef(floor)?.name || `${floor}层`;
  } catch (_) {
    return `${floor}层`;
  }
}

function bossSkillPool(floor) {
  const f = Math.max(1, Math.min(10, Math.floor(floor || 1)));
  return BOSS_LOOT_BY_FLOOR[f] || BOSS_LOOT_BY_FLOOR[1];
}

function bossNormalPool(floor) {
  const f = Math.max(1, Math.min(10, Math.floor(floor || 1)));
  return BOSS_NORMAL_BY_FLOOR[f] || NORMAL_POOL;
}

function rarityByFloor(floor, preferHigh = false) {
  const f = Math.max(1, floor || 1);
  let idx;
  if (f <= 2) idx = preferHigh ? 1 : 0;
  else if (f <= 4) idx = preferHigh ? 2 : 1;
  else if (f <= 6) idx = preferHigh ? 3 : 2;
  else if (f <= 8) idx = preferHigh ? 4 : 3;
  else idx = preferHigh ? 5 : 4;
  if (Math.random() < 0.35) idx = Math.max(0, idx - 1);
  if (Math.random() < 0.25) idx = Math.min(RARITY_ORDER.length - 1, idx + 1);
  return RARITY_ORDER[idx];
}

function bumpRarity(rarity) {
  const i = RARITY_ORDER.indexOf(normalizeRarity(rarity));
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, i + 1)];
}

function ensureMinRarityForSkill(rarity) {
  const need = 2;
  let r = normalizeRarity(rarity);
  while (affixCountForRarity(r) < need) {
    const i = RARITY_ORDER.indexOf(r);
    if (i >= RARITY_ORDER.length - 1) break;
    r = RARITY_ORDER[i + 1];
  }
  return r;
}

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollNormalItem(floor) {
  const tpl = pick(NORMAL_POOL);
  const rarity = rarityByFloor(floor, Math.random() < 0.35);
  const level = floorItemLevel(floor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `${floorName(floor)}掉落 · 装备等级 ${level}。`,
    })
  );
}

function rollUniqueBossItem(floor, tpl) {
  const level = floorItemLevel(floor, { boss: true });
  const place = floorName(floor);
  const preferDps =
    tpl.slot === "weapon" ||
    tpl.slot === "ringL" ||
    tpl.slot === "ringR" ||
    tpl.skillOwner === "pink";
  const preferTank =
    tpl.slot === "shield" ||
    tpl.slot === "armor" ||
    tpl.skillOwner === "yellow";
  // 红装 3 词条：1 唯一 + 2 属性（输出装偏向暴击/攻击）
  const affixes = [
    makeUniqueAffix(tpl.uniqueId, tpl.uniqueText),
    ...rollAffixes(2, level, {
      allowSkill: false,
      preferDps,
      preferTank: !preferDps && preferTank,
    }),
  ];
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `unique_${tpl.uniqueId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity: "red",
      icon: tpl.icon,
      kind: tpl.kind || "Boss",
      level,
      desc: `${tpl.desc}（${place} · 等级 ${level}）`,
      uniqueId: tpl.uniqueId,
      skillOwner: tpl.skillOwner,
      skillStrengthen: true,
      affixes,
      bossOnly: true,
      bossFloor: floor,
    })
  );
}

/** 所有唯一词条装备各一件（按层模板生成） */
export function createAllUniqueItems() {
  const out = [];
  for (const [floorKey, raw] of Object.entries(UNIQUE_BOSS_BY_FLOOR)) {
    const floor = Number(floorKey) || 1;
    for (const tpl of [].concat(raw || []).filter(Boolean)) {
      if (!tpl.uniqueId) continue;
      out.push(rollUniqueBossItem(floor, tpl));
    }
  }
  return out;
}

function rollBossSkillItem(floor) {
  const tpl = pick(bossSkillPool(floor));
  let rarity = ensureMinRarityForSkill(tpl.rarity || "purple");
  if (Math.random() < 0.2) rarity = bumpRarity(rarity);
  if (floor >= 8 && Math.random() < 0.35) rarity = bumpRarity(rarity);
  const level = floorItemLevel(floor, { boss: true });
  const place = floorName(floor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `boss_${floor}_${tpl.name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "Boss",
      level,
      desc: `${tpl.desc}（${place} · 等级 ${level}）`,
      skillMods: { ...tpl.skillMods },
      skillAffixText: tpl.skillAffixText,
      bossOnly: true,
      bossFloor: floor,
    })
  );
}

function rollBossNormalItem(floor) {
  const tpl = pick(bossNormalPool(floor));
  let rarity = rarityByFloor(floor, true);
  if (Math.random() < 0.2) rarity = bumpRarity(rarity);
  const level = floorItemLevel(floor, { boss: true });
  const place = floorName(floor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `${place} Boss 掉落 · 装备等级 ${level}。`,
      bossFloor: floor,
    })
  );
}

/** 小怪：10% 掉一件装备（共用普通池） */
export function rollTrashLoot(monster) {
  if (Math.random() >= 0.1) return [];
  const floor = monster?.floor || 1;
  return [rollNormalItem(floor)];
}

/** Boss：必掉 2–3 件；有唯一装则全掉；其余补本层技能装/普通装 */
export function rollBossLoot(monster) {
  const floor = monster?.floor || 1;
  const drops = [];
  const uniqueTpls = []
    .concat(UNIQUE_BOSS_BY_FLOOR[floor] || [])
    .filter(Boolean);
  for (const tpl of uniqueTpls) {
    drops.push(rollUniqueBossItem(floor, tpl));
  }
  if (!drops.length) drops.push(rollBossSkillItem(floor));
  const count = Math.max(drops.length, Math.random() < 0.5 ? 2 : 3);
  while (drops.length < count) {
    if (Math.random() < 0.55) drops.push(rollBossSkillItem(floor));
    else drops.push(rollBossNormalItem(floor));
  }
  return drops;
}

export function rollBattleLoot(worldMonsters) {
  const drops = [];
  for (const m of worldMonsters || []) {
    if (!m) continue;
    if (m.isBoss) drops.push(...rollBossLoot(m));
    else drops.push(...rollTrashLoot(m));
  }
  return drops;
}
