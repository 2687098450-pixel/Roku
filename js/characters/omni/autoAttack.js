/** 全能：自动战斗逻辑（顺序数据在 characters/stats.js） */

import { getAutoRotation, setAutoRotation } from "../stats.js";

const STATS_ID = "omni";

export function ensureRotation(hero) {
  const id = hero.statsId || STATS_ID;
  if (!hero.autoRotation || hero.autoRotation.length !== 5) {
    hero.autoRotation = getAutoRotation(id);
  }
  return hero.autoRotation;
}

/** 界面改顺序时：同步到 hero 与 stats 总表 */
export function updateRotationSlot(hero, index, skillId) {
  const id = hero.statsId || STATS_ID;
  ensureRotation(hero);
  hero.autoRotation[index] = skillId;
  setAutoRotation(id, hero.autoRotation);
  return hero.autoRotation;
}

export function nextAutoSkill(hero, rotIndex) {
  const rot = ensureRotation(hero);
  const idx = rotIndex % rot.length;
  return {
    skillId: rot[idx],
    nextIndex: (idx + 1) % rot.length,
    slot: idx + 1,
  };
}

export function activeSkills(hero) {
  return hero.skills.filter((s) => s.kind === "active");
}
