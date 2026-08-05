/**
 * 英雄蓝条消耗
 * - 普通攻击 / 被动 / 自身单体增益：不耗蓝
 * - 其余主动技耗蓝；满蓝约可打完「所有耗蓝技能」三轮（小粉偏高耗）
 */

import { SKILL_POWER } from "./skills.js?v=101";
import { basicAttackId } from "./omni/autoAttack.js?v=101";

/** 各英雄满蓝 */
export const HERO_MAX_MP = {
  omni: 144,
  pink: 126,
  green: 135,
  yellow: 60,
  blue: 174,
  orange: 129,
  cyan: 114,
};

/** 技能固定耗蓝（未列出则走默认） */
export const SKILL_MP_COST = {
  radiant: 15,
  quake: 18,
  omni_bless: 15,
  pink_barrage: 42,
  green_mend: 20,
  green_bloom: 25,
  yellow_slam: 20,
  blue_nova: 18,
  blue_freeze: 22,
  blue_veil: 18,
  orange_wave: 18,
  orange_blaze: 25,
  cyan_tailwind: 20,
  cyan_gust: 18,
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
  if (def.style === "heal") return 20;
  if (def.style === "buff") return 18;
  return 16;
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
