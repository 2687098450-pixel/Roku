/** 按总表 id 创建可上阵角色 */

import { getCharacterStats, getAutoRotation } from "./stats.js?v=74";
import { calcStats } from "./omni/attributes.js?v=74";
import { createDefaultEquip, sumEquipBonus } from "./omni/equipment.js?v=74";
import {
  createHeroSkills,
  refreshSkillTexts,
  attrPassiveSkillId,
  scaledPassiveBoost,
} from "./skills.js?v=74";
import {
  expToNext,
  getSkillLevel,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
} from "./progression.js?v=74";

export function refreshHeroStats(hero) {
  if (!hero.basePassiveBoost) {
    hero.basePassiveBoost = { ...(hero.passiveBoost || {}) };
  }
  const attrId = attrPassiveSkillId(hero.statsId);
  if (attrId) {
    hero.passiveBoost = scaledPassiveBoost(
      hero.basePassiveBoost,
      getSkillLevel(hero, attrId)
    );
  }
  const eq = sumEquipBonus(hero.equip);
  const stats = calcStats(hero.base, hero.passiveBoost, eq, hero.level || 1);
  const mult = hero.isCaptain ? 1.1 : 1;
  hero.maxHp = Math.max(1, Math.floor(stats.maxHp * mult));
  hero.atk = Math.max(1, Math.floor(stats.atk * mult));
  hero.def = Math.max(0, Math.floor(stats.def * mult));
  hero.spd = Math.max(1, Math.floor(stats.spd * mult));
  hero.critRate = Math.min(0.85, DEFAULT_CRIT_RATE + (eq.critRate || 0));
  hero.critDmg = Math.max(1.2, DEFAULT_CRIT_DMG + (eq.critDmg || 0));
  if (hero.hp == null) hero.hp = hero.maxHp;
  else hero.hp = Math.max(0, Math.min(hero.maxHp, hero.hp));
}

const DESC = {
  omni: "各项属性均衡的全能型角色。近战与远程兼备，可用震地击控场。",
  pink: "远程爆发型射手。脆皮高攻，可用燃心提升攻击与暴伤。",
  green: "浅绿色治疗型角色。战中治疗队友，战后为全体参战者恢复。",
  yellow: "黄色坦克。高生命高防御，受伤时对全场反伤，可用铁壁强化防御。",
};

export function createHero(statsId) {
  const sheet = getCharacterStats(statsId);
  const hero = {
    id: `hero_${statsId}`,
    statsId,
    name: sheet.name,
    className: sheet.className,
    gender: sheet.gender || "male",
    level: 1,
    exp: 0,
    maxExp: expToNext(1),
    skillPoints: 0,
    skillLevels: {},
    dead: false,
    critRate: DEFAULT_CRIT_RATE,
    critDmg: DEFAULT_CRIT_DMG,
    mp: 30,
    maxMp: 30,
    desc: DESC[statsId] || "",
    color: sheet.color,
    shape: "diamond",
    base: { ...sheet.base },
    basePassiveBoost: { ...sheet.passiveBoost },
    passiveBoost: { ...sheet.passiveBoost },
    equip: createDefaultEquip(statsId),
    skills: createHeroSkills(statsId),
    autoRotation: getAutoRotation(statsId),
    hp: 0,
    maxHp: 0,
  };
  refreshSkillTexts(hero);
  refreshHeroStats(hero);
  hero.hp = hero.maxHp;
  hero.mp = hero.maxMp;
  return hero;
}

export function createOmniHero() {
  return createHero("omni");
}

export function createPinkHero() {
  return createHero("pink");
}

export function createGreenHero() {
  return createHero("green");
}

export function createYellowHero() {
  return createHero("yellow");
}

/** 战斗阵容：3 列 × 2 排（与战斗画面一致：上前排 / 下后排） */
export const FORMATION_COLS = 3;
export const FORMATION_SLOTS = 6;

/**
 * 阵位 → 战斗站位（编辑器与战场同向：敌在上）
 * 0 1 2 = 前排左中右（靠近敌人）
 * 3 4 5 = 后排左中右
 */
export function formationSlotPos(slot) {
  const col = slot % FORMATION_COLS;
  const row = slot < FORMATION_COLS ? "front" : "back";
  return { row, col, slot };
}

/** 阵容里已上阵角色（按阵位顺序，跳过空位） */
export function getDeployedHeroes(state) {
  const ids = state.formation || [];
  return ids
    .filter((id) => !!id)
    .map((id) => state.party.find((h) => h.id === id))
    .filter(Boolean);
}

/** 带战斗站位的上阵列表 */
export function getBattleFormation(state) {
  normalizeFormation(state);
  const out = [];
  for (let i = 0; i < FORMATION_SLOTS; i++) {
    const id = state.formation[i];
    if (!id) continue;
    const hero = state.party.find((h) => h.id === id);
    if (!hero) continue;
    out.push({ hero, ...formationSlotPos(i) });
  }
  return out;
}

/** 保证阵容为固定长度的站位数组 */
export function normalizeFormation(state, slots = FORMATION_SLOTS) {
  const src = Array.isArray(state.formation) ? state.formation : [];
  const next = [];
  for (let i = 0; i < slots; i++) {
    const id = src[i];
    next.push(id || null);
  }
  // 去重：同一角色只保留第一次出现
  const seen = new Set();
  for (let i = 0; i < next.length; i++) {
    const id = next[i];
    if (!id) continue;
    if (seen.has(id)) next[i] = null;
    else seen.add(id);
  }
  state.formation = next;
  return next;
}

export function combatPower(hero) {
  return Math.floor(hero.maxHp * 0.35 + hero.atk * 18 + hero.def * 12 + hero.spd * 6);
}

/** 菱形主体色：与角色表 color 一致（不再提亮） */
export const DIAMOND_MID_COLOR = {
  omni: "#3cb86a",
  pink: "#ff7eb3",
  green: "#8fdf8a",
  yellow: "#e8c044",
};

export function diamondMidColor(unit) {
  if (unit?.color) return unit.color;
  const id = unit?.statsId || unit?.id;
  if (id && DIAMOND_MID_COLOR[id]) return DIAMOND_MID_COLOR[id];
  return DIAMOND_MID_COLOR.omni;
}

/** 宽←血防，高←攻速（仅作分项，不设写死阈值） */
function diamondScores(unit) {
  const hp = Math.max(0, unit.maxHp ?? unit.hp ?? 0);
  const def = Math.max(0, unit.def ?? 0);
  const atk = Math.max(0, unit.atk ?? 0);
  const spd = Math.max(0, unit.spd ?? 0);
  return {
    width: hp + def * 12,
    height: atk * 5 + spd * 3,
  };
}

/** 像素上下限（数值=0 → 下限；数值=队伍总和 → 上限）
 * 宽、高共用同一区间；极限宽高比 / 高宽比均为 2:1
 * 最长边沿用旧版高度上限 56，最短边 = 56/2 = 28（不再整体缩小）
 */
const DIAMOND_EDGE_MIN = 28;
const DIAMOND_EDGE_MAX = 56;

/**
 * 菱形长宽：
 * - 下限：对应分项数值为 0
 * - 上限：对应分项 = 队伍内所有人该项之和
 * - 每人在下限基础上，按 个人/队伍总和 向上限靠拢
 * - 极限宽高比、高宽比均为 2:1
 */
export function diamondDims(unit, scale = 1, peers = null) {
  const self = diamondScores(unit);
  const group = (Array.isArray(peers) ? peers.filter(Boolean) : []).length
    ? peers.filter(Boolean)
    : [unit];
  const scored = group.map(diamondScores);
  const sumW = scored.reduce((a, s) => a + s.width, 0);
  const sumH = scored.reduce((a, s) => a + s.height, 0);

  const tW = sumW > 0 ? Math.min(1, self.width / sumW) : 0;
  const tH = sumH > 0 ? Math.min(1, self.height / sumH) : 0;

  const w = (DIAMOND_EDGE_MIN + (DIAMOND_EDGE_MAX - DIAMOND_EDGE_MIN) * tW) * scale;
  const h = (DIAMOND_EDGE_MIN + (DIAMOND_EDGE_MAX - DIAMOND_EDGE_MIN) * tH) * scale;
  return { w, h, aspect: w / Math.max(1e-6, h) };
}

/** 用于 style：主体色 + 宽高（无四角着色） */
export function diamondStyleAttr(unit, scale = 1, peers = null) {
  const { w, h } = diamondDims(unit, scale, peers);
  const mid = diamondMidColor(unit);
  return [`--c:${mid}`, `--dw:${w.toFixed(1)}px`, `--dh:${h.toFixed(1)}px`].join(";");
}

/** 像素高/宽达到此值视为纤细（2:1 边框下小粉满配约 1.2+） */
export const SLENDER_RATIO = 1.18;

/** 菱形像素高宽比（队伍占比体型，与缩放无关） */
export function diamondSlenderRatio(unit, peers = null) {
  const { w, h } = diamondDims(unit, 1, peers);
  return h / Math.max(1e-6, w);
}

/** 女性 + 足够纤细（小粉转圈用） */
export function isSlenderFemale(hero, peers = null) {
  if (!hero || hero.gender !== "female") return false;
  return diamondSlenderRatio(hero, peers) >= SLENDER_RATIO;
}
