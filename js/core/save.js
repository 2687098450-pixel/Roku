/** 游戏进度本地存档（localStorage） */

import {
  createOmniHero,
  createPinkHero,
  createGreenHero,
  createYellowHero,
  refreshHeroStats,
  normalizeFormation,
  FORMATION_SLOTS,
  rebuildEquipStats,
  refreshSkillTexts,
  expToNext,
} from "../characters/omni/index.js?v=61";
import { createPatrolMonster } from "../monsters/slime.js?v=61";
import { createBoss } from "../monsters/boss.js?v=61";
import { setSavedFormation, clearCharacterSettings } from "../characters/stats.js?v=61";

export const SAVE_KEY = "moku_game_progress_v1";
export const SAVE_VERSION = 1;

let saveTimer = 0;

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function serializeItem(item) {
  if (!item) return null;
  return cloneJson(item);
}

function reviveItem(raw) {
  if (!raw) return null;
  const item = cloneJson(raw);
  if (item.slot || item.kind === "equip" || item.rarity) {
    try {
      rebuildEquipStats(item);
    } catch {
      /* keep raw */
    }
  }
  return item;
}

function serializeEquip(equip = {}) {
  const out = {};
  for (const [k, v] of Object.entries(equip || {})) {
    out[k] = serializeItem(v);
  }
  return out;
}

function reviveEquip(raw = {}) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    out[k] = reviveItem(v);
  }
  return out;
}

function serializeHero(hero) {
  if (!hero) return null;
  return {
    statsId: hero.statsId,
    id: hero.id,
    level: hero.level || 1,
    exp: hero.exp || 0,
    maxExp: hero.maxExp || expToNext(hero.level || 1),
    skillPoints: hero.skillPoints || 0,
    skillLevels: { ...(hero.skillLevels || {}) },
    dead: !!hero.dead,
    hp: hero.hp,
    mp: hero.mp,
    critRate: hero.critRate,
    critDmg: hero.critDmg,
    autoRotation: Array.isArray(hero.autoRotation)
      ? [...hero.autoRotation]
      : undefined,
    equip: serializeEquip(hero.equip),
  };
}

function applyHeroSave(hero, data) {
  if (!hero || !data) return hero;
  hero.level = Math.max(1, Math.floor(data.level || 1));
  hero.exp = Math.max(0, Math.floor(data.exp || 0));
  hero.maxExp = data.maxExp || expToNext(hero.level);
  hero.skillPoints = Math.max(0, Math.floor(data.skillPoints || 0));
  hero.skillLevels = { ...(data.skillLevels || {}) };
  hero.dead = !!data.dead;
  if (data.critRate != null) hero.critRate = data.critRate;
  if (data.critDmg != null) hero.critDmg = data.critDmg;
  if (Array.isArray(data.autoRotation) && data.autoRotation.length) {
    hero.autoRotation = [...data.autoRotation];
  }
  if (data.equip) hero.equip = reviveEquip(data.equip);
  refreshSkillTexts(hero);
  refreshHeroStats(hero);
  if (data.hp != null) {
    hero.hp = Math.max(0, Math.min(hero.maxHp, Number(data.hp)));
  } else if (hero.dead) {
    hero.hp = 0;
  } else {
    hero.hp = hero.maxHp;
  }
  if (data.mp != null) {
    hero.mp = Math.max(0, Math.min(hero.maxMp || 30, Number(data.mp)));
  } else {
    hero.mp = hero.maxMp;
  }
  if (hero.hp <= 0) hero.dead = true;
  return hero;
}

function serializeMonster(m, map) {
  if (!m || !map) return null;
  const ox = map.ox || 0;
  const oy = map.oy || 0;
  const toPlay = (p) =>
    p
      ? {
          x: Math.round(p.x - ox),
          y: Math.round(p.y - oy),
        }
      : null;
  return {
    kind: m.kind || m.type || (m.isBoss ? "boss" : "slime"),
    isBoss: !!m.isBoss,
    from: toPlay(m.from) || toPlay(m),
    to: toPlay(m.to) || toPlay(m.from) || toPlay(m),
    x: Math.round((m.x ?? 0) - ox),
    y: Math.round((m.y ?? 0) - oy),
    dir: m.dir === -1 ? -1 : 1,
  };
}

function reviveMonsters(list, map, floor, scale) {
  if (!Array.isArray(list) || !map) return null;
  const ox = map.ox;
  const oy = map.oy;
  const out = [];
  for (const raw of list) {
    if (!raw) continue;
    if (raw.isBoss || raw.kind === "boss") {
      const pos = raw.from || { x: raw.x, y: raw.y };
      const boss = createBoss({
        pos,
        ox,
        oy,
        scale,
        floor,
      });
      boss.x = ox + (raw.x ?? pos.x);
      boss.y = oy + (raw.y ?? pos.y);
      boss.dir = raw.dir === -1 ? -1 : 1;
      out.push(boss);
      continue;
    }
    const kind = raw.kind || "slime";
    const from = raw.from || { x: raw.x, y: raw.y };
    const to = raw.to || from;
    const m = createPatrolMonster(kind, {
      from,
      to,
      ox,
      oy,
      scale,
      floor,
    });
    m.x = ox + (raw.x ?? from.x);
    m.y = oy + (raw.y ?? from.y);
    m.dir = raw.dir === -1 ? -1 : 1;
    out.push(m);
  }
  return out;
}

/** 导出可写入 localStorage 的进度快照 */
export function serializeProgress(state) {
  if (!state) return null;
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    floor: state.floor || 1,
    visitedFloors: Array.isArray(state.visitedFloors)
      ? [...state.visitedFloors]
      : [1],
    gold: state.gold || 0,
    gem: state.gem || 0,
    // 坐标仅作参考；读档时强制回出生点，不恢复站位
    playerPos: state.map?.spawn
      ? { x: state.map.spawn.x, y: state.map.spawn.y }
      : state.playerPos
        ? { x: state.playerPos.x, y: state.playerPos.y }
        : null,
    formation: Array.isArray(state.formation)
      ? state.formation.map((id) => id || null)
      : [],
    formationStats: (state.formation || []).map((id) => {
      if (!id) return null;
      const h = state.party?.find((p) => p.id === id);
      return h?.statsId || null;
    }),
    captainId: state.captainId || null,
    captainStatsId:
      state.party?.find((h) => h.id === state.captainId)?.statsId || null,
    inventory: (state.inventory || []).map(serializeItem),
    party: (state.party || []).map(serializeHero),
    monsters: (state.monsters || [])
      .map((m) => serializeMonster(m, state.map))
      .filter(Boolean),
    monsterTotal: state.monsterTotal || 0,
  };
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn("存档写入失败", err);
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** 清空进度与角色设置，用于「重置游戏」 */
export function resetGameLocalData() {
  clearSave();
  clearCharacterSettings();
}

export const PHONE_ITEM = {
  id: "phone",
  name: "手机",
  kind: "tool",
  useId: "phone_dial",
  qty: 1,
  tint: "#6b7c8f",
  desc: "一部能拨号的手机。",
};

const DEAD_BAG_IDS = new Set(["potion_hp", "potion_mp", "cake", "seed"]);

/** 去掉已废弃道具，确保有手机；道具优先于装备 */
export function sanitizeInventory(state) {
  if (!state) return;
  let inv = Array.isArray(state.inventory) ? state.inventory.filter(Boolean) : [];
  inv = inv.filter((it) => it && !DEAD_BAG_IDS.has(it.id));
  if (!inv.some((it) => it.useId === "phone_dial" || it.id === "phone")) {
    inv = [{ ...PHONE_ITEM }, ...inv];
  }
  const tools = [];
  const equips = [];
  for (const it of inv) {
    if (it.slot || it.kind === "equip" || it.rarity) equips.push(it);
    else tools.push(it);
  }
  state.inventory = [...tools, ...equips];
}

export function saveProgress(state) {
  const snap = serializeProgress(state);
  if (!snap) return false;
  if (Array.isArray(snap.formationStats)) {
    setSavedFormation(snap.formationStats);
  }
  return writeSave(snap);
}

export function scheduleSave(state, delay = 250) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveProgress(state);
  }, delay);
}

export function flushSave(state) {
  clearTimeout(saveTimer);
  return saveProgress(state);
}

/**
 * 把存档应用到已有 state
 * @returns {{ ok: boolean, restored: boolean, reason?: string }}
 */
export function loadProgressIntoState(state, applyFloorFn) {
  const data = readSave();
  if (!data || !Array.isArray(data.party) || !data.party.length) {
    return { ok: false, restored: false, reason: "empty" };
  }

  const makers = {
    omni: createOmniHero,
    pink: createPinkHero,
    green: createGreenHero,
    yellow: createYellowHero,
  };

  const party = [];
  for (const raw of data.party) {
    if (!raw?.statsId || !makers[raw.statsId]) continue;
    const hero = makers[raw.statsId]();
    if (raw.id) hero.id = raw.id;
    applyHeroSave(hero, raw);
    party.push(hero);
  }
  // 旧档补全小黄
  for (const sid of Object.keys(makers)) {
    if (!party.some((h) => h.statsId === sid)) {
      party.push(makers[sid]());
    }
  }
  if (!party.length) return { ok: false, restored: false, reason: "no-party" };

  state.party = party;
  state.gold = Math.max(0, Math.floor(data.gold || 0));
  state.gem = Math.max(0, Math.floor(data.gem || 0));
  state.inventory = (data.inventory || []).map(reviveItem).filter(Boolean);
  state.visitedFloors = Array.isArray(data.visitedFloors)
    ? data.visitedFloors.filter((n) => n >= 1)
    : [1];
  if (!state.visitedFloors.length) state.visitedFloors = [1];

  if (data.captainId && party.some((h) => h.id === data.captainId)) {
    state.captainId = data.captainId;
  } else if (data.captainStatsId) {
    state.captainId =
      party.find((h) => h.statsId === data.captainStatsId)?.id || party[0]?.id || null;
  } else {
    state.captainId = party[0]?.id || null;
  }
  for (const h of party) {
    h.isCaptain = h.id === state.captainId;
    refreshHeroStats(h);
  }

  if (Array.isArray(data.formation) && data.formation.some(Boolean)) {
    state.formation = data.formation.map((id) => {
      if (!id) return null;
      return party.some((h) => h.id === id) ? id : null;
    });
  } else if (Array.isArray(data.formationStats)) {
    state.formation = data.formationStats.map((sid) => {
      if (!sid) return null;
      return party.find((h) => h.statsId === sid)?.id || null;
    });
  }
  normalizeFormation(state, FORMATION_SLOTS);
  if (!state.formation.some(Boolean)) {
    state.formation = [
      party[0]?.id || null,
      null,
      null,
      party[1]?.id || null,
      party[2]?.id || null,
      null,
    ];
    normalizeFormation(state, FORMATION_SLOTS);
  }
  setSavedFormation(
    state.formation.map((id) => party.find((h) => h.id === id)?.statsId || null)
  );

  const floor = Math.max(1, Math.floor(data.floor || 1));
  applyFloorFn(state, floor);

  const restoredMonsters = Array.isArray(data.monsters)
    ? reviveMonsters(data.monsters, state.map, state.floor, state.floorScale)
    : null;
  if (restoredMonsters) {
    state.monsters = restoredMonsters;
    state.monsterTotal =
      data.monsterTotal != null
        ? Math.max(restoredMonsters.length, Math.floor(data.monsterTotal))
        : Math.max(state.monsterTotal || 0, restoredMonsters.length);
  }

  // 刷新读档：进度保留，位置始终回到本层起点
  if (state.map?.spawn) {
    state.playerPos = { ...state.map.spawn };
    state.displayPos = { ...state.map.spawn };
    state.camReady = false;
  }

  state.mode = "explore";
  state.battle = null;
  state.moving = false;
  state.step = null;
  state.path = null;

  sanitizeInventory(state);

  return { ok: true, restored: true };
}
