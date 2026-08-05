/**
 * 全部角色属性总表（后续新角色也写在这里）
 *
 * 行动条规则：
 * - 满值 GAUGE_MAX = 100
 * - 游戏时间单位见 core/time.js：每 0.1 秒为一跳
 * - 速度 = 每一跳往行动条增加的点数
 * - 例：速度 20 → 100/20 = 5 跳 → 0.5 秒行动一次
 *
 * 自动战斗相关会写入 localStorage，刷新页面后仍保留。
 */

import { TICK_SECONDS } from "../core/time.js?v=75";

export const GAUGE_MAX = 100;
export { TICK_SECONDS };

/** 角色默认速度（点 / 0.1秒） */
export const DEFAULT_HERO_SPEED = 20;

const STORAGE_KEY = "moku_character_settings_v1";

/**
 * 角色基础属性表
 * id 与角色目录对应，如 omni → characters/omni/
 */
export const CHARACTER_STATS = {
  omni: {
    id: "omni",
    name: "小全能",
    className: "全能",
    gender: "male",
    color: "#3cb86a",
    shape: "diamond",
    base: {
      hp: 66,
      atk: 9,
      def: 4,
      spd: DEFAULT_HERO_SPEED,
    },
    passiveBoost: {
      hp: 11,
      atk: 2,
      def: 1,
      spd: 0,
    },
    // 空 = 普通攻击；默认全空
    autoRotation: ["", "", "", "", ""],
  },
  pink: {
    id: "pink",
    name: "小粉",
    className: "爆发",
    gender: "female",
    color: "#ff7eb3",
    shape: "diamond",
    base: {
      hp: 46,
      atk: 12,
      def: 2,
      spd: DEFAULT_HERO_SPEED + 3,
    },
    passiveBoost: {
      hp: 3,
      atk: 4,
      def: 0,
      spd: 1,
    },
    autoRotation: ["", "", "", "", ""],
  },
  green: {
    id: "green",
    name: "小绿",
    className: "治疗",
    gender: "female",
    color: "#8fdf8a",
    shape: "diamond",
    base: {
      hp: 64,
      atk: 5,
      def: 3,
      spd: DEFAULT_HERO_SPEED - 1,
    },
    passiveBoost: {
      hp: 16,
      atk: 0,
      def: 1,
      spd: 0,
    },
    autoRotation: ["", "", "", "", ""],
  },
  yellow: {
    id: "yellow",
    name: "小黄",
    className: "坦克",
    gender: "male",
    color: "#e8c044",
    shape: "diamond",
    base: {
      hp: 88,
      atk: 6,
      def: 9,
      spd: DEFAULT_HERO_SPEED - 2,
    },
    passiveBoost: {
      hp: 14,
      atk: 0,
      def: 5,
      spd: 0,
    },
    autoRotation: ["", "", "", "", ""],
  },
};

/** 战斗是否默认开启自动（跨刷新保存） */
let battleAutoEnabled = false;

/** 战斗阵容：statsId 或 null，长度 6（跨刷新保存） */
let savedFormation = null;

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {
    /* 隐私模式等可能写失败，忽略 */
  }
}

function collectSave() {
  const rotations = {};
  for (const id of Object.keys(CHARACTER_STATS)) {
    rotations[id] = [...CHARACTER_STATS[id].autoRotation];
  }
  return {
    battleAutoEnabled,
    rotations,
    formation: savedFormation,
  };
}

/** 启动时从 localStorage 恢复设置到总表 */
export function loadSavedSettings() {
  const data = readStorage();
  if (!data) return;
  if (typeof data.battleAutoEnabled === "boolean") {
    battleAutoEnabled = data.battleAutoEnabled;
  }
  if (data.rotations && typeof data.rotations === "object") {
    const validActives = {
      omni: new Set(["attack", "radiant", "quake"]),
      pink: new Set(["pink_shot", "pink_burst", "pink_barrage", "pink_fervor"]),
      green: new Set(["green_bolt", "green_mend", "green_bloom"]),
      yellow: new Set(["yellow_hit", "yellow_slam", "yellow_fortify"]),
    };
    for (const id of Object.keys(data.rotations)) {
      const rot = data.rotations[id];
      const allow = validActives[id];
      const slotOk = (s) => s == null || s === "" || allow.has(s);
      if (
        CHARACTER_STATS[id] &&
        allow &&
        Array.isArray(rot) &&
        rot.length === 5 &&
        rot.every(slotOk)
      ) {
        CHARACTER_STATS[id].autoRotation = rot.map((s) => (s == null || s === "" ? "" : s));
      }
    }
  }
  if (Array.isArray(data.formation) && data.formation.length === 6) {
    savedFormation = data.formation.map((id) => {
      if (!id || typeof id !== "string") return null;
      return CHARACTER_STATS[id] ? id : null;
    });
  }
}

function persist() {
  writeStorage(collectSave());
}

loadSavedSettings();

export function getCharacterStats(id) {
  const data = CHARACTER_STATS[id];
  if (!data) throw new Error(`未知角色属性: ${id}`);
  return data;
}

/** 读取角色自动攻击顺序（拷贝） */
export function getAutoRotation(id) {
  const rot = getCharacterStats(id).autoRotation;
  if (!rot || rot.length !== 5) {
    throw new Error(`角色 ${id} 缺少长度为 5 的 autoRotation`);
  }
  return [...rot];
}

/** 写回角色自动攻击顺序，并持久化（刷新后仍在）；"" 表示空＝普攻 */
export function setAutoRotation(id, rotation) {
  if (!rotation || rotation.length !== 5) {
    throw new Error("autoRotation 必须是 5 个技能");
  }
  getCharacterStats(id).autoRotation = rotation.map((s) =>
    s == null || s === "" ? "" : s
  );
  persist();
  return getAutoRotation(id);
}

export function getBattleAutoEnabled() {
  return battleAutoEnabled;
}

/** 战斗里点「自动」时调用，刷新后进战斗仍保持 */
export function setBattleAutoEnabled(on) {
  battleAutoEnabled = !!on;
  persist();
  return battleAutoEnabled;
}

/** 读取已保存的阵容（statsId[]，未保存过则为 null） */
export function getSavedFormation() {
  return savedFormation ? [...savedFormation] : null;
}

/** 写入战斗阵容（statsId 或 null × 6），刷新后仍保持 */
export function setSavedFormation(slots) {
  if (!Array.isArray(slots) || slots.length !== 6) return null;
  savedFormation = slots.map((id) => {
    if (!id || typeof id !== "string") return null;
    return CHARACTER_STATS[id] ? id : null;
  });
  persist();
  return getSavedFormation();
}

/** 清除角色侧本地设置（阵容 / 自动战斗等）；通常配合整页刷新） */
export function clearCharacterSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  savedFormation = null;
}
