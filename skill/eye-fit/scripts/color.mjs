const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function normHex(s) {
  if (typeof s !== "string") return null;
  let h = s.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? "#" + h.toUpperCase() : null;
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcag(hexA, hexB) {
  const [a, b] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

export function apca(textHex, bgHex) {
  const soft = (y) => (y < 0.022 ? y + (0.022 - y) ** 1.414 : y);
  const t = soft(luminance(textHex));
  const b = soft(luminance(bgHex));
  if (b > t) {
    const s = (b ** 0.56 - t ** 0.57) * 1.14;
    return s >= 0.1 ? (s - 0.027) * 100 : 0;
  }
  const s = (b ** 0.65 - t ** 0.62) * 1.14;
  return s <= -0.1 ? (s + 0.027) * 100 : 0;
}

function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklch(hex) {
  const [L, a, b] = linToOklab(hexToRgb(hex).map(lin));
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(a, b), H };
}

export function fromOklch(L, C, H) {
  const r = (H * Math.PI) / 180;
  const rgb = oklabToLin([L, C * Math.cos(r), C * Math.sin(r)]);
  return "#" + rgb.map((v) => Math.round(clamp01(gam(clamp01(v))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const L_STEP = 0.005;

export function lightnessForLc(C, H, bgHex, targetLc) {
  const dark = oklch(bgHex).L < 0.5;
  const dir = dark ? 1 : -1;
  const lc = (L) => Math.abs(apca(fromOklch(L, C, H), bgHex));
  let L = Math.round(0.6 / L_STEP) * L_STEP;
  if (lc(L) >= targetLc) {
    while (L - dir * L_STEP > 0 && L - dir * L_STEP < 1 && lc(L - dir * L_STEP) >= targetLc) L -= dir * L_STEP;
    return L;
  }
  while (lc(L) < targetLc && L + dir * L_STEP > 0 && L + dir * L_STEP < 1) L += dir * L_STEP;
  return L;
}
