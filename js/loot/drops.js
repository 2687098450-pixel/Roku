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
} from "../characters/omni/equipment.js?v=159";
import { makeFoolSeal } from "../characters/seals.js?v=159";
import { makeAffixCondenser } from "../characters/affixItems.js?v=159";
import { getFloorDef } from "../map/floors.js?v=159";

const NORMAL_POOL = [
  { name: "皮帽", slot: "helmet", base: { def: 1 }, icon: "hat.png" },
  { name: "铜坠", slot: "necklace", base: { hp: 8 }, icon: "pendant.png" },
  { name: "布衣", slot: "armor", base: { def: 2, hp: 10 }, icon: "cloth.png" },
  { name: "草鞋", slot: "shoes", base: { spd: 1 }, icon: "sandals.png" },
  { name: "木戒", slot: "ringL", base: {}, icon: "ring.png" },
  { name: "短剑", slot: "weapon", base: { atk: 4 }, icon: "sword.png", kind: "剑" },
  { name: "木盾", slot: "shield", base: { def: 2 }, icon: "wood_shield.png" },
  { name: "手枪", slot: "weapon", base: { atk: 5, spd: 1 }, icon: "pistol.png", kind: "手枪" },
  { name: "法杖", slot: "weapon", base: { atk: 2, hp: 12 }, icon: "staff.png", kind: "法杖" },
];

/** 部分层特殊 Boss 必掉唯一红装（仅 5 / 10 / 30… 等关口） */
export const UNIQUE_BOSS_BY_FLOOR = {
  5: [
    {
      name: "冠廊爆裂枪",
      slot: "weapon",
      base: { atk: 8, spd: 2 },
      icon: "pistol.png",
      kind: "手枪",
      uniqueId: "pink_burst_echo",
      skillOwner: "pink",
      uniqueText: "强化爆裂矢",
      desc: "雾林树妖掉落。唯一词条强化小粉二技能；仅小粉装备时生效。",
    },
    {
      name: "冠廊反伤盾",
      slot: "shield",
      base: { def: 6, hp: 22 },
      icon: "wood_shield.png",
      kind: "Boss",
      uniqueId: "yellow_reflect_shield",
      skillOwner: "yellow",
      uniqueText: "强化反伤",
      desc: "雾林树妖掉落。唯一词条将反伤改为对全体生效；仅小黄装备时生效。",
    },
    {
      name: "雾林灵衡坠",
      slot: "necklace",
      base: { hp: 28, def: 2 },
      icon: "pendant.png",
      kind: "Boss",
      uniqueId: "omni_balance_spirit",
      skillOwner: "omni",
      uniqueText: "强化均衡",
      desc: "雾林树妖掉落。唯一词条强化均衡；仅全能装备时生效。",
    },
    {
      name: "雾林脉动戒",
      slot: "ringL",
      base: { hp: 16, atk: 1 },
      icon: "ring.png",
      kind: "Boss",
      uniqueId: "green_mend_pulse",
      skillOwner: "",
      uniqueText: "强化治疗脉动",
      desc: "雾林树妖掉落。与春芽戒孪生。任意治疗附加 200 行动条脉动（按治疗者行动条推进）。",
    },
    {
      name: "雾林春芽戒",
      slot: "ringR",
      base: { hp: 12, atk: 2 },
      icon: "ring.png",
      kind: "Boss",
      uniqueId: "green_spring_bloom",
      skillOwner: "",
      uniqueText: "开场春芽",
      desc: "雾林树妖掉落。与脉动戒孪生。开场释放 10% 春芽治疗；大幅缩短治疗动画。任意职业可触发。",
    },
    {
      name: "环礁生机杖",
      slot: "weapon",
      base: { atk: 4, hp: 26 },
      icon: "staff.png",
      kind: "法杖",
      uniqueId: "green_life_flow",
      skillOwner: "green",
      uniqueText: "强化生机流转",
      desc: "雾林树妖掉落。唯一词条强化生机流转；仅小绿装备时生效。",
    },
  ],
  10: [
    {
      name: "爪屿寒锁杖",
      slot: "weapon",
      base: { atk: 6, hp: 20 },
      icon: "staff.png",
      kind: "法杖",
      uniqueId: "blue_freeze_lock",
      skillOwner: "blue",
      uniqueText: "强化寒锁",
      desc: "终焉爪兽掉落。唯一词条强化小蓝「寒锁」；仅小蓝装备时生效。",
    },
    {
      name: "黑曜烬焚枪",
      slot: "weapon",
      base: { atk: 10, spd: 1 },
      icon: "pistol.png",
      kind: "手枪",
      uniqueId: "orange_blaze_ember",
      skillOwner: "orange",
      uniqueText: "强化烬焚",
      desc: "终焉爪兽掉落。唯一词条强化小橙「烬焚」；仅小橙装备时生效。",
    },
  ],
  30: [
    {
      name: "深渊疾风靴",
      slot: "shoes",
      base: { spd: 4, def: 2 },
      icon: "sandals.png",
      kind: "Boss",
      uniqueId: "cyan_tailwind_gale",
      skillOwner: "cyan",
      uniqueText: "强化疾风",
      desc: "深渊门廊双殿石像掉落。唯一词条强化小青「疾风」；仅小青装备时生效。",
    },
    {
      name: "深渊风刃戒",
      slot: "ringL",
      base: { atk: 4, spd: 2 },
      icon: "ring.png",
      kind: "Boss",
      uniqueId: "cyan_cut_gale",
      skillOwner: "cyan",
      uniqueText: "强化风刃",
      desc: "深渊门廊双殿石像掉落。唯一词条强化小青「风刃」整段附魔并开局释放；仅小青装备时生效。",
    },
    {
      name: "深渊织律戒",
      slot: "ringR",
      base: { hp: 14, atk: 2 },
      icon: "ring.png",
      kind: "Boss",
      uniqueId: "status_weave_ring",
      skillOwner: "",
      uniqueText: "织律",
      desc: "深渊门廊双殿石像掉落。增益/减益取消瞬伤、效果+20%、动画加速。任意职业可触发。",
    },
  ],
};

export function floorHasUniqueBossLoot(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  // 唯一装只挂在特殊关口（逢 5 / 逢 10…）
  if (f % 5 !== 0) return false;
  const list = UNIQUE_BOSS_BY_FLOOR[f];
  return Array.isArray(list) && list.some((t) => t && t.uniqueId);
}

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
      skillMods: { powerMult: 0.12 },
      skillAffixText: "技能伤害 +12%",
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
      skillMods: { powerMult: 0.14 },
      skillAffixText: "技能伤害 +14%",
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
      skillMods: { powerMult: 0.18, powerFlat: 4 },
      skillAffixText: "技能伤害 +18%，额外 +4",
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
      skillMods: { powerMult: 0.2, powerFlat: 5 },
      skillAffixText: "技能伤害 +20%，额外 +5",
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
      skillMods: { hitBonus: 1, hitDamageMult: 0.6 },
      skillAffixText: "技能回响",
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
    { name: "海藻戒", slot: "ringL", base: {}, icon: "ring.png" },
  ],
  4: [
    { name: "锚链坠", slot: "necklace", base: { hp: 16 }, icon: "pendant.png" },
    { name: "码头短剑", slot: "weapon", base: { atk: 5 }, icon: "sword.png", kind: "剑" },
  ],
  5: [
    { name: "雾丝衣", slot: "armor", base: { def: 3, hp: 18 }, icon: "cloth.png" },
    { name: "苔环", slot: "ringL", base: {}, icon: "ring.png" },
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
    { name: "浪刃戒", slot: "ringR", base: {}, icon: "ring.png" },
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

/** 11+ 层循环 1～10 主题池，并按十层段强化基础属性 */
function lootThemeFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  return ((f - 1) % 10) + 1;
}

function lootDecade(floor) {
  return Math.floor((Math.max(1, Math.floor(floor || 1)) - 1) / 10);
}

/**
 * 掉落强度层：跟怪物战斗层走，但轮回增量只吃一部分（默认 55%），
 * 装备跟不上怪物，轮回会越来越难。
 */
export const LOOT_LOOP_FACTOR = 0.55;

export function lootPowerFloor(monster) {
  const display = Math.max(1, Math.floor(monster?.floor || 1));
  const combat = Math.max(display, Math.floor(monster?.combatFloor || display));
  if (combat <= display) return display;
  return Math.max(
    display,
    Math.round(display + (combat - display) * LOOT_LOOP_FACTOR)
  );
}

function scaleLootBase(base, floor) {
  const tier = lootDecade(floor);
  if (!base || tier <= 0) return { ...(base || {}) };
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    out[k] = Math.max(1, Math.round(Number(v) * (1 + tier * 0.35)));
  }
  return out;
}

function bossSkillPool(displayFloor, powerFloor) {
  const key = lootThemeFloor(displayFloor);
  const pool = BOSS_LOOT_BY_FLOOR[key] || BOSS_LOOT_BY_FLOOR[1];
  const power = powerFloor || displayFloor;
  return pool.map((tpl) => ({
    ...tpl,
    base: scaleLootBase(tpl.base, power),
    desc:
      displayFloor > 10
        ? `${floorName(displayFloor)}掉落。${tpl.desc || ""}`
        : tpl.desc,
  }));
}

function bossNormalPool(displayFloor, powerFloor) {
  const key = lootThemeFloor(displayFloor);
  const pool = BOSS_NORMAL_BY_FLOOR[key] || NORMAL_POOL;
  const power = powerFloor || displayFloor;
  return pool.map((tpl) => ({
    ...tpl,
    base: scaleLootBase(tpl.base, power),
  }));
}

function rarityByFloor(floor, preferHigh = false) {
  const f = Math.max(1, floor || 1);
  let idx;
  if (f <= 2) idx = preferHigh ? 1 : 0;
  else if (f <= 4) idx = preferHigh ? 2 : 1;
  else if (f <= 6) idx = preferHigh ? 3 : 2;
  else if (f <= 8) idx = preferHigh ? 4 : 3;
  else if (f <= 15) idx = preferHigh ? 5 : 4;
  else idx = 5;
  if (Math.random() < 0.35) idx = Math.max(0, idx - 1);
  if (Math.random() < 0.25) idx = Math.min(RARITY_ORDER.length - 1, idx + 1);
  return RARITY_ORDER[idx];
}

function bumpRarity(rarity) {
  const i = RARITY_ORDER.indexOf(normalizeRarity(rarity));
  return RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, i + 1)];
}

/** 红装掉落概率为原先的 60%（非唯一随机红） */
const RED_DROP_KEEP_RATE = 0.6;
/** 唯一红装：普通/后续击杀掉率（相对旧「必掉」） */
const UNIQUE_DROP_BASE = 0.6;
/** 首次击杀该 Boss 唯一装掉率（提高） */
const UNIQUE_DROP_FIRST = 0.85;

function dampRedRarity(rarity, rng = Math.random) {
  if (normalizeRarity(rarity) !== "red") return rarity;
  if (rng() < RED_DROP_KEEP_RATE) return "red";
  return "orange";
}

/**
 * @param {object} stateProgress state.bossUniqueLoot
 * @param {string} uniqueId
 */
export function uniqueLootEntry(stateProgress, uniqueId) {
  if (!stateProgress || !uniqueId) return { kills: 0, dropped: false };
  if (!stateProgress[uniqueId]) stateProgress[uniqueId] = { kills: 0, dropped: false };
  return stateProgress[uniqueId];
}

/** 开战前：若该层有唯一装曾失手，返回需加「！！！」的提示 */
export function bossUniqueUrgent(displayFloor, stateProgress) {
  const tpls = [].concat(UNIQUE_BOSS_BY_FLOOR[displayFloor] || []).filter((t) => t?.uniqueId);
  if (!tpls.length) return false;
  return tpls.some((t) => {
    const e = stateProgress?.[t.uniqueId];
    return e && e.kills >= 1 && !e.dropped;
  });
}

export function bossTauntLine(monster, { urgent = false } = {}) {
  const name = monster?.name || "关口守护者";
  const base = `${name}挡住了去路。`;
  return urgent ? `${name}挡住了去路！！！` : base;
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

function rollNormalItem(powerFloor, displayFloor = powerFloor) {
  const tpl = pick(NORMAL_POOL);
  let rarity = rarityByFloor(powerFloor, Math.random() < 0.35);
  rarity = dampRedRarity(rarity);
  const level = floorItemLevel(powerFloor);
  const place = floorName(displayFloor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `${place}掉落 · 装备等级 ${level}。`,
    })
  );
}

function rollUniqueBossItem(powerFloor, tpl, displayFloor = powerFloor) {
  const level = floorItemLevel(powerFloor, { boss: true });
  const place = floorName(displayFloor);
  const preferDps =
    tpl.slot === "weapon" ||
    tpl.slot === "ringL" ||
    tpl.slot === "ringR" ||
    tpl.skillOwner === "pink";
  const preferTank =
    tpl.slot === "shield" ||
    tpl.slot === "armor" ||
    tpl.skillOwner === "yellow";
  // 红装词条：1 唯一 + 其余属性/技能位（戒指额外 +2）
  const extra = Math.max(0, affixCountForRarity("red", tpl.slot) - 1);
  const affixes = [
    makeUniqueAffix(tpl.uniqueId, tpl.uniqueText),
    ...rollAffixes(extra, level, {
      allowSkill: false,
      preferDps,
      preferTank: !preferDps && preferTank,
      rarity: "red",
      slot: tpl.slot,
    }),
  ];
  const ringBase = tpl.slot === "ringL" || tpl.slot === "ringR" ? {} : scaleLootBase(tpl.base, powerFloor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, ringBase, {
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
      bossFloor: displayFloor,
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
      out.push(rollUniqueBossItem(floor, tpl, floor));
    }
  }
  return out;
}

function rollBossSkillItem(displayFloor, powerFloor = displayFloor) {
  const tpl = pick(bossSkillPool(displayFloor, powerFloor));
  let rarity = ensureMinRarityForSkill(tpl.rarity || "purple");
  if (Math.random() < 0.2) rarity = bumpRarity(rarity);
  if (powerFloor >= 8 && Math.random() < 0.35) rarity = bumpRarity(rarity);
  rarity = dampRedRarity(rarity);
  const level = floorItemLevel(powerFloor, { boss: true });
  const place = floorName(displayFloor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `boss_${displayFloor}_${tpl.name}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "Boss",
      level,
      desc: `${tpl.desc}（${place} · 等级 ${level}）`,
      skillMods: { ...tpl.skillMods },
      skillAffixText: tpl.skillAffixText,
      bossOnly: true,
      bossFloor: displayFloor,
    })
  );
}

function rollBossNormalItem(displayFloor, powerFloor = displayFloor) {
  const tpl = pick(bossNormalPool(displayFloor, powerFloor));
  let rarity = rarityByFloor(powerFloor, true);
  if (Math.random() < 0.2) rarity = bumpRarity(rarity);
  rarity = dampRedRarity(rarity);
  const level = floorItemLevel(powerFloor, { boss: true });
  const place = floorName(displayFloor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity,
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `${place} Boss 掉落 · 装备等级 ${level}。`,
      bossFloor: displayFloor,
    })
  );
}

/** 小怪：10% 掉一件装备；强化小怪另有 30% 掉红装 */
export function rollTrashLoot(monster) {
  const display = monster?.floor || 1;
  const power = lootPowerFloor(monster);
  const drops = [];
  if (monster?.isElite && Math.random() < 0.3) {
    drops.push(rollEliteRedItem(power, display));
  }
  if (Math.random() < 0.1) {
    drops.push(rollNormalItem(power, display));
  }
  return drops;
}

function rollEliteRedItem(powerFloor, displayFloor = powerFloor) {
  const tpl = pick(NORMAL_POOL);
  const level = floorItemLevel(powerFloor);
  const place = floorName(displayFloor);
  return toBagEquip(
    makeItem(tpl.name, tpl.slot, { ...tpl.base }, {
      id: `${tpl.slot}_${tpl.name}_elite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      rarity: "red",
      icon: tpl.icon,
      kind: tpl.kind || "",
      level,
      desc: `${place}强化怪掉落 · 装备等级 ${level}。`,
    })
  );
}

/**
 * Boss：掉 2–3 件；唯一红装按击杀次数概率掉（可全空）
 * @param {object} monster
 * @param {{ uniqueLoot?: Record<string, { kills: number, dropped: boolean }> }} [opts]
 */
export function rollBossLoot(monster, opts = {}) {
  const display = monster?.floor || 1;
  const power = lootPowerFloor(monster);
  const uniqueLoot = opts.uniqueLoot || {};
  const drops = [];

  if (
    monster?.dropsFoolSeal ||
    monster?.isHiddenBoss ||
    monster?.kind === "boss_fool"
  ) {
    drops.push(makeFoolSeal());
  }

  const uniqueTpls = []
    .concat(UNIQUE_BOSS_BY_FLOOR[display] || [])
    .filter((t) => t && t.uniqueId);

  for (const tpl of uniqueTpls) {
    const entry = uniqueLootEntry(uniqueLoot, tpl.uniqueId);
    const killIndex = entry.kills; // 0 = 首次击杀
    let chance = UNIQUE_DROP_BASE;
    if (killIndex === 0) chance = UNIQUE_DROP_FIRST;
    else if (!entry.dropped) chance = 1;
    entry.kills = killIndex + 1;
    if (Math.random() < chance) {
      drops.push(rollUniqueBossItem(power, tpl, display));
      entry.dropped = true;
    }
  }

  // 隐藏愚人 Boss：印章必掉，另给 1 件普通/技能装
  if (
    monster?.dropsFoolSeal ||
    monster?.isHiddenBoss ||
    monster?.kind === "boss_fool"
  ) {
    if (Math.random() < 0.55) drops.push(rollBossSkillItem(display, power));
    else drops.push(rollBossNormalItem(display, power));
    return drops;
  }

  // 10 层主 Boss：词条凝炼器
  if (display === 10 && monster?.isBoss && !monster?.isHiddenBoss) {
    drops.push(makeAffixCondenser(1));
  }

  const want = Math.random() < 0.5 ? 2 : 3;
  if (!drops.length) {
    // 允许不掉红装：用技能/普通装补满
    while (drops.length < want) {
      if (Math.random() < 0.55) drops.push(rollBossSkillItem(display, power));
      else drops.push(rollBossNormalItem(display, power));
    }
  } else {
    while (drops.length < want) {
      if (Math.random() < 0.55) drops.push(rollBossSkillItem(display, power));
      else drops.push(rollBossNormalItem(display, power));
    }
  }
  return drops;
}

export function rollBattleLoot(worldMonsters, opts = {}) {
  const drops = [];
  for (const m of worldMonsters || []) {
    if (!m) continue;
    if (m.isBoss) drops.push(...rollBossLoot(m, opts));
    else drops.push(...rollTrashLoot(m));
  }
  return drops;
}
