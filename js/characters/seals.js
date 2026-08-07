/** 印章：独立于装备槽；可扩展多种印章（愚人印章为速度档位） */

export const FOOL_SEAL_ID = "fool";

export const SEAL_DEFS = {
  fool: {
    id: "fool",
    name: "愚人印章",
    tint: "#c9a227",
    desc: "奇异的金色印记。装备后可将自身速度设为 0% / 50% / 100%（相对当前速度）。",
  },
};

export function isSealItem(item) {
  return !!(item && (item.kind === "seal" || item.sealId));
}

export function sealDef(itemOrId) {
  const id =
    typeof itemOrId === "string"
      ? itemOrId
      : itemOrId?.sealId || itemOrId?.id;
  return SEAL_DEFS[id] || null;
}

export function makeFoolSeal() {
  const def = SEAL_DEFS.fool;
  return {
    id: `seal_fool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    name: def.name,
    kind: "seal",
    sealId: FOOL_SEAL_ID,
    qty: 1,
    tint: def.tint,
    desc: def.desc,
  };
}

export function heroHasFoolSeal(hero) {
  return hero?.seal?.sealId === FOOL_SEAL_ID;
}

/** 合法速度档：0 / 0.5 / 1；未装备愚人印章时视为 1 */
export function normalizeSpdScale(hero) {
  if (!heroHasFoolSeal(hero)) return 1;
  const s = Number(hero.spdScale);
  if (s === 0 || s === 0.5 || s === 1) return s;
  return 1;
}
