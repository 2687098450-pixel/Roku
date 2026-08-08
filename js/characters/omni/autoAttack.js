/** 全能：自动战斗逻辑（顺序数据在 characters/stats.js） */

import { getAutoRotation, setAutoRotation } from "../stats.js?v=179";

const STATS_ID = "omni";

/** 各角色普通攻击技能 id */
const BASIC_ATTACK_BY_STATS = {
  omni: "attack",
  pink: "pink_burst",
  green: "green_bolt",
  yellow: "yellow_hit",
  blue: "blue_bolt",
  orange: "orange_shot",
  cyan: "cyan_cut",
};

export function basicAttackId(hero) {
  const id = hero?.statsId || STATS_ID;
  return BASIC_ATTACK_BY_STATS[id] || "attack";
}

/** 空槽 / null / undefined 视为清空（战斗时当普攻） */
export function isEmptyAutoSlot(skillId) {
  return skillId == null || skillId === "";
}

export function resolveAutoSkillId(hero, skillId) {
  return isEmptyAutoSlot(skillId) ? basicAttackId(hero) : skillId;
}

export function ensureRotation(hero) {
  const id = hero.statsId || STATS_ID;
  if (!hero.autoRotation || hero.autoRotation.length !== 5) {
    hero.autoRotation = getAutoRotation(id);
  }
  // 规范化：非法值当空槽
  hero.autoRotation = hero.autoRotation.map((s) => (isEmptyAutoSlot(s) ? "" : s));
  return hero.autoRotation;
}

/** 界面改顺序时：同步到 hero 与 stats 总表；传 "" 表示清空 */
export function updateRotationSlot(hero, index, skillId) {
  const id = hero.statsId || STATS_ID;
  ensureRotation(hero);
  hero.autoRotation[index] = isEmptyAutoSlot(skillId) ? "" : skillId;
  setAutoRotation(id, hero.autoRotation);
  return hero.autoRotation;
}

export function nextAutoSkill(hero, rotIndex) {
  const rot = ensureRotation(hero);
  const idx = rotIndex % rot.length;
  return {
    skillId: resolveAutoSkillId(hero, rot[idx]),
    nextIndex: (idx + 1) % rot.length,
    slot: idx + 1,
  };
}

export function activeSkills(hero) {
  return hero.skills.filter((s) => s.kind === "active");
}
