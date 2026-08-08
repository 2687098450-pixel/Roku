/** 战斗节奏：DoT 跳伤间隔、技能动画时长 */

export const DOT_TICK_SECONDS = 0.3;
export const ANIM_FAST_MS = 180;
export const ANIM_SLOW_MS = 420;

/** 流畅模式：走位间隔（秒，受战斗倍速缩放）；与行动条无关 */
export const MOVE_STEP_SECONDS = 0.14;

/** 旧行动条 gauge → 持续秒数：(gauge/50)*3，至少 1.2s */
export function dotDurationSec(gauge) {
  const g = Math.max(0, Number(gauge) || 50);
  return Math.max(1.2, (g / 50) * 3);
}

/**
 * @param {{ style?: string, skillId?: string, pace?: 'fast'|'slow' }} opts
 */
export function skillAnimMs({ style, skillId, pace } = {}) {
  if (pace === "fast") return ANIM_FAST_MS;
  if (pace === "slow") return ANIM_SLOW_MS;
  if (style === "buff") return ANIM_FAST_MS;
  if (style === "heal") return ANIM_SLOW_MS;
  return ANIM_SLOW_MS;
}

/** 0=关/1x  1=1x  2=1.5x  3=2x；整场战斗时间倍率：行动条/DoT/动画/特效 */
export function battleSpeedFromMode(mode) {
  const m = Math.floor(Number(mode) || 0);
  if (m <= 1) return 1;
  if (m === 2) return 1.5;
  return 2;
}

export const AUTO_MODE_LABELS = ["自动", "速度·1x", "速度·1.5x", "速度·2x"];
export const FLOW_SPEED_LABELS = ["速度·1x", "速度·1x", "速度·1.5x", "速度·2x"];
