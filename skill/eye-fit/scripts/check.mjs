import { readFileSync } from "node:fs";
import { apca, hueDistance, luminance, normHex, oklch, wcag } from "./color.mjs";
import { SYNTAX_ROLES } from "./palette.mjs";

const NEUTRAL_C = 0.02;
const LOOK_ALIKE_DE = 0.02;

function deltaE(a, b) {
  const rad = (h) => (h * Math.PI) / 180;
  const da = a.C * Math.cos(rad(a.H)) - b.C * Math.cos(rad(b.H));
  const db = a.C * Math.sin(rad(a.H)) - b.C * Math.sin(rad(b.H));
  return Math.hypot(a.L - b.L, da, db);
}
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

export function paletteToRoles(p) {
  return Object.fromEntries(Object.entries(SYNTAX_ROLES).map(([role, key]) => [role, p[key]]));
}

export function parseColors(path) {
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".json")) {
    const json = JSON.parse(text);
    if (json.colors && json.tokenColors) return fromVscode(json);
    return Object.fromEntries(Object.entries(json).filter(([, v]) => normHex(String(v))).map(([k, v]) => [k, normHex(v)]));
  }
  const roles = {};
  for (const line of text.split("\n")) {
    const hex = (line.match(/#[0-9a-fA-F]{6}\b/) || [])[0];
    if (!hex) continue;
    const key = line.trim().split(/[\s=]+/)[0].replace(/"/g, "");
    const palette = line.match(/palette\s*=\s*(\d+)=/);
    const kittyColor = key.match(/^color(\d+)$/);
    if (palette) roles[ansiName(+palette[1])] = normHex(hex);
    else if (kittyColor) roles[ansiName(+kittyColor[1])] = normHex(hex);
    else if (/^(background|foreground)$/.test(key) && !roles[key]) roles[key] = normHex(hex);
    else if (/^(selection[-_]background)$/.test(key)) roles.selection = normHex(hex);
    else if (ANSI.includes(key)) roles[`${section(text, line)}-${key}`] = normHex(hex);
  }
  return roles;
}

const ansiName = (i) => (i < 8 ? ANSI[i] : `bright-${ANSI[i - 8]}`);

function section(text, line) {
  const before = text.slice(0, text.indexOf(line));
  const headers = [...before.matchAll(/\[colors\.(\w+)\]/g)];
  return headers.length ? headers[headers.length - 1][1] : "normal";
}

function fromVscode(theme) {
  const roles = { background: theme.colors["editor.background"], foreground: theme.colors["editor.foreground"] };
  const want = { comment: "comment", keyword: "keyword", string: "string", function: "entity.name.function", type: "entity.name.type", constant: "constant.numeric", punctuation: "punctuation" };
  for (const [role, scope] of Object.entries(want)) {
    const rule = theme.tokenColors.find((t) => [].concat(t.scope || []).some((s) => s === scope || s.startsWith(scope + ".")));
    if (rule?.settings?.foreground) roles[role] = rule.settings.foreground;
  }
  return Object.fromEntries(Object.entries(roles).filter(([, v]) => normHex(v ?? "")).map(([k, v]) => [k, normHex(v.slice(0, 7))]));
}

export function measure(roles) {
  const bg = roles.background;
  if (!bg) throw new Error("no background color found");
  const bgm = { Y: luminance(bg), ...oklch(bg) };
  const dark = bgm.L < 0.5;
  const rows = Object.entries(roles)
    .filter(([role, hex]) => role !== "background" && hex)
    .map(([role, hex]) => ({ role, hex, Y: luminance(hex), ...oklch(hex), Lc: Math.abs(apca(hex, bg)), wcag: wcag(hex, bg), surface: role === "selection" || role.endsWith("black") }));
  const text = rows.filter((r) => !r.surface);
  const warnings = [];
  const warn = (code, msg) => warnings.push({ code, msg });

  if (dark && bgm.Y < 0.005 && text.some((r) => r.Y > 0.5))
    warn("HALATION", `Background is near black (Y ${bgm.Y.toFixed(4)}) under bright text. Bright text bleeds into a black field for people with astigmatism. Lift the background to Y 0.015-0.05.`);
  if (!dark && bgm.Y > 0.92) warn("GLARE", `Light background is very bright (Y ${bgm.Y.toFixed(3)}). A warm off-white around Y 0.80-0.90 glares less.`);
  const fg = rows.find((r) => r.role === "foreground");
  if (dark && fg && fg.Y > 0.6) warn("BRIGHT-TEXT", `Main text is very bright (Y ${fg.Y.toFixed(2)}, Lc ${fg.Lc.toFixed(0)}). If long sessions tire your eyes, try text around Lc 70-80.`);
  for (const r of text.filter((r) => r.C > 0.11)) warn("SATURATION", `${r.role} ${r.hex} is highly saturated (C ${r.C.toFixed(3)}).`);
  for (const r of text.filter((r) => dark && r.H >= 230 && r.H <= 290 && r.C > 0.09 && r.L < 0.75))
    warn("DARK-BLUE", `${r.role} ${r.hex} is a dark saturated blue/violet; short wavelengths scatter more and look blurry for many eyes. Raise its lightness or lower its chroma.`);
  for (const r of text.filter((r) => r.wcag < 4.5)) warn("LOW-CONTRAST", `${r.role} ${r.hex} is under WCAG AA 4.5:1 (${r.wcag.toFixed(2)}:1, Lc ${r.Lc.toFixed(0)}).`);

  const syntax = text.filter((r) => !ANSI.some((a) => r.role.endsWith(a)));
  const clusters = [];
  for (const r of syntax.filter((r) => r.C > NEUTRAL_C)) if (!clusters.some((h) => hueDistance(h, r.H) < 30)) clusters.push(r.H);
  if (clusters.length > 3) warn("HUE-JUMPS", `${clusters.length} different hue families in the syntax colors. Some people find the jumps between hues tiring; a calmer theme separates roles by lightness instead.`);
  const lookAlike = [];
  for (let i = 0; i < syntax.length; i++)
    for (let j = i + 1; j < syntax.length; j++) {
      const a = syntax[i], b = syntax[j];
      if (a.hex !== b.hex && deltaE(a, b) < LOOK_ALIKE_DE) lookAlike.push(`${a.role}/${b.role}`);
    }
  if (lookAlike.length)
    warn("LOOK-ALIKE", `Nearly identical roles (ΔE OK < ${LOOK_ALIKE_DE}): ${lookAlike.join(", ")}. Fine if you tell them apart by bold or position; otherwise spread contrast.text/mid/low further apart.`);
  return { background: { hex: bg, ...bgm }, mode: dark ? "dark" : "light", rows, warnings };
}

export function formatReport(m) {
  const pad = (s, n) => String(s).padEnd(n);
  const lines = [
    `${m.mode} theme on ${m.background.hex} (Y ${m.background.Y.toFixed(4)}, OKLCH ${m.background.L.toFixed(3)} ${m.background.C.toFixed(3)} ${m.background.H.toFixed(0)})`,
    "",
    `${pad("role", 16)}${pad("hex", 9)}${pad("APCA Lc", 9)}${pad("WCAG", 8)}OKLCH L / C / H`,
    ...m.rows.map((r) => `${pad(r.role, 16)}${pad(r.hex, 9)}${pad(r.Lc.toFixed(1), 9)}${pad(r.wcag.toFixed(2), 8)}${r.L.toFixed(3)} / ${r.C.toFixed(3)} / ${r.H.toFixed(0)}`),
    "",
    m.warnings.length ? "Notes:" : "Notes: none",
    ...m.warnings.map((w) => `  [${w.code}] ${w.msg}`),
  ];
  return lines.join("\n");
}
