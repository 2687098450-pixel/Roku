/** 按总表 id 创建可上阵角色 */

import { getCharacterStats, getAutoRotation } from "./stats.js";
import { calcStats } from "./omni/attributes.js";
import { createDefaultEquip, sumEquipBonus } from "./omni/equipment.js";
import { createHeroSkills } from "./skills.js";
import {
  expToNext,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
} from "./progression.js";

export function refreshHeroStats(hero) {
  const eq = sumEquipBonus(hero.equip);
  const stats = calcStats(hero.base, hero.passiveBoost, eq, hero.level || 1);
  hero.maxHp = stats.maxHp;
  hero.atk = stats.atk;
  hero.def = stats.def;
  hero.spd = stats.spd;
  if (hero.critRate == null) hero.critRate = DEFAULT_CRIT_RATE;
  if (hero.critDmg == null) hero.critDmg = DEFAULT_CRIT_DMG;
  if (hero.hp == null) hero.hp = hero.maxHp;
  else hero.hp = Math.max(0, Math.min(hero.maxHp, hero.hp));
}

const DESC = {
  omni: "各项属性均衡的全能型角色。近战与远程兼备，可用震地击控场。",
  pink: "远程爆发型射手。脆皮高攻，可用燃心提升攻击与暴伤。",
  green: "浅绿色治疗型角色。战中治疗队友，战后为全体参战者恢复。",
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
    passiveBoost: { ...sheet.passiveBoost },
    equip: createDefaultEquip(statsId),
    skills: createHeroSkills(statsId),
    autoRotation: getAutoRotation(statsId),
    hp: 0,
    maxHp: 0,
  };
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

/** 像素上下限（数值=0 → 下限；数值=队伍总和 → 上限） */
const DIAMOND_W_MIN = 14;
const DIAMOND_W_MAX = 40;
const DIAMOND_H_MIN = 22;
const DIAMOND_H_MAX = 56;

/**
 * 菱形长宽：
 * - 下限：对应分项数值为 0
 * - 上限：对应分项 = 队伍内所有人该项之和
 * - 每人在下限基础上，按 个人/队伍总和 向上限靠拢
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

  const w = (DIAMOND_W_MIN + (DIAMOND_W_MAX - DIAMOND_W_MIN) * tW) * scale;
  const h = (DIAMOND_H_MIN + (DIAMOND_H_MAX - DIAMOND_H_MIN) * tH) * scale;
  return { w, h, aspect: w / Math.max(1, h) };
}

/** 用于 style 属性：颜色 + 宽高；peers 为队伍对照 */
export function diamondStyleAttr(unit, scale = 1, peers = null) {
  const { w, h } = diamondDims(unit, scale, peers);
  const color = unit.color || "#3cb86a";
  return `--c:${color};--dw:${w.toFixed(1)}px;--dh:${h.toFixed(1)}px`;
}

/** 高/宽达到此值视为纤细体型（小粉当前体型可触发） */
export const SLENDER_RATIO = 1.55;

/** 菱形高宽比（与缩放无关） */
export function diamondSlenderRatio(unit, peers = null) {
  const { w, h } = diamondDims(unit, 1, peers);
  return h / Math.max(1e-6, w);
}

/** 女性 + 足够纤细 → 详情预览可旋转 */
export function isSlenderFemale(hero, peers = null) {
  if (!hero || hero.gender !== "female") return false;
  return diamondSlenderRatio(hero, peers) >= SLENDER_RATIO;
}
