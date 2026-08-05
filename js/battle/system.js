/** 战斗系统：读条、技能、自动循环 */

import { $, clamp, irand } from "../core/utils.js?v=73";
import { playSkillAnim, playReflectSpikes } from "./anim.js?v=73";
import {
  refreshHeroStats,
  skillPower,
  skillHealAmount,
  isHealSkill,
  isBuffSkill,
  scaledSkillDef,
  SKILL_POWER,
  nextAutoSkill,
  getBattleFormation,
  FORMATION_COLS,
  activeSkills,
  diamondStyleAttr,
  sumSkillMods,
  heroHasUnique,
} from "../characters/omni/index.js?v=73";
import {
  gainExp,
  splitExp,
  getSkillLevel,
  DEFAULT_CRIT_RATE,
  DEFAULT_CRIT_DMG,
  isHeroDead,
} from "../characters/progression.js?v=73";
import {
  refreshSkillTexts,
  calcReflectEnemyDamage,
  getReflectParams,
  applyReflectAllyUnique,
} from "../characters/skills.js?v=73";
import { buildEncounter } from "../monsters/roster.js?v=73";
import { pickMonsterSkill, monsterSkillDamage } from "../monsters/skills.js?v=73";
import { monsterShapeDomProps } from "../monsters/visuals.js?v=73";
import { rollBattleLoot } from "../loot/drops.js?v=73";
import {
  GAUGE_MAX,
  getBattleAutoEnabled,
  setBattleAutoEnabled,
} from "../characters/stats.js?v=73";
import { createTicker } from "../core/time.js?v=73";

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
      b.disabled = !on;
    });
  }

  function battleUnits(b) {
    return [...b.allies, ...b.enemies];
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

  /** 敌人优先打前排，前排清空再打后排；无视灵体 */
  function pickAllyTarget(b) {
    const front = frontAllies(b);
    const pool = front.length ? front : targetableAllies(b);
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
    if (a.row === b.row) return Math.abs(a.col - b.col) === 1;
    if (a.col === b.col) return a.row !== b.row;
    return false;
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

  const SKILL_ICON = {
    attack: "斩",
    radiant: "光",
    quake: "震",
    pink_shot: "箭",
    pink_burst: "爆",
    pink_barrage: "雨",
    pink_fervor: "燃",
    green_bolt: "叶",
    green_mend: "愈",
    green_bloom: "芽",
    yellow_hit: "盾",
    yellow_slam: "猛",
    yellow_fortify: "壁",
  };

  function updateBattleSkillButtons(unit) {
    const hero = actingHero(unit);
    const box = $("battleActions");
    if (!box || !hero) return;
    const actives = activeSkills(hero);
    box.innerHTML = actives
      .map((sk) => {
        const icon = SKILL_ICON[sk.id] || "技";
        const cls =
          sk.style === "heal"
            ? "skill-btn skill heal"
            : sk.style === "buff"
              ? "skill-btn skill buff"
              : "skill-btn skill";
        return `<button type="button" class="${cls}" data-skill="${sk.id}" disabled>
          <span class="skill-icon" data-kind="${sk.id}">${icon}</span>
          <span class="skill-name">${sk.name}</span>
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

  function unitCritRate(unit) {
    return unit.critRate ?? DEFAULT_CRIT_RATE;
  }

  function unitCritDmg(unit) {
    return (unit.critDmg ?? DEFAULT_CRIT_DMG) + (unit.critDmgBonus || 0);
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
      const props = monsterShapeDomProps(u);
      const styleAttr = props.style ? ` style="${props.style}"` : "";
      artCls = props.inner ? " has-monster-art" : "";
      shapeHtml = props.inner
        ? `<div class="shape ${props.className}"${styleAttr}>${props.inner}</div>`
        : `<div class="shape ${props.className}"${styleAttr}></div>`;
    } else {
      const shapeClass = u.shape || "square";
      const shapeStyle =
        u.shape === "diamond"
          ? diamondStyleAttr(u, 1.15, peers)
          : `--c:${u.color}`;
      shapeHtml = `<div class="shape ${shapeClass}" style="${shapeStyle}"></div>`;
    }

    return `<div class="battle-unit ${side}${ready}${stunCls}${bossCls}${spiritCls}${artCls}" data-id="${u.id}" data-col="${u.col ?? 1}" data-kind="${kind}">
      <div class="unit-float">
        <div class="unit-hp"><i style="width:${pct}%"></i></div>
        <div class="unit-atb"><i data-gauge="${u.id}" style="width:${g}%"></i></div>
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
    let raw;
    if (opts.trueDamage) {
      raw = Math.max(1, Math.floor(power));
    } else {
      raw = Math.max(1, power - effectiveDef(target) + irand(-1, 2));
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
    const unit = document.querySelector(`.battle-unit[data-id="${target.id}"]`);
    if (unit) {
      unit.classList.remove("hit", "crit");
      void unit.offsetWidth;
      unit.classList.add(crit ? "crit" : "hit");
    }
    if (!opts.fromReflect && raw > 0) {
      triggerReflect(target);
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

  function triggerReflect(victim) {
    const b = getState().battle;
    if (!b || !victim?.isHero) return;
    const hero = actingHero(victim);
    if (!hero?.skills?.some((s) => s.id === "yellow_reflect")) return;
    const lv = getSkillLevel(hero, "yellow_reflect");
    const p = getReflectParams(lv);
    let allyRatio = applyReflectAllyUnique(
      p.allyRatio,
      heroHasUnique(hero, "yellow_reflect_shield")
    );
    const enemyDmg = reflectBaseDamage(victim);
    const hitIds = [];
    for (const u of battleUnits(b)) {
      if (!u || u.hp <= 0 || u.id === victim.id) continue;
      const isAlly = !!u.isHero;
      if (!isAlly) {
        dealDamage(u, enemyDmg, {
          fromReflect: true,
          trueDamage: true,
        });
        hitIds.push(u.id);
        continue;
      }
      if (allyRatio > 0) {
        const allyDmg = Math.max(1, Math.floor(enemyDmg * allyRatio));
        dealDamage(u, allyDmg, {
          fromReflect: true,
          trueDamage: true,
        });
        hitIds.push(u.id);
      } else if (allyRatio < 0) {
        const healAmt = Math.max(1, Math.floor(enemyDmg * Math.abs(allyRatio)));
        applyHeal(u, healAmt);
        applyMendPulse(b, victim, u, healAmt);
        dealDamage(u, 1, {
          fromReflect: true,
          trueDamage: true,
        });
        hitIds.push(u.id);
      }
    }
    if (hitIds.length) playReflectSpikes(victim.id, hitIds);
    syncHeroHp(b);
  }

  function heroStrike(attacker, target, skillId, mods) {
    if (attacker?.spiritForm) return 0;
    const hero = actingHero(attacker);
    const lv = getSkillLevel(hero, skillId);
    const power = skillPower(effectiveAtk(attacker), skillId, mods, lv);
    return dealDamage(target, power, {
      canCrit: true,
      critRate: unitCritRate(attacker),
      critDmg: unitCritDmg(attacker),
    });
  }

  /** 爆裂枪强化：单段连射（与技能段数独立；每段固定起手 3 发） */
  async function resolvePinkBurstEchoSegment(b, ally, skillId, mods, skillLv, fxMeta) {
    const shotPower = Math.max(
      1,
      Math.floor(skillPower(effectiveAtk(ally), skillId, mods, skillLv) * 0.5)
    );
    let remaining = 3;
    while (remaining > 0) {
      const t = pickLowestEnemy(b);
      if (!t) break;
      remaining -= 1;
      await playSkillAnim("ranged", ally.id, t.id, {
        ...fxMeta,
        shotDuration: 160,
      });
      dealDamage(t, shotPower, {
        canCrit: true,
        critRate: unitCritRate(ally),
        critDmg: unitCritDmg(ally),
      });
      if (t.hp <= 0) remaining += 1;
      renderBattle(b);
    }
  }

  function applyHeal(target, amount) {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const unit = document.querySelector(`.battle-unit[data-id="${target.id}"]`);
    if (unit) {
      unit.classList.remove("healed");
      void unit.offsetWidth;
      unit.classList.add("healed");
    }
    return target.hp - before;
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

  /** 治愈戒：任意治疗后 2 秒脉动（不限治愈之触 / 不限小绿） */
  function applyMendPulse(b, healer, target, healedAmount) {
    const hero = actingHero(healer);
    if (!heroHasUnique(hero, "green_mend_pulse") || !target) return;
    const tickDmg = Math.max(1, Math.floor(Math.max(1, healedAmount) * 0.2));
    target.mendPulse = {
      ticksLeft: 20, // 2s / 0.1s
      walk: 0,
      lostThisCycle: false,
      lastLost: 0,
      tickDmg,
    };
  }

  function advanceMendPulse(b, unit, walked) {
    const p = unit?.mendPulse;
    if (!p || unit.hp <= 0) return;
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
      applyHeal(unit, healAmt);
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
      if (hero) hero.hp = Math.max(0, ally.hp);
    }
  }

  function afterBattleHeal() {
    const list = (getDeployed ? getDeployed() : [getHero()]).filter(
      (h) => h && !isHeroDead(h) && h.hp > 0
    );
    let total = 0;
    let partyHealed = false;

    for (const hero of list) {
      const hasGreen = hero.skills?.some((s) => s.id === "green_aftercare");
      if (hasGreen && !partyHealed) {
        const lv = getSkillLevel(hero, "green_aftercare");
        const def = scaledSkillDef("green_aftercare", lv) || SKILL_POWER.green_aftercare;
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
    return { totalExp, share, levelUps };
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
    state.gold = (state.gold || 0) + gold;
    if (gems) state.gem = (state.gem || 0) + gems;
    return { gold, gems };
  }

  function canUseSkill(b, skillId) {
    const def = SKILL_POWER[skillId];
    if (!def) return false;
    if (isBuffSkill(skillId)) return true;
    if (isHealSkill(skillId)) return livingAllies(b).length > 0;
    if (def.hitAllFront || def.stunGauge || def.stunTurns) {
      return livingEnemies(b).length > 0;
    }
    if (skillId === "gnaw") return livingAllies(b).length > 0;
    return !!pickRandomFront(b) || livingEnemies(b).length > 0;
  }

  function firstUsableSkill(b, hero) {
    const actives = activeSkills(hero);
    for (const sk of actives) {
      if (canUseSkill(b, sk.id)) return sk.id;
    }
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
    if (!canUseSkill(b, used)) used = firstUsableSkill(b, hero);
    if (!used || !canUseSkill(b, used)) return false;

    const skillLv = getSkillLevel(hero, used);
    const def = scaledSkillDef(used, skillLv) || SKILL_POWER[used];
    const style = def.style || "melee";
    const mods = sumSkillMods(hero?.equip);
    const hits = Math.max(1, 1 + (mods.hitBonus || 0));

    const fxMeta = {
      skillId: used,
      statsId: hero?.statsId || "",
      color: hero?.color || ally.color || "",
    };

    let appliedBuff = false;
    if (isBuffSkill(used)) {
      await playSkillAnim("buff", ally.id, ally.id, fxMeta);
      if (def.atkMult) ally.atkBuff = def.atkMult || 0;
      if (def.critDmgBonus) ally.critDmgBonus = def.critDmgBonus || 0;
      if (def.defMult) ally.defBuff = def.defMult || 0;
      ally.buffTurns = def.turns || 3;
      appliedBuff = true;
    } else if (isHealSkill(used)) {
      if (def.target === "all") {
        const amount = skillHealAmount(ally, used, mods, skillLv);
        const list = livingAllies(b);
        const primary = pickLowestAlly(b) || list[0];
        await playSkillAnim(style, ally.id, primary.id, fxMeta);
        for (const t of list) {
          const healed = applyHeal(t, amount);
          applyMendPulse(b, ally, t, healed || amount);
        }
      } else {
        const t = pickLowestAlly(b);
        if (!t) return false;
        const amount = skillHealAmount(ally, used, mods, skillLv, t);
        await playSkillAnim(style, ally.id, t.id, fxMeta);
        const healed = applyHeal(t, amount);
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
          if (h === 0) applyStun(t, stunNeed);
        }
      }
    } else if (
      used === "pink_burst" &&
      heroHasUnique(hero, "pink_burst_echo")
    ) {
      // 技能段数各自独立：每段起手 3 发半伤子弹，击杀仅本段 +1 发
      for (let seg = 0; seg < hits; seg++) {
        if (!livingEnemies(b).length) break;
        await resolvePinkBurstEchoSegment(b, ally, used, mods, skillLv, fxMeta);
      }
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
    renderBattle(b);
    return true;
  }

  /** 施加眩晕：stun = 隐形行动条目标值；期间真实行动条冻结 */
  function applyStun(unit, amount) {
    if (!unit || !(amount > 0)) return;
    const need = Math.max(1, Math.floor(amount));
    // 重复上晕：取更高目标并重置隐形条
    unit.stun = Math.max(unit.stun || 0, need);
    unit.stunBar = 0;
  }

  function isStunned(unit) {
    return !!(unit && unit.stun > 0);
  }

  async function resolveEnemySkill(b, actor) {
    // 保险：眩晕中不应进入出手（正常真实行动条已冻结）
    if (isStunned(actor)) {
      renderBattle(b);
      return;
    }

    const skill = pickMonsterSkill(actor);
    const power = monsterSkillDamage(actor, skill);
    let targets = [];

    if (skill.hitAll) {
      targets = targetableAllies(b);
    } else if (skill.hitFront) {
      const front = frontAllies(b);
      targets = front.length ? front : targetableAllies(b);
    } else {
      const t = pickAllyTarget(b);
      if (t) targets = [t];
    }

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
    for (const t of targets) dealDamage(t, power);
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
      if (!ready || u.spd > ready.spd) ready = u;
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

    const hero = actingHero(unit);
    const { skillId, nextIndex } = nextAutoSkill(hero, unit.rotIndex || 0);
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
        if (u.mendPulse) {
          u.mendPulse.ticksLeft -= 1;
          if (u.mendPulse.ticksLeft <= 0) u.mendPulse = null;
        }
        if (u.hp <= 0) continue;
        // 眩晕：真实行动条冻结；隐形条按速度走，攒满 stun（如 100）后解除
        if (isStunned(u)) {
          u.stunBar = (u.stunBar || 0) + u.spd;
          if (u.stunBar >= u.stun) {
            u.stun = 0;
            u.stunBar = 0;
          }
          continue;
        }
        u.gauge += u.spd;
        if (u.mendPulse) advanceMendPulse(b, u, u.spd);
        if (u.gauge >= GAUGE_MAX) {
          u.gauge = GAUGE_MAX;
          if (!ready || u.spd > ready.spd) ready = u;
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
      lineup = [{ hero, row: "front", col: 1, slot: 4 }];
    }
    for (const { hero } of lineup) {
      hero.isCaptain = hero.id === state.captainId;
      refreshHeroStats(hero);
    }

    setMode("battle");
    hideExplore();
    $("battle").classList.remove("hidden");

    // - 地图怪：只把撞到的那只挂 worldRef，打赢后只删它
    // - 小怪战：混合类型 1～7 只；Boss：后排中央 + 前排/侧翼小怪
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
      atk: hero.atk,
      def: hero.def,
      spd: hero.spd,
      critRate: hero.critRate ?? DEFAULT_CRIT_RATE,
      critDmg: hero.critDmg ?? DEFAULT_CRIT_DMG,
      atkBuff: 0,
      defBuff: 0,
      critDmgBonus: 0,
      buffTurns: 0,
      row,
      col,
      slot,
      stun: 0,
      stunBar: 0,
      gauge: irand(10, 45),
      isHero: true,
      rotIndex: 0,
      spiritForm: false,
      mendPulse: null,
    }));

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
    }
  }

  function bind() {
    $("btnFlee")?.addEventListener("click", flee);
    $("btnAuto")?.addEventListener("click", toggleAuto);
    $("battleActions")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.(".skill-btn[data-skill]");
      if (!btn || btn.disabled) return;
      playerPickSkill(btn.dataset.skill);
    });
  }

  return { enter, tick, playerPickSkill, toggleAuto, flee, bind };
}
