/** 战斗系统：读条、技能、自动循环 */

import { $, clamp, irand } from "../core/utils.js?v=177";
import {
  playSkillAnim,
  playReflectSpikes,
  setBattleAnimSpeed,
} from "./anim.js?v=177";
import {
  refreshHeroStats,
  skillPower,
  skillHealAmount,
  isHealSkill,
  isBuffSkill,
  isWeaveStatusSkill,
  applyWeaveEffectBoost,
  windGaleMaxSegments,
  windGaleSingleMult,
  WIND_GALE_SEGMENT_MULT,
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
  getSkillAiMode,
} from "../characters/omni/index.js?v=177";
import { mergeStackableTools } from "../characters/affixItems.js?v=177";
import {
  gainExp,
  splitExp,
  getSkillLevel,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
  DEFAULT_HIT_RATE,
  DEFAULT_DODGE_RATE,
  isHeroDead,
} from "../characters/progression.js?v=177";
import {
  refreshSkillTexts,
  calcReflectEnemyDamage,
  getReflectParams,
  applyReflectAllyUnique,
} from "../characters/skills.js?v=177";
import { buildEncounter } from "../monsters/roster.js?v=177";
import {
  pickMonsterSkill,
  monsterSkillDamage,
  monsterDotTickDamage,
  MONSTER_SKILLS,
} from "../monsters/skills.js?v=177";
import { rollBattleLoot, bossUniqueUrgent, bossTauntLine } from "../loot/drops.js?v=177";
import {
  GAUGE_MAX,
  getBattleAutoMode,
  setBattleAutoMode,
  DEFAULT_HERO_SPEED,
} from "../characters/stats.js?v=177";
import { createTicker } from "../core/time.js?v=177";
import { scaleMonsterGoldGain, scaleExpGain } from "../core/economy.js?v=177";
import { unitIconHtml, unitShapeHtml } from "../ui/unitIcon.js?v=177";
import {
  applyStun as applyStunStatus,
  applyStatus,
  isStunned,
  isSilenced,
  rollHit,
  healReceivedMult,
  tryApplySkillStatuses,
  amplifyBossSkillApply,
  tryApplySelfBuffs,
  tickStatuses,
  effectiveSpd,
  statusBadgesHtml,
  DEFAULT_STATUS_GAUGE,
} from "./status.js?v=177";
import { basicAttackId } from "../characters/omni/autoAttack.js?v=177";
import {
  DOT_TICK_SECONDS,
  ANIM_FAST_MS,
  ANIM_SLOW_MS,
  MOVE_STEP_SECONDS,
  dotDurationSec,
  skillAnimMs,
  battleSpeedFromMode,
  AUTO_MODE_LABELS,
  FLOW_SPEED_LABELS,
} from "./timing.js?v=177";
import {
  boardDist,
  boardXY,
  skillAttackRange,
  skillAoeRadius,
  unitsInRadius,
  splashDamageScale,
  stepUnitToward,
  pickNearestUnit,
  unitsInAttackRange,
  syncBoardPosFromRowCol,
  BOARD_LANE_IDS,
} from "./grid.js?v=177";

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

  function rowEnemies(b, row) {
    return livingEnemies(b).filter((e) => e.row === row);
  }

  /** 指定排敌人；该排空则前→中→后回退 */
  function enemiesForRowPref(b, prefRow) {
    const order = [prefRow, "front", "mid", "back"].filter(
      (r, i, arr) => arr.indexOf(r) === i
    );
    for (const row of order) {
      const list = rowEnemies(b, row);
      if (list.length) return list;
    }
    return livingEnemies(b);
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

  function pickMaxStatEnemy(b, key) {
    const list = livingEnemies(b);
    if (!list.length) return null;
    return list
      .slice()
      .sort((a, c) => {
        const va = key === "spd" ? effectiveSpd(a) : a[key] || 0;
        const vc = key === "spd" ? effectiveSpd(c) : c[key] || 0;
        return vc - va || (c.hp || 0) - (a.hp || 0);
      })[0];
  }

  function pickEnemyBySkillAi(b, hero, skillId) {
    const mode = getSkillAiMode(hero, skillId);
    if (mode === "maxAtk") return pickMaxStatEnemy(b, "atk");
    if (mode === "maxSpd") return pickMaxStatEnemy(b, "spd");
    return pickRandomFront(b) || livingEnemies(b)[0];
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

  function pickAllyBySkillAi(b, hero, skillId) {
    const list = livingAllies(b);
    if (!list.length) return null;
    const mode = getSkillAiMode(hero, skillId);
    if (mode === "maxDef") {
      return list
        .slice()
        .sort(
          (a, c) =>
            (c.def || 0) - (a.def || 0) ||
            a.hp / a.maxHp - c.hp / c.maxHp
        )[0];
    }
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
      const u = units.find((x) => {
        if (x.hp <= 0) return false;
        const bx = boardXY(x).x;
        return bx === col;
      });
      if (!u) return `<div class="battle-unit spacer" data-col="${col}" aria-hidden="true"></div>`;
      const asEnemy = enemy != null ? enemy : !u.isHero;
      return unitHtml(u, asEnemy, peers);
    });
    el.innerHTML = cells.join("");
  }

  function renderBattle(b) {
    const allyPeers = b.allies;
    if (isFlowBattle(b)) {
      // 按 boardY 塞进 6 条巷道，穿场走位才能看见
      for (let y = 0; y < BOARD_LANE_IDS.length; y++) {
        const laneUnits = battleUnits(b).filter(
          (u) => u.hp > 0 && boardXY(u).y === y
        );
        const el = $(BOARD_LANE_IDS[y]);
        if (el) el.classList.toggle("is-empty", !laneUnits.length);
        renderLane(el, laneUnits, null, allyPeers);
      }
      const frontEl = $("enemyFront");
      if (frontEl) {
        const upperEmpty = ![0, 1].some((y) =>
          battleUnits(b).some((u) => u.hp > 0 && boardXY(u).y === y)
        );
        frontEl.classList.toggle("solo-row", upperEmpty);
      }
      updateGaugeBars(b);
      return;
    }

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

  /** 怪物技能目标选取（经典：前排/十字/行列） */
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

  function isFlowBattle(b) {
    return !!b?.atbDuringAct;
  }

  /** 流畅：条满即放，不等人点技能；经典才在关闭「自动」时手操 */
  function usesAutoCast(b) {
    return isFlowBattle(b) || !!(b && b.autoMode > 0);
  }

  function battleOccupants(b) {
    return [...(b?.allies || []), ...(b?.enemies || [])];
  }

  function advanceFlowMovement() {
    /* 不限距：无需走近 */
  }

  function ensureActingIds(b) {
    if (!b.actingIds) b.actingIds = new Set();
    return b.actingIds;
  }

  function checkBattleEnd(b) {
    if (!b || b.ending) return true;
    if (!livingEnemies(b).length) {
      endBattle("win");
      return true;
    }
    if (b.allies.some((a) => a.spiritForm)) {
      if (!mortalAllies(b).length) {
        endBattle("lose");
        return true;
      }
    } else if (!livingAllies(b).length) {
      endBattle("lose");
      return true;
    }
    return false;
  }

  /**
   * 流畅：每人独立——条满就出手，不互等、不占全局 busy。
   */
  async function startFlowAction(b, unit) {
    if (!b || b.ending || b.opening) return;
    if (!unit || unit.hp <= 0 || isStunned(unit)) return;
    if (unit.gauge < GAUGE_MAX) return;
    const acting = ensureActingIds(b);
    if (acting.has(unit.id)) return;
    acting.add(unit.id);
    b.actingId = unit.id;
    try {
      syncHeroHp(b);
      if (unit.hp <= 0 || b.ending) return;
      if (unit.isHero) {
        const hero = actingHero(unit);
        let { skillId, nextIndex } = nextAutoSkill(hero, unit.rotIndex || 0);
        if (isSilenced(unit) && unit.firstSkillDone) {
          skillId = basicAttackId(hero);
        }
        unit.rotIndex = nextIndex;
        let ok = await resolveHeroSkill(b, unit, skillId);
        if (!ok) {
          const basic = basicAttackId(hero);
          if (basic && basic !== skillId) {
            await resolveHeroSkill(b, unit, basic);
          }
        }
      } else {
        await resolveEnemySkill(b, unit);
      }
    } finally {
      unit.gauge = 0;
      acting.delete(unit.id);
      if (b.actingId === unit.id) b.actingId = null;
      checkBattleEnd(b);
    }
  }

  /** 流畅：全体敌人里挑目标 */
  function pickFlowEnemy(b, ally, skillId, def, hero) {
    const pool = livingEnemies(b);
    if (!pool.length) return null;
    if (skillId === "pink_burst") {
      return pool
        .slice()
        .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.hp - c.hp)[0];
    }
    if (skillId === "blue_bolt" || skillId === "blue_freeze") {
      const mode = getSkillAiMode(hero, skillId);
      if (mode === "maxAtk") {
        return pool.slice().sort((a, c) => (c.atk || 0) - (a.atk || 0))[0];
      }
      if (mode === "maxSpd") {
        return pool
          .slice()
          .sort((a, c) => effectiveSpd(c) - effectiveSpd(a))[0];
      }
    }
    return pool[irand(0, pool.length - 1)];
  }

  function flowSplashTargets(b, center, def) {
    const r = skillAoeRadius(def);
    if (r <= 0) return center ? [center] : [];
    return unitsInRadius(livingEnemies(b), center, r);
  }

  function flowAllySplashTargets(b, center, skill) {
    const r = skillAoeRadius(skill);
    if (r <= 0) return center ? [center] : [];
    return unitsInRadius(targetableAllies(b), center, r);
  }

  async function resolveHeroSkillFlow(
    b,
    ally,
    used,
    def,
    style,
    mods,
    hits,
    skillLv,
    fxMeta,
    opts,
    hero
  ) {
    let appliedBuff = false;

    if (isBuffSkill(used)) {
      const applyBuffTo = (unit) => {
        if (!unit || unit.hp <= 0) return;
        if (def.windEnchant) {
          applyWindEnchant(b, ally, unit);
          return;
        }
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
        let candidates = livingAllies(b).filter((a) => a.id !== ally.id);
        if (def.windEnchant) {
          candidates = candidates.length ? candidates : livingAllies(b);
        }
        const t = def.windEnchant
          ? candidates.slice().sort((a, c) => (c.atk || 0) - (a.atk || 0))[0] ||
            ally
          : candidates
              .slice()
              .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.hp - c.hp)[0] ||
            ally;
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
        const allies = livingAllies(b);
        if (!allies.length) return false;
        const t =
          used === "green_mend"
            ? pickAllyBySkillAi(b, hero, used)
            : allies
                .slice()
                .sort(
                  (a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.hp - c.hp
                )[0];
        if (!t) return false;
        const amount = skillHealAmount(ally, used, mods, skillLv, t);
        await playSkillAnim(style, ally.id, t.id, fxMeta);
        const healed = applyHeal(t, amount, { source: ally });
        applyMendPulse(b, ally, t, healed || amount);
      }
      applyLifeFlowBuff(b, ally);
      syncHeroHp(b);
    } else {
      // 攻击：不限距离；群体按目标半径溅射，伤害随命中人数变薄
      let center = pickFlowEnemy(b, ally, used, def, hero);
      if (!center) return false;

      if (
        used === "pink_burst" &&
        heroHasUnique(hero, "pink_burst_echo")
      ) {
        await resolvePinkBurstEcho(b, ally, used, mods, skillLv, fxMeta);
      } else {
        const list = flowSplashTargets(b, center, def);
        if (!list.length) return false;
        const scale = splashDamageScale(list.length);
        const aoe = skillAoeRadius(def) > 0;
        const stunNeed =
          def.stunGauge != null
            ? Math.max(1, Math.floor(def.stunGauge))
            : def.stunTurns
              ? Math.max(1, Math.floor((def.stunTurns || 1) * GAUGE_MAX))
              : 0;
        const stunAmt = ally.spiritForm
          ? Math.max(1, Math.floor(stunNeed * 0.5))
          : stunNeed;

        if (used === "pink_burst" && hits > 1 && !aoe) {
          for (let h = 0; h < hits; h++) {
            const cur = pickFlowEnemy(b, ally, used, def, hero);
            if (!cur) break;
            await playSkillAnim(style, ally.id, cur.id, {
              ...fxMeta,
              shotDuration: ANIM_FAST_MS,
            });
            heroStrike(ally, cur, used, mods, 1);
          }
        } else {
          await playSkillAnim(style, ally.id, center.id, fxMeta);
          for (let h = 0; h < hits; h++) {
            if (ally.windEnchant) ally.windEnchant.consumedThisCast = false;
            for (const t of list) {
              if (t.hp <= 0) continue;
              if (!ally.spiritForm) {
                heroStrike(ally, t, used, mods, scale);
              }
              if (stunNeed && h === 0) {
                applyStunStatus(t, stunAmt);
                recordControl(ally, stunAmt);
              }
            }
          }
        }
      }
    }

    if (!appliedBuff) tickUnitBuffs(ally);
    if (!opts.freeCast) {
      spendSkillMp(hero, used);
      ally.firstSkillDone = true;
    }
    ally.mp = hero.mp;
    ally.maxMp = hero.maxMp;
    syncHeroHp(b);
    renderBattle(b);
    return true;
  }

  function ensureDots(unit) {
    if (!unit.dots || typeof unit.dots !== "object") unit.dots = {};
    if (unit.dot && !unit.dots[unit.dot.skillId || "_legacy"]) {
      const id = unit.dot.skillId || "_legacy";
      unit.dots[id] = { ...unit.dot, skillId: id };
    }
    unit.dot = null;
    for (const d of Object.values(unit.dots)) {
      if (!d) continue;
      if (d.remainSec == null && d.remain != null) {
        const left = Math.max(0, (d.remain || 0) - (d.bar || 0));
        d.remainSec = dotDurationSec(left || d.remain || 50);
        d.tickAcc = d.tickAcc || 0;
      }
    }
    return unit.dots;
  }

  function listActiveDots(unit) {
    if (!unit) return [];
    const map = ensureDots(unit);
    return Object.values(map).filter((d) => d && (d.remainSec || 0) > 0);
  }

  function applyMonsterDot(target, caster, skill) {
    const def = skill?.dot;
    if (!def || !target || target.hp <= 0) return;
    const skillId = skill?.id || def.skillId || "dot";
    let tickDmg;
    if (!target.isHero) {
      const atk = Math.max(0, Number(caster?.atk) || 0);
      tickDmg = Math.max(
        1,
        Math.floor(atk * (Number(def.mult) || 0)) + (Number(def.flat) || 0)
      );
    } else {
      tickDmg = monsterDotTickDamage(caster?.atk || 0, def);
    }
    const remainSec = dotDurationSec(def.gauge ?? 50);
    const dots = ensureDots(target);
    dots[skillId] = {
      skillId,
      tickDmg,
      remainSec,
      tickAcc: 0,
      sourceId: caster?.id || null,
    };
  }

  /** 按真实时间推进所有 DoT（受 battleSpeed 缩放） */
  function advanceTimedDots(b, scaledDt) {
    if (!(scaledDt > 0)) return;
    for (const u of battleUnits(b)) {
      if (u.hp <= 0) {
        u.dots = {};
        u.dot = null;
        continue;
      }
      const dots = ensureDots(u);
      for (const id of Object.keys(dots)) {
        const d = dots[id];
        if (!d || !(d.remainSec > 0)) {
          delete dots[id];
          continue;
        }
        d.tickAcc = (d.tickAcc || 0) + scaledDt;
        while (d.tickAcc >= DOT_TICK_SECONDS && d.remainSec > 0 && u.hp > 0) {
          d.tickAcc -= DOT_TICK_SECONDS;
          const src = findUnitById(b, d.sourceId);
          dealDamage(u, d.tickDmg, { source: src || null });
        }
        d.remainSec -= scaledDt;
        if (d.remainSec <= 0 || u.hp <= 0) delete dots[id];
      }
    }
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
    const firstFree = !unit.firstSkillDone;
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
        const locked = silenced && !firstFree && sk.id !== basicId;
        const blocked = locked || noMp;
        const tip = locked
          ? "禁魔中：仅可普通攻击"
          : silenced && firstFree
            ? "本场首技能不受禁魔"
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

  /** 技能/治疗吃智向强度；普攻仍吃 atk */
  function effectiveSkillAtk(unit, skillId) {
    const hero = unit?.isHero ? actingHero(unit) : null;
    const basic = hero ? basicAttackId(hero) : null;
    if (skillId && basic && skillId === basic) return effectiveAtk(unit);
    const raw = unit?.skillAtk ?? hero?.skillAtk ?? unit?.atk ?? 0;
    return Math.max(1, Math.floor(raw * (1 + (unit?.atkBuff || 0))));
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
        unit.classList.toggle(
          "ready",
          u.gauge >= GAUGE_MAX && !stunned
        );
        unit.classList.toggle("approaching", false);
        unit.classList.toggle("stun", stunned);
        const mark = unit.querySelector(".stun-mark");
        if (mark) mark.hidden = !stunned;
      }
    }
  }

  function pickMaxAtkAlly(b) {
    const list = livingAllies(b);
    if (!list.length) return null;
    return list
      .slice()
      .sort(
        (a, c) =>
          effectiveAtk(c) - effectiveAtk(a) || (c.hp || 0) - (a.hp || 0)
      )[0];
  }

  /** 规划风刃附魔段数（强化装随风刃等级成长） */
  function planWindEnchant(casterHero, targetHero, skillId, mods) {
    const unique = heroHasUnique(casterHero, "cyan_cut_gale");
    if (!unique) {
      return { charges: 1, mult: 0.3, aoeOnce: true };
    }
    const cutLv = getSkillLevel(casterHero, "cyan_cut");
    const maxSeg = windGaleMaxSegments(cutLv);
    const singleMult = windGaleSingleMult(cutLv);
    const segMult = WIND_GALE_SEGMENT_MULT;
    if (
      skillId === "pink_burst" &&
      heroHasUnique(targetHero, "pink_burst_echo")
    ) {
      return {
        charges: Math.min(maxSeg, 3 + (mods?.hitBonus || 0)),
        mult: segMult,
        aoeOnce: false,
      };
    }
    const hits = Math.max(1, 1 + (mods?.hitBonus || 0));
    if (isHealSkill(skillId) && heroHasUnique(targetHero, "green_mend_pulse")) {
      return {
        charges: maxSeg,
        mult: segMult,
        aoeOnce: false,
        mendPulse: true,
      };
    }
    const def = SKILL_POWER[skillId];
    const isAoe = !!(
      def?.hitAllFront ||
      skillId === "blue_nova" ||
      def?.stunGauge ||
      def?.stunTurns
    );
    if (isAoe) {
      if (hits > 1) {
        return {
          charges: Math.min(maxSeg, hits),
          mult: segMult,
          aoeOnce: true,
        };
      }
      return { charges: 1, mult: singleMult, aoeOnce: true };
    }
    if (hits > 1) {
      return {
        charges: Math.min(maxSeg, hits),
        mult: segMult,
        aoeOnce: false,
      };
    }
    return { charges: 1, mult: singleMult, aoeOnce: true };
  }

  function applyWindEnchant(b, caster, target) {
    if (!caster || !target || target.hp <= 0) return;
    const hero = actingHero(caster);
    const unique = heroHasUnique(hero, "cyan_cut_gale");
    target.windEnchant = {
      sourceId: caster.id,
      atk: effectiveAtk(caster),
      unique: !!unique,
      armed: false,
      charges: unique ? 0 : 1,
      mult: unique ? 0.3 : 0.3,
      aoeOnce: !unique,
      consumedThisCast: false,
      castSkill: null,
      mendPulse: false,
    };
  }

  function armWindEnchantForSkill(b, ally, skillId) {
    const we = ally?.windEnchant;
    if (!we || we.armed) return;
    const caster = findUnitById(b, we.sourceId) || ally;
    const casterHero = actingHero(caster);
    const targetHero = actingHero(ally);
    const mods = sumSkillMods(targetHero?.equip);
    if (!we.unique) {
      we.armed = true;
      we.castSkill = skillId;
      we.consumedThisCast = false;
      return;
    }
    const plan = planWindEnchant(casterHero, targetHero, skillId, mods);
    we.charges = plan.charges;
    we.mult = plan.mult;
    we.aoeOnce = !!plan.aoeOnce;
    we.mendPulse = !!plan.mendPulse;
    we.armed = true;
    we.castSkill = skillId;
    we.consumedThisCast = false;
  }

  function tryWindEnchantExtra(b, source, preferTarget = null, opts = {}) {
    const we = source?.windEnchant;
    if (!we) return 0;
    if (!(we.charges > 0)) {
      source.windEnchant = null;
      return 0;
    }
    if (we.unique && !we.armed) return 0;
    if (we.aoeOnce && we.consumedThisCast) return 0;
    let foe = preferTarget && preferTarget.hp > 0 ? preferTarget : null;
    // 脉动段：附魔打在脉动同一目标（可友方）；其余默认打敌人
    if (!foe || (foe.isHero && !opts.allowAlly)) {
      foe = pickLowestEnemy(b) || livingEnemies(b)[0];
    }
    if (!foe || foe.hp <= 0) return 0;
    const extra = Math.max(1, Math.floor((we.atk || 1) * (we.mult || 0.3)));
    we.charges -= 1;
    if (we.aoeOnce) we.consumedThisCast = true;
    if (we.charges <= 0) source.windEnchant = null;
    return dealDamage(foe, extra, {
      trueDamage: true,
      skipHitCheck: true,
      source,
      fromEnchant: true,
    });
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
    // 减益词条：任意对敌有效伤害均可触发（技能/灼烧/附魔/反伤等）
    if (
      raw > 0 &&
      !opts.skipAffixDebuff &&
      opts.source?.isHero &&
      !target.isHero &&
      opts.source.id !== target.id
    ) {
      const srcHero = actingHero(opts.source);
      const affixMods = sumSkillMods(srcHero?.equip);
      if (
        affixMods &&
        (affixMods.stunChance ||
          affixMods.slowChance ||
          affixMods.silenceChance ||
          affixMods.healCutChance)
      ) {
        recordControl(
          opts.source,
          tryApplySkillStatuses(opts.source, target, {}, affixMods)
        );
      }
    }
    if (
      !opts.fromEnchant &&
      !opts.fromReflect &&
      opts.source &&
      opts.source.isHero &&
      !target.isHero &&
      raw > 0
    ) {
      const b = getState().battle;
      if (b) tryWindEnchantExtra(b, opts.source, target);
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

  function syncBattleHpBars(b) {
    if (!b) return;
    for (const u of battleUnits(b)) {
      const el = document.querySelector(
        `.battle-unit[data-id="${u.id}"] .unit-hp > i`
      );
      if (!el || !(u.maxHp > 0)) continue;
      el.style.width = `${clamp((u.hp / u.maxHp) * 100, 0, 100)}%`;
    }
  }

  function triggerReflect(victim, source = null) {
    const b = getState().battle;
    if (!b || !victim?.isHero) return;
    const hero = actingHero(victim);
    if (!hero?.skills?.some((s) => s.id === "yellow_reflect")) return;
    const lv = getSkillLevel(hero, "yellow_reflect");
    const p = getReflectParams(lv);
    // 唯一装挂在 affixes 时也由 heroHasUnique 识别
    const hasUnique = heroHasUnique(hero, "yellow_reflect_shield");
    let allyRatio = applyReflectAllyUnique(p.allyRatio, hasUnique);
    const enemyDmg = reflectBaseDamage(victim);
    /** @type {{ id: string, opacity: number }[]} */
    const fxHits = [];

    const units = battleUnits(b).filter(
      (u) => u && u.hp > 0 && u.id !== victim.id
    );
    /** 默认只反击伤害来源；强化反伤 → 全体其他单位 */
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
    syncBattleHpBars(b);
  }

  function heroStrike(attacker, target, skillId, mods, damageScale = 1) {
    if (attacker?.spiritForm) return 0;
    const hero = actingHero(attacker);
    const lv = getSkillLevel(hero, skillId);
    let def = applyUniqueSkillMods(
      hero,
      skillId,
      scaledSkillDef(skillId, lv) || SKILL_POWER[skillId]
    );
    const weave =
      heroHasUnique(hero, "status_weave_ring") && isWeaveStatusSkill(skillId);
    if (weave) def = applyWeaveEffectBoost(def, 1.2);
    let dealt = 0;
    if (!weave) {
      const scale =
        (damageScale || 1) *
        (mods?.hitDamageMult != null ? mods.hitDamageMult : 1);
      const power = Math.max(
        1,
        Math.floor(
          skillPower(effectiveSkillAtk(attacker, skillId), skillId, mods, lv) *
            scale
        )
      );
      dealt = dealDamage(target, power, {
        canCrit: true,
        critRate: unitCritRate(attacker),
        critDmg: unitCritDmg(attacker),
        source: attacker,
      });
    } else {
      // 织律：取消瞬伤，仍结算附魔（若有）与状态
      const b = getState().battle;
      if (b && !target.isHero) tryWindEnchantExtra(b, attacker, target);
    }
    if (dealt > 0 || weave) {
      // 技能自带 apply；装备减益词条改由 dealDamage 统一按「伤害」触发
      recordControl(
        attacker,
        tryApplySkillStatuses(attacker, target, def?.apply || {}, null)
      );
      if (def?.dot) applyMonsterDot(target, attacker, { id: skillId, dot: def.dot });
      if (dealt > 0) applySelfRecoil(attacker, dealt, def);
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
      Math.floor(
        skillPower(effectiveSkillAtk(ally, skillId), skillId, mods, skillLv) *
          damageScale
      )
    );
    let remaining = 3 + (mods.hitBonus || 0);
    while (remaining > 0) {
      const t = pickLowestEnemy(b);
      if (!t) break;
      remaining -= 1;
      await playSkillAnim("ranged", ally.id, t.id, {
        ...fxMeta,
        shotDuration: ANIM_FAST_MS,
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
        recordControl(ally, tryApplySkillStatuses(ally, t, def?.apply || {}, null));
        if (def?.dot) applyMonsterDot(t, ally, { id: skillId, dot: def.dot });
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

  /** 治愈戒：任意治疗后附加 200 行动条脉动（按治疗者行动条推进）；同效果刷新不叠加 */
  function applyMendPulse(b, healer, target, healedAmount) {
    const hero = actingHero(healer);
    if (!heroHasUnique(hero, "green_mend_pulse") || !target || !healer) return;
    const tickDmg = Math.max(1, Math.floor(Math.max(1, healedAmount) * 0.2));
    const remain = 200;
    if (target.mendPulse && target.mendPulse.healerId === healer.id) {
      target.mendPulse.remain = remain;
      target.mendPulse.bar = 0;
      target.mendPulse.walk = 0;
      target.mendPulse.lostThisCycle = false;
      target.mendPulse.lastLost = 0;
      target.mendPulse.tickDmg = tickDmg;
      return;
    }
    target.mendPulse = {
      remain,
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

  /** 行动条词条：推进时按累计回血 */
  function applyGaugeRegen(unit, walked) {
    if (!unit?.isHero || !(walked > 0) || unit.hp <= 0) return;
    const hero = actingHero(unit);
    if (!hero) return;
    const mods = sumSkillMods(hero.equip);
    const hpPer = mods?.gaugeHpPer10 || 0;
    if (!(hpPer > 0)) return;
    if (!unit.gaugeRegen) unit.gaugeRegen = { hp: 0 };
    unit.gaugeRegen.hp += walked;
    while (unit.gaugeRegen.hp >= 10) {
      unit.gaugeRegen.hp -= 10;
      const amt = Math.max(1, Math.floor((unit.maxHp || 1) * hpPer));
      applyHeal(unit, amt, { source: unit });
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
      // 脉动流失走正常受伤结算（来源=治疗者）→ 可触发反伤；有强化则全场
      const lost = dealDamage(unit, p.tickDmg, {
        trueDamage: true,
        skipHitCheck: true,
        source: healer,
      });
      p.lastLost = lost || p.tickDmg;
      p.lostThisCycle = true;
      if (healer?.windEnchant?.mendPulse || healer?.windEnchant?.unique) {
        const bb = getState().battle;
        // 与脉动同一目标结算附魔段（可打到小黄并触发反伤）
        if (bb) tryWindEnchantExtra(bb, healer, unit, { allowAlly: true });
      }
    }
    if (p.walk >= 20) {
      const healAmt = Math.max(1, Math.floor(p.lastLost * 2.5));
      applyHeal(unit, healAmt, { source: healer || null });
      p.walk -= 20;
      p.lostThisCycle = false;
      p.lastLost = 0;
    }
  }

  /** 均衡灵衡：全体友军共享被动；自身灵体化 */
  function applyBalanceSpiritEffects(b) {
    for (const ally of b.allies) {
      const hero = heroById(ally.id);
      if (!heroHasUnique(hero, "omni_balance_spirit")) continue;
      ally.spiritForm = true;
      const boost = hero.passiveBoost || {};
      for (const other of b.allies) {
        if (other.id === ally.id) continue;
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
    if (ally && isSilenced(ally) && ally.firstSkillDone) {
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
      if (!state.bossUniqueLoot || typeof state.bossUniqueLoot !== "object") {
        state.bossUniqueLoot = {};
      }
      const loot = rollBattleLoot(pack, { uniqueLoot: state.bossUniqueLoot });
      if (loot.length) {
        if (!state.inventory) state.inventory = [];
        state.inventory.push(...loot);
        state.inventory = mergeStackableTools(state.inventory);
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
    const silenceBlocks = isSilenced(ally) && !!ally.firstSkillDone;
    if (silenceBlocks && used !== basicAttackId(hero)) {
      used = basicAttackId(hero);
    }
    if (!canUseSkill(b, used, hero)) used = firstUsableSkill(b, hero);
    if (silenceBlocks) {
      const basic = basicAttackId(hero);
      if (canUseSkill(b, basic, hero)) used = basic;
    }
    if (!used || !canUseSkill(b, used, hero)) return false;

    const skillLv = getSkillLevel(hero, used);
    let def = applyUniqueSkillMods(
      hero,
      used,
      scaledSkillDef(used, skillLv) || SKILL_POWER[used]
    );
    const weave = heroHasUnique(hero, "status_weave_ring") && isWeaveStatusSkill(used);
    if (weave) def = applyWeaveEffectBoost(def, 1.2);
    const style = def.style || "melee";
    const mods = sumSkillMods(hero?.equip);
    const hits = Math.max(1, 1 + (mods.hitBonus || 0));

    const fxMeta = {
      skillId: used,
      statsId: hero?.statsId || "",
      color: hero?.color || ally.color || "",
      battleSpeed: b.battleSpeed || 1,
      shotDuration: skillAnimMs({
        style,
        skillId: used,
        pace: isBuffSkill(used) || weave ? "fast" : "slow",
      }),
    };

    tryApplySelfBuffs(ally, mods);
    armWindEnchantForSkill(b, ally, used);

    if (isFlowBattle(b)) {
      return resolveHeroSkillFlow(
        b,
        ally,
        used,
        def,
        style,
        mods,
        hits,
        skillLv,
        fxMeta,
        opts,
        hero
      );
    }

    let appliedBuff = false;
    if (isBuffSkill(used)) {
      const applyBuffTo = (unit) => {
        if (!unit || unit.hp <= 0) return;
        if (def.windEnchant) {
          applyWindEnchant(b, ally, unit);
          return;
        }
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
        const t = def.windEnchant ? pickMaxAtkAlly(b) : pickLowestAlly(b);
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
        const t =
          used === "green_mend"
            ? pickAllyBySkillAi(b, hero, used)
            : pickLowestAlly(b);
        if (!t) return false;
        const amount = skillHealAmount(ally, used, mods, skillLv, t);
        await playSkillAnim(style, ally.id, t.id, fxMeta);
        const healed = applyHeal(t, amount, { source: ally });
        applyMendPulse(b, ally, t, healed || amount);
      }
      applyLifeFlowBuff(b, ally);
      syncHeroHp(b);
    } else if (def.hitAllFront || used === "blue_nova") {
      const rowPref =
        used === "blue_nova" ? getSkillAiMode(hero, used) : "front";
      const list =
        used === "blue_nova"
          ? enemiesForRowPref(b, rowPref)
          : frontEnemies(b).length
            ? frontEnemies(b)
            : preferredEnemies(b);
      if (!list.length) return false;
      await playSkillAnim(style, ally.id, list[0].id, fxMeta);
      for (let h = 0; h < hits; h++) {
        if (ally.windEnchant) ally.windEnchant.consumedThisCast = false;
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
        if (ally.windEnchant) ally.windEnchant.consumedThisCast = false;
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
    } else if (used === "pink_barrage" && hits > 1) {
      for (let h = 0; h < hits; h++) {
        const cur = pickRandomFront(b) || livingEnemies(b)[0];
        if (!cur) break;
        await playSkillAnim(style, ally.id, cur.id, {
          ...fxMeta,
          shotDuration: ANIM_FAST_MS,
        });
        heroStrike(ally, cur, used, mods);
      }
    } else if (used === "pink_burst" && hits > 1) {
      for (let h = 0; h < hits; h++) {
        const cur = pickLowestEnemy(b) || livingEnemies(b)[0];
        if (!cur) break;
        await playSkillAnim(style, ally.id, cur.id, {
          ...fxMeta,
          shotDuration: ANIM_FAST_MS,
        });
        heroStrike(ally, cur, used, mods);
      }
    } else {
      const t =
        used === "pink_burst"
          ? pickLowestEnemy(b) || livingEnemies(b)[0]
          : used === "blue_bolt" || used === "blue_freeze"
            ? pickEnemyBySkillAi(b, hero, used) || livingEnemies(b)[0]
            : pickRandomFront(b) || livingEnemies(b)[0];
      if (!t) return false;
      await playSkillAnim(style, ally.id, t.id, fxMeta);
      for (let h = 0; h < hits; h++) {
        const cur =
          used === "pink_burst"
            ? pickLowestEnemy(b) || (t.hp > 0 ? t : null)
            : used === "blue_bolt" || used === "blue_freeze"
              ? pickEnemyBySkillAi(b, hero, used) ||
                (t.hp > 0 ? t : null)
              : t.hp > 0
                ? t
                : null;
        if (!cur) break;
        heroStrike(ally, cur, used, mods);
      }
    }

    // 施加 buff 的当回合不扣持续时间
    if (!appliedBuff) tickUnitBuffs(ally);
    if (!opts.freeCast) {
      spendSkillMp(hero, used);
      ally.firstSkillDone = true;
    }
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

    let targets;
    if (isFlowBattle(b)) {
      // 流畅：怪物也不限距离；群体按目标半径溅射
      const allies = targetableAllies(b);
      if (!allies.length) return false;
      const primary = pickAllyTarget(b) || allies[0];
      if (!primary) return false;
      targets = flowAllySplashTargets(b, primary, skill);
      if (!targets.length) targets = [primary];
      const scale = splashDamageScale(targets.length);
      await playSkillAnim(skill.style || "melee", actor.id, primary.id, {
        skillId: skill.id,
        statsId: "enemy",
        color: actor.color || "",
        battleSpeed: b.battleSpeed || 1,
        shotDuration: skillAnimMs({
          style: skill.style || "melee",
          skillId: skill.id,
          pace: skill.style === "buff" ? "fast" : "slow",
        }),
      });
      for (const t of targets) {
        const dealt = dealDamage(
          t,
          Math.max(1, Math.floor(power * scale)),
          { source: actor }
        );
        if (dealt > 0) {
          recordControl(
            actor,
            tryApplySkillStatuses(
              actor,
              t,
              amplifyBossSkillApply(actor, skill.apply || {}),
              null
            )
          );
          applyMonsterDot(t, actor, skill);
        }
      }
      syncHeroHp(b);
      renderBattle(b);
      return true;
    }

    targets = pickEnemySkillTargets(b, skill);

    // 无目标时也算消耗回合，避免行动条顶满却卡住
    if (!targets.length) {
      renderBattle(b);
      return;
    }
    await playSkillAnim(skill.style || "melee", actor.id, targets[0].id, {
      skillId: skill.id,
      statsId: "enemy",
      color: actor.color || "",
      battleSpeed: b.battleSpeed || 1,
      shotDuration: skillAnimMs({
        style: skill.style || "melee",
        skillId: skill.id,
        pace: skill.style === "buff" ? "fast" : "slow",
      }),
    });
    for (const t of targets) {
      const dealt = dealDamage(t, power, { source: actor });
      if (dealt > 0) {
        recordControl(actor, tryApplySkillStatuses(actor, t, amplifyBossSkillApply(actor, skill.apply || {}), null));
        applyMonsterDot(t, actor, skill);
      }
    }
    syncHeroHp(b);
    renderBattle(b);
  }

  /** 整场战斗时间倍率：行动条 / DoT / 技能等待 / CSS 特效同一套 */
  function applyBattleSpeed(b) {
    const sp = Math.max(0.25, Number(b?.battleSpeed) || 1);
    setBattleAnimSpeed(sp);
    const root = $("battle");
    if (root) root.style.setProperty("--bsp", String(sp));
  }

  function syncAutoButton(b) {
    const btn = $("btnAuto");
    if (!btn) return;
    const mode = b.autoMode || 0;
    applyBattleSpeed(b);
    if (isFlowBattle(b)) {
      btn.textContent = FLOW_SPEED_LABELS[mode] || "速度·1x";
      btn.classList.toggle("on", true);
      btn.setAttribute("aria-pressed", "true");
      return;
    }
    btn.textContent = AUTO_MODE_LABELS[mode] || "自动";
    btn.classList.toggle("on", mode > 0);
    btn.setAttribute("aria-pressed", mode > 0 ? "true" : "false");
  }

  function pickReadyUnit(b) {
    let ready = null;
    for (const u of battleUnits(b)) {
      if (u.hp <= 0 || isStunned(u)) continue;
      if (u.gauge < GAUGE_MAX) continue;
      // 经典手操：正在等选招的人跳过
      if (b.waitingPlayer && b.readyHero?.id === u.id) continue;
      if (!ready || effectiveSpd(u) > effectiveSpd(ready)) ready = u;
    }
    return ready;
  }

  async function finishUnitAction(b) {
    if (!b || b.ending) return;
    if (checkBattleEnd(b)) return;

    b.waitingPlayer = false;
    b.readyHero = null;
    b.autoResolving = false;
    b.actingId = null;

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
    if (!b || !unit || b.ending) return;
    // 经典自动：防止重入；流畅走 startFlowAction，不进这里
    if (b.autoResolving) return;
    b.autoResolving = true;
    b.busy = true;
    b.waitingPlayer = false;
    b.readyHero = null;
    b.actingId = unit.id;
    setBattleButtons(false);

    syncHeroHp(b);
    if (unit.hp <= 0) {
      unit.gauge = 0;
      await finishUnitAction(b);
      return;
    }

    const hero = actingHero(unit);
    let { skillId, nextIndex } = nextAutoSkill(hero, unit.rotIndex || 0);
    if (isSilenced(unit) && unit.firstSkillDone) skillId = basicAttackId(hero);
    unit.rotIndex = nextIndex;
    try {
      let ok = await resolveHeroSkill(b, unit, skillId);
      if (!ok) {
        const basic = basicAttackId(hero);
        if (basic && basic !== skillId) {
          ok = await resolveHeroSkill(b, unit, basic);
        }
      }
      unit.gauge = 0;
    } finally {
      await finishUnitAction(b);
    }
  }

  async function unitAct(b, unit, opts = {}) {
    if (!b || b.ending) return;
    // 流畅不走串行 unitAct
    if (isFlowBattle(b)) {
      await startFlowAction(b, unit);
      return;
    }
    if (b.busy && !opts.chained) return;

    b.busy = true;
    b.waitingPlayer = false;
    b.readyHero = null;
    b.actingId = unit.id;
    setBattleButtons(false);
    unit.gauge = 0;

    if (unit.isHero) {
      if (usesAutoCast(b)) {
        await runHeroAutoSkill(b, unit);
        return;
      }
      b.waitingPlayer = true;
      b.readyHero = unit;
      updateBattleSkillButtons(unit);
      setBattleButtons(true);
      $("btnFlee").disabled = false;
      updateGaugeBars(b);
      return;
    }

    try {
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
    if (isFlowBattle(b)) return;
    const unit = b.readyHero;
    b.waitingPlayer = false;
    b.busy = true;
    b.actingId = unit.id;
    setBattleButtons(false);
    try {
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
    applyBattleSpeed(b);

    const scaledDt = dt * (b.battleSpeed || 1);
    advanceTimedDots(b, scaledDt);
    advanceFlowMovement(b, scaledDt);

    // classic：有人行动/等操作时全体条停住；flow：仅各自出手中的单位停条
    const freezeAtb =
      !b.atbDuringAct && (b.busy || b.waitingPlayer || b.autoResolving);

    const acting = isFlowBattle(b) ? ensureActingIds(b) : null;
    const steps = b.ticker.step(scaledDt);
    for (let i = 0; i < steps; i++) {
      for (const u of battleUnits(b)) {
        if (u.hp <= 0) continue;
        if (freezeAtb) continue;
        if (acting) {
          if (acting.has(u.id)) continue;
        } else if (b.actingId && u.id === b.actingId) {
          continue;
        }
        const walk = Math.max(1, u.spd || 1);
        if (isStunned(u)) {
          tickStatuses(u, walk);
          continue;
        }
        tickStatuses(u, walk);
        const spd = effectiveSpd(u);
        u.gauge += spd;
        applyGaugeRegen(u, spd);
        advanceMendPulsesFromHealer(b, u, spd);
        if (u.gauge >= GAUGE_MAX) u.gauge = GAUGE_MAX;
      }
    }

    syncHeroHp(b);
    updateGaugeBars(b);

    if (isFlowBattle(b)) {
      // 开场技期间先别开打；否则谁满谁放、可并行
      if (!b.opening) {
        for (const u of battleUnits(b)) {
          if (u.hp <= 0 || isStunned(u)) continue;
          if (u.gauge < GAUGE_MAX) continue;
          if (acting.has(u.id)) continue;
          void startFlowAction(b, u);
        }
      }
      return;
    }

    if (b.autoMode > 0 && b.waitingPlayer && b.readyHero && !b.autoResolving) {
      void runHeroAutoSkill(b, b.readyHero);
      return;
    }

    if (!b.busy && !b.autoResolving && !b.waitingPlayer) {
      const ready = pickReadyUnit(b);
      if (ready) void unitAct(b, ready);
    }
  }

  function toggleAuto() {
    const b = getState().battle;
    if (!b || b.ending) return;
    let next;
    if (isFlowBattle(b)) {
      // 流畅：1x → 1.5x → 2x → 1x（不再空点一档）
      const cur = b.autoMode >= 1 ? b.autoMode : 1;
      next = cur >= 3 ? 1 : cur + 1;
    } else {
      next = ((b.autoMode || 0) + 1) % 4;
    }
    b.autoMode = next;
    b.battleSpeed = battleSpeedFromMode(next);
    setBattleAutoMode(next);
    syncAutoButton(b);

    if (b.autoMode > 0 && b.waitingPlayer && b.readyHero && !b.autoResolving) {
      void runHeroAutoSkill(b, b.readyHero);
    }
  }

  function flee() {
    const b = getState().battle;
    if (!b || b.ending) return;
    // 随时可逃（流畅几乎一直 busy，不能再要求「不忙」）
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
    if (touched?.isBoss) {
      if (!state.bossUniqueLoot || typeof state.bossUniqueLoot !== "object") {
        state.bossUniqueLoot = {};
      }
      const urgent = bossUniqueUrgent(
        touched.floor || state.floor || 1,
        state.bossUniqueLoot
      );
      const line = bossTauntLine(touched, { urgent });
      const toast = $("lootToast") || $("toast");
      if (toast && line) {
        toast.textContent = line;
        toast.classList.remove("hidden");
        clearTimeout(toast._bossTauntTimer);
        toast._bossTauntTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
      }
    }
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
      skillAtk: hero.skillAtk ?? hero.atk,
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
      dots: {},
      dot: null,
      killStacks: 0,
      firstSkillDone: false,
      windEnchant: null,
      gaugeRegen: { hp: 0, mp: 0 },
      combat: blankCombat(),
    }));

    for (const e of enemies) ensureCombat(e);
    for (const u of [...allies, ...enemies]) syncBoardPosFromRowCol(u);

    const autoMode = getBattleAutoMode();
    state.battle = {
      allies,
      enemies,
      busy: false,
      waitingPlayer: false,
      autoResolving: false,
      actingId: null,
      actingIds: new Set(),
      opening: false,
      /** flow=别人行动时条继续走；classic=全体暂停 */
      atbDuringAct: state.paceMode === "flow",
      autoMode,
      battleSpeed: battleSpeedFromMode(autoMode),
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

    void runOpeningSkills(state.battle);
  }

  /** 队伍里小绿的春芽技能等级；没有小绿则按 1 级 */
  function partyGreenBloomLevel() {
    const green = (getState().party || []).find((h) => h?.statsId === "green");
    return green ? getSkillLevel(green, "green_bloom") : 1;
  }

  /**
   * 开场技能：增益 > 治疗 > 伤害
   * - 强化风刃：开场释放风刃
   * - 春芽戒：开场 10% 春芽全体治疗
   */
  async function runOpeningSkills(b) {
    if (!b || b.ending) return;
    /** @type {{ ally: object, kind: string, prio: number }[]} */
    const jobs = [];
    for (const ally of b.allies || []) {
      if (!ally || ally.hp <= 0) continue;
      const hero = actingHero(ally);
      if (heroHasUnique(hero, "cyan_cut_gale")) {
        jobs.push({ ally, kind: "cyan_cut", prio: 0 });
      }
      if (heroHasUnique(hero, "green_spring_bloom")) {
        jobs.push({ ally, kind: "spring_bloom", prio: 1 });
      }
    }
    if (!jobs.length) return;
    jobs.sort((a, c) => a.prio - c.prio);

    b.opening = true;
    b.busy = true;
    setBattleButtons(false);
    const bloomLv = partyGreenBloomLevel();
    try {
      for (const job of jobs) {
        const ally = job.ally;
        if (!b || b.ending || ally.hp <= 0) continue;
        const hero = actingHero(ally);
        if (job.kind === "cyan_cut") {
          await resolveHeroSkill(b, ally, "cyan_cut", { freeCast: true });
          continue;
        }
        if (job.kind === "spring_bloom") {
          const mods = sumSkillMods(hero?.equip);
          const full = skillHealAmount(ally, "green_bloom", mods, bloomLv);
          const amount = Math.max(1, Math.floor(full * 0.1));
          const list = livingAllies(b);
          if (!list.length) continue;
          const primary = pickLowestAlly(b) || list[0];
          // 春芽戒可穿别人身上；脉动戒在谁身上，脉动就记谁为治疗者
          const pulseHealer =
            b.allies.find((a) =>
              heroHasUnique(actingHero(a), "green_mend_pulse")
            ) || ally;
          await playSkillAnim("heal", ally.id, primary.id, {
            skillId: "green_bloom",
            statsId: "green",
            color: hero?.color || ally.color || "",
            battleSpeed: b.battleSpeed || 1,
            shotDuration: ANIM_SLOW_MS,
          });
          for (const t of list) {
            if (t.hp <= 0) continue;
            const healed = applyHeal(t, amount, { source: ally });
            applyMendPulse(b, pulseHealer, t, healed || amount);
          }
          applyLifeFlowBuff(b, ally);
          syncHeroHp(b);
          renderBattle(b);
        }
      }
    } finally {
      b.opening = false;
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
