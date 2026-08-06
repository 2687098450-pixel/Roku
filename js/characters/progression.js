/** 经验、升级、技能点（无循环依赖） */

import { scaleExpGain } from "../core/economy.js?v=115";

export const DEFAULT_CRIT_RATE = 0.1;
export const DEFAULT_CRIT_DMG = 1.5; // 暴击伤害 150%
export const DEFAULT_HIT_RATE = 1;
export const DEFAULT_DODGE_RATE = 0.05;
export const MAX_SKILL_LEVEL = 10;

/** 装备「技能等级」词条提供的额外等级（全技能生效） */
export function equipSkillLevelBonus(hero) {
  let n = 0;
  const eq = hero?.equip;
  if (!eq || typeof eq !== "object") return 0;
  for (const item of Object.values(eq)) {
    if (!item) continue;
    n += Math.max(0, Math.floor(Number(item.skillMods?.skillLevel) || 0));
  }
  return n;
}

/** 技能点升级用的基础等级（不含装备加成） */
export function getBaseSkillLevel(hero, skillId) {
  if (!hero || !skillId) return 1;
  const fromMap = hero.skillLevels?.[skillId];
  if (fromMap != null) return Math.max(1, Math.floor(fromMap));
  const sk = hero.skills?.find((s) => s.id === skillId);
  return Math.max(1, Math.floor(sk?.level || 1));
}

export function getSkillLevel(hero, skillId) {
  if (!hero || !skillId) return 1;
  const base = getBaseSkillLevel(hero, skillId);
  const bonus = equipSkillLevelBonus(hero);
  // 加点上限 10；装备等其他途径可继续抬高实际等级
  return Math.max(1, base + bonus);
}

/** 升到下一级所需经验 */
export function expToNext(level) {
  const lv = Math.max(1, Math.floor(level || 1));
  return Math.max(1, Math.floor(6 + lv * 3.5 + lv * lv * 0.6));
}

export function levelStatBonus(level) {
  const L = Math.max(0, Math.floor(level || 1) - 1);
  return {
    hp: L * 5,
    atk: L * 1,
    def: Math.floor(L * 0.4),
    spd: Math.floor(L * 0.2),
  };
}

/**
 * 给英雄加经验；升级时每次 +1 技能点
 * @returns {{ gained: number, levels: number, leveled: boolean }}
 */
export function gainExp(hero, amount) {
  if (!hero || !(amount > 0)) {
    return { gained: 0, levels: 0, leveled: false };
  }
  if (hero.maxExp == null) hero.maxExp = expToNext(hero.level || 1);
  if (hero.skillPoints == null) hero.skillPoints = 0;
  if (hero.exp == null) hero.exp = 0;
  if (hero.level == null) hero.level = 1;

  const gained = scaleExpGain(amount);
  if (!gained) return { gained: 0, levels: 0, leveled: false };
  hero.exp += gained;
  let levels = 0;
  let guard = 0;
  while (hero.exp >= hero.maxExp && guard++ < 50) {
    hero.exp -= hero.maxExp;
    hero.level += 1;
    hero.skillPoints += 1;
    levels += 1;
    hero.maxExp = expToNext(hero.level);
  }
  return { gained, levels, leveled: levels > 0 };
}

/** 参战英雄平分总经验（至少 1） */
export function splitExp(total, heroCount) {
  const n = Math.max(1, heroCount || 1);
  const t = Math.max(0, Math.floor(total || 0));
  if (!t) return 0;
  return Math.max(1, Math.ceil(t / n));
}

/** 复活费用：随英雄等级提升 */
export function reviveCost(level) {
  const lv = Math.max(1, Math.floor(level || 1));
  return 40 + lv * 35;
}

export function isHeroDead(hero) {
  return !!(hero && (hero.dead || hero.hp <= 0));
}

/**
 * 用金币复活英雄（恢复 50% 生命）
 * @returns {{ ok: boolean, cost: number, reason?: string }}
 */
export function reviveHero(hero, state) {
  if (!hero || !state) return { ok: false, cost: 0, reason: "无效" };
  const cost = reviveCost(hero.level || 1);
  if (!isHeroDead(hero)) return { ok: false, cost, reason: "无需复活" };
  if ((state.gold || 0) < cost) {
    return { ok: false, cost, reason: "金币不足" };
  }
  state.gold -= cost;
  hero.dead = false;
  hero.hp = Math.max(1, Math.floor((hero.maxHp || 1) * 0.5));
  return { ok: true, cost };
}
