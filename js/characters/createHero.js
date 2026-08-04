/** 按总表 id 创建可上阵角色 */

import { getCharacterStats, getAutoRotation } from "./stats.js?v=60";
import { calcStats } from "./omni/attributes.js?v=60";
import { createDefaultEquip, sumEquipBonus } from "./omni/equipment.js?v=60";
import {
  createHeroSkills,
  refreshSkillTexts,
  attrPassiveSkillId,
  scaledPassiveBoost,
} from "./skills.js?v=60";
import {
  expToNext,
  getSkillLevel,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
} from "./progression.js?v=60";
import { bossCornerScoresForFloor } from "../monsters/boss.js?v=60";

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

/** 网站 lift=0.6 烤死的主体提亮色（勿再用乘法现算） */
export const DIAMOND_MID_COLOR = {
  omni: "#a6d8bc",
  pink: "#f4c1d9",
  green: "#c7e8c8",
  yellow: "#eadcac",
};

/** 四角属性色：上输出紫 · 下幸运橙 · 左状态蓝 · 右坦度绿 */
export const DIAMOND_ATTR_COLOR = {
  up: "#a870e0", // 输出
  down: "#ec8c40", // 幸运
  left: "#508cec", // 状态
  right: "#48b078", // 坦度
};

/** 端点相对满属性的染色强度（再淡 50%） */
const DIAMOND_TIP_STRENGTH = 0.18;

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return [160, 200, 160];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
  return (
    "#" +
    rgb
      .map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const u = clamp01(t);
  return rgbToHex([
    A[0] + (B[0] - A[0]) * u,
    A[1] + (B[1] - A[1]) * u,
    A[2] + (B[2] - A[2]) * u,
  ]);
}

/** 状态向能力分（英雄按技能类型；Boss/怪按技能数） */
function statusCapability(unit) {
  if (!unit) return 1;
  const skills = unit.skills || [];
  if (skills.length) {
    let s = 0;
    for (const sk of skills) {
      if (!sk) continue;
      if (sk.style === "buff" || sk.style === "heal") s += 22 + (sk.level || 1) * 4;
      if (
        sk.id === "quake" ||
        sk.id === "yellow_reflect" ||
        sk.id === "yellow_fortify" ||
        sk.id === "pink_fervor" ||
        sk.id === "green_mend" ||
        sk.id === "green_bloom" ||
        sk.id === "quake_roar" ||
        sk.id === "soul_drain"
      ) {
        s += 28;
      }
    }
    return Math.max(1, s);
  }
  const n = (unit.skillIds || []).length;
  return Math.max(1, n * 22 + Math.floor((unit.atk || 0) * 0.35));
}

/**
 * 菱形四角对比用数值（英雄 / Boss 同一套）
 * 上输出·下幸运·左状态·右坦度
 */
export function diamondCornerScores(unit) {
  const atk = Math.max(0, unit?.atk ?? 0);
  const def = Math.max(0, unit?.def ?? 0);
  const hp = Math.max(0, unit?.maxHp ?? unit?.hp ?? 0);
  const spd = Math.max(0, unit?.spd ?? 0);
  return {
    dps: Math.max(1, atk),
    luck: Math.max(1, Math.floor(spd * 0.8 + atk * 0.2)),
    status: statusCapability(unit),
    tank: Math.max(1, Math.floor(hp * 0.35 + def * 12)),
  };
}

/** 本层 Boss 对比基准（与 createBoss 成长一致） */
export function floorBossCornerScores(floor = 1, floorScale = 1) {
  return bossCornerScoresForFloor(floor, floorScale);
}

export function diamondMidColor(unit) {
  const id = unit?.statsId || unit?.id;
  if (id && DIAMOND_MID_COLOR[id]) return DIAMOND_MID_COLOR[id];
  return unit?.color || DIAMOND_MID_COLOR.omni;
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

/**
 * 用于 style：提亮主体色 + 四角相对本层 Boss 的着色 + 宽高
 * @param {{ floor?: number, floorScale?: number, bossScores?: object }} [opts]
 */
export function diamondStyleAttr(unit, scale = 1, peers = null, opts = {}) {
  const { w, h } = diamondDims(unit, scale, peers);
  const mid = diamondMidColor(unit);
  const bossScores =
    opts.bossScores || floorBossCornerScores(opts.floor ?? 1, opts.floorScale ?? 1);
  const heroScores = diamondCornerScores(unit);
  const ratio = (key) =>
    clamp01(heroScores[key] / Math.max(1, bossScores[key] || 1));

  const tip = (dir, key) =>
    mixHex(mid, DIAMOND_ATTR_COLOR[dir], ratio(key) * DIAMOND_TIP_STRENGTH);

  const cUp = tip("up", "dps");
  const cDown = tip("down", "luck");
  const cLeft = tip("left", "status");
  const cRight = tip("right", "tank");

  return [
    `--c:${mid}`,
    `--c-mid:${mid}`,
    `--c-up:${cUp}`,
    `--c-down:${cDown}`,
    `--c-left:${cLeft}`,
    `--c-right:${cRight}`,
    `--dw:${w.toFixed(1)}px`,
    `--dh:${h.toFixed(1)}px`,
  ].join(";");
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
