/** 两套节奏共用同一套内容，仅「行动时行动条是否继续走」不同；存档分槽 */

export const PACE_CLASSIC = "classic";
export const PACE_FLOW = "flow";

export const PACE_MODES = [PACE_CLASSIC, PACE_FLOW];

const PREF_KEY = "moku_pace_pref_v1";
const LEGACY_SAVE = "moku_game_progress_v1";
const LEGACY_SETTINGS = "moku_character_settings_v1";

export const PACE_META = {
  [PACE_CLASSIC]: {
    id: PACE_CLASSIC,
    title: "经典",
    tagline: "行动时条停住",
    desc: "有人出手时，其他人行动条暂停。节奏更像回合制。",
  },
  [PACE_FLOW]: {
    id: PACE_FLOW,
    title: "流畅",
    tagline: "行动时条继续走",
    desc: "有人出手时，其他人行动条照常前进。整体更紧凑。",
  },
};

export function isPaceMode(v) {
  return v === PACE_CLASSIC || v === PACE_FLOW;
}

export function saveKeyFor(mode) {
  return `moku_game_progress_v1_${mode}`;
}

export function settingsKeyFor(mode) {
  return `moku_character_settings_v1_${mode}`;
}

export function readPacePref() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return isPaceMode(v) ? v : null;
  } catch {
    return null;
  }
}

export function writePacePref(mode) {
  if (!isPaceMode(mode)) return;
  try {
    localStorage.setItem(PREF_KEY, mode);
  } catch {
    /* ignore */
  }
}

function readJsonKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function copyKeyIfEmpty(dest, src) {
  try {
    if (localStorage.getItem(dest)) return false;
    const raw = localStorage.getItem(src);
    if (!raw) return false;
    localStorage.setItem(dest, raw);
    return true;
  } catch {
    return false;
  }
}

/** 经典档承接旧版未分槽存档（旧版≈条停住的手感） */
export function migrateLegacyForMode(mode) {
  if (mode !== PACE_CLASSIC) return;
  copyKeyIfEmpty(saveKeyFor(mode), LEGACY_SAVE);
  copyKeyIfEmpty(settingsKeyFor(mode), LEGACY_SETTINGS);
}

/** 启动页卡片上的存档摘要 */
export function peekModeSaveSummary(mode) {
  if (!isPaceMode(mode)) return { hasSave: false, floor: 0, placeName: "" };
  if (mode === PACE_CLASSIC) migrateLegacyForMode(mode);
  const data = readJsonKey(saveKeyFor(mode));
  if (!data || !Array.isArray(data.party) || !data.party.length) {
    return { hasSave: false, floor: 0, placeName: "" };
  }
  const floor = Math.max(1, Math.floor(Number(data.floor) || 1));
  const placeName = typeof data.placeName === "string" ? data.placeName : "";
  const loop = Math.max(0, Math.floor(Number(data.loop) || 0));
  return { hasSave: true, floor, placeName, loop };
}
