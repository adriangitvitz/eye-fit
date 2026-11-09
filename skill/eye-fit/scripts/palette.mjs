import { fromOklch, lightnessForLc, normHex, oklch } from "./color.mjs";

const DEFAULTS = {
  name: "eye-fit",
  mode: "dark",
  background: { L: 0.235, C: 0.011, H: 72 },
  hue: 75,
  contrast: { text: 70, mid: 71, low: 65, comment: 58 },
  chroma: 0.012,
  accent: 0.03,
  accentHue: null,
  signal: 0.03,
  boldKeywords: true,
  italicComments: false,
  font: { family: "JetBrains Mono", size: 15, weight: 400, lineHeight: 1.4 },
};

export function withDefaults(profile) {
  const p = { ...DEFAULTS, ...profile };
  p.contrast = { ...DEFAULTS.contrast, ...profile.contrast };
  p.font = { ...DEFAULTS.font, ...profile.font };
  if (typeof p.background === "string") {
    const hex = normHex(p.background);
    if (!hex) throw new Error(`background is not a hex color: ${p.background}`);
    p.background = oklch(hex);
  }
  p.background = { ...DEFAULTS.background, ...p.background };
  p.accentHue ??= p.hue;
  return p;
}

export function buildPalette(profile) {
  const p = withDefaults(profile);
  const { L: bgL, C: bgC, H: bgH } = p.background;
  const bg = fromOklch(bgL, bgC, bgH);
  const sign = bgL < 0.5 ? 1 : -1;
  const tier = (lc) => lightnessForLc(p.chroma, p.hue, bg, lc);
  const [t0, t1, t2, t3] = [p.contrast.text, p.contrast.mid, p.contrast.low, p.contrast.comment].map(tier);
  const quiet = Math.max(p.chroma - 0.004, 0);
  const ink = (L, C = p.chroma, H = p.hue) => fromOklch(L, C, H);
  const surface = (dL, C = bgC + 0.001, H = bgH) => fromOklch(bgL + sign * dL, C, H);
  return {
    name: p.name,
    mode: bgL < 0.5 ? "dark" : "light",
    bg,
    bg_alt: surface(0.035),
    surface: surface(0.06, bgC + 0.002),
    sel: surface(0.085, bgC + 0.003),
    border: surface(0.15, Math.max(bgC - 0.001, 0)),
    linenr: ink(t3 - sign * 0.09, quiet),
    fg: ink(t0),
    keyword: ink(t0),
    fn: ink(t0, p.chroma + 0.008),
    type: ink(t1),
    param: ink(t1),
    str: ink(t1, p.accent, p.accentHue),
    punct: ink(t2, quiet),
    const: ink(t2, p.accent * 0.87, p.accentHue),
    comment: ink(t3, quiet),
    err: ink(t0, p.signal, 35),
    warn: ink(t0, p.signal, 85),
    info: ink(t1),
    hint: ink(t2),
    add: ink(t1, p.signal * 0.83, 140),
    del: ink(t1, p.signal * 0.83, 30),
    chg: ink(t1, p.signal * 0.67),
    add_bg: surface(0.05, p.signal * 0.67, 140),
    del_bg: surface(0.05, p.signal * 0.67, 30),
    chg_bg: surface(0.05, bgC + 0.001, p.hue),
    search_bg: fromOklch(bgL < 0.5 ? 0.52 : 0.74, p.signal, 80),
    style: { boldKeywords: p.boldKeywords, italicComments: p.italicComments, font: p.font },
    ansi: ansi(p, [t0, t1], ink, bg),
  };
}

function ansi(p, [hi, mid], ink, bg) {
  const hues = [null, 30, 140, 85, 240, 350, 190, null];
  const C = Math.max(p.signal, 0.03);
  const normal = hues.map((h) => (h === null ? null : ink(mid, C, h)));
  const bright = hues.map((h) => (h === null ? null : ink(hi, C, h)));
  const dark = oklch(bg).L < 0.5;
  normal[0] = fromOklch(oklch(bg).L + (dark ? 0.085 : -0.085), 0.01, p.hue);
  normal[7] = ink(mid, Math.max(p.chroma - 0.004, 0));
  bright[0] = fromOklch(oklch(bg).L + (dark ? 0.2 : -0.2), 0.01, p.hue);
  bright[7] = ink(hi);
  return [...normal, ...bright];
}

export const SYNTAX_ROLES = {
  background: "bg",
  foreground: "fg",
  comment: "comment",
  keyword: "keyword",
  constant: "const",
  string: "str",
  type: "type",
  function: "fn",
  parameter: "param",
  punctuation: "punct",
  selection: "sel",
};
