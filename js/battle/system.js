/** 战斗系统：读条、技能、自动循环 */

import { $, clamp, irand } from "../core/utils.js?v=123";
import { playSkillAnim, playReflectSpikes } from "./anim.js?v=123";
import {
  refreshHeroStats,
  skillPower,
  skillHealAmount,
  isHealSkill,
  isBuffSkill,
  scaledSkillDef,
  applyUniqueSkillMods,
  SKILL_POWER,
  nextAutoSkill,
  getBattleFormation,
  FORMATION_COLS,
  activeSkills,
  sumSkillMods,
  heroHasUnique,
  skillMpCost,
  canAffordSkill,
  spendSkillMp,
} from "../characters/omni/index.js?v=123";
import {
  gainExp,
  splitExp,
  getSkillLevel,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
  DEFAULT_HIT_RATE,
  DEFAULT_DODGE_RATE,
  isHeroDead,
} from "../characters/progression.js?v=123";
import {
  refreshSkillTexts,
  calcReflectEnemyDamage,
  getReflectParams,
  applyReflectAllyUnique,
} from "../characters/skills.js?v=123";
import { buildEncounter } from "../monsters/roster.js?v=123";
import {
  pickMonsterSkill,
  monsterSkillDamage,
  monsterDotTickDamage,
  clampMonsterDotGauge,
  PULSE_DOT_INTERVAL,
} from "../monsters/skills.js?v=123";
import { rollBattleLoot } from "../loot/drops.js?v=123";
import {
  GAUGE_MAX,
  getBattleAutoEnabled,
  setBattleAutoEnabled,
} from "../characters/stats.js?v=123";
import { createTicker } from "../core/time.js?v=123";
import { scaleMonsterGoldGain, scaleExpGain } from "../core/economy.js?v=123";
import { unitIconHtml, unitShapeHtml } from "../ui/unitIcon.js?v=123";
import {
  applyStun as applyStunStatus,
  applyStatus,
  isStunned,
  isSilenced,
  rollHit,
  healReceivedMult,
  tryApplySkillStatuses,
  tryApplySelfBuffs,
  tickStatuses,
  effectiveSpd,
  statusBadgesHtml,
  DEFAULT_STATUS_GAUGE,
} from "./status.js?v=123";
import { basicAttackId } from "../characters/omni/autoAttack.js?v=123";

export function createBattleApi(ctx) {
  const {
    getState,
    setMode,
    getHero,
    getDeployed,
    onBattleEnd,
    showExplore,
    hideExplore,
  } = ctx;

  function heroById(id) {
    return getState().party.find((h) => h.id === id) || null;
  }

  function actingHero(unit) {
    return (unit && heroById(unit.id)) || getHero();
  }

  function setBattleButtons(on) {
    document.querySelectorAll(".skill-btn").forEach((b) => {
      if (b.dataset.silenced === "1" || b.dataset.nomp === "1") {
        b.disabled = true;
        return;
      }
      b.disabled = !on;
    });
  }

  function battleUnits(b) {
    return [...b.allies, ...b.enemies];
  }

  function blankCombat() {
    return { dmg: 0, heal: 0, tank: 0, ctrl: 0 };
  }

  function ensureCombat(unit) {
    if (!unit) return blankCombat();
    if (!unit.combat) unit.combat = blankCombat();
    const c = unit.combat;
    if (c.ctrl == null) c.ctrl = 0;
    if (c.dmg == null) c.dmg = 0;
    if (c.heal == null) c.heal = 0;
    if (c.tank == null) c.tank = 0;
    return c;
  }

  function findUnitById(b, id) {
    if (!b || !id) return null;
    return battleUnits(b).find((u) => u.id === id) || null;
  }

  function recordDamage(source, target, amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!n) return;
    if (source) ensureCombat(source).dmg += n;
    if (target) ensureCombat(target).tank += n;
  }

  function recordHeal(source, amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!n || !source) return;
    ensureCombat(source).heal += n;
  }

  /** 控制时长：累计施加的 debuff 行动条（眩晕/减速/禁魔/减疗） */
  function recordControl(source, amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!n || !source) return;
    ensureCombat(source).ctrl += n;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeBattleInfo() {
    $("battleInfoModal")?.classList.add("hidden");
  }

  function biBarPct(val, max) {
    if (!(max > 0) || !(val > 0)) return 0;
    return Math.max(4, Math.min(100, Math.round((val / max) * 100)));
  }

  let battleInfoTab = "dmg";

  function renderBattleInfoRows(units, metricKey, maxVal, allyPeers) {
    if (!units.length) {
      return `<li class="bi-empty-row">暂无</li>`;
    }
    return units
      .slice()
      .sort((a, b) => (b.combat?.[metricKey] || 0) - (a.combat?.[metricKey] || 0))
      .map((u) => {
        const val = ensureCombat(u)[metricKey] || 0;
        const dead = u.hp <= 0;
        const enemy = !u.isHero;
        const peers = enemy ? null : allyPeers;
        return `<li class="bi-row${dead ? " is-dead" : ""}">
          ${unitIconHtml(u, "xs", { enemy, peers })}
          <div class="bi-name">${escapeHtml(u.name || "？")}${dead ? " · 倒下" : ""}</div>
          <div class="bi-bar"><i style="width:${biBarPct(val, maxVal)}%"></i></div>
          <span class="bi-val">${val}</span>
        </li>`;
      })
      .join("");
  }

  function renderBattleInfoPanel() {
    const b = getState().battle;
    const body = $("battleInfoBody");
    if (!b || !body) return;
    const tab = battleInfoTab;
    const units = battleUnits(b);
    for (const u of units) ensureCombat(u);
    const maxVal = units.reduce((m, u) => Math.max(m, u.combat?.[tab] || 0), 0);
    const peers = b.allies || [];
    const tabs = [
      { id: "dmg", label: "伤害" },
      { id: "heal", label: "治疗" },
      { id: "tank", label: "抗伤" },
      { id: "ctrl", label: "控制" },
    ];
    body.innerHTML = `
      <div class="bi-tabs" role="tablist">
        ${tabs
          .map(
            (t) =>
              `<button type="button" class="bi-tab${t.id === tab ? " on" : ""}" data-bi-tab="${t.id}" role="tab" aria-selected="${t.id === tab}">${t.label}</button>`
          )
          .join("")}
      </div>
      <div class="bi-pane bi-pane-${tab}">
        <section class="bi-side">
          <h3 class="bi-side-title">己方</h3>
          <ul class="bi-list">${renderBattleInfoRows(b.allies || [], tab, maxVal, peers)}</ul>
        </section>
        <section class="bi-side">
          <h3 class="bi-side-title">敌方</h3>
          <ul class="bi-list">${renderBattleInfoRows(b.enemies || [], tab, maxVal, peers)}</ul>
        </section>
      </div>`;
    body.querySelectorAll("[data-bi-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        battleInfoTab = btn.dataset.biTab || "dmg";
        renderBattleInfoPanel();
      });
    });
  }

  function openBattleInfo() {
    const b = getState().battle;
    const modal = $("battleInfoModal");
    if (!b || !modal) return;
    if (!["dmg", "heal", "tank", "ctrl"].includes(battleInfoTab)) battleInfoTab = "dmg";
    renderBattleInfoPanel();
    modal.classList.remove("hidden");
  }

  function livingEnemies(b) {
    return b.enemies.filter((e) => e.hp > 0);
  }

  function livingAllies(b) {
    return b.allies.filter((a) => a.hp > 0);
  }

  /** 可被敌人锁定的友军（灵体除外） */
  function targetableAllies(b) {
    return livingAllies(b).filter((a) => !a.spiritForm);
  }

  /** 非灵体友军；灵体战中若这些人全灭则失败 */
  function mortalAllies(b) {
    return livingAllies(b).filter((a) => !a.spiritForm);
  }

  function frontEnemies(b) {
    return livingEnemies(b).filter((e) => e.row === "front");
  }

  function frontAllies(b) {
    return targetableAllies(b).filter((a) => a.row === "front");
  }

  /** 敌方优先前排 → 中排 → 后排 */
  function preferredEnemies(b) {
    const front = frontEnemies(b);
    if (front.length) return front;
    const mid = livingEnemies(b).filter((e) => e.row === "mid");
    if (mid.length) return mid;
    return livingEnemies(b);
  }

  function pickRandomFront(b) {
    const list = preferredEnemies(b);
    if (!list.length) return null;
    return list[irand(0, list.length - 1)];
  }

  /** 敌人优先打前排 → 中排 → 后排；无视灵体 */
  function pickAllyTarget(b) {
    const front = frontAllies(b);
    if (front.length) return front[irand(0, front.length - 1)];
    const mid = targetableAllies(b).filter((a) => a.row === "mid");
    if (mid.length) return mid[irand(0, mid.length - 1)];
    const pool = targetableAllies(b);
    if (!pool.length) return null;
    return pool[irand(0, pool.length - 1)];
  }

  function pickLowestEnemy(b) {
    const list = livingEnemies(b);
    if (!list.length) return null;
    return list
      .slice()
      .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.hp - c.hp)[0];
  }

  function isCrossNeighbor(a, b) {
    if (!a || !b) return false;
    const rank = { front: 0, mid: 1, back: 2 };
    if (a.row === b.row) return Math.abs(a.col - b.col) === 1;
    if (a.col !== b.col) return false;
    const ra = rank[a.row];
    const rb = rank[b.row];
    if (ra == null || rb == null) return false;
    return Math.abs(ra - rb) === 1;
  }

  function renderLane(el, units, enemy, peers = null) {
    if (!el) return;
    const cells = Array.from({ length: FORMATION_COLS }, (_, col) => {
      const u = units.find((x) => x.col === col && x.hp > 0);
      if (!u) return `<div class="battle-unit spacer" data-col="${col}" aria-hidden="true"></div>`;
      return unitHtml(u, enemy, peers);
    });
    el.innerHTML = cells.join("");
  }

  function crossTargets(b, center) {
    return livingEnemies(b).filter((e) => {
      if (e.row !== center.row) return false;
      return Math.abs(e.col - center.col) <= 1;
    });
  }

  /** 友军：目标十字（中心 + 正交邻格） */
  function allyCrossTargets(b, center) {
    if (!center) return [];
    return targetableAllies(b).filter((a) => a.id === center.id || isCrossNeighbor(center, a));
  }

  function allyRowTargets(b, center) {
    if (!center) return [];
    return targetableAllies(b).filter((a) => a.row === center.row);
  }

  function allyColTargets(b, center) {
    if (!center) return [];
    return targetableAllies(b).filter((a) => a.col === center.col);
  }

  /** 怪物技能目标选取 */
  function pickEnemySkillTargets(b, skill) {
    if (skill.hitAll) return targetableAllies(b);
    if (skill.hitFront) {
      const front = frontAllies(b);
      return front.length ? front : targetableAllies(b);
    }
    const primary = pickAllyTarget(b);
    if (!primary) return [];
    if (skill.hitCross) return allyCrossTargets(b, primary);
    if (skill.hitRow) return allyRowTargets(b, primary);
    if (skill.hitCol) return allyColTargets(b, primary);
    return [primary];
  }

  function applyMonsterDot(target, caster, skill) {
    const def = skill?.dot;
    if (!def || !target || target.hp <= 0) return;
    const type = def.type === "pulse" ? "pulse" : "onAct";
    target.dot = {
      type,
      tickDmg: monsterDotTickDamage(caster?.atk || 0, { ...def, type }),
      remain: clampMonsterDotGauge({ ...def, type }),
      bar: 0,
      walk: 0,
      interval: type === "pulse" ? def.interval || PULSE_DOT_INTERVAL : 0,
      sourceId: caster?.id || null,
    };
  }

  function advanceUnitDot(b, unit, walked) {
    const d = unit?.dot;
    if (!d || unit.hp <= 0) {
      if (unit) unit.dot = null;
      return;
    }
    d.bar = (d.bar || 0) + walked;
    if (d.type === "pulse") {
      d.walk = (d.walk || 0) + walked;
      const interval = d.interval || PULSE_DOT_INTERVAL;
      while (d.walk >= interval) {
        d.walk -= interval;
        const src = findUnitById(b, d.sourceId);
        dealDamage(unit, d.tickDmg, { source: src || null });
        if (unit.hp <= 0) break;
      }
    }
    if (d.bar >= d.remain) unit.dot = null;
  }

  /** 行动时持续：出手瞬间跳伤 */
  function triggerActDot(b, unit) {
    const d = unit?.dot;
    if (!d || d.type !== "onAct" || unit.hp <= 0) return;
    const src = findUnitById(b, d.sourceId);
    dealDamage(unit, d.tickDmg, { source: src || null });
  }

  const SKILL_ICON = {
    attack: "斩",
    radiant: "印",
    quake: "震",
    omni_bless: "衡",
    pink_burst: "爆",
    pink_barrage: "雨",
    pink_fervor: "燃",
    pink_marks: "印",
    green_bolt: "叶",
    green_mend: "愈",
    green_bloom: "芽",
    yellow_hit: "盾",
    yellow_slam: "猛",
    yellow_fortify: "壁",
    blue_bolt: "霜",
    blue_nova: "环",
    blue_freeze: "锁",
    blue_veil: "幕",
    orange_shot: "烬",
    orange_wave: "浪",
    orange_blaze: "焚",
    orange_stoke: "薪",
    cyan_cut: "刃",
    cyan_tailwind: "风",
    cyan_gust: "迅",
  };

  function updateBattleSkillButtons(unit) {
    const hero = actingHero(unit);
    const box = $("battleActions");
    if (!box || !hero) return;
    const actives = activeSkills(hero);
    const silenced = isSilenced(unit);
    const basicId = basicAttackId(hero);
    box.innerHTML = actives
      .map((sk) => {
        const icon = SKILL_ICON[sk.id] || "技";
        const cls =
          sk.style === "heal"
            ? "skill-btn skill heal"
            : sk.style === "buff"
              ? "skill-btn skill buff"
              : "skill-btn skill";
        const cost = skillMpCost(hero, sk.id);
        const noMp = cost > 0 && !canAffordSkill(hero, sk.id);
        const locked = silenced && sk.id !== basicId;
        const blocked = locked || noMp;
        const tip = locked
          ? "禁魔中：仅可普通攻击"
          : noMp
            ? `蓝不足（需要 ${cost}）`
            : cost > 0
              ? `耗蓝 ${cost}`
              : "不耗蓝";
        return `<button type="button" class="${cls}${blocked ? " silenced" : ""}" data-skill="${sk.id}"${locked ? ' data-silenced="1"' : ""}${noMp ? ' data-nomp="1"' : ""} disabled title="${tip}">
          <span class="skill-icon" data-kind="${sk.id}">${icon}</span>
          <span class="skill-name">${sk.name}</span>
          ${cost > 0 ? `<span class="skill-mp">${cost}</span>` : ""}
        </button>`;
      })
      .join("");
  }

  function effectiveAtk(unit) {
    return Math.max(1, Math.floor((unit.atk || 0) * (1 + (unit.atkBuff || 0))));
  }

  function effectiveDef(unit) {
    return Math.max(0, Math.floor((unit.def || 0) * (1 + (unit.defBuff || 0))));
  }

  /**
   * 攻防结算：伤害 = atk² / (atk + def)，至少 1
   * （与 atk×atk/(atk+def) 相同）
   */
  function mitigatedDamage(power, def) {
    const atk = Math.max(0, Number(power) || 0);
    const d = Math.max(0, Number(def) || 0);
    if (atk <= 0) return 1;
    return Math.max(1, Math.floor((atk * atk) / (atk + d)));
  }

  function unitCritRate(unit) {
    const stacks = Math.max(0, Math.min(5, unit.killStacks || 0));
    const hero = unit?.isHero ? actingHero(unit) : null;
    const markLv = hero?.statsId === "pink" ? getSkillLevel(hero, "pink_marks") : 1;
    const per = 0.03 + Math.max(0, markLv - 1) * 0.01;
    return Math.min(0.85, (unit.critRate ?? DEFAULT_CRIT_RATE) + stacks * per);
  }

  function unitCritDmg(unit) {
    const stacks = Math.max(0, Math.min(5, unit.killStacks || 0));
    const hero = unit?.isHero ? actingHero(unit) : null;
    const markLv = hero?.statsId === "pink" ? getSkillLevel(hero, "pink_marks") : 1;
    const per = 0.05 + Math.max(0, markLv - 1) * 0.01;
    return (unit.critDmg ?? DEFAULT_CRIT_DMG) + (unit.critDmgBonus || 0) + stacks * per;
  }

  function notePinkKill(source) {
    if (!source?.isHero) return;
    const hero = actingHero(source);
    if (hero?.statsId !== "pink") return;
    source.killStacks = Math.min(5, (source.killStacks || 0) + 1);
  }

  function tickUnitBuffs(unit) {
    if (!unit || !(unit.buffTurns > 0)) return;
    unit.buffTurns -= 1;
    if (unit.buffTurns <= 0) {
      unit.atkBuff = 0;
      unit.defBuff = 0;
      unit.critDmgBonus = 0;
      unit.buffTurns = 0;
    }
  }

  function unitHtml(u, enemy, peers = null) {
    const pct = clamp((u.hp / u.maxHp) * 100, 0, 100);
    const g = clamp((u.gauge / GAUGE_MAX) * 100, 0, 100);
    const mpPct =
      !enemy && u.maxMp > 0
        ? clamp(((u.mp || 0) / u.maxMp) * 100, 0, 100)
        : 0;
    const ready = u.gauge >= GAUGE_MAX ? " ready" : "";
    const stunned = isStunned(u);
    const stunCls = stunned ? " stun" : "";
    const side = enemy ? "enemy" : "ally";
    const bossCls = u.isBoss ? " boss-unit" : "";
    const spiritCls = u.spiritForm ? " spirit-form" : "";
    const kind = u.kind || u.type || "";
    const stunMark = `<div class="stun-mark"${stunned ? "" : " hidden"} title="眩晕" aria-label="眩晕"><span>★</span><span>★</span><span>★</span></div>`;

    let artCls = "";
    let shapeHtml;
    if (enemy) {
      shapeHtml = unitShapeHtml(u, "md", { enemy: true });
      if (shapeHtml.includes("monster-art")) artCls = " has-monster-art";
    } else {
      shapeHtml = unitShapeHtml(u, "md", { peers });
    }

    const mpBar = enemy
      ? ""
      : `<div class="unit-mp"><i data-mp="${u.id}" style="width:${mpPct}%"></i></div>`;

    return `<div class="battle-unit ${side}${ready}${stunCls}${bossCls}${spiritCls}${artCls}" data-id="${u.id}" data-col="${u.col ?? 1}" data-kind="${kind}">
      <div class="unit-float">
        <div class="unit-hp"><i style="width:${pct}%"></i></div>
        ${mpBar}
        <div class="unit-atb"><i data-gauge="${u.id}" style="width:${g}%"></i></div>
        ${statusBadgesHtml(u)}
      </div>
      <div class="shape-wrap" data-wrap="${u.id}">
        ${stunMark}
        ${shapeHtml}
        <div class="unit-shadow"></div>
      </div>
    </div>`;
  }

  function updateGaugeBars(b) {
    for (const u of battleUnits(b)) {
      if (u.hp <= 0) continue;
      const el = document.querySelector(`[data-gauge="${u.id}"]`);
      if (el) el.style.width = `${clamp((u.gauge / GAUGE_MAX) * 100, 0, 100)}%`;
      if (u.isHero && u.maxMp > 0) {
        const mpEl = document.querySelector(`[data-mp="${u.id}"]`);
        if (mpEl) {
          mpEl.style.width = `${clamp(((u.mp || 0) / u.maxMp) * 100, 0, 100)}%`;
        }
      }
      const unit = document.querySelector(`.battle-unit[data-id="${u.id}"]`);
      if (unit) {
        const stunned = isStunned(u);
        unit.classList.toggle("ready", u.gauge >= GAUGE_MAX && !stunned);
        unit.classList.toggle("stun", stunned);
        const mark = unit.querySelector(".stun-mark");
        if (mark) mark.hidden = !stunned;
      }
    }
  }

  function renderBattle(b) {
    const allyPeers = b.allies;
    const backUnits = b.enemies.filter((e) => e.row === "back");
    const midUnits = b.enemies.filter((e) => e.row === "mid");
    const frontUnits = b.enemies.filter((e) => e.row === "front");
    const midAlive = midUnits.some((e) => e.hp > 0);
    const backAlive = backUnits.some((e) => e.hp > 0);
    const midEl = $("enemyMid");
    if (midEl) midEl.classList.toggle("is-empty", !midAlive);
    const backEl = $("enemyBack");
    if (backEl) backEl.classList.toggle("is-empty", !backAlive);
    const frontEl = $("enemyFront");
    if (frontEl) frontEl.classList.toggle("solo-row", !backAlive && !midAlive);

    renderLane($("enemyBack"), backUnits, true, null);
    renderLane($("enemyMid"), midUnits, true, null);
    renderLane($("enemyFront"), frontUnits, true, null);
    renderLane(
      $("allyFront"),
      b.allies.filter((a) => a.row === "front"),
      false,
      allyPeers
    );
    renderLane(
      $("allyMid"),
      b.allies.filter((a) => a.row === "mid"),
      false,
      allyPeers
    );
    renderLane(
      $("allyBack"),
      b.allies.filter((a) => a.row === "back"),
      false,
      allyPeers
    );
    updateGaugeBars(b);
  }

  function dealDamage(target, power, opts = {}) {
    if (!target || target.hp <= 0) return 0;
    if (target.spiritForm) return 0;
    if (!opts.trueDamage && !opts.skipHitCheck && opts.source) {
      if (!rollHit(opts.source, target)) {
        const unit = document.querySelector(`.battle-unit[data-id="${target.id}"]`);
        if (unit) {
          unit.classList.remove("hit", "crit", "miss");
          void unit.offsetWidth;
          unit.classList.add("miss");
        }
        return 0;
      }
    }
    let raw;
    if (opts.trueDamage) {
      raw = Math.max(1, Math.floor(power));
    } else {
      raw = Math.max(1, mitigatedDamage(power, effectiveDef(target)) + irand(-1, 2));
    }
    let crit = false;
    if (opts.canCrit) {
      const rate = opts.critRate ?? DEFAULT_CRIT_RATE;
      const dmg = opts.critDmg ?? DEFAULT_CRIT_DMG;
      if (Math.random() < rate) {
        crit = true;
        raw = Math.max(1, Math.floor(raw * dmg));
      }
    }
    target.hp = Math.max(0, target.hp - raw);
    recordDamage(opts.source || null, target, raw);
    if (target.hp <= 0 && opts.source && opts.source.id !== target.id) {
      notePinkKill(opts.source);
    }
    const unit = document.querySelector(`.battle-unit[data-id="${target.id}"]`);
    if (unit) {
      unit.classList.remove("hit", "crit", "miss");
      void unit.offsetWidth;
      unit.classList.add(crit ? "crit" : "hit");
    }
    if (!opts.fromReflect && !opts.skipReflect && raw > 0) {
      triggerReflect(target, opts.source || null);
    }
    return raw;
  }

  function reflectBaseDamage(victim) {
    const hero = actingHero(victim);
    const lv = getSkillLevel(hero, "yellow_reflect");
    const def = Math.max(1, effectiveDef(victim));
    const atk = Math.max(0, effectiveAtk(victim));
    return calcReflectEnemyDamage(atk, def, lv);
  }

  function triggerReflect(victim, source = null) {
    const b = getState().battle;
    if (!b || !victim?.isHero) return;
    const hero = actingHero(victim);
    if (!hero?.skills?.some((s) => s.id === "yellow_reflect")) return;
    const lv = getSkillLevel(hero, "yellow_reflect");
    const p = getReflectParams(lv);
    const hasUnique = heroHasUnique(hero, "yellow_reflect_shield");
    let allyRatio = applyReflectAllyUnique(p.allyRatio, hasUnique);
    const enemyDmg = reflectBaseDamage(victim);
    /** @type {{ id: string, opacity: number }[]} */
    const fxHits = [];

    const units = battleUnits(b).filter(
      (u) => u && u.hp > 0 && u.id !== victim.id
    );
    /** 默认只打伤害来源；唯一强化后打全场 */
    const targets = hasUnique
      ? units
      : units.filter((u) => source && u.id === source.id);

    /** 友军飞针透明度：伤害/治疗比例越低越透明，仍可见 */
    const allyFxOpacity = (ratio) => {
      const r = Math.abs(Number(ratio) || 0);
      return Math.max(0.22, Math.min(0.85, 0.18 + r * 0.95));
    };

    for (const u of targets) {
      const isAlly = !!u.isHero;
      if (!isAlly) {
        dealDamage(u, enemyDmg, {
          fromReflect: true,
          trueDamage: true,
          source: victim,
        });
        fxHits.push({ id: u.id, opacity: 1 });
        continue;
      }
      if (allyRatio > 0) {
        const allyDmg = Math.max(1, Math.floor(enemyDmg * allyRatio));
        dealDamage(u, allyDmg, {
          fromReflect: true,
          trueDamage: true,
          source: victim,
        });
        fxHits.push({ id: u.id, opacity: allyFxOpacity(allyRatio) });
      } else if (allyRatio < 0) {
        const healAmt = Math.max(1, Math.floor(enemyDmg * Math.abs(allyRatio)));
        applyHeal(u, healAmt, { source: victim });
        applyMendPulse(b, victim, u, healAmt);
        fxHits.push({ id: u.id, opacity: allyFxOpacity(allyRatio) });
      }
    }
    if (fxHits.length) playReflectSpikes(victim.id, fxHits);
    syncHeroHp(b);
  }

  function heroStrike(attacker, target, skillId, mods, damageScale = 1) {
    if (attacker?.spiritForm) return 0;
    const hero = actingHero(attacker);
    const lv = getSkillLevel(hero, skillId);
    const def = applyUniqueSkillMods(
      hero,
      skillId,
      scaledSkillDef(skillId, lv) || SKILL_POWER[skillId]
    );
    const scale =
      (damageScale || 1) *
      (mods?.hitDamageMult != null ? mods.hitDamageMult : 1);
    const power = Math.max(
      1,
      Math.floor(skillPower(effectiveAtk(attacker), skillId, mods, lv) * scale)
    );
    const dealt = dealDamage(target, power, {
      canCrit: true,
      critRate: unitCritRate(attacker),
      critDmg: unitCritDmg(attacker),
      source: attacker,
    });
    if (dealt > 0) {
      recordControl(
        attacker,
        tryApplySkillStatuses(attacker, target, def?.apply || {}, mods)
      );
      if (def?.dot) applyMonsterDot(target, attacker, { dot: def.dot });
      applySelfRecoil(attacker, dealt, def);
    }
    return dealt;
  }

  /** 小黄盾击等：命中后对自身造成少量真实伤害（可触发反伤） */
  function applySelfRecoil(attacker, dealt, def) {
    const pct = def?.selfRecoilPct;
    if (!attacker || !(pct > 0) || !(dealt > 0)) return 0;
    if (attacker.spiritForm || attacker.hp <= 0) return 0;
    const selfDmg = Math.max(1, Math.floor(dealt * pct));
    return dealDamage(attacker, selfDmg, {
      trueDamage: true,
      skipHitCheck: true,
      source: attacker,
    });
  }

  /** 强化爆裂矢：3+回响 段，每段写入倍率的半伤（再乘回响 60%），击杀额外 +1 段 */
  async function resolvePinkBurstEcho(b, ally, skillId, mods, skillLv, fxMeta) {
    const hitScale = mods?.hitDamageMult != null ? mods.hitDamageMult : 1;
    const damageScale = 0.5 * hitScale;
    const shotPower = Math.max(
      1,
      Math.floor(skillPower(effectiveAtk(ally), skillId, mods, skillLv) * damageScale)
    );
    let remaining = 3 + (mods.hitBonus || 0);
    while (remaining > 0) {
      const t = pickLowestEnemy(b);
      if (!t) break;
      remaining -= 1;
      await playSkillAnim("ranged", ally.id, t.id, {
        ...fxMeta,
        shotDuration: 160,
      });
      const dealt = dealDamage(t, shotPower, {
        canCrit: true,
        critRate: unitCritRate(ally),
        critDmg: unitCritDmg(ally),
        source: ally,
      });
      if (dealt > 0) {
        const def = applyUniqueSkillMods(
          actingHero(ally),
          skillId,
          scaledSkillDef(skillId, skillLv) || SKILL_POWER[skillId]
        );
        recordControl(ally, tryApplySkillStatuses(ally, t, def?.apply || {}, mods));
        if (def?.dot) applyMonsterDot(t, ally, { dot: def.dot });
      }
      if (t.hp <= 0) remaining += 1;
      renderBattle(b);
    }
  }

  function applyHeal(target, amount, opts = {}) {
    const before = target.hp;
    const scaled = Math.max(0, Math.floor(amount * healReceivedMult(target)));
    target.hp = Math.min(target.maxHp, target.hp + scaled);
    const healed = target.hp - before;
    if (healed > 0) recordHeal(opts.source || null, healed);
    const unit = document.querySelector(`.battle-unit[data-id="${target.id}"]`);
    if (unit) {
      unit.classList.remove("healed");
      void unit.offsetWidth;
      unit.classList.add("healed");
    }
    return healed;
  }

  function pickLowestAlly(b) {
    const list = livingAllies(b);
    if (!list.length) return null;
    return list.slice().sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  }

  function applyLifeFlowBuff(b, healer) {
    const hero = actingHero(healer);
    if (!heroHasUnique(hero, "green_life_flow")) return;
    for (const a of livingAllies(b)) {
      a.atkBuff = Math.max(a.atkBuff || 0, 0.22);
      a.buffTurns = Math.max(a.buffTurns || 0, 2);
    }
  }

  /** 治愈戒：任意治疗后附加 200 行动条脉动（按治疗者行动条推进） */
  function applyMendPulse(b, healer, target, healedAmount) {
    const hero = actingHero(healer);
    if (!heroHasUnique(hero, "green_mend_pulse") || !target || !healer) return;
    const tickDmg = Math.max(1, Math.floor(Math.max(1, healedAmount) * 0.2));
    target.mendPulse = {
      remain: 200,
      bar: 0,
      walk: 0,
      lostThisCycle: false,
      lastLost: 0,
      tickDmg,
      healerId: healer.id,
    };
  }

  /** 治疗者走行动条时，推进其施加的所有愈合脉冲 */
  function advanceMendPulsesFromHealer(b, healer, walked) {
    if (!healer?.id || !(walked > 0)) return;
    for (const u of battleUnits(b)) {
      if (u?.mendPulse?.healerId === healer.id) {
        advanceMendPulse(b, u, walked);
      }
    }
  }

  function advanceMendPulse(b, unit, walked) {
    const p = unit?.mendPulse;
    if (!p || unit.hp <= 0) {
      if (unit) unit.mendPulse = null;
      return;
    }
    const healer = findUnitById(b, p.healerId);
    if (!healer || healer.hp <= 0) {
      unit.mendPulse = null;
      return;
    }
    p.bar = (p.bar || 0) + walked;
    if (p.bar >= (p.remain || 200)) {
      unit.mendPulse = null;
      return;
    }
    p.walk += walked;
    if (p.walk >= 10 && !p.lostThisCycle) {
      const lost = dealDamage(unit, p.tickDmg, {
        fromReflect: true,
        trueDamage: true,
      });
      p.lastLost = lost || p.tickDmg;
      p.lostThisCycle = true;
    }
    if (p.walk >= 20) {
      const healAmt = Math.max(1, Math.floor(p.lastLost * 2.5));
      applyHeal(unit, healAmt, { source: healer || null });
      p.walk -= 20;
      p.lostThisCycle = false;
      p.lastLost = 0;
    }
  }

  /** 均衡灵衡：十字友军共享被动；自身灵体化 */
  function applyBalanceSpiritEffects(b) {
    for (const ally of b.allies) {
      const hero = heroById(ally.id);
      if (!heroHasUnique(hero, "omni_balance_spirit")) continue;
      ally.spiritForm = true;
      const boost = hero.passiveBoost || {};
      for (const other of b.allies) {
        if (other.id === ally.id) continue;
        if (!isCrossNeighbor(ally, other)) continue;
        other.atk += boost.atk || 0;
        other.def += boost.def || 0;
        other.spd += boost.spd || 0;
        if (boost.hp) {
          other.maxHp += boost.hp;
          other.hp = Math.min(other.maxHp, other.hp + boost.hp);
        }
      }
    }
  }

  function syncHeroHp(b) {
    for (const ally of b.allies) {
      const hero = heroById(ally.id);
      if (!hero) continue;
      hero.hp = Math.max(0, ally.hp);
      if (ally.mp != null) hero.mp = Math.max(0, ally.mp);
    }
  }

  function afterBattleHeal() {
    const list = (getDeployed ? getDeployed() : [getHero()]).filter(
      (h) => h && !isHeroDead(h) && h.hp > 0
    );
    let total = 0;
    let partyHealed = false;

    for (const hero of list) {
      const hasParty =
        hero.skills?.some((s) => s.id === "green_aftercare" || s.id === "cyan_breeze");
      if (hasParty && !partyHealed) {
        const sid = hero.skills.some((s) => s.id === "green_aftercare")
          ? "green_aftercare"
          : "cyan_breeze";
        const lv = getSkillLevel(hero, sid);
        const def = scaledSkillDef(sid, lv) || SKILL_POWER[sid];
        const ratio = def.healRatio || 0.2;
        for (const h of list) {
          const heal = Math.floor(h.maxHp * ratio);
          const before = h.hp;
          h.hp = Math.min(h.maxHp, h.hp + heal);
          total += h.hp - before;
        }
        partyHealed = true;
        continue;
      }
      const hasSelf = hero.skills?.some((s) => s.id === "aftercare");
      if (hasSelf) {
        const lv = getSkillLevel(hero, "aftercare");
        const def = scaledSkillDef("aftercare", lv) || SKILL_POWER.aftercare;
        const heal = Math.floor(hero.maxHp * (def.healRatio || 0.25));
        const before = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + heal);
        total += hero.hp - before;
      }
    }
    return total;
  }

  /** 战后标记阵亡（hp≤0）；存活者清除 dead */
  function syncHeroDeathFlags(b) {
    for (const ally of b.allies) {
      const hero = heroById(ally.id);
      if (!hero) continue;
      if (ally.hp <= 0) {
        hero.hp = 0;
        hero.dead = true;
      } else {
        hero.dead = false;
        hero.hp = ally.hp;
      }
    }
  }

  function grantBattleExp(b) {
    const totalExp = (b.enemies || []).reduce((s, e) => s + (e.exp || 0), 0);
    const list = (getDeployed ? getDeployed() : [getHero()]).filter(
      (h) => h && !isHeroDead(h) && h.hp > 0
    );
    if (!list.length || !totalExp) {
      return { totalExp: 0, share: 0, levelUps: [] };
    }
    const share = splitExp(totalExp, list.length);
    const levelUps = [];
    for (const hero of list) {
      const beforeLv = hero.level || 1;
      const result = gainExp(hero, share);
      if (result.leveled) {
        const ratio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
        refreshHeroStats(hero);
        hero.hp = Math.min(hero.maxHp, Math.max(1, Math.ceil(hero.maxHp * ratio)));
        refreshSkillTexts(hero);
        levelUps.push({
          name: hero.name,
          from: beforeLv,
          to: hero.level,
          skillPoints: hero.skillPoints,
        });
      }
    }
    return {
      totalExp: scaleExpGain(totalExp),
      share: scaleExpGain(share),
      levelUps,
    };
  }

  /** 击杀金币；Boss 额外 +1 钻石 */
  function grantBattleCurrency(b) {
    const state = getState();
    let gold = 0;
    let gems = 0;
    for (const e of b.enemies || []) {
      gold += e.gold || Math.max(1, Math.round((e.exp || 10) * 0.45));
      if (e.isBoss) gems += 1;
    }
    gold = scaleMonsterGoldGain(gold);
    state.gold = (state.gold || 0) + gold;
    if (gems) state.gem = (state.gem || 0) + gems;
    return { gold, gems };
  }

  function canUseSkill(b, skillId, hero = null) {
    const def = SKILL_POWER[skillId];
    if (!def) return false;
    if (hero && !canAffordSkill(hero, skillId)) return false;
    if (isBuffSkill(skillId)) return true;
    if (isHealSkill(skillId)) return livingAllies(b).length > 0;
    if (def.hitAllFront || def.stunGauge || def.stunTurns) {
      return livingEnemies(b).length > 0;
    }
    if (skillId === "gnaw") return livingAllies(b).length > 0;
    return !!pickRandomFront(b) || livingEnemies(b).length > 0;
  }

  function firstUsableSkill(b, hero) {
    const ally = b.allies?.find((a) => a.id === hero?.id);
    if (ally && isSilenced(ally)) {
      const basic = basicAttackId(hero);
      if (canUseSkill(b, basic, hero)) return basic;
    }
    const actives = activeSkills(hero);
    for (const sk of actives) {
      if (canUseSkill(b, sk.id, hero)) return sk.id;
    }
    const basic = basicAttackId(hero);
    if (canUseSkill(b, basic, hero)) return basic;
    return null;
  }

  function syncWorldHp(b) {
    for (const foe of b.enemies) {
      if (!foe.worldRef) continue;
      foe.worldRef.hp = Math.max(0, foe.hp);
    }
  }

  function endBattle(result) {
    const state = getState();
    const b = state.battle;
    if (!b || b.ending) return;
    b.ending = true;
    b.busy = true;
    closeBattleInfo();
    syncHeroHp(b);
    syncWorldHp(b);
    syncHeroDeathFlags(b);
    afterBattleHeal();
    const pack = b.enemies.map((e) => e.worldRef).filter(Boolean);

    if (result === "win") {
      const expInfo = grantBattleExp(b);
      const currency = grantBattleCurrency(b);
      // 只移除撞到的那只地图怪
      const ids = new Set(pack.map((m) => m.id));
      state.monsters = state.monsters.filter((m) => !ids.has(m.id));
      const loot = rollBattleLoot(pack);
      if (loot.length) {
        if (!state.inventory) state.inventory = [];
        state.inventory.push(...loot);
      }
      onBattleEnd?.("win", pack, loot, { ...expInfo, ...currency });
    } else if (result === "flee") {
      // 逃跑：阵亡保留，存活者保持当前血量
      onBattleEnd?.("flee", pack);
    } else if (result === "lose") {
      // 全灭：阵亡需金币复活，不再自动回血
      onBattleEnd?.("lose", pack);
    }

    setTimeout(() => {
      state.battle = null;
      setMode("explore");
      $("battle").classList.add("hidden");
      showExplore();
      const fx = $("fxLayer");
      if (fx) fx.innerHTML = "";
    }, 120);
  }

  async function resolveHeroSkill(b, ally, skillId, opts = {}) {
    const hero = actingHero(ally);
    let used = skillId;
    if (isSilenced(ally) && used !== basicAttackId(hero)) {
      used = basicAttackId(hero);
    }
    if (!canUseSkill(b, used, hero)) used = firstUsableSkill(b, hero);
    if (isSilenced(ally)) {
      const basic = basicAttackId(hero);
      if (canUseSkill(b, basic, hero)) used = basic;
    }
    if (!used || !canUseSkill(b, used, hero)) return false;

    const skillLv = getSkillLevel(hero, used);
    const def = applyUniqueSkillMods(
      hero,
      used,
      scaledSkillDef(used, skillLv) || SKILL_POWER[used]
    );
    const style = def.style || "melee";
    const mods = sumSkillMods(hero?.equip);
    const hits = Math.max(1, 1 + (mods.hitBonus || 0));

    const fxMeta = {
      skillId: used,
      statsId: hero?.statsId || "",
      color: hero?.color || ally.color || "",
    };
    if (isHealSkill(used) && heroHasUnique(hero, "green_spring_bloom")) {
      fxMeta.shotDuration = 95;
    }

    tryApplySelfBuffs(ally, mods);

    let appliedBuff = false;
    if (isBuffSkill(used)) {
      const applyBuffTo = (unit) => {
        if (!unit || unit.hp <= 0) return;
        if (def.atkMult) unit.atkBuff = Math.max(unit.atkBuff || 0, def.atkMult || 0);
        if (def.critDmgBonus) {
          unit.critDmgBonus = Math.max(unit.critDmgBonus || 0, def.critDmgBonus || 0);
        }
        if (def.defMult) unit.defBuff = Math.max(unit.defBuff || 0, def.defMult || 0);
        unit.buffTurns = Math.max(unit.buffTurns || 0, def.turns || 3);
        if (def.hastePower) {
          applyStatus(unit, "haste", {
            gauge: def.hasteGauge ?? DEFAULT_STATUS_GAUGE,
            power: def.hastePower,
          });
        }
        if (def.dodgePower) {
          applyStatus(unit, "dodgeUp", {
            gauge: def.dodgeGauge ?? DEFAULT_STATUS_GAUGE,
            power: def.dodgePower,
          });
        }
        if (def.hitUpPower) {
          applyStatus(unit, "hitUp", {
            gauge: def.hitUpGauge ?? DEFAULT_STATUS_GAUGE,
            power: def.hitUpPower,
          });
        }
      };
      if (def.target === "all") {
        const list = livingAllies(b);
        const primary = list[0] || ally;
        await playSkillAnim("buff", ally.id, primary.id, fxMeta);
        for (const a of list) applyBuffTo(a);
      } else if (def.target === "ally") {
        const t = pickLowestAlly(b);
        if (!t) return false;
        await playSkillAnim("buff", ally.id, t.id, fxMeta);
        applyBuffTo(t);
      } else {
        await playSkillAnim("buff", ally.id, ally.id, fxMeta);
        applyBuffTo(ally);
      }
      appliedBuff = true;
    } else if (isHealSkill(used)) {
      if (def.target === "all") {
        const amount = skillHealAmount(ally, used, mods, skillLv);
        const list = livingAllies(b);
        const primary = pickLowestAlly(b) || list[0];
        await playSkillAnim(style, ally.id, primary.id, fxMeta);
        for (const t of list) {
          const healed = applyHeal(t, amount, { source: ally });
          applyMendPulse(b, ally, t, healed || amount);
        }
      } else {
        const t = pickLowestAlly(b);
        if (!t) return false;
        const amount = skillHealAmount(ally, used, mods, skillLv, t);
        await playSkillAnim(style, ally.id, t.id, fxMeta);
        const healed = applyHeal(t, amount, { source: ally });
        applyMendPulse(b, ally, t, healed || amount);
      }
      applyLifeFlowBuff(b, ally);
      syncHeroHp(b);
    } else if (def.hitAllFront) {
      const list = frontEnemies(b);
      if (!list.length) return false;
      await playSkillAnim(style, ally.id, list[0].id, fxMeta);
      for (let h = 0; h < hits; h++) {
        for (const t of list) {
          if (t.hp <= 0) continue;
          heroStrike(ally, t, used, mods);
        }
      }
    } else if (def.stunGauge || def.stunTurns) {
      const center = pickRandomFront(b) || livingEnemies(b)[0];
      if (!center) return false;
      await playSkillAnim(style, ally.id, center.id, fxMeta);
      let stunNeed =
        def.stunGauge != null
          ? Math.max(1, Math.floor(def.stunGauge))
          : Math.max(1, Math.floor((def.stunTurns || 1) * GAUGE_MAX));
      if (ally.spiritForm) stunNeed = Math.max(1, Math.floor(stunNeed * 0.5));
      for (let h = 0; h < hits; h++) {
        for (const t of crossTargets(b, center)) {
          if (!ally.spiritForm) {
            if (t.hp <= 0) continue;
            heroStrike(ally, t, used, mods);
          }
          if (h === 0) {
            applyStunStatus(t, stunNeed);
            recordControl(ally, stunNeed);
          }
        }
      }
    } else if (
      used === "pink_burst" &&
      heroHasUnique(hero, "pink_burst_echo")
    ) {
      await resolvePinkBurstEcho(b, ally, used, mods, skillLv, fxMeta);
    } else {
      const t =
        used === "pink_burst"
          ? pickLowestEnemy(b) || livingEnemies(b)[0]
          : pickRandomFront(b) || livingEnemies(b)[0];
      if (!t) return false;
      await playSkillAnim(style, ally.id, t.id, fxMeta);
      for (let h = 0; h < hits; h++) {
        const cur =
          used === "pink_burst"
            ? pickLowestEnemy(b) || (t.hp > 0 ? t : null)
            : t.hp > 0
              ? t
              : null;
        if (!cur) break;
        heroStrike(ally, cur, used, mods);
      }
    }

    // 施加 buff 的当回合不扣持续时间
    if (!appliedBuff) tickUnitBuffs(ally);
    spendSkillMp(hero, used);
    ally.mp = hero.mp;
    ally.maxMp = hero.maxMp;
    syncHeroHp(b);
    renderBattle(b);
    return true;
  }

  /** 施加眩晕：默认行动条 50 */
  function applyStun(unit, amount) {
    applyStunStatus(unit, amount != null ? amount : DEFAULT_STATUS_GAUGE);
  }

  async function resolveEnemySkill(b, actor) {
    // 保险：眩晕中不应进入出手（正常真实行动条已冻结）
    if (isStunned(actor)) {
      renderBattle(b);
      return;
    }

    const skill = pickMonsterSkill(actor);
    const power = monsterSkillDamage(actor, skill);
    const targets = pickEnemySkillTargets(b, skill);

    // 无目标时也算消耗回合，避免行动条顶满却卡住
    if (!targets.length) {
      renderBattle(b);
      return;
    }
    await playSkillAnim(skill.style || "melee", actor.id, targets[0].id, {
      skillId: skill.id,
      statsId: "enemy",
      color: actor.color || "",
    });
    for (const t of targets) {
      const dealt = dealDamage(t, power, { source: actor });
      if (dealt > 0) {
        recordControl(actor, tryApplySkillStatuses(actor, t, skill.apply || {}, null));
        applyMonsterDot(t, actor, skill);
      }
    }
    syncHeroHp(b);
    renderBattle(b);
  }

  function syncAutoButton(b) {
    const btn = $("btnAuto");
    if (!btn) return;
    btn.textContent = b.auto ? "自动中" : "自动";
    btn.classList.toggle("on", !!b.auto);
    btn.setAttribute("aria-pressed", b.auto ? "true" : "false");
  }

  function pickReadyUnit(b) {
    let ready = null;
    for (const u of battleUnits(b)) {
      if (u.hp <= 0 || isStunned(u)) continue;
      if (u.gauge < GAUGE_MAX) continue;
      if (!ready || effectiveSpd(u) > effectiveSpd(ready)) ready = u;
    }
    return ready;
  }

  async function finishUnitAction(b) {
    if (!b || b.ending) return;
    if (!livingEnemies(b).length) return endBattle("win");
    // 灵体存在时：非灵体友军全灭即失败；否则全灭失败
    if (b.allies.some((a) => a.spiritForm)) {
      if (!mortalAllies(b).length) return endBattle("lose");
    } else if (!livingAllies(b).length) {
      return endBattle("lose");
    }
    b.waitingPlayer = false;
    b.readyHero = null;
    b.autoResolving = false;

    // 已有满条单位时立刻接上，避免 Boss 顶满条却要等小怪先打完才动
    const next = pickReadyUnit(b);
    if (next) {
      b.busy = true;
      setBattleButtons(false);
      updateGaugeBars(b);
      await unitAct(b, next, { chained: true });
      return;
    }

    b.busy = false;
    setBattleButtons(false);
    $("btnFlee").disabled = false;
  }

  async function runHeroAutoSkill(b, unit) {
    if (!b || !unit || b.ending || b.autoResolving) return;
    b.autoResolving = true;
    b.busy = true;
    b.waitingPlayer = false;
    setBattleButtons(false);

    triggerActDot(b, unit);
    syncHeroHp(b);
    if (unit.hp <= 0) {
      await finishUnitAction(b);
      return;
    }

    const hero = actingHero(unit);
    let { skillId, nextIndex } = nextAutoSkill(hero, unit.rotIndex || 0);
    if (isSilenced(unit)) skillId = basicAttackId(hero);
    unit.rotIndex = nextIndex;
    try {
      await resolveHeroSkill(b, unit, skillId);
    } finally {
      await finishUnitAction(b);
    }
  }

  async function unitAct(b, unit, opts = {}) {
    if (!b || b.ending) return;
    if (b.busy && !opts.chained) return;
    b.busy = true;
    b.waitingPlayer = false;
    setBattleButtons(false);
    unit.gauge = 0;

    if (unit.isHero) {
      if (!b.auto) {
        // 手动：挂起，等点技能或打开自动
        b.waitingPlayer = true;
        b.readyHero = unit;
        updateBattleSkillButtons(unit);
        setBattleButtons(true);
        $("btnFlee").disabled = false;
        // busy 保持 true，暂停他人读条
        return;
      }
      await runHeroAutoSkill(b, unit);
      return;
    }

    try {
      triggerActDot(b, unit);
      syncHeroHp(b);
      if (unit.hp <= 0) return;
      await resolveEnemySkill(b, unit);
    } finally {
      await finishUnitAction(b);
    }
  }

  async function playerPickSkill(skillId) {
    const b = getState().battle;
    if (!b || !b.waitingPlayer || !b.readyHero || b.autoResolving) return;
    // 手动选招时若已开自动，仍允许这次手操
    const unit = b.readyHero;
    b.waitingPlayer = false;
    b.busy = true;
    setBattleButtons(false);
    try {
      triggerActDot(b, unit);
      syncHeroHp(b);
      if (unit.hp <= 0) return;
      await resolveHeroSkill(b, unit, skillId);
    } finally {
      await finishUnitAction(b);
    }
  }

  function tick(dt) {
    const b = getState().battle;
    if (!b || b.ending) return;

    if (!b.ticker) b.ticker = createTicker();

    // 已开自动且正在等手操 → 由读条循环接管自动出手
    if (b.auto && b.waitingPlayer && b.readyHero && !b.autoResolving) {
      void runHeroAutoSkill(b, b.readyHero);
      return;
    }

    if (b.busy || b.waitingPlayer || b.autoResolving) {
      updateGaugeBars(b);
      return;
    }

    const steps = b.ticker.step(dt);
    let ready = null;
    for (let i = 0; i < steps; i++) {
      for (const u of battleUnits(b)) {
        if (u.hp <= 0) continue;
        const walk = Math.max(1, u.spd || 1);
        // 眩晕：真实行动条冻结；状态条按基础速度走
        if (isStunned(u)) {
          tickStatuses(u, walk);
          advanceUnitDot(b, u, walk);
          continue;
        }
        tickStatuses(u, walk);
        const spd = effectiveSpd(u);
        u.gauge += spd;
        advanceMendPulsesFromHealer(b, u, spd);
        advanceUnitDot(b, u, spd);
        if (u.gauge >= GAUGE_MAX) {
          u.gauge = GAUGE_MAX;
          if (!ready || spd > effectiveSpd(ready)) ready = u;
        }
      }
      if (ready) break;
    }
    syncHeroHp(b);
    updateGaugeBars(b);
    if (ready) void unitAct(b, ready);
  }

  function toggleAuto() {
    const b = getState().battle;
    if (!b || b.ending) return;
    b.auto = !b.auto;
    setBattleAutoEnabled(b.auto); // 刷新后仍记住开/关
    syncAutoButton(b);

    if (b.auto && b.waitingPlayer && b.readyHero && !b.autoResolving) {
      void runHeroAutoSkill(b, b.readyHero);
    }
  }

  function flee() {
    const b = getState().battle;
    if (!b || b.ending) return;
    if (b.busy && !b.waitingPlayer) return;
    endBattle("flee");
  }

  function enter(worldMonster) {
    const state = getState();
    let lineup = getBattleFormation(state).filter(
      ({ hero }) => hero && !isHeroDead(hero) && hero.hp > 0
    );
    if (!lineup.length) {
      const hero =
        (getDeployed?.() || []).find((h) => h && !isHeroDead(h) && h.hp > 0) ||
        state.party.find((h) => h && !isHeroDead(h) && h.hp > 0) ||
        null;
      if (!hero) {
        onBattleEnd?.("blocked", null, null, { reason: "no_living" });
        return;
      }
      lineup = [{ hero, row: "front", col: 1, slot: 1 }];
    }
    for (const { hero } of lineup) {
      hero.isCaptain = hero.id === state.captainId;
      refreshHeroStats(hero);
      hero.mp = hero.maxMp;
    }

    setMode("battle");
    hideExplore();
    $("battle").classList.remove("hidden");

    // - 小怪战：混合类型，最多 9 只铺满 3×3；Boss：后排中央 + 其余格位小怪
    const touched =
      state.monsters.find((m) => m.id === worldMonster.id) || worldMonster;
    const floor = touched.floor || state.floor || 1;
    const scale = state.floorScale || 1;
    const { enemies } = buildEncounter(touched, floor, scale);

    const allies = lineup.map(({ hero, row, col, slot }) => ({
      id: hero.id,
      name: hero.name,
      color: hero.color,
      shape: hero.shape,
      maxHp: hero.maxHp,
      hp: hero.hp,
      maxMp: hero.maxMp,
      mp: hero.mp,
      atk: hero.atk,
      def: hero.def,
      spd: hero.spd,
      critRate: hero.critRate ?? DEFAULT_CRIT_RATE,
      critDmg: hero.critDmg ?? DEFAULT_CRIT_DMG,
      hitRate: hero.hitRate ?? DEFAULT_HIT_RATE,
      dodgeRate: hero.dodgeRate ?? DEFAULT_DODGE_RATE,
      atkBuff: 0,
      defBuff: 0,
      critDmgBonus: 0,
      buffTurns: 0,
      row,
      col,
      slot,
      stun: 0,
      stunBar: 0,
      statuses: {},
      gauge: irand(10, 45),
      isHero: true,
      rotIndex: 0,
      spiritForm: false,
      mendPulse: null,
      dot: null,
      killStacks: 0,
      combat: blankCombat(),
    }));

    for (const e of enemies) ensureCombat(e);

    state.battle = {
      allies,
      enemies,
      busy: false,
      waitingPlayer: false,
      autoResolving: false,
      auto: getBattleAutoEnabled(),
      ending: false,
      ticker: createTicker(),
    };

    applyBalanceSpiritEffects(state.battle);
    // 仅灵体上场：无法维持战斗
    if (
      state.battle.allies.some((a) => a.spiritForm) &&
      !mortalAllies(state.battle).length
    ) {
      // 仍进入战场 UI，下一拍结算失败；先渲染
    }

    syncAutoButton(state.battle);
    updateBattleSkillButtons(allies[0]);
    renderBattle(state.battle);
    setBattleButtons(false);
    $("btnFlee").disabled = false;
    $("btnAuto").disabled = false;

    if (
      state.battle.allies.some((a) => a.spiritForm) &&
      !mortalAllies(state.battle).length
    ) {
      void endBattle("lose");
      return;
    }

    void runOpeningSpringBloom(state.battle);
  }

  /** 队伍里小绿的春芽技能等级；没有小绿则按 1 级 */
  function partyGreenBloomLevel() {
    const green = (getState().party || []).find((h) => h?.statsId === "green");
    return green ? getSkillLevel(green, "green_bloom") : 1;
  }

  /** 雾林春芽戒：开场 10% 春芽全体治疗 */
  async function runOpeningSpringBloom(b) {
    if (!b || b.ending) return;
    const casters = (b.allies || []).filter((a) => {
      if (!a || a.hp <= 0) return false;
      const hero = actingHero(a);
      return heroHasUnique(hero, "green_spring_bloom");
    });
    if (!casters.length) return;

    b.busy = true;
    setBattleButtons(false);
    const bloomLv = partyGreenBloomLevel();
    try {
      for (const ally of casters) {
        if (!b || b.ending || ally.hp <= 0) continue;
        const hero = actingHero(ally);
        const mods = sumSkillMods(hero?.equip);
        const full = skillHealAmount(ally, "green_bloom", mods, bloomLv);
        const amount = Math.max(1, Math.floor(full * 0.1));
        const list = livingAllies(b);
        if (!list.length) continue;
        const primary = pickLowestAlly(b) || list[0];
        await playSkillAnim("heal", ally.id, primary.id, {
          skillId: "green_bloom",
          statsId: "green",
          color: hero?.color || ally.color || "",
          shotDuration: 95,
        });
        for (const t of list) {
          if (t.hp <= 0) continue;
          const healed = applyHeal(t, amount, { source: ally });
          applyMendPulse(b, ally, t, healed || amount);
        }
        applyLifeFlowBuff(b, ally);
        syncHeroHp(b);
        renderBattle(b);
      }
    } finally {
      if (b && !b.ending) {
        b.busy = false;
        setBattleButtons(false);
        $("btnFlee").disabled = false;
        $("btnAuto").disabled = false;
      }
    }
  }

  function bind() {
    $("btnFlee")?.addEventListener("click", flee);
    $("btnAuto")?.addEventListener("click", toggleAuto);
    $("btnBattleInfo")?.addEventListener("click", openBattleInfo);
    $("closeBattleInfo")?.addEventListener("click", closeBattleInfo);
    $("battleInfoModal")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeBattleInfo();
    });
    $("battleActions")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.(".skill-btn[data-skill]");
      if (!btn || btn.disabled) return;
      playerPickSkill(btn.dataset.skill);
    });
  }

  return { enter, tick, playerPickSkill, toggleAuto, flee, bind };
}
