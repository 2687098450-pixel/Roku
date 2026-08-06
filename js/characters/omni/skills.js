/** 兼容旧路径：技能定义集中在 characters/skills.js */

export {
  SKILL_POWER,
  skillPower,
  skillHealAmount,
  isHealSkill,
  isBuffSkill,
  scaledSkillDef,
  applyUniqueSkillMods,
  refreshSkillTexts,
  buildSkillText,
  upgradeSkill,
  createOmniSkills,
  createPinkSkills,
  createGreenSkills,
  createHeroSkills,
  attrPassiveSkillId,
  scaledPassiveBoost,
  getReflectParams,
  previewReflectDamage,
  calcReflectEnemyDamage,
  applyReflectAllyUnique,
} from "../skills.js?v=112";
