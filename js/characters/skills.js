/** 各职业技能定义与战斗数值 */

import { skillPowerText } from "../core/utils.js?v=71";
import { getCharacterStats } from "./stats.js?v=71";
import { getSkillLevel, MAX_SKILL_LEVEL } from "./progression.js?v=71";
import { heroHasUnique } from "./omni/equipment.js?v=71";

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

  // —— 小绿：治疗（与施法者攻击相关；单体另加被治疗者生命%）——
  green_bolt: { mult: 0.75, flat: 0, style: "ranged" },
  green_mend: {
    healAtkMult: 1.35,
    healTargetMaxHp: 0.1,
    healFlat: 6,
    style: "heal",
    target: "lowest",
  },
  green_bloom: {
    healAtkMult: 0.85,
    healFlat: 4,
    style: "heal",
    target: "all",
  },

  // —— 小黄：坦克 ——
  yellow_hit: { mult: 1.0, flat: 2, style: "melee" },
  yellow_slam: { mult: 1.65, flat: 6, style: "melee" },
  yellow_fortify: {
    style: "buff",
    target: "self",
    defMult: 0.45,
    turns: 3,
  },
  /** 被动反伤：对敌 = 防御×(等级×10%)×(1+攻击÷防御)
   *  对友：1 级 60%，每级 -10%；≤ -10% 时改为治疗 |比例|×对敌伤害，并造成 1 真实伤害
   */
  yellow_reflect: {
    reflectPctPerLevel: 0.1,
    allyRatioBase: 0.6,
    allyRatioStep: -0.1,
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
  if (out.healTargetMaxHp != null) {
    out.healTargetMaxHp = +(out.healTargetMaxHp + lv * 0.008).toFixed(4);
  }
  if (out.healAtkMult != null) out.healAtkMult = +(out.healAtkMult + lv * 0.05).toFixed(3);
  if (out.healFlat != null) out.healFlat = Math.round(out.healFlat + lv * 2);
  if (out.healMult != null) out.healMult = +(out.healMult + lv * 0.05).toFixed(3);
  if (out.atkMult != null) out.atkMult = +(out.atkMult + lv * 0.03).toFixed(3);
  if (out.critDmgBonus != null) out.critDmgBonus = +(out.critDmgBonus + lv * 0.05).toFixed(3);
  if (out.defMult != null) out.defMult = +(out.defMult + lv * 0.04).toFixed(3);
  if (out.turns != null) out.turns = out.turns + Math.floor(lv / 3);
  if (out.healRatio != null) out.healRatio = +(out.healRatio + lv * 0.02).toFixed(3);
  // 反伤：系数 = 等级 × 10%（不走通用 +flat 成长）
  if (out.reflectPctPerLevel != null) {
    const rank = Math.max(1, Math.floor(skillLevel || 1));
    out.reflectMult = +(out.reflectPctPerLevel * rank).toFixed(3);
    delete out.reflectFlat;
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

/**
 * 治疗量：与施法者攻击相关；单体可再加被治疗者最大生命百分比（群体不加）
 * @param {object} caster 施法者（战斗单位或英雄）
 * @param {string} skillId
 * @param {object|null} mods
 * @param {number} skillLevel
 * @param {object|null} target 被治疗者；群体可不传
 */
export function skillHealAmount(caster, skillId, mods = null, skillLevel = 1, target = null) {
  const s = scaledSkillDef(skillId, skillLevel);
  if (!s) return 0;
  let v = s.healFlat || 0;
  const atk = Math.max(0, caster?.atk ?? 0);
  if (s.healAtkMult) v += Math.floor(atk * s.healAtkMult);
  else if (s.healMult) v += Math.floor(atk * s.healMult);
  // 仅单体：加被治疗者生命百分比
  if (s.target !== "all" && s.healTargetMaxHp && target) {
    v += Math.floor(Math.max(0, target.maxHp || 0) * s.healTargetMaxHp);
  } else if (s.healMaxHp && s.target !== "all" && target) {
    // 兼容旧字段：当作目标生命%
    v += Math.floor(Math.max(0, target.maxHp || 0) * s.healMaxHp);
  }
  v = Math.floor(v * (1 + (mods?.healMult || 0)));
  return Math.max(1, v);
}

export function isHealSkill(skillId) {
  const s = SKILL_POWER[skillId];
  return !!(
    s &&
    (s.style === "heal" ||
      s.healMaxHp != null ||
      s.healTargetMaxHp != null ||
      s.healAtkMult != null ||
      s.healMult != null)
  );
}

export function isBuffSkill(skillId) {
  return SKILL_POWER[skillId]?.style === "buff";
}

/** 反伤系数（随等级）；战斗与面板共用 */
export function getReflectParams(skillLevel = 1) {
  const rank = Math.max(1, Math.floor(skillLevel || 1));
  const s = scaledSkillDef("yellow_reflect", rank) || SKILL_POWER.yellow_reflect;
  const per = s.reflectPctPerLevel ?? 0.1;
  const base = s.allyRatioBase ?? 0.6;
  const step = s.allyRatioStep ?? -0.1;
  // 用百分数取整，避免 0.6-0.6 变成 -0
  const allyPct = Math.round((base + (rank - 1) * step) * 100);
  return {
    reflectMult: s.reflectMult ?? +(per * rank).toFixed(3),
    /** 1 级 60%，每级 -10%；≤ -10% 时治疗 */
    allyRatio: allyPct / 100,
  };
}

/**
 * 对敌反伤：防御力 × (等级×10%) × (1 + 攻击÷防御)
 */
export function calcReflectEnemyDamage(atk, def, skillLevel = 1) {
  const p = getReflectParams(skillLevel);
  const d = Math.max(1, Math.floor(def || 1));
  const a = Math.max(0, Math.floor(atk || 0));
  return Math.max(1, Math.floor(d * p.reflectMult * (1 + a / d)));
}

/** 唯一盾：友军比例再 -10%（更快转入治疗） */
export function applyReflectAllyUnique(allyRatio, hasShield) {
  if (!hasShield) return allyRatio;
  return +(allyRatio - 0.1).toFixed(3);
}

/**
 * 按角色当前攻防预览反伤数值（真实伤害，未算战中 buff）
 */
export function previewReflectDamage(hero) {
  const lv = getSkillLevel(hero, "yellow_reflect");
  const p = getReflectParams(lv);
  const def = Math.max(1, Math.floor(hero?.def || 1));
  const atk = Math.max(0, Math.floor(hero?.atk || 0));
  const hasShield = heroHasUnique(hero, "yellow_reflect_shield");
  const allyRatio = applyReflectAllyUnique(p.allyRatio, hasShield);
  const enemy = calcReflectEnemyDamage(atk, def, lv);
  let ally = 0;
  let allyHeal = 0;
  if (allyRatio > 0) ally = Math.max(1, Math.floor(enemy * allyRatio));
  else if (allyRatio < 0) {
    allyHeal = Math.max(1, Math.floor(enemy * Math.abs(allyRatio)));
    ally = 1; // 真实伤害
  }
  return { enemy, ally, allyHeal, ...p, allyRatio, hasShield };
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
    const atkPart = s.healAtkMult
      ? skillPowerText(s.healAtkMult, s.healFlat || 0)
      : s.healFlat
        ? `+${s.healFlat}`
        : "";
    if (s.target === "all") {
      const nums = `${atkPart} · 全体`;
      return {
        nums,
        desc: `治疗全体友方：${atkPart}。`,
      };
    }
    const hpPct = Math.round((s.healTargetMaxHp || s.healMaxHp || 0) * 100);
    const text =
      hpPct > 0 ? `${atkPart}+目标生命×${hpPct}%` : atkPart;
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
    const allyRatio = applyReflectAllyUnique(
      p.allyRatio,
      heroHasUnique(hero, "yellow_reflect_shield")
    );
    const enemyFormula = `防御力×${pct}%×(1+攻击÷防御)`;
    let allyText;
    if (allyRatio > 0) {
      allyText = `对友方造成 该伤害×${Math.round(allyRatio * 100)}%`;
    } else if (allyRatio === 0) {
      allyText = `对友方无溅射`;
    } else {
      allyText = `治疗友方 该伤害×${Math.round(Math.abs(allyRatio) * 100)}%，并造成 1 真实伤害`;
    }
    const nums =
      allyRatio > 0
        ? `敌${enemyFormula} · 友×${Math.round(allyRatio * 100)}%`
        : allyRatio === 0
          ? `敌${enemyFormula} · 友无溅射`
          : `敌${enemyFormula} · 友治疗×${Math.round(Math.abs(allyRatio) * 100)}%+1真伤`;
    const desc = `受伤时，对敌人造成 ${enemyFormula} 伤害，${allyText}。`;
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
      desc: `${desc}装备治愈戒时：任意治疗效果都会给目标附加 2 秒脉动——行动条每累计走 10，流失约等于本次治疗量 20% 的血；再累计走到 20，按刚流失量的 2.5 倍回血。`,
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
      nums: "敌防御力×10%×(1+攻击÷防御) · 友×60%",
      desc: "受伤时，对敌人造成 防御力×10%×(1+攻击÷防御) 伤害，对友方造成 该伤害×60%。",
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
