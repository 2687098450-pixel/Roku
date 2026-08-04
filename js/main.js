import { $ } from "./core/utils.js?v=59";
import {
  canWalk,
  isExitCell,
  drawMap,
  computeCamera,
  screenToTile,
  VIEW_COLS,
} from "./map/island15.js?v=59";
import { buildFloor } from "./map/dungeon.js?v=59";
import { MAX_FLOOR } from "./map/floors.js?v=59";
import {
  createOmniHero,
  createPinkHero,
  createGreenHero,
  createYellowHero,
  getDeployedHeroes,
  normalizeFormation,
  FORMATION_SLOTS,
  diamondDims,
  makeItem,
  toBagEquip,
  refreshHeroStats,
} from "./characters/omni/index.js?v=59";
import { getSavedFormation } from "./characters/stats.js?v=59";
import { moveSlimeOnce } from "./monsters/slime.js?v=59";
import { createBattleApi } from "./battle/system.js?v=59";
import { createUI } from "./ui/shell.js?v=59";
import {
  loadProgressIntoState,
  flushSave,
  sanitizeInventory,
} from "./core/save.js?v=59";

const canvas = $("map");
const ctx = canvas.getContext("2d");

/** 相机跟随速度（越大越快贴上） */
const CAM_SMOOTH = 10;
/** 走一格动画时长（秒） */
const STEP_DUR = 0.16;

const omni = createOmniHero();
const pink = createPinkHero();
const green = createGreenHero();
const yellow = createYellowHero();

function defaultFormation() {
  return [yellow.id, omni.id, null, pink.id, green.id, null];
}

function restoreFormation(party) {
  const saved = getSavedFormation();
  if (!saved) return defaultFormation();
  const next = saved.map((statsId) => {
    if (!statsId) return null;
    const hero = party.find((h) => h.statsId === statsId);
    return hero ? hero.id : null;
  });
  while (next.length < FORMATION_SLOTS) next.push(null);
  const stateLike = { formation: next.slice(0, FORMATION_SLOTS), party };
  normalizeFormation(stateLike, FORMATION_SLOTS);
  if (!getDeployedHeroes(stateLike).length) return defaultFormation();
  return stateLike.formation;
}

function markVisited(state, floorNum) {
  if (!Array.isArray(state.visitedFloors)) state.visitedFloors = [];
  const f = Math.max(1, Math.min(MAX_FLOOR, Number(floorNum) || 1));
  if (!state.visitedFloors.includes(f)) {
    state.visitedFloors.push(f);
    state.visitedFloors.sort((a, b) => a - b);
  }
}

/** 进入 / 传送到某层：重建地图与怪物（传送会刷新本层怪物） */
function applyFloor(state, floorNum) {
  const built = buildFloor(floorNum);
  state.map = built.map;
  state.monsters = built.monsters;
  state.monsterTotal = built.monsters.length;
  state.floor = built.floor;
  state.floorScale = built.scale;
  state.placeName = built.name;
  state.placeFloor = `${built.floor}层`;
  state.playerPos = { ...built.map.spawn };
  state.displayPos = { ...built.map.spawn };
  state.camReady = false;
  state.moving = false;
  state.step = null;
  state.path = null;
  markVisited(state, built.floor);
}

const state = {
  mode: "explore",
  floor: 1,
  floorScale: 1,
  map: null,
  playerPos: null,
  displayPos: null,
  party: [omni, pink, green, yellow],
  formation: restoreFormation([omni, pink, green, yellow]),
  captainId: yellow.id,
  inventory: [
    {
      id: "phone",
      name: "手机",
      kind: "tool",
      useId: "phone_dial",
      qty: 1,
      tint: "#6b7c8f",
      desc: "一部能拨号的手机。",
    },
    {
      id: "warp_refresh_orb",
      name: "传送刷新球",
      kind: "tool",
      useId: "warp_refresh",
      qty: 1,
      tint: "#c4a0ff",
      desc: "传送到已到过的任意楼层，并刷新该层全部怪物。从高层回到低层后，仍可再传回高层。",
    },
    toBagEquip(makeItem("短剑", "weapon", { atk: 4 }, { id: "sword_bag", rarity: "blue", icon: "sword.png", kind: "剑", level: 10 })),
    toBagEquip(makeItem("木戒", "ringL", { atk: 1 }, { id: "ring_bag", rarity: "purple", icon: "ring.png", level: 5 })),
    toBagEquip(makeItem("木盾", "shield", { def: 2 }, { id: "wood_shield_bag", rarity: "orange", icon: "wood_shield.png", level: 8 })),
  ],
  visitedFloors: [1],
  monsters: [],
  monsterTotal: 0,
  gold: 120,
  gem: 15,
  placeName: "阳光海岛",
  placeFloor: "1层",
  battle: null,
  moving: false,
  step: null,
  /** 自动寻路剩余格子 [{x,y}, ...] */
  path: null,
  tile: 64,
  viewW: 0,
  viewH: 0,
  camX: 0,
  camY: 0,
  camReady: false,
  cam: { camX: 0, camY: 0, viewW: 0, viewH: 0 },
  time: 0,
};

let toastTimer = 0;

function showToast(msg, ms = 2600) {
  const el = $("lootToast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

function isLiving(h) {
  return h && !h.dead && h.hp > 0;
}

function getHero() {
  return (
    getDeployedHeroes(state).find(isLiving) ||
    state.party.find(isLiving) ||
    state.party[0]
  );
}

function getDeployed() {
  return getDeployedHeroes(state).filter(isLiving);
}

function setMode(mode) {
  state.mode = mode;
}

function showExplore() {
  $("explore").classList.remove("hidden");
  ui.refreshExploreHud();
  state.camReady = false;
  resize();
}

function hideExplore() {
  $("explore").classList.add("hidden");
  ui.closeModals();
}

function sameTile(a, b) {
  return a.x === b.x && a.y === b.y;
}

function resetMonsterAway(m) {
  m.x = m.from.x;
  m.y = m.from.y;
  m.dir = 1;
  if (sameTile(state.playerPos, m)) {
    m.x = m.to.x;
    m.y = m.to.y;
    m.dir = -1;
  }
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function goNextFloor() {
  if (state.floor >= MAX_FLOOR) {
    showToast("已通关全部 10 层！出口暂时关闭。", 3200);
    return;
  }
  const next = state.floor + 1;
  applyFloor(state, next);
  showToast(`进入 ${state.placeName}（${state.placeFloor}）`, 2400);
  ui.refreshExploreHud();
  resize();
  flushSave(state);
}

/** 传送刷新球：跳到已访问层并重建怪物 */
function warpToFloor(floorNum) {
  const f = Math.max(1, Math.min(MAX_FLOOR, Number(floorNum) || 1));
  if (!state.visitedFloors?.includes(f)) {
    showToast("尚未到达过该层", 2200);
    return false;
  }
  applyFloor(state, f);
  showToast(`传送至 ${state.placeName}（${f}层），怪物已刷新`, 2800);
  ui.refreshExploreHud();
  resize();
  flushSave(state);
  return true;
}

const battle = createBattleApi({
  getState: () => state,
  setMode,
  getHero,
  getDeployed,
  showExplore,
  hideExplore,
  onBattleEnd(result, monsters, loot, reward) {
    const pack = Array.isArray(monsters) ? monsters : monsters ? [monsters] : [];
    if (result === "blocked") {
      showToast("没有可出战的英雄，请在阵容中单独复活", 2800);
      return;
    }
    if (result === "win") {
      const parts = [];
      if (reward?.share > 0) parts.push(`经验 +${reward.share}`);
      if (reward?.gold > 0) parts.push(`金币 +${reward.gold}`);
      if (reward?.gems > 0) parts.push(`钻石 +${reward.gems}`);
      if (reward?.levelUps?.length) {
        parts.push(
          reward.levelUps.map((u) => `${u.name}升至${u.to}级`).join("、")
        );
      }
      if (loot?.length) {
        parts.push(`装备：${loot.map((it) => it.name).join("、")}`);
      }
      const deadNames = state.party.filter((h) => h.dead).map((h) => h.name);
      if (deadNames.length) parts.push(`${deadNames.join("、")}阵亡`);
      if (parts.length) showToast(parts.join(" · "), 3600);
      ui.refreshExploreHud();
      flushSave(state);
      return;
    }
    if (result === "lose") {
      showToast("全员阵亡！可在阵容或角色详情中单独复活英雄", 3200);
      ui.refreshExploreHud();
      flushSave(state);
    }
    if (!pack.length) return;
    if (result === "flee" || result === "lose") {
      for (const monster of pack) {
        if (result === "lose") {
          monster.x = monster.to.x;
          monster.y = monster.to.y;
          monster.dir = -1;
        } else {
          resetMonsterAway(monster);
        }
      }
      flushSave(state);
    }
  },
});

const ui = createUI({
  getState: () => state,
  setMode,
  canOpenParty: () => state.mode === "explore" || state.mode === "menu" || state.mode === "detail",
  onWarpFloor: warpToFloor,
  onProgressChange: () => flushSave(state),
});

function resize() {
  const wrap = $("mapWrap");
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.viewW = w;
  state.viewH = h;
  state.tile = Math.max(24, w / VIEW_COLS);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const target = computeCamera(state.map, state.displayPos, state.tile, w, h);
  if (!state.camReady) {
    state.camX = target.camX;
    state.camY = target.camY;
    state.camReady = true;
  }
  state.cam = { camX: state.camX, camY: state.camY, viewW: w, viewH: h };
}

function updateCamera(dt) {
  const target = computeCamera(
    state.map,
    state.displayPos,
    state.tile,
    state.viewW,
    state.viewH
  );
  const k = 1 - Math.exp(-CAM_SMOOTH * dt);
  state.camX += (target.camX - state.camX) * k;
  state.camY += (target.camY - state.camY) * k;
  state.cam = {
    camX: state.camX,
    camY: state.camY,
    viewW: state.viewW,
    viewH: state.viewH,
  };
}

function draw() {
  const leader = getHero();
  const form = diamondDims(leader, 1, state.party);
  drawMap(
    ctx,
    state.map,
    {
      tile: state.tile,
      time: state.time,
      playerPos: state.displayPos,
      logicPos: state.playerPos,
      playerColor: leader.color,
      playerAspect: form.aspect,
      playerScale: form.h / 40,
      ...state.cam,
    },
    { monsters: state.monsters, exitOpen: !bossAlive() }
  );
}

function monsterAtPlayer() {
  return state.monsters.find((m) => sameTile(state.playerPos, m)) || null;
}

function tryEnterBattle() {
  const hit = monsterAtPlayer();
  if (hit) {
    battle.enter(hit);
    return true;
  }
  return false;
}

function bossAlive() {
  return state.monsters.some((m) => m.isBoss);
}

/** Boss 未死时出口不可走；死后才能踩上 */
function canPlayerWalk(x, y) {
  if (canWalk(state.map, x, y)) return true;
  if (isExitCell(state.map, x, y) && !bossAlive()) return true;
  return false;
}

function tryEnterExit() {
  if (!isExitCell(state.map, state.playerPos.x, state.playerPos.y)) return false;
  if (bossAlive()) return false;
  goNextFloor();
  return true;
}

/** BFS 四向寻路，返回不含起点、含终点的格子列表；不可达则 null */
function findPath(from, to) {
  if (!from || !to) return null;
  if (from.x === to.x && from.y === to.y) return [];
  if (!canPlayerWalk(to.x, to.y)) return null;

  const key = (x, y) => `${x},${y}`;
  const q = [{ x: from.x, y: from.y }];
  const prev = new Map([[key(from.x, from.y), null]]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (!canPlayerWalk(nx, ny)) continue;
      prev.set(k, cur);
      if (nx === to.x && ny === to.y) {
        const path = [];
        let p = { x: nx, y: ny };
        while (p && !(p.x === from.x && p.y === from.y)) {
          path.push(p);
          p = prev.get(key(p.x, p.y));
        }
        path.reverse();
        return path;
      }
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

function clearPath() {
  state.path = null;
}

function startStepTo(nx, ny) {
  state.moving = true;
  state.step = {
    fromX: state.displayPos.x,
    fromY: state.displayPos.y,
    toX: nx,
    toY: ny,
    t: 0,
    dur: STEP_DUR,
  };
  state.playerPos.x = nx;
  state.playerPos.y = ny;
}

/** 沿 path 走出下一步；途中被挡则清空 */
function continuePath() {
  if (state.mode !== "explore" || state.moving || state.step) return;
  if (!state.path?.length) {
    clearPath();
    return;
  }
  const next = state.path[0];
  const dx = next.x - state.playerPos.x;
  const dy = next.y - state.playerPos.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1 || !canPlayerWalk(next.x, next.y)) {
    clearPath();
    return;
  }
  state.path.shift();
  startStepTo(next.x, next.y);
}

function finishStep() {
  if (tryEnterBattle()) {
    clearPath();
    state.moving = false;
    return;
  }

  for (const m of state.monsters) {
    moveSlimeOnce(m, state.map);
  }

  if (tryEnterBattle()) {
    clearPath();
    state.moving = false;
    return;
  }

  if (tryEnterExit()) {
    clearPath();
    state.moving = false;
    return;
  }

  state.moving = false;
  continuePath();
}

function updateStep(dt) {
  const step = state.step;
  if (!step) return;
  step.t += dt;
  const u = Math.min(1, step.t / step.dur);
  const e = easeOutCubic(u);
  state.displayPos.x = step.fromX + (step.toX - step.fromX) * e;
  state.displayPos.y = step.fromY + (step.toY - step.fromY) * e;
  if (u < 1) return;

  state.displayPos.x = step.toX;
  state.displayPos.y = step.toY;
  state.playerPos.x = step.toX;
  state.playerPos.y = step.toY;
  state.step = null;
  finishStep();
}

function movePlayer(dx, dy) {
  if (state.mode !== "explore" || state.moving || state.step) return;
  if (!state.party.some(isLiving)) {
    showToast("没有存活英雄，请打开角色详情花费金币复活", 2800);
    return;
  }
  clearPath();
  const nx = state.playerPos.x + dx;
  const ny = state.playerPos.y + dy;
  if (!canPlayerWalk(nx, ny)) return;
  startStepTo(nx, ny);
}

/** 点击/触屏：寻路到目标格并自动走过去 */
function pathToTile(x, y) {
  if (state.mode !== "explore") return;
  if (!state.party.some(isLiving)) {
    showToast("没有存活英雄，请打开角色详情花费金币复活", 2800);
    return;
  }
  const goal = { x: Math.floor(x), y: Math.floor(y) };
  // 逻辑坐标在迈步时已到目标格，寻路从该点开始
  const from = { x: state.playerPos.x, y: state.playerPos.y };
  if (from.x === goal.x && from.y === goal.y) return;

  const path = findPath(from, goal);
  if (!path) {
    showToast("无法到达", 1200);
    return;
  }
  if (!path.length) return;

  state.path = path;
  // 空闲时立刻开走；迈步动画中则等本步结束后接上
  if (!state.moving && !state.step) continuePath();
}

function bindExplore() {
  canvas.addEventListener("pointerdown", (e) => {
    if (state.mode !== "explore") return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.viewW / rect.width;
    const scaleY = state.viewH / rect.height;
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    const { x, y } = screenToTile(state.cam, state.tile, localX, localY);
    pathToTile(x, y);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const reset = $("resetConfirmModal");
      if (reset && !reset.classList.contains("hidden")) {
        reset.querySelector("#closeResetConfirm")?.click();
        return;
      }
      const phone = $("phoneModal");
      if (phone && !phone.classList.contains("hidden")) {
        phone.querySelector("#closePhone")?.click();
        return;
      }
      const warp = $("warpModal");
      if (warp && !warp.classList.contains("hidden")) {
        warp.querySelector("#closeWarp")?.click();
        return;
      }
      const bagSell = $("bagSellModal");
      if (bagSell && !bagSell.classList.contains("hidden")) {
        bagSell.querySelector("#closeBagSell")?.click();
        return;
      }
      const equipPick = $("equipPickModal");
      if (equipPick && !equipPick.classList.contains("hidden")) {
        equipPick.querySelector("#closeEquipPick")?.click();
        return;
      }
      const equipPrev = $("equipPreviewModal");
      if (equipPrev && !equipPrev.classList.contains("hidden")) {
        equipPrev.querySelector("#closeEquipPreview")?.click();
        return;
      }
      const skillDetail = $("skillDetailModal");
      if (skillDetail && !skillDetail.classList.contains("hidden")) {
        skillDetail.querySelector("#closeSkillDetail")?.click();
        return;
      }
      const pick = $("skillPickModal");
      if (pick && !pick.classList.contains("hidden")) {
        pick.querySelector("#closeSkillPick")?.click();
        return;
      }
      if (state.mode === "detail" || state.mode === "menu") ui.closeModals();
      return;
    }
    if (state.mode !== "explore") return;
    const key = e.key.toLowerCase();
    if (key === "arrowup" || key === "w") movePlayer(0, -1);
    else if (key === "arrowdown" || key === "s") movePlayer(0, 1);
    else if (key === "arrowleft" || key === "a") movePlayer(-1, 0);
    else if (key === "arrowright" || key === "d") movePlayer(1, 0);
  });

  window.addEventListener("resize", resize);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;
  if (state.mode === "explore") {
    updateStep(dt);
    updateCamera(dt);
    draw();
  } else if (state.mode === "battle") {
    battle.tick(dt);
  }
  requestAnimationFrame(frame);
}

ui.bind();
bindExplore();
battle.bind();

const loaded = loadProgressIntoState(state, applyFloor);
if (!loaded.restored) {
  applyFloor(state, 1);
}
if (!state.captainId || !state.party.some((h) => h.id === state.captainId)) {
  state.captainId =
    (state.formation || []).find((id) => !!id) || state.party[0]?.id || null;
}
for (const h of state.party) {
  h.isCaptain = h.id === state.captainId;
  refreshHeroStats(h);
}
sanitizeInventory(state);
flushSave(state);

resize();
ui.refreshExploreHud();
if (loaded.restored) {
  const f = state.floor || 1;
  showToast(`已读取本地进度 · 当前 ${state.placeName || ""} ${f}层`, 3200);
} else {
  showToast("点击地面可自动寻路。出口在蓝色楼梯，击败紫色 Boss 后前进。", 3600);
}

window.addEventListener("pagehide", () => {
  if (window.__MOKU_SKIP_SAVE__) return;
  flushSave(state);
});
window.addEventListener("beforeunload", () => {
  if (window.__MOKU_SKIP_SAVE__) return;
  flushSave(state);
});
document.addEventListener("visibilitychange", () => {
  if (window.__MOKU_SKIP_SAVE__) return;
  if (document.visibilityState === "hidden") flushSave(state);
});

requestAnimationFrame(frame);
