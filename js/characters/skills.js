/** 各职业技能定义与战斗数值 */

import { skillPowerText } from "../core/utils.js";
import { getCharacterStats } from "./stats.js";
import { getSkillLevel, MAX_SKILL_LEVEL } from "./progression.js";

/**
 * 技能数值表（基础值；升级在 scaledSkillDef 中叠加）
 * - style: melee / ranged / heal / buff
 */
export const SKILL_POWER = {
  // —— 全能 ——
  attack: { mult: 1.0, flat: 0, style: "melee" },
  radiant: { mult: 1.7, flat: 4, style: "ranged" },
  /** stunGauge：眩晕隐形行动条目标值（按敌人速度攒满后解除） */
  quake: { mult: 1.15, flat: 0, stunGauge: 100, style: "melee" },

  // —— 小粉：远程爆发 ——
  pink_shot: { mult: 1.15, flat: 3, style: "ranged" },
  pink_burst: { mult: 2.6, flat: 10, style: "ranged" },
  pink_barrage: { mult: 1.05, flat: 2, style: "ranged", hitAllFront: true },
  /** 主动：提升自身攻击与暴击伤害 */
  pink_fervor: {
    style: "buff",
    target: "self",
    atkMult: 0.28,
    critDmgBonus: 0.45,
    turns: 3,
  },

  // —— 小绿：治疗 ——
  green_bolt: { mult: 0.75, flat: 0, style: "ranged" },
  green_mend: { healMaxHp: 0.16, healFlat: 10, style: "heal", target: "lowest" },
  green_bloom: { healMaxHp: 0.08, healFlat: 4, style: "heal", target: "all" },

  // —— 被动：战后 ——
  aftercare: { healRatio: 0.25, healParty: false },
  /** 小绿：战后为所有参战人员恢复 */
  green_aftercare: { healRatio: 0.2, healParty: true },
};

/** 按技能等级缩放战斗数值 */
export function scaledSkillDef(skillId, skillLevel = 1) {
  const base = SKILL_POWER[skillId];
  if (!base) return null;
  const lv = Math.max(0, Math.floor(skillLevel || 1) - 1);
  const out = { ...base };
  if (out.mult != null) out.mult = +(out.mult + lv * 0.07).toFixed(3);
  if (out.flat != null) out.flat = Math.round(out.flat + lv * 1.5);
  if (out.healMaxHp != null) out.healMaxHp = +(out.healMaxHp + lv * 0.012).toFixed(4);
  if (out.healFlat != null) out.healFlat = Math.round(out.healFlat + lv * 2);
  if (out.atkMult != null) out.atkMult = +(out.atkMult + lv * 0.03).toFixed(3);
  if (out.critDmgBonus != null) out.critDmgBonus = +(out.critDmgBonus + lv * 0.05).toFixed(3);
  if (out.turns != null) out.turns = out.turns + Math.floor(lv / 3);
  if (out.healRatio != null) out.healRatio = +(out.healRatio + lv * 0.02).toFixed(3);
  return out;
}

export function skillPower(atk, skillId, mods = null, skillLevel = 1) {
  const s = scaledSkillDef(skillId, skillLevel);
  if (!s) return atk;
  const mult = (s.mult || 0) * (1 + (mods?.powerMult || 0));
  const flat = (s.flat || 0) + (mods?.powerFlat || 0);
  return Math.max(1, Math.floor(atk * mult) + flat);
}

export function skillHealAmount(unit, skillId, mods = null, skillLevel = 1) {
  const s = scaledSkillDef(skillId, skillLevel);
  if (!s) return 0;
  let v = s.healFlat || 0;
  if (s.healMaxHp) v += Math.floor(unit.maxHp * s.healMaxHp);
  if (s.healMult) v += Math.floor(unit.atk * s.healMult);
  v = Math.floor(v * (1 + (mods?.healMult || 0)));
  return Math.max(1, v);
}

export function isHealSkill(skillId) {
  const s = SKILL_POWER[skillId];
  return !!(s && (s.style === "heal" || s.healMaxHp != null || s.healMult != null));
}

export function isBuffSkill(skillId) {
  return SKILL_POWER[skillId]?.style === "buff";
}

function passiveNums(sheet) {
  const p = sheet.passiveBoost;
  const parts = [];
  if (p.hp) parts.push(`生命+${p.hp}`);
  if (p.atk) parts.push(`攻击+${p.atk}`);
  if (p.def) parts.push(`防御+${p.def}`);
  if (p.spd) parts.push(`速度+${p.spd}`);
  return parts.join(" ") || "—";
}

function skillNumsAndDesc(skillId, level = 1) {
  const s = scaledSkillDef(skillId, level);
  if (!s) return { nums: "—", desc: "" };

  if (skillId === "aftercare") {
    const pct = Math.round(s.healRatio * 100);
    return {
      nums: `恢复最大生命×${pct}%`,
      desc: `战斗结束后恢复自身最大生命的 ${pct}%。`,
    };
  }
  if (skillId === "green_aftercare") {
    const pct = Math.round(s.healRatio * 100);
    return {
      nums: `参战全体×${pct}%`,
      desc: `战斗结束后，为所有参战人员恢复各自最大生命的 ${pct}%。`,
    };
  }
  if (s.style === "buff") {
    const atkPct = Math.round((s.atkMult || 0) * 100);
    const critPct = Math.round((s.critDmgBonus || 0) * 100);
    return {
      nums: `攻击+${atkPct}% · 暴伤+${critPct}% · ${s.turns}回合`,
      desc: `主动强化自身：攻击 +${atkPct}%，暴击伤害 +${critPct}%（叠加在基础 150% 上），持续 ${s.turns} 回合。`,
    };
  }
  if (s.style === "heal") {
    const text = `生命×${Math.round((s.healMaxHp || 0) * 100)}%+${s.healFlat || 0}`;
    const scope = s.target === "all" ? "全体友方" : "生命比例最低的友方";
    return {
      nums: s.target === "all" ? `${text} · 全体` : text,
      desc: `治疗${scope}。恢复：${text}。`,
    };
  }
  if (s.stunGauge || s.stunTurns) {
    const stun = s.stunGauge || s.stunTurns * 100;
    return {
      nums: `${skillPowerText(s.mult, s.flat)}，眩晕${stun}`,
      desc: `近战。十字范围受伤并眩晕。眩晕期间冻结行动条，按速度攒满隐形条 ${stun} 后恢复。伤害：${skillPowerText(s.mult, s.flat)}。`,
    };
  }
  if (s.hitAllFront) {
    return {
      nums: `${skillPowerText(s.mult, s.flat)} · 前排全体`,
      desc: `远程齐射。命中前排所有敌人。伤害：${skillPowerText(s.mult, s.flat)}（再减防御）。`,
    };
  }
  const styleName = s.style === "ranged" ? "远程" : "近战";
  return {
    nums: skillPowerText(s.mult, s.flat),
    desc: `${styleName}。伤害：${skillPowerText(s.mult, s.flat)}（再减防御）。`,
  };
}

function makeSkill(partial) {
  const level = partial.level || 1;
  const { nums, desc } = skillNumsAndDesc(partial.id, level);
  return {
    ...partial,
    level,
    nums: partial.nums ?? nums,
    desc: partial.desc ?? desc,
  };
}

/** 属性型被动：omni/pink/green */
export function attrPassiveSkillId(statsId) {
  if (statsId === "pink") return "pink_focus";
  if (statsId === "green") return "green_life";
  if (statsId === "omni") return "boost";
  return null;
}

/** 属性被动随等级成长（每级约 +10% 基础被动） */
export function scaledPassiveBoost(baseBoost = {}, level = 1) {
  const lv = Math.max(1, Math.floor(level || 1));
  const mult = 1 + (lv - 1) * 0.1;
  return {
    hp: Math.round((baseBoost.hp || 0) * mult),
    atk: Math.round((baseBoost.atk || 0) * mult),
    def: Math.round((baseBoost.def || 0) * mult),
    spd: Math.round((baseBoost.spd || 0) * mult),
  };
}

function formatBoostNums(boost) {
  const parts = [];
  if (boost.hp) parts.push(`生命+${boost.hp}`);
  if (boost.atk) parts.push(`攻击+${boost.atk}`);
  if (boost.def) parts.push(`防御+${boost.def}`);
  if (boost.spd) parts.push(`速度+${boost.spd}`);
  return parts.join(" ") || "—";
}

export function refreshSkillTexts(hero) {
  if (!hero?.skills) return;
  const attrId = attrPassiveSkillId(hero.statsId);
  for (const sk of hero.skills) {
    const lv = getSkillLevel(hero, sk.id);
    sk.level = lv;
    if (attrId && sk.id === attrId) {
      const base = hero.basePassiveBoost || hero.passiveBoost || {};
      const boosted = scaledPassiveBoost(base, lv);
      sk.nums = formatBoostNums(boosted);
      sk.desc = `被动属性强化，随技能等级提升。当前：${sk.nums}。`;
      continue;
    }
    const { nums, desc } = skillNumsAndDesc(sk.id, lv);
    sk.nums = nums;
    sk.desc = desc;
  }
}

/** 消耗 1 技能点升级技能（主动 / 被动均可） */
export function upgradeSkill(hero, skillId) {
  if (!hero || !skillId) return false;
  if ((hero.skillPoints || 0) < 1) return false;
  const sk = hero.skills?.find((s) => s.id === skillId);
  if (!sk) return false;
  const lv = getSkillLevel(hero, skillId);
  if (lv >= MAX_SKILL_LEVEL) return false;

  hero.skillPoints -= 1;
  const next = lv + 1;
  sk.level = next;
  if (!hero.skillLevels) hero.skillLevels = {};
  hero.skillLevels[skillId] = next;
  refreshSkillTexts(hero);
  return true;
}

export function createOmniSkills() {
  const sheet = getCharacterStats("omni");
  return [
    makeSkill({
      id: "attack",
      name: "普通攻击",
      kind: "active",
      style: "melee",
    }),
    makeSkill({
      id: "radiant",
      name: "飞镖投掷",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "quake",
      name: "震地击",
      kind: "active",
      style: "melee",
    }),
    {
      id: "boost",
      name: "均衡强化",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `被动：${passiveNums(sheet)}。`,
    },
    makeSkill({
      id: "aftercare",
      name: "战后恢复",
      kind: "passive",
    }),
  ];
}

export function createPinkSkills() {
  const sheet = getCharacterStats("pink");
  return [
    makeSkill({
      id: "pink_shot",
      name: "粉晶箭",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "pink_burst",
      name: "爆裂矢",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "pink_barrage",
      name: "流星雨",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "pink_fervor",
      name: "燃心",
      kind: "active",
      style: "buff",
    }),
    {
      id: "pink_focus",
      name: "爆发专注",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `被动：远程爆发型，${passiveNums(sheet)}。默认暴击率 10%，暴击伤害 150%。`,
    },
  ];
}

export function createGreenSkills() {
  const sheet = getCharacterStats("green");
  return [
    makeSkill({
      id: "green_bolt",
      name: "叶绿弹",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "green_mend",
      name: "治愈之触",
      kind: "active",
      style: "heal",
    }),
    makeSkill({
      id: "green_bloom",
      name: "春芽绽放",
      kind: "active",
      style: "heal",
    }),
    {
      id: "green_life",
      name: "生机流转",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `被动：治疗型，${passiveNums(sheet)}。`,
    },
    makeSkill({
      id: "green_aftercare",
      name: "战后群疗",
      kind: "passive",
    }),
  ];
}

const KIT = {
  omni: createOmniSkills,
  pink: createPinkSkills,
  green: createGreenSkills,
};

export function createHeroSkills(statsId) {
  const fn = KIT[statsId] || createOmniSkills;
  return fn();
}
