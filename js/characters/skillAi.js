/**
 * 技能自动目标偏好（小蓝 / 小绿等）
 * 存在 hero.skillAi[skillId]
 */

export const SKILL_AI_OPTIONS = {
  blue_bolt: [
    { id: "maxAtk", label: "最高攻击" },
    { id: "maxSpd", label: "最高速度" },
  ],
  blue_freeze: [
    { id: "maxAtk", label: "最高攻击" },
    { id: "maxSpd", label: "最高速度" },
  ],
  blue_nova: [
    { id: "front", label: "前排" },
    { id: "mid", label: "中排" },
    { id: "back", label: "后排" },
  ],
  green_mend: [
    { id: "lowestHp", label: "最低血量" },
    { id: "maxDef", label: "最高防御" },
  ],
};

export const SKILL_AI_DEFAULTS = {
  blue_bolt: "maxAtk",
  blue_freeze: "maxAtk",
  blue_nova: "front",
  green_mend: "lowestHp",
};

export function skillAiOptions(skillId) {
  return SKILL_AI_OPTIONS[skillId] || null;
}

export function getSkillAiMode(hero, skillId) {
  if (!skillId) return null;
  const opts = SKILL_AI_OPTIONS[skillId];
  if (!opts) return null;
  const cur = hero?.skillAi?.[skillId];
  if (opts.some((o) => o.id === cur)) return cur;
  return SKILL_AI_DEFAULTS[skillId] || opts[0].id;
}

export function setSkillAiMode(hero, skillId, mode) {
  if (!hero || !skillId) return false;
  const opts = SKILL_AI_OPTIONS[skillId];
  if (!opts || !opts.some((o) => o.id === mode)) return false;
  if (!hero.skillAi) hero.skillAi = {};
  hero.skillAi[skillId] = mode;
  return true;
}

export function normalizeSkillAi(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [id, mode] of Object.entries(raw)) {
    const opts = SKILL_AI_OPTIONS[id];
    if (opts && opts.some((o) => o.id === mode)) out[id] = mode;
  }
  return out;
}
