/**
 * 战斗状态：眩晕 / 减速 / 禁魔 / 减疗 / 增速 / 闪避 / 命中
 * 时长按「行动条」计量（默认 50），与眩晕相同：按速度攒满后解除。
 */

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

/** 技能 / 词条命中后尝试上状态 */
export function tryApplySkillStatuses(source, target, apply = {}, mods = null) {
  if (!target || target.hp <= 0) return;
  const roll = (p) => p > 0 && Math.random() < p;

  if (apply.stun || (mods?.stunChance && roll(mods.stunChance))) {
    applyStatus(target, "stun", {
      gauge: apply.stunGauge ?? mods?.stunGauge ?? DEFAULT_STATUS_GAUGE,
    });
  }
  if (apply.slow != null || (mods?.slowChance && roll(mods.slowChance))) {
    applyStatus(target, "slow", {
      gauge: apply.slowGauge ?? mods?.slowGauge ?? DEFAULT_STATUS_GAUGE,
      power: apply.slow ?? mods?.slowPower ?? STATUS_META.slow.defaultPower,
    });
  }
  if (apply.silence || (mods?.silenceChance && roll(mods.silenceChance))) {
    applyStatus(target, "silence", {
      gauge: apply.silenceGauge ?? mods?.silenceGauge ?? DEFAULT_STATUS_GAUGE,
    });
  }
  if (apply.healCut != null || (mods?.healCutChance && roll(mods.healCutChance))) {
    applyStatus(target, "healCut", {
      gauge: apply.healCutGauge ?? mods?.healCutGauge ?? DEFAULT_STATUS_GAUGE,
      power: apply.healCut ?? mods?.healCutPower ?? STATUS_META.healCut.defaultPower,
    });
  }
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

export function statusBadgesHtml(unit) {
  if (!unit?.statuses && !(unit?.stun > 0) && !unit?.dot) return "";
  const ids = [];
  if (isStunned(unit)) ids.push("stun");
  for (const id of Object.keys(unit.statuses || {})) {
    if (id === "stun") continue;
    if (hasStatus(unit, id)) ids.push(id);
  }
  const badges = ids.map((id) => {
    const meta = STATUS_META[id];
    const cls = meta?.kind === "buff" ? "buff" : "debuff";
    return `<i class="st-badge ${cls}" title="${meta?.label || id}">${(meta?.label || id).slice(0, 1)}</i>`;
  });
  if (unit?.dot && (unit.dot.remain || 0) > (unit.dot.bar || 0)) {
    const pulse = unit.dot.type === "pulse";
    const label = pulse ? "脉动毒" : "行动毒";
    badges.push(
      `<i class="st-badge debuff" title="${label}">毒</i>`
    );
  }
  if (!badges.length) return "";
  return `<div class="status-badges">${badges.join("")}</div>`;
}
