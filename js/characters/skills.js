/** 各职业技能定义与战斗数值 */

import { getCharacterStats } from "./stats.js?v=136";
import { getSkillLevel, getBaseSkillLevel, MAX_SKILL_LEVEL } from "./progression.js?v=136";
import { heroHasUnique, sumSkillMods } from "./omni/equipment.js?v=136";

function fmtSkillNum(n) {
  const x = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(x)) return "0";
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  return String(+x.toFixed(2));
}

/** 技能描述里可计算数值高亮 */
function skVal(inner) {
  return `<span class="sk-val">${inner}</span>`;
}

/** 将段伤倍率折入公式，避免玩家二次换算 */
function skillPowerMarked(mult, flat, scale = 1) {
  const m = (Number(mult) || 0) * scale;
  const f = Math.round((Number(flat) || 0) * scale);
  const parts = [`攻击力×${skVal(fmtSkillNum(m))}`];
  if (f > 0) parts.push(`+${skVal(f)}`);
  else if (f < 0) parts.push(skVal(String(f)));
  return parts.join("");
}

function hitDamageScale(mods) {
  return mods?.hitDamageMult != null ? mods.hitDamageMult : 1;
}

/**
 * 技能数值表（基础值；升级在 scaledSkillDef 中叠加）
 * - style: melee / ranged / heal / buff
 */
export const SKILL_POWER = {
  // —— 全能 ——
  attack: { mult: 1.0, flat: 0, style: "melee" },
  radiant: { mult: 1.2, flat: 2, style: "ranged", apply: { slow: 0.25 } },
  /** stunGauge：眩晕隐形行动条目标值（默认 50） */
  quake: { mult: 1.15, flat: 0, stunGauge: 50, style: "melee" },
  omni_bless: {
    style: "buff",
    target: "all",
    atkMult: 0.12,
    defMult: 0.12,
    turns: 2,
  },

  // —— 小粉：远程爆发 ——
  /** 普通攻击（原粉晶箭倍率） */
  pink_burst: { mult: 1.15, flat: 3, style: "ranged" },
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
  /** 普攻盾击：命中后自身承受造成伤害的一小部分（真实伤害，并触发反伤） */
  yellow_hit: { mult: 1.0, flat: 2, style: "melee", selfRecoilPct: 0.15 },
  yellow_slam: { mult: 1.65, flat: 6, style: "melee", apply: { slow: 0.2 } },
  yellow_fortify: {
    style: "buff",
    target: "self",
    defMult: 0.45,
    turns: 3,
  },
  /** 被动反伤：对敌 = 防御×(等级×10%)×(1+攻击÷防御)，至少 1
   *  默认只反击伤害来源；唯一强化后打全场
   *  对友：1 级 60%，每级 -5%；≤ -10% 时改为治疗 |比例|×对敌伤害（至少 1）
   */
  yellow_reflect: {
    reflectPctPerLevel: 0.1,
    allyRatioBase: 0.6,
    allyRatioStep: -0.05,
  },

  // —— 小蓝：霜语 ——
  blue_bolt: { mult: 1.0, flat: 2, style: "ranged", apply: { slow: 0.3 } },
  blue_nova: {
    mult: 0.65,
    flat: 1,
    style: "ranged",
    hitAllFront: true,
    apply: { slow: 0.25 },
  },
  blue_freeze: { mult: 0.9, flat: 2, style: "ranged", apply: { stun: true } },
  blue_veil: {
    style: "buff",
    target: "all",
    dodgePower: 0.12,
    dodgeGauge: 50,
    turns: 2,
  },

  // —— 小橙：烬火 ——
  orange_shot: {
    mult: 0.95,
    flat: 2,
    style: "ranged",
    dot: { type: "onAct", mult: 0.16, flat: 0, gauge: 50 },
  },
  orange_wave: {
    mult: 0.55,
    flat: 1,
    style: "ranged",
    hitAllFront: true,
    dot: { type: "onAct", mult: 0.12, flat: 0, gauge: 50 },
  },
  orange_blaze: {
    mult: 1.8,
    flat: 6,
    style: "ranged",
    dot: { type: "onAct", mult: 0.2, flat: 1, gauge: 50 },
  },
  orange_stoke: { style: "buff", target: "self", atkMult: 0.22, turns: 3 },

  // —— 小青：疾风 ——
  /** 风刃：为友方下次伤害附魔（亦为小青第一技能/普通攻击位） */
  cyan_cut: {
    style: "buff",
    target: "ally",
    windEnchant: true,
    windEnchantMult: 0.3,
  },
  cyan_tailwind: {
    style: "buff",
    target: "all",
    hastePower: 0.18,
    hasteGauge: 50,
    turns: 2,
  },
  cyan_gust: {
    style: "buff",
    target: "ally",
    hastePower: 0.25,
    hasteGauge: 50,
    turns: 2,
  },

  // —— 被动：战后 ——
  aftercare: { healRatio: 0.25, healParty: false },
  /** 小绿：战后为所有参战人员恢复 */
  green_aftercare: { healRatio: 0.2, healParty: true },
  /** 小青：战后为所有参战人员恢复 */
  cyan_breeze: { healRatio: 0.12, healParty: true },
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
  if (out.hastePower != null) out.hastePower = +(out.hastePower + lv * 0.01).toFixed(3);
  if (out.dodgePower != null) out.dodgePower = +(out.dodgePower + lv * 0.008).toFixed(3);
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

/** 强化风刃：最多段数 = 3 + ⌊(等级-1)/2⌋ */
export function windGaleMaxSegments(skillLevel = 1) {
  const lv = Math.max(1, Math.floor(skillLevel || 1));
  return 3 + Math.floor((lv - 1) / 2);
}

/** 强化风刃：单次伤害附魔倍率 = 80% + (等级-1)×10% */
export function windGaleSingleMult(skillLevel = 1) {
  const lv = Math.max(1, Math.floor(skillLevel || 1));
  return +(0.8 + (lv - 1) * 0.1).toFixed(3);
}

/** 强化风刃：多段每段固定攻×10% */
export const WIND_GALE_SEGMENT_MULT = 0.1;

/** 织律戒：增益 / 带控制·减速·持续伤害的减益技 */
export function isWeaveStatusSkill(skillId) {
  const s = SKILL_POWER[skillId];
  if (!s) return false;
  if (s.style === "buff") return true;
  if (s.apply || s.stunGauge != null || s.stunTurns != null || s.dot) return true;
  return false;
}

/** 织律：效果强度 ×1.2（浅拷贝） */
export function applyWeaveEffectBoost(def, mult = 1.2) {
  if (!def || !(mult > 0) || mult === 1) return def;
  const out = { ...def };
  if (def.apply) out.apply = { ...def.apply };
  if (def.dot) out.dot = { ...def.dot };
  const scale = (v) =>
    v == null ? v : +((Number(v) || 0) * mult).toFixed(4);
  if (out.atkMult != null) out.atkMult = scale(out.atkMult);
  if (out.defMult != null) out.defMult = scale(out.defMult);
  if (out.critDmgBonus != null) out.critDmgBonus = scale(out.critDmgBonus);
  if (out.hastePower != null) out.hastePower = scale(out.hastePower);
  if (out.dodgePower != null) out.dodgePower = scale(out.dodgePower);
  if (out.hitUpPower != null) out.hitUpPower = scale(out.hitUpPower);
  if (out.windEnchantMult != null) out.windEnchantMult = scale(out.windEnchantMult);
  if (out.stunGauge != null) out.stunGauge = Math.round(out.stunGauge * mult);
  if (out.stunTurns != null) out.stunTurns = Math.max(1, Math.round(out.stunTurns * mult));
  if (out.apply?.slow != null) out.apply.slow = scale(out.apply.slow);
  if (out.apply?.stunGauge != null) {
    out.apply.stunGauge = Math.round(out.apply.stunGauge * mult);
  }
  if (out.dot) {
    if (out.dot.mult != null) out.dot.mult = scale(out.dot.mult);
    if (out.dot.flat != null) out.dot.flat = Math.round(out.dot.flat * mult);
    if (out.dot.gauge != null) out.dot.gauge = Math.round(out.dot.gauge * mult);
  }
  return out;
}

/** 反伤系数（随等级）；战斗与面板共用 */
export function getReflectParams(skillLevel = 1) {
  const rank = Math.max(1, Math.floor(skillLevel || 1));
  const s = scaledSkillDef("yellow_reflect", rank) || SKILL_POWER.yellow_reflect;
  const per = s.reflectPctPerLevel ?? 0.1;
  const base = s.allyRatioBase ?? 0.6;
  const step = s.allyRatioStep ?? -0.05;
  // 用百分数取整，避免浮点误差
  const allyPct = Math.round((base + (rank - 1) * step) * 100);
  return {
    reflectMult: s.reflectMult ?? +(per * rank).toFixed(3),
    /** 1 级 60%，每级 -5%；≤ -10% 时治疗 */
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
 * 唯一词条对技能数值的覆盖（返回浅拷贝）
 * @param {object|null} hero
 * @param {string} skillId
 * @param {object|null} def
 */
export function applyUniqueSkillMods(hero, skillId, def) {
  if (!def || !hero || !skillId) return def;
  const out = { ...def };
  if (def.apply) out.apply = { ...def.apply };
  if (def.dot) out.dot = { ...def.dot };

  if (skillId === "blue_freeze" && heroHasUnique(hero, "blue_freeze_lock")) {
    out.apply = { stun: true, stunGauge: 80, slow: 0.3 };
  }
  if (skillId === "orange_blaze" && heroHasUnique(hero, "orange_blaze_ember")) {
    const d = out.dot || { type: "onAct", mult: 0.2, flat: 1, gauge: 50 };
    out.dot = {
      ...d,
      mult: +((d.mult || 0.2) * 1.5).toFixed(3),
      flat: Math.round((d.flat || 0) + 2),
      gauge: Math.max(d.gauge || 50, 70),
    };
  }
  if (skillId === "cyan_tailwind" && heroHasUnique(hero, "cyan_tailwind_gale")) {
    out.hastePower = +((out.hastePower || 0.18) + 0.12).toFixed(3);
    out.hasteGauge = Math.max(out.hasteGauge || 50, 70);
    out.hitUpPower = Math.max(out.hitUpPower || 0, 0.1);
    out.hitUpGauge = 70;
  }
  return out;
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

function statusEffectNotes(s, scale = 1) {
  const parts = [];
  if (s.apply?.slow != null) {
    parts.push(`命中减速${skVal(Math.round(s.apply.slow * 100) + "%")}`);
  }
  if (s.apply?.stun) {
    const g = s.apply.stunGauge;
    parts.push(g != null ? `命中眩晕(${skVal(g)})` : "命中眩晕");
  }
  if (s.dot) {
    const dotDmg = skillPowerMarked(s.dot.mult || 0, s.dot.flat || 0, scale);
    const g = s.dot.gauge;
    parts.push(
      g != null
        ? `行动时持续伤害 ${dotDmg}(${skVal(g)})`
        : `行动时持续伤害 ${dotDmg}`
    );
  }
  return parts;
}

function skillNumsAndDesc(skillId, level = 1, opts = {}) {
  const s = opts.def || scaledSkillDef(skillId, level);
  if (!s) return { nums: "—", desc: "" };
  const scale = opts.damageScale != null ? opts.damageScale : 1;
  const dmg = skillPowerMarked(s.mult, s.flat, scale);
  const casts = Math.max(1, opts.casts || 1);

  if (skillId === "aftercare") {
    const pct = Math.round(s.healRatio * 100);
    const desc = `战斗结束时，恢复自身最大生命×${skVal(pct + "%")}。`;
    return { nums: `战斗结束 · 自身×${skVal(pct + "%")}`, desc };
  }
  if (skillId === "green_aftercare") {
    const pct = Math.round(s.healRatio * 100);
    const desc = `战斗结束时，参战全体各恢复最大生命×${skVal(pct + "%")}。`;
    return { nums: `战斗结束 · 全体×${skVal(pct + "%")}`, desc };
  }
  if (skillId === "cyan_breeze") {
    const pct = Math.round(s.healRatio * 100);
    const desc = `战斗结束时，参战全体各恢复最大生命×${skVal(pct + "%")}。`;
    return { nums: `战斗结束 · 全体×${skVal(pct + "%")}`, desc };
  }
  if (s.style === "buff") {
    const atkPct = Math.round((s.atkMult || 0) * 100);
    const critPct = Math.round((s.critDmgBonus || 0) * 100);
    const defPct = Math.round((s.defMult || 0) * 100);
    const hastePct = Math.round((s.hastePower || 0) * 100);
    const dodgePct = Math.round((s.dodgePower || 0) * 100);
    const turns = skVal(s.turns);

    if (s.target === "all" && atkPct && defPct) {
      const desc = `全体攻击+${skVal(atkPct + "%")}、防御+${skVal(defPct + "%")}，持续 ${turns} 回合。`;
      return {
        nums: `全体攻击+${skVal(atkPct + "%")} · 防御+${skVal(defPct + "%")} · ${turns}回合`,
        desc,
      };
    }
    if (hastePct && s.target === "all") {
      const hitPct = Math.round((s.hitUpPower || 0) * 100);
      const hitNote = hitPct ? `、命中+${skVal(hitPct + "%")}` : "";
      const hitShort = hitPct ? ` · 命中+${skVal(hitPct + "%")}` : "";
      const desc = `全体增速+${skVal(hastePct + "%")}${hitNote}，持续 ${turns} 回合。`;
      return {
        nums: `全体增速+${skVal(hastePct + "%")}${hitShort} · ${turns}回合`,
        desc,
      };
    }
    if (dodgePct && s.target === "all") {
      const desc = `全体闪避+${skVal(dodgePct + "%")}，持续 ${turns} 回合。`;
      return {
        nums: `全体闪避+${skVal(dodgePct + "%")} · ${turns}回合`,
        desc,
      };
    }
    if (hastePct && s.target === "ally") {
      const desc = `生命比例最低的友方增速+${skVal(hastePct + "%")}，持续 ${turns} 回合。`;
      return {
        nums: `友方增速+${skVal(hastePct + "%")} · ${turns}回合`,
        desc,
      };
    }
    if (s.windEnchant) {
      const pct = Math.round((s.windEnchantMult || 0.3) * 100);
      const unique = !!opts.windUnique;
      if (unique) {
        const lv = Math.max(1, Math.floor(opts.level || 1));
        const maxSeg = windGaleMaxSegments(lv);
        const singlePct = Math.round(windGaleSingleMult(lv) * 100);
        const segPct = Math.round(WIND_GALE_SEGMENT_MULT * 100);
        return {
          nums: `附魔整段 · 段伤攻×${skVal(segPct + "%")}（最多${skVal(maxSeg)}）· 单段攻×${skVal(singlePct + "%")}`,
          desc: `为攻击最高的友方附魔下次技能：多段技每段追加小青攻击×${skVal(segPct + "%")}（最多${skVal(maxSeg)}段，初始3段每两级+1）；单次伤害（含群伤一次结算）追加攻击×${skVal(singlePct + "%")}（初始80%每级+10%）。开局自动释放。`,
        };
      }
      return {
        nums: `附魔下次伤害 · 攻×${skVal(pct + "%")}`,
        desc: `为攻击最高的友方附魔：其下次造成伤害时，额外造成一次小青攻击×${skVal(pct + "%")} 的伤害。`,
      };
    }
    if (defPct && !atkPct && !hastePct && !dodgePct) {
      const desc = `自身防御+${skVal(defPct + "%")}，持续 ${turns} 回合。`;
      return { nums: `防御+${skVal(defPct + "%")} · ${turns}回合`, desc };
    }
    if (atkPct && !critPct && !defPct && !hastePct) {
      const desc = `自身攻击+${skVal(atkPct + "%")}，持续 ${turns} 回合。`;
      return { nums: `攻击+${skVal(atkPct + "%")} · ${turns}回合`, desc };
    }
    const desc = `自身攻击+${skVal(atkPct + "%")}、暴伤+${skVal(critPct + "%")}，持续 ${turns} 回合。`;
    return {
      nums: `攻击+${skVal(atkPct + "%")} · 暴伤+${skVal(critPct + "%")} · ${turns}回合`,
      desc,
    };
  }
  if (s.style === "heal") {
    const atkPart = s.healAtkMult
      ? skillPowerMarked(s.healAtkMult, s.healFlat || 0, 1)
      : s.healFlat
        ? `+${skVal(s.healFlat)}`
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
      hpPct > 0 ? `${atkPart}+目标生命×${skVal(hpPct + "%")}` : atkPart;
    return {
      nums: text,
      desc: `治疗生命比例最低的友方：${text}。`,
    };
  }
  if (s.stunGauge || s.stunTurns) {
    const stun = s.stunGauge || s.stunTurns * 100;
    const castNote =
      casts > 1 ? `释放 ${skVal(casts)} 次。` : "";
    return {
      nums:
        casts > 1
          ? `${dmg} · 命中眩晕${skVal(stun)} · ${skVal(casts)}次`
          : `${dmg} · 命中眩晕${skVal(stun)}`,
      desc: `对十字范围造成 ${dmg} 伤害，命中眩晕 ${skVal(stun)}。${castNote}`,
    };
  }
  if (s.hitAllFront) {
    const castNote = casts > 1 ? `释放 ${skVal(casts)} 次。` : "";
    const effects = statusEffectNotes(s, scale);
    const effectStr = effects.length ? ` · ${effects.join(" · ")}` : "";
    const scope = "对前排全体";
    const descEffects = effects.length ? `，${effects.join("，")}` : "";
    return {
      nums:
        casts > 1
          ? `${dmg} · 前排全体${effectStr} · ${skVal(casts)}次`
          : `${dmg} · 前排全体${effectStr}`,
      desc: `${scope}造成 ${dmg} 伤害${descEffects}。${castNote}`,
    };
  }
  if (skillId === "pink_burst") {
    if (opts.pinkEcho) {
      const segs = Math.max(3, opts.casts || 3);
      return {
        nums: `${dmg} · ${skVal(segs)}段 · 击杀+${skVal(1)}`,
        desc: `对生命最低的敌人造成 ${dmg} 伤害。释放 ${skVal(segs)} 段，每击杀一个敌人额外释放 ${skVal(1)} 段。`,
      };
    }
    const castNote = casts > 1 ? `释放 ${skVal(casts)} 次。` : "";
    return {
      nums: casts > 1 ? `${dmg} · ${skVal(casts)}次` : dmg,
      desc: `对生命最低的敌人造成 ${dmg} 伤害。${castNote}`,
    };
  }
  const castNote = casts > 1 ? `释放 ${skVal(casts)} 次。` : "";
  const effects = statusEffectNotes(s, scale);
  const recoilPct =
    s.selfRecoilPct != null ? Math.round(s.selfRecoilPct * 100) : 0;
  // nums 用短标签；desc 只写完整自伤说明，避免「自伤15%」再说一遍
  const numsEffects = effects.slice();
  if (recoilPct > 0) {
    numsEffects.push(`自伤${skVal(recoilPct + "%")}`);
  }
  const effectStr = numsEffects.length ? ` · ${numsEffects.join(" · ")}` : "";
  const descEffects = effects.length ? `，${effects.join("，")}` : "";
  const recoilNote =
    recoilPct > 0
      ? `命中后自身受到该次伤害×${skVal(recoilPct + "%")} 的真实伤害，并触发反伤。`
      : "";
  return {
    nums: casts > 1 ? `${dmg}${effectStr} · ${skVal(casts)}次` : `${dmg}${effectStr}`,
    desc: `对单体造成 ${dmg} 伤害${descEffects}。${recoilNote}${castNote}`,
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
  if (statsId === "blue") return "blue_chill";
  if (statsId === "orange") return "orange_ember";
  if (statsId === "cyan") return "cyan_swift";
  return null;
}

/** 属性被动随等级成长：每级约 +10% 基础被动，且非 0 项每级至少 +1（避免小数四舍五入看不出变化） */
export function scaledPassiveBoost(baseBoost = {}, level = 1) {
  const lv = Math.max(1, Math.floor(level || 1));
  const grow = (v) => {
    const base = Math.max(0, Math.round(Number(v) || 0));
    if (!base) return 0;
    if (lv <= 1) return base;
    const per = Math.max(1, Math.round(base * 0.1));
    return base + (lv - 1) * per;
  };
  return {
    hp: grow(baseBoost.hp),
    atk: grow(baseBoost.atk),
    def: grow(baseBoost.def),
    spd: grow(baseBoost.spd),
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
      desc += `全体友军共享属性；自身灵体（不造成/不受伤害）；震地眩晕减半。`;
    } else if (skillId === "green_life" && heroHasUnique(hero, "green_life_flow")) {
      desc += `治疗时提升友军伤害。`;
    }
    return { nums, desc };
  }

  if (skillId === "pink_marks") {
    const critPct = 3 + (lv - 1);
    const cdmgPct = 5 + (lv - 1);
    return {
      nums: `击杀叠层 · 暴击+${critPct}%/层 · 暴伤+${cdmgPct}%/层 · 最多5`,
      desc: `本场战斗每击杀一名敌人叠 1 层印记：暴击率+${critPct}%、暴击伤害+${cdmgPct}%，最多 5 层。`,
    };
  }

  if (skillId === "yellow_reflect") {
    const p = getReflectParams(lv);
    const pct = Math.round(p.reflectMult * 100);
    const hasUnique = heroHasUnique(hero, "yellow_reflect_shield");
    const allyRatio = applyReflectAllyUnique(p.allyRatio, hasUnique);
    const enemyFormula = `防御力×${skVal(pct + "%")}×(1+攻击÷防御)（至少${skVal(1)}）`;
    if (!hasUnique) {
      return {
        nums: `反击来源 · ${enemyFormula}`,
        desc: `受伤时，仅对造成伤害的单位造成 ${enemyFormula} 真实伤害（来源为友方时按友方比例结算）。装备唯一强化后改为对全体生效。`,
      };
    }
    let allyText;
    if (allyRatio > 0) {
      allyText = `对友方造成 该伤害×${skVal(Math.round(allyRatio * 100) + "%")}`;
    } else if (allyRatio === 0) {
      allyText = `对友方无溅射`;
    } else {
      allyText = `治疗友方 该伤害×${skVal(Math.round(Math.abs(allyRatio) * 100) + "%")}（至少${skVal(1)}）`;
    }
    const nums =
      allyRatio > 0
        ? `全体 · 敌${enemyFormula} · 友×${skVal(Math.round(allyRatio * 100) + "%")}`
        : allyRatio === 0
          ? `全体 · 敌${enemyFormula} · 友无溅射`
          : `全体 · 敌${enemyFormula} · 友治疗×${skVal(Math.round(Math.abs(allyRatio) * 100) + "%")}`;
    const desc = `受伤时，对全体其他单位生效：敌人 ${enemyFormula}，${allyText}。`;
    return { nums, desc };
  }

  const mods = sumSkillMods(hero?.equip || {});
  const pinkEcho =
    skillId === "pink_burst" && heroHasUnique(hero, "pink_burst_echo");
  const hitScale = hitDamageScale(mods);
  let damageScale = 1;
  let casts = 1;
  if (pinkEcho) {
    damageScale = 0.5 * hitScale;
    casts = 3 + (mods.hitBonus || 0);
  } else if (hitScale !== 1 || mods.hitBonus) {
    // 技能回响：多释放，伤害折入倍率
    damageScale = hitScale;
    casts = Math.max(1, 1 + (mods.hitBonus || 0));
  }

  const uniqueDef = applyUniqueSkillMods(
    hero,
    skillId,
    scaledSkillDef(skillId, lv)
  );
  const { nums, desc } = skillNumsAndDesc(skillId, lv, {
    damageScale,
    casts,
    pinkEcho,
    def: uniqueDef,
    windUnique:
      skillId === "cyan_cut" && heroHasUnique(hero, "cyan_cut_gale"),
    level: lv,
  });
  if (isHealSkill(skillId) && heroHasUnique(hero, "green_mend_pulse")) {
    return {
      nums: `${nums} · 治疗后脉动`,
      desc: `${desc}装备脉动戒：治疗附加 200 行动条脉动（按治疗者行动条：走10流失约治疗量20%真伤，走20按流失×2.5回血）。`,
    };
  }
  return { nums, desc };
}

export function refreshSkillTexts(hero) {
  if (!hero?.skills) return;
  if (!hero.skillLevels) hero.skillLevels = {};
  for (const sk of hero.skills) {
    if (hero.skillLevels[sk.id] == null) {
      hero.skillLevels[sk.id] = Math.max(1, Math.floor(sk.level || 1));
    }
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
  const lv = getBaseSkillLevel(hero, skillId);
  if (lv >= MAX_SKILL_LEVEL) return false;

  hero.skillPoints -= 1;
  const next = lv + 1;
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
      name: "衡印弹",
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
      id: "omni_bless",
      name: "均衡祝福",
      kind: "active",
      style: "buff",
    }),
  ];
}

export function createPinkSkills() {
  const sheet = getCharacterStats("pink");
  return [
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
    {
      id: "pink_marks",
      name: "猎杀印记",
      kind: "passive",
      level: 1,
      nums: "击杀叠层 · 暴击+3%/层 · 暴伤+5%/层 · 最多5",
      desc: "本场战斗每击杀一名敌人叠 1 层印记：暴击率+3%、暴击伤害+5%，最多 5 层。随技能等级提升每层加成。",
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
      nums: "反击来源 · 防御力×10%×(1+攻击÷防御)",
      desc: "受伤时，仅对造成伤害的单位造成 防御力×10%×(1+攻击÷防御) 真实伤害。装备唯一强化后改为对全体生效。",
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

export function createBlueSkills() {
  const sheet = getCharacterStats("blue");
  return [
    makeSkill({
      id: "blue_bolt",
      name: "霜箭",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "blue_nova",
      name: "寒霜环",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "blue_freeze",
      name: "极寒锁",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "blue_veil",
      name: "霜幕",
      kind: "active",
      style: "buff",
    }),
    {
      id: "blue_chill",
      name: "霜骨",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `永久属性：${passiveNums(sheet)}。`,
    },
  ];
}

export function createOrangeSkills() {
  const sheet = getCharacterStats("orange");
  return [
    makeSkill({
      id: "orange_shot",
      name: "烬矢",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "orange_wave",
      name: "灼浪",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "orange_blaze",
      name: "焚焰",
      kind: "active",
      style: "ranged",
    }),
    makeSkill({
      id: "orange_stoke",
      name: "添薪",
      kind: "active",
      style: "buff",
    }),
    {
      id: "orange_ember",
      name: "余烬",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `永久属性：${passiveNums(sheet)}。`,
    },
  ];
}

export function createCyanSkills() {
  const sheet = getCharacterStats("cyan");
  return [
    makeSkill({
      id: "cyan_cut",
      name: "风刃",
      kind: "active",
      style: "buff",
    }),
    makeSkill({
      id: "cyan_tailwind",
      name: "顺风",
      kind: "active",
      style: "buff",
    }),
    makeSkill({
      id: "cyan_gust",
      name: "援风",
      kind: "active",
      style: "buff",
    }),
    {
      id: "cyan_swift",
      name: "迅捷",
      kind: "passive",
      level: 1,
      nums: passiveNums(sheet),
      desc: `永久属性：${passiveNums(sheet)}。`,
    },
    makeSkill({
      id: "cyan_breeze",
      name: "微风",
      kind: "passive",
    }),
  ];
}

const KIT = {
  omni: createOmniSkills,
  pink: createPinkSkills,
  green: createGreenSkills,
  yellow: createYellowSkills,
  blue: createBlueSkills,
  orange: createOrangeSkills,
  cyan: createCyanSkills,
};

export function createHeroSkills(statsId) {
  const fn = KIT[statsId] || createOmniSkills;
  return fn();
}
