export function $(id) {
  return document.getElementById(id);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function irand(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function styleTag(style) {
  if (style === "ranged") return "远程";
  if (style === "heal") return "治疗";
  if (style === "buff") return "强化";
  return "近战";
}

export function skillPowerText(mult, flat) {
  const parts = [];
  if (mult === 1) parts.push("攻击力×1");
  else parts.push(`攻击力×${mult}`);
  if (flat > 0) parts.push(`+${flat}`);
  if (flat < 0) parts.push(`${flat}`);
  return parts.join(" ");
}
