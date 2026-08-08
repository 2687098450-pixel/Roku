/**
 * 战斗状态：眩晕 / 减速 / 禁魔 / 减疗 / 增速 / 闪避 / 命中
 * 时长按「行动条」计量（默认 50），与眩晕相同：按速度攒满后解除。
 */

import {
  bossControlEffectMult,
  isSpecialBossFloor,
} from "../monsters/bossKinds.js?v=178";

export const DEFAULT_STATUS_GAUGE = 50;
export const DEFAULT_HIT_RATE = 1;
export const DEFAULT_DODGE_RATE = 0.05;

export const STATUS_META = {
  stun: { label: "眩晕", kind: "debuff" },
  slow: { label: "减速", kind: "debuff", defaultPower: 0.25 },
  silence: { label: "禁魔", kind: "debuff" },
  healCut: { label: "减疗", kind: "debuff", defaultPower: 0.4 },
  haste: { label: "增速", kind: "buff", defaultPower: 0.2 },
  dodgeUp: { label: "闪避↑", kind: "buff", defaultPower: 0.12 },
  hitUp: { label: "命中↑", kind: "buff", defaultPower: 0.1 },
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** @returns {boolean} */
export function hasStatus(unit, id) {
  const st = unit?.statuses?.[id];
  if (!st) return false;
  return (st.remain || 0) > (st.bar || 0);
}

export function isStunned(unit) {
  return hasStatus(unit, "stun") || !!(unit && unit.stun > 0);
}

export function isSilenced(unit) {
  return hasStatus(unit, "silence");
}

export function statusPower(unit, id) {
  if (!hasStatus(unit, id)) return 0;
  return Number(unit.statuses[id].power) || 0;
}

/**
 * @param {object} unit
 * @param {string} id
 * @param {{ gauge?: number, power?: number }} [opts]
 */
export function applyStatus(unit, id, opts = {}) {
  if (!unit || !STATUS_META[id]) return;
  const meta = STATUS_META[id];
  const gauge = Math.max(1, Math.floor(opts.gauge ?? DEFAULT_STATUS_GAUGE));
  const power =
    opts.power != null ? Number(opts.power) : meta.defaultPower != null ? meta.defaultPower : 0;
  if (!unit.statuses) unit.statuses = {};
  const cur = unit.statuses[id];
  const curLeft = cur ? Math.max(0, (cur.remain || 0) - (cur.bar || 0)) : 0;
  if (!cur || gauge >= curLeft) {
    unit.statuses[id] = { remain: gauge, bar: 0, power };
  } else if (power > (cur.power || 0)) {
    cur.power = power;
  }
  if (id === "stun") {
    unit.stun = Math.max(unit.stun || 0, gauge);
    unit.stunBar = 0;
  }
}

/** 兼容旧 applyStun(unit, amount) */
export function applyStun(unit, amount) {
  applyStatus(unit, "stun", {
    gauge: amount != null ? amount : DEFAULT_STATUS_GAUGE,
  });
}

/** 状态条推进；walked 用基础速度，避免减速拖长控制 */
export function tickStatuses(unit, walked) {
  if (!unit?.statuses) {
    if (unit && unit.stun > 0) {
      unit.stunBar = (unit.stunBar || 0) + walked;
      if (unit.stunBar >= unit.stun) {
        unit.stun = 0;
        unit.stunBar = 0;
      }
    }
    return;
  }
  for (const id of Object.keys(unit.statuses)) {
    const st = unit.statuses[id];
    st.bar = (st.bar || 0) + walked;
    if (st.bar >= st.remain) {
      delete unit.statuses[id];
      if (id === "stun") {
        unit.stun = 0;
        unit.stunBar = 0;
      }
    } else if (id === "stun") {
      unit.stun = st.remain;
      unit.stunBar = st.bar;
    }
  }
}

export function effectiveSpd(unit) {
  let spd = Math.max(1, Number(unit?.spd) || 1);
  spd *= 1 - clamp(statusPower(unit, "slow"), 0, 0.85);
  spd *= 1 + Math.max(0, statusPower(unit, "haste"));
  return Math.max(1, Math.floor(spd));
}

export function unitHitRate(unit) {
  return Math.max(
    0,
    (unit?.hitRate != null ? unit.hitRate : DEFAULT_HIT_RATE) + statusPower(unit, "hitUp")
  );
}

export function unitDodgeRate(unit) {
  return Math.max(
    0,
    (unit?.dodgeRate != null ? unit.dodgeRate : DEFAULT_DODGE_RATE) +
      statusPower(unit, "dodgeUp")
  );
}

/** 命中判定：命中率 − 闪避率，下限 5% */
export function rollHit(attacker, defender) {
  const chance = clamp(unitHitRate(attacker) - unitDodgeRate(defender), 0.05, 1);
  return Math.random() < chance;
}

export function healReceivedMult(target) {
  return clamp(1 - statusPower(target, "healCut"), 0, 1);
}

/** 特殊 Boss 技能控制：加强减速/减疗幅度与行动条时长 */
export function amplifyBossSkillApply(source, apply = {}) {
  if (!source?.isBoss || source.isHiddenBoss) return apply;
  if (!apply || !Object.keys(apply).length) return apply;
  const f = source.combatFloor || source.floor || 1;
  if (!isSpecialBossFloor(f)) return apply;
  const amp = bossControlEffectMult(f);
  if (amp === 1) return apply;
  const out = { ...apply };
  if (out.slow != null) out.slow = Math.min(0.72, +(out.slow * amp).toFixed(3));
  if (out.healCut != null) out.healCut = Math.min(0.85, +(out.healCut * amp).toFixed(3));
  const gBoost = f % 10 === 0 ? 1.3 : 1.12;
  if (out.stun) {
    out.stunGauge = Math.floor((out.stunGauge ?? DEFAULT_STATUS_GAUGE) * gBoost);
  }
  if (out.silence) {
    out.silenceGauge = Math.floor((out.silenceGauge ?? DEFAULT_STATUS_GAUGE) * gBoost);
  }
  if (out.slow != null) {
    out.slowGauge = Math.floor((out.slowGauge ?? DEFAULT_STATUS_GAUGE) * gBoost);
  }
  if (out.healCut != null) {
    out.healCutGauge = Math.floor((out.healCutGauge ?? DEFAULT_STATUS_GAUGE) * gBoost);
  }
  return out;
}

/** 技能 / 词条命中后尝试上状态；返回本次施加的控制行动条总量 */
export function tryApplySkillStatuses(source, target, apply = {}, mods = null) {
  if (!target || target.hp <= 0) return 0;
  const roll = (p) => p > 0 && Math.random() < p;
  let ctrl = 0;

  if (apply.stun || (mods?.stunChance && roll(mods.stunChance))) {
    const gauge = apply.stunGauge ?? mods?.stunGauge ?? DEFAULT_STATUS_GAUGE;
    applyStatus(target, "stun", { gauge });
    ctrl += Math.max(1, Math.floor(gauge));
  }
  if (apply.slow != null || (mods?.slowChance && roll(mods.slowChance))) {
    const gauge = apply.slowGauge ?? mods?.slowGauge ?? DEFAULT_STATUS_GAUGE;
    applyStatus(target, "slow", {
      gauge,
      power: apply.slow ?? mods?.slowPower ?? STATUS_META.slow.defaultPower,
    });
    ctrl += Math.max(1, Math.floor(gauge));
  }
  if (apply.silence || (mods?.silenceChance && roll(mods.silenceChance))) {
    const gauge = apply.silenceGauge ?? mods?.silenceGauge ?? DEFAULT_STATUS_GAUGE;
    applyStatus(target, "silence", { gauge });
    ctrl += Math.max(1, Math.floor(gauge));
  }
  if (apply.healCut != null || (mods?.healCutChance && roll(mods.healCutChance))) {
    const gauge = apply.healCutGauge ?? mods?.healCutGauge ?? DEFAULT_STATUS_GAUGE;
    applyStatus(target, "healCut", {
      gauge,
      power: apply.healCut ?? mods?.healCutPower ?? STATUS_META.healCut.defaultPower,
    });
    ctrl += Math.max(1, Math.floor(gauge));
  }
  return ctrl;
}

/** 施法后给自己上增益（装备词条） */
export function tryApplySelfBuffs(unit, mods = null) {
  if (!unit || !mods) return;
  if (mods.selfHaste) {
    applyStatus(unit, "haste", {
      gauge: mods.hasteGauge ?? DEFAULT_STATUS_GAUGE,
      power: mods.selfHaste,
    });
  }
  if (mods.selfDodge) {
    applyStatus(unit, "dodgeUp", {
      gauge: mods.dodgeGauge ?? DEFAULT_STATUS_GAUGE,
      power: mods.selfDodge,
    });
  }
  if (mods.selfHit) {
    applyStatus(unit, "hitUp", {
      gauge: mods.hitGauge ?? DEFAULT_STATUS_GAUGE,
      power: mods.selfHit,
    });
  }
}

/** 12×12 软像素图标（无汉字），风格对齐奶油暖色 UI */
const ST_SVG = {
  stun: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#fff8ee" d="M6 1.2l.55 1.35L8 2.8l-1.2.85.35 1.4L6 4.4 4.85 5.05l.35-1.4L4 2.8l1.45-.25z"/><path fill="#ffe9a8" d="M2.2 7.2l.4 1 .95.15-.7.6.2 1L2.2 9.4l-.85.55.2-1-.7-.6.95-.15z"/><path fill="#ffe9a8" d="M9.8 7.2l.4 1 .95.15-.7.6.2 1L9.8 9.4l-.85.55.2-1-.7-.6.95-.15z"/></svg>`,
  slow: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="#fff8ee" stroke-width="1.15" stroke-linecap="round" d="M6 2.2v3.2L8.2 7"/><circle cx="6" cy="6" r="3.6" fill="none" stroke="#fff8ee" stroke-width="1.15"/><path fill="#c9f3ff" d="M6 9.6l-.7 1.2h1.4z"/></svg>`,
  silence: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#fff8ee" d="M3.2 4.2h2.1L7.2 2.6v6.8L5.3 7.8H3.2z"/><path fill="none" stroke="#ffb4a8" stroke-width="1.3" stroke-linecap="round" d="M2.2 2.4l7.6 7.2"/></svg>`,
  healCut: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#fff8ee" d="M6 10.2C4.2 8.6 2.4 7 2.4 5.1c0-1.2.9-2.1 2.1-2.1.7 0 1.3.3 1.5.8.2-.5.8-.8 1.5-.8 1.2 0 2.1.9 2.1 2.1 0 1.9-1.8 3.5-3.6 5.1z"/><path fill="none" stroke="#ff6b6b" stroke-width="1.25" stroke-linecap="round" d="M2.5 9.5L9.5 2.5"/></svg>`,
  haste: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="#fff8ee" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M2.2 3.2L5.6 6 2.2 8.8M6.2 3.2L9.6 6 6.2 8.8"/></svg>`,
  dodgeUp: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="#fff8ee" stroke-width="1.25" stroke-linecap="round" d="M2.4 8.2c1.6-2.8 3.4-4 7.2-4.4"/><path fill="none" stroke="#c9f3ff" stroke-width="1.15" stroke-linecap="round" d="M7.6 2.6l2.2 1.1-1.4 2"/></svg>`,
  hitUp: `<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.5" fill="none" stroke="#fff8ee" stroke-width="1.15"/><circle cx="6" cy="6" r="1.15" fill="#ffe9a8"/><path fill="none" stroke="#fff8ee" stroke-width="1.1" stroke-linecap="round" d="M6 1.4v1.5M6 9.1v1.5M1.4 6h1.5M9.1 6h1.5"/></svg>`,
  dot: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#d8f3c8" d="M6 1.6c0 0 3.4 3.4 3.4 5.6A3.4 3.4 0 0 1 6 10.6 3.4 3.4 0 0 1 2.6 7.2C2.6 5 6 1.6 6 1.6z"/><circle cx="4.8" cy="6.6" r=".7" fill="#fff8ee" opacity=".7"/></svg>`,
  atkUp: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#fff8ee" d="M7.6 1.6l2.8 2.8-1.1 1.1-2.8-2.8z"/><path fill="#ffe9a8" d="M6.2 3.4l2.4 2.4-4.1 4.1H2.2V7.5z"/><path fill="none" stroke="#ff9f43" stroke-width="1.1" stroke-linecap="round" d="M3.2 8.8l-1 1"/></svg>`,
  defUp: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#fff8ee" d="M6 1.5l3.8 1.4v3.2c0 2.2-1.6 3.6-3.8 4.4-2.2-.8-3.8-2.2-3.8-4.4V2.9z"/><path fill="#c9f3ff" d="M6 2.8l2.4.9v2.2c0 1.4-1 2.3-2.4 2.9-1.4-.6-2.4-1.5-2.4-2.9V3.7z"/></svg>`,
  critUp: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#ffe9a8" d="M6 1.4l1.1 2.4 2.6.3-2 1.8.6 2.5L6 7.1 3.7 8.4l.6-2.5-2-1.8 2.6-.3z"/><path fill="#fff8ee" d="M9.6 2.2l.45 1 .95.1-.7.65.2.95-.9-.5-.9.5.2-.95-.7-.65.95-.1z"/></svg>`,
  mend: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="#fff8ee" d="M5.2 2.4h1.6v2.8h2.8v1.6H6.8v2.8H5.2V6.8H2.4V5.2h2.8z"/><circle cx="6" cy="6" r="4.4" fill="none" stroke="#7ed99a" stroke-width="1"/></svg>`,
};

function stIco(id, kind, title) {
  const svg = ST_SVG[id];
  if (!svg) return "";
  return `<i class="st-ico ${kind} st-${id}" title="${title}" aria-label="${title}">${svg}</i>`;
}

export function statusBadgesHtml(unit) {
  const badges = [];
  if (isStunned(unit)) badges.push(stIco("stun", "debuff", STATUS_META.stun.label));
  for (const id of Object.keys(STATUS_META)) {
    if (id === "stun") continue;
    if (!hasStatus(unit, id)) continue;
    const meta = STATUS_META[id];
    badges.push(stIco(id, meta.kind === "buff" ? "buff" : "debuff", meta.label));
  }
  if (unit?.dots && typeof unit.dots === "object") {
    const active = Object.values(unit.dots).filter(
      (d) => d && ((d.remainSec != null ? d.remainSec : (d.remain || 0) - (d.bar || 0)) > 0)
    );
    if (active.length) {
      badges.push(stIco("dot", "debuff", "持续伤害"));
    }
  } else if (unit?.dot) {
    const left =
      unit.dot.remainSec != null
        ? unit.dot.remainSec
        : (unit.dot.remain || 0) - (unit.dot.bar || 0);
    if (left > 0) badges.push(stIco("dot", "debuff", "持续伤害"));
  }
  if ((unit?.buffTurns || 0) > 0) {
    if ((unit.atkBuff || 0) > 0) badges.push(stIco("atkUp", "buff", "攻击↑"));
    if ((unit.defBuff || 0) > 0) badges.push(stIco("defUp", "buff", "防御↑"));
    if ((unit.critDmgBonus || 0) > 0) badges.push(stIco("critUp", "buff", "暴伤↑"));
  }
  if (unit?.mendPulse && (unit.mendPulse.remain || 0) > (unit.mendPulse.bar || 0)) {
    badges.push(stIco("mend", "buff", "愈合脉冲"));
  }
  if (!badges.length) return "";
  return `<div class="status-badges">${badges.join("")}</div>`;
}
