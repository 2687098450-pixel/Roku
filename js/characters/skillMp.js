/**
 * 英雄蓝条消耗
 * - 普通攻击 / 被动 / 自身单体增益：不耗蓝
 * - 其余主动技：10 / 15 两档
 */

import { SKILL_POWER } from "./skills.js?v=169";
import { basicAttackId } from "./omni/autoAttack.js?v=169";

/** 各英雄满蓝（统一 100） */
export const HERO_MAX_MP = {
  omni: 100,
  pink: 100,
  green: 100,
  yellow: 100,
  blue: 100,
  orange: 100,
  cyan: 100,
};

/** 15 档：高耗技能；其余耗蓝技能默认 10 */
export const SKILL_MP_COST = {
  quake: 15,
  pink_barrage: 15,
  green_bloom: 15,
  blue_freeze: 15,
  orange_blaze: 15,
  cyan_tailwind: 15,
};

export function heroMaxMp(statsId) {
  return HERO_MAX_MP[statsId] || 100;
}

/** 是否自身单体增益（不耗蓝） */
export function isSelfBuffSkill(skillId) {
  const def = SKILL_POWER[skillId];
  return !!(def && def.style === "buff" && def.target === "self");
}

export function skillMpCost(hero, skillId) {
  if (!hero || !skillId) return 0;
  if (skillId === basicAttackId(hero)) return 0;
  const sk = hero.skills?.find((s) => s.id === skillId);
  if (sk?.kind === "passive") return 0;
  if (isSelfBuffSkill(skillId)) return 0;
  if (SKILL_MP_COST[skillId] != null) return SKILL_MP_COST[skillId];
  const def = SKILL_POWER[skillId];
  if (!def) return 0;
  // 有实装的主动技默认 10；未知定义不扣
  return 10;
}

export function canAffordSkill(hero, skillId) {
  const cost = skillMpCost(hero, skillId);
  if (cost <= 0) return true;
  return (hero.mp || 0) >= cost;
}

export function spendSkillMp(hero, skillId) {
  const cost = skillMpCost(hero, skillId);
  if (cost <= 0) return 0;
  hero.mp = Math.max(0, (hero.mp || 0) - cost);
  return cost;
}
