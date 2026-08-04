/** 各职业技能定义与战斗数值 */

import { skillPowerText } from "../core/utils.js?v=59";
import { getCharacterStats } from "./stats.js?v=59";
import { getSkillLevel, MAX_SKILL_LEVEL } from "./progression.js?v=59";
import { heroHasUnique } from "./omni/equipment.js?v=59";

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

  // —— 小黄：坦克 ——
  yellow_hit: { mult: 1.0, flat: 2, style: "melee" },
  yellow_slam: { mult: 1.65, flat: 6, style: "melee" },
  yellow_fortify: {
    style: "buff",
    target: "self",
    defMult: 0.45,
    turns: 3,
  },
  /** 被动反伤：敌人 = 防御×reflectMult+reflectFlat；友军 = 敌人×allyRatio */
  yellow_reflect: {
    reflectMult: 0.6,
    reflectFlat: 4,
    allyRatio: 0.7,
  },

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
  if (out.defMult != null) out.defMult = +(out.defMult + lv * 0.04).toFixed(3);
  if (out.turns != null) out.turns = out.turns + Math.floor(lv / 3);
  if (out.healRatio != null) out.healRatio = +(out.healRatio + lv * 0.02).toFixed(3);
  if (out.reflectMult != null) out.reflectMult = +(out.reflectMult + lv * 0.04).toFixed(3);
  if (out.reflectFlat != null) out.reflectFlat = Math.round(out.reflectFlat + lv * 1);
  // 友军反伤是副作用：升级应减轻，不是加重
  if (out.allyRatio != null) {
    out.allyRatio = Math.max(0.2, +(out.allyRatio - lv * 0.025).toFixed(3));
  }
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

/** 反伤系数（随等级）；战斗与面板共用 */
export function getReflectParams(skillLevel = 1) {
  const s = scaledSkillDef("yellow_reflect", skillLevel) || SKILL_POWER.yellow_reflect;
  return {
    reflectMult: s.reflectMult,
    reflectFlat: s.reflectFlat,
    allyRatio: s.allyRatio,
  };
}

/**
 * 按角色当前攻防预览反伤数值（真实伤害，未算战中 buff）
 * @returns {{ enemy: number, ally: number, reflectMult: number, reflectFlat: number, allyRatio: number, hasShield: boolean }}
 */
export function previewReflectDamage(hero) {
  const lv = getSkillLevel(hero, "yellow_reflect");
  const p = getReflectParams(lv);
  const def = Math.max(1, Math.floor(hero?.def || 1));
  let enemy = Math.max(1, Math.floor(def * p.reflectMult + p.reflectFlat));
  const hasShield = heroHasUnique(hero, "yellow_reflect_shield");
  if (hasShield) {
    const atk = Math.max(0, Math.floor(hero?.atk || 0));
    enemy = Math.max(1, Math.floor((atk / def) * enemy));
  }
  const ally = Math.max(1, Math.floor(enemy * p.allyRatio));
  return { enemy, ally, ...p, hasShield };
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
  const dmg = skillPowerText(s.mult, s.flat);

  if (skillId === "aftercare") {
    const pct = Math.round(s.healRatio * 100);
    const desc = `战斗结束时，恢复自身最大生命×${pct}%。`;
    return { nums: `战斗结束 · 自身×${pct}%`, desc };
  }
  if (skillId === "green_aftercare") {
    const pct = Math.round(s.healRatio * 100);
    const desc = `战斗结束时，参战全体各恢复最大生命×${pct}%。`;
    return { nums: `战斗结束 · 全体×${pct}%`, desc };
  }
  if (s.style === "buff") {
    const atkPct = Math.round((s.atkMult || 0) * 100);
    const critPct = Math.round((s.critDmgBonus || 0) * 100);
    const defPct = Math.round((s.defMult || 0) * 100);
    if (defPct && !atkPct) {
      const desc = `自身防御+${defPct}%，持续 ${s.turns} 回合。`;
      return { nums: `防御+${defPct}% · ${s.turns}回合`, desc };
    }
    const desc = `自身攻击+${atkPct}%、暴伤+${critPct}%，持续 ${s.turns} 回合。`;
    return {
      nums: `攻击+${atkPct}% · 暴伤+${critPct}% · ${s.turns}回合`,
      desc,
    };
  }
  if (s.style === "heal") {
    const text = `生命×${Math.round((s.healMaxHp || 0) * 100)}%+${s.healFlat || 0}`;
    if (s.target === "all") {
      return {
        nums: `${text} · 全体`,
        desc: `治疗全体友方：${text}。`,
      };
    }
    return {
      nums: text,
      desc: `治疗生命比例最低的友方：${text}。`,
    };
  }
  if (s.stunGauge || s.stunTurns) {
    const stun = s.stunGauge || s.stunTurns * 100;
    return {
      nums: `${dmg} · 命中眩晕${stun}`,
      desc: `对十字范围造成 ${dmg} 伤害，命中眩晕 ${stun}。`,
    };
  }
  if (s.hitAllFront) {
    return {
      nums: `${dmg} · 前排全体`,
      desc: `对前排全体造成 ${dmg} 伤害。`,
    };
  }
  if (skillId === "pink_burst") {
    return {
      nums: dmg,
      desc: `对生命最低的敌人造成 ${dmg} 伤害。`,
    };
  }
  return {
    nums: dmg,
    desc: `对单体造成 ${dmg} 伤害。`,
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
  if (statsId === "yellow") return "yellow_armor";
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

/**
 * 按指定等级生成技能面板文案（nums 短 / desc 完整）
 * @param {object} hero
 * @param {string} skillId
 * @param {number} level
 */
export function buildSkillText(hero, skillId, level = 1) {
  const lv = Math.max(1, Math.floor(level || 1));
  const attrId = attrPassiveSkillId(hero?.statsId);

  if (attrId && skillId === attrId) {
    const base = hero.basePassiveBoost || hero.passiveBoost || {};
    const boosted = scaledPassiveBoost(base, lv);
    const nums = formatBoostNums(boosted);
    let desc = `永久属性：${nums}。`;
    if (skillId === "boost" && heroHasUnique(hero, "omni_balance_spirit")) {
      desc += `十字友军共享属性；自身灵体（不造成/不受伤害）；震地眩晕减半。`;
    } else if (skillId === "green_life" && heroHasUnique(hero, "green_life_flow")) {
      desc += `治疗时提升友军伤害。`;
    }
    return { nums, desc };
  }

  if (skillId === "yellow_reflect") {
    const p = getReflectParams(lv);
    const pct = Math.round(p.reflectMult * 100);
    const allyPct = Math.round(p.allyRatio * 100);
    const hasShield = heroHasUnique(hero, "yellow_reflect_shield");
    const enemyFormula = hasShield
      ? `防御力×${pct}%+${p.reflectFlat}×(攻击÷防御)`
      : `防御力×${pct}%+${p.reflectFlat}`;
    const nums = `敌${enemyFormula} · 友×${allyPct}%`;
    const desc = `受伤时，对敌人造成 ${enemyFormula} 伤害，对友方造成 该伤害×${allyPct}%。`;
    return { nums, desc };
  }

  const { nums, desc } = skillNumsAndDesc(skillId, lv);
  if (skillId === "pink_burst" && heroHasUnique(hero, "pink_burst_echo")) {
    return {
      nums: `${nums} · 3发×50% · 击杀+1发`,
      desc: `${desc}每段连射 3 发（每发 50% 伤害），击杀则本段 +1 发。`,
    };
  }
  if (skillId === "green_mend" && heroHasUnique(hero, "green_mend_pulse")) {
    return {
      nums: `${nums} · 治疗后脉动`,
      desc: `${desc}治疗后 2 秒脉动：行动条每走 10 掉血，每走 20 回复刚掉血量的 2.5 倍。`,
    };
  }
  return { nums, desc };
}

export function refreshSkillTexts(hero) {
  if (!hero?.skills) return;
  for (const sk of hero.skills) {
    const lv = getSkillLevel(hero, sk.id);
    sk.level = lv;
    const { nums, desc } = buildSkillText(hero, sk.id, lv);
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
      name: "斩击",
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
      desc: `永久属性：${passiveNums(sheet)}。`,
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
      desc: `永久属性：${passiveNums(sheet)}。`,
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
      desc: `永久属性：${passiveNums(sheet)}。`,
    },
    makeSkill({
      id: "green_aftercare",
      name: "战后群疗",
      kind: "passive",
    }),
  ];
}

export function createYellowSkills() {
  const sheet = getCharacterStats("yellow");
  return [
    makeSkill({
      id: "yellow_hit",
      name: "盾击",
      kind: "active",
      style: "melee",
    }),
    makeSkill({
      id: "yellow_slam",
      name: "盾猛",
      kind: "active",
      style: "melee",
    }),
    makeSkill({
      id: "yellow_fortify",
      name: "铁壁",
      kind: "active",
      style: "buff",
    }),
    {
      id: "yellow_reflect",
      name: "反伤",
      kind: "passive",
      level: 1,
      nums: "敌防御力×60%+4 · 友×70%",
      desc: "受伤时，对敌人造成 防御力×60%+4 伤害，对友方造成 该伤害×70%。",
    },
    {
      id: "yellow_armor",
      name: "坚甲",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `永久属性：${passiveNums(sheet)}。`,
    },
  ];
}

const KIT = {
  omni: createOmniSkills,
  pink: createPinkSkills,
  green: createGreenSkills,
  yellow: createYellowSkills,
};

export function createHeroSkills(statsId) {
  const fn = KIT[statsId] || createOmniSkills;
  return fn();
}
