/**
 * 单位头像：全项目只用固定几档尺寸，禁止再散落随意缩放。
 *
 * | 档位 | 盒宽 | 用途 |
 * |------|------|------|
 * | xs   | 28px | 战斗信息列表（略小于战场） |
 * | sm   | 40px | 探索左侧条、本层怪物列表、阵容格/池 |
 * | md   | 56px | 战斗场地站位 |
 * | lg   | 120px| 英雄详情立绘 |
 */

import { diamondStyleAttr } from "../characters/createHero.js?v=180";
import { monsterShapeDomProps } from "../monsters/visuals.js?v=180";

export const UNIT_ICON = Object.freeze({
  xs: Object.freeze({ id: "xs", box: 28, diamondScale: 0.55 }),
  sm: Object.freeze({ id: "sm", box: 40, diamondScale: 0.78 }),
  md: Object.freeze({ id: "md", box: 56, diamondScale: 1.15 }),
  lg: Object.freeze({ id: "lg", box: 120, diamondScale: 2.2 }),
});

export function unitIconSize(key = "sm") {
  return UNIT_ICON[key] || UNIT_ICON.sm;
}

export function unitDiamondScale(key = "md") {
  return unitIconSize(key).diamondScale;
}

function isMonsterUnit(unit, opts = {}) {
  if (opts.enemy != null) return !!opts.enemy;
  if (unit?.isHero) return false;
  return !!(unit?.kind || unit?.type || unit?.isBoss);
}

/** 与战斗站位相同的外形 HTML（菱形 / 方块 / 怪物图） */
export function unitShapeHtml(unit, sizeKey = "sm", opts = {}) {
  const size = unitIconSize(sizeKey);
  const peers = opts.peers || null;
  if (isMonsterUnit(unit, opts)) {
    const props = monsterShapeDomProps(unit);
    const styleAttr = props.style ? ` style="${props.style}"` : "";
    return props.inner
      ? `<div class="shape ${props.className}"${styleAttr}>${props.inner}</div>`
      : `<div class="shape ${props.className}"${styleAttr}></div>`;
  }
  const shapeClass = unit?.shape || "diamond";
  const style =
    shapeClass === "diamond"
      ? diamondStyleAttr(unit, size.diamondScale, peers)
      : `--c:${unit?.color || "#888"}`;
  return `<div class="shape ${shapeClass}" style="${style}"></div>`;
}

/**
 * 标准单位头像节点
 * @param {object} unit
 * @param {"xs"|"sm"|"md"|"lg"} sizeKey
 * @param {{ peers?: object[], enemy?: boolean, className?: string }} [opts]
 */
export function unitIconHtml(unit, sizeKey = "sm", opts = {}) {
  const size = unitIconSize(sizeKey);
  const extra = opts.className ? ` ${opts.className}` : "";
  return `<span class="unit-ico unit-ico-${size.id}${extra}" aria-hidden="true">${unitShapeHtml(
    unit,
    sizeKey,
    opts
  )}</span>`;
}
