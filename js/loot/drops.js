/** 战斗掉落：等级=层数；品质决定词条数 */

import {
  makeItem,
  toBagEquip,
  RARITY_ORDER,
  normalizeRarity,
  floorItemLevel,
  affixCountForRarity,
} from "../characters/omni/equipment.js";

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

/** Boss 专属：固定技能词条模板（仍受品质词条数约束） */
const BOSS_SKILL_GEAR = [
  {
    name: "连击之戒",
    slot: "ringL",
    base: { atk: 2 },
    icon: "ring.png",
    rarity: "purple",
    skillMods: { hitBonus: 1 },
    skillAffixText: "技能段数 +1",
    desc: "Boss 专属。技能额外攻击 1 次。",
  },
  {
    name: "爆裂护符",
    slot: "necklace",
    base: { hp: 12 },
    icon: "pendant.png",
    rarity: "orange",
    skillMods: { powerMult: 0.25 },
    skillAffixText: "技能伤害 +25%",
    desc: "Boss 专属。技能伤害 +25%。",
  },
  {
    name: "穿心短剑",
    slot: "weapon",
    base: { atk: 6 },
    icon: "sword.png",
    kind: "剑",
    rarity: "orange",
    skillMods: { powerFlat: 10, powerMult: 0.1 },
    skillAffixText: "技能伤害 +10%，额外 +10 点",
    desc: "Boss 专属。技能伤害强化。",
  },
  {
    name: "回春翠枝",
    slot: "shield",
    base: { def: 2, hp: 16 },
    icon: "vine_shield.png",
    rarity: "purple",
    skillMods: { healMult: 0.25 },
    skillAffixText: "治疗效果 +25%",
    desc: "Boss 专属。治疗效果 +25%。",
  },
  {
    name: "齐射徽章",
    slot: "ringR",
    base: { spd: 2 },
    icon: "ring.png",
    rarity: "red",
    skillMods: { hitBonus: 1, powerMult: 0.12 },
    skillAffixText: "技能段数 +1，伤害 +12%",
    desc: "Boss 专属。技能多段与伤害。",
  },
  {
    name: "怒涛法冠",
    slot: "helmet",
    base: { def: 3, hp: 20 },
    icon: "hat.png",
    rarity: "red",
    skillMods: { powerMult: 0.35, powerFlat: 6 },
    skillAffixText: "技能伤害大幅提升",
    desc: "Boss 专属。大幅提升技能攻击力。",
  },
];

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
  // 技能装至少紫（2 词条），可放技能词条 + 属性
  const need = 2;
  let r = normalizeRarity(rarity);
  while (affixCountForRarity(r) < need) {
    const i = RARITY_ORDER.indexOf(r);
    if (i >= RARITY_ORDER.length - 1) break;
    r = RARITY_ORDER[i + 1];
  }
  return r;
}

function rollNormalItem(floor) {
  const tpl = NORMAL_POOL[Math.floor(Math.random() * NORMAL_POOL.length)];
  const rarity = rarityByFloor(floor, Math.random() < 0.35);
  const level = floorItemLevel(floor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `第 ${floor} 层掉落 · 装备等级 ${level}。`,
    })
  );
}

function rollBossSkillItem(floor) {
  const tpl = BOSS_SKILL_GEAR[Math.floor(Math.random() * BOSS_SKILL_GEAR.length)];
  let rarity = ensureMinRarityForSkill(tpl.rarity || "purple");
  if (Math.random() < 0.2) rarity = bumpRarity(rarity);
  if (floor >= 8 && Math.random() < 0.35) rarity = bumpRarity(rarity);
  const level = floorItemLevel(floor, { boss: true });
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `boss_${tpl.name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "Boss",
      level,
      desc: `${tpl.desc}（第 ${floor} 层 · 等级 ${level}）`,
      skillMods: { ...tpl.skillMods },
      skillAffixText: tpl.skillAffixText,
      bossOnly: true,
    })
  );
}

function rollBossNormalItem(floor) {
  const tpl = NORMAL_POOL[Math.floor(Math.random() * NORMAL_POOL.length)];
  let rarity = rarityByFloor(floor, true);
  if (Math.random() < 0.2) rarity = bumpRarity(rarity);
  const level = floorItemLevel(floor, { boss: true });
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `Boss 掉落 · 第 ${floor} 层 · 装备等级 ${level}。`,
    })
  );
}

/** 小怪：10% 掉一件装备 */
export function rollTrashLoot(monster) {
  if (Math.random() >= 0.1) return [];
  const floor = monster?.floor || 1;
  return [rollNormalItem(floor)];
}

/** Boss：必掉 2–3 件 */
export function rollBossLoot(monster) {
  const floor = monster?.floor || 1;
  const count = Math.random() < 0.5 ? 2 : 3;
  const drops = [];
  drops.push(rollBossSkillItem(floor));
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
