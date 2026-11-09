#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { buildPalette, withDefaults } from "./palette.mjs";
import { formatReport, measure, paletteToRoles, parseColors } from "./check.mjs";
import { writeAll } from "./export.mjs";
import { labHtml } from "./lab.mjs";

const PRESETS = JSON.parse(readFileSync(new URL("../presets.json", import.meta.url), "utf8"));

const USAGE = `eye-fit: build an editor and terminal theme tuned to your eyes

  eye-fit presets                                  list starting points
  eye-fit init <preset> [--name my-theme] [--out profile.json]
  eye-fit lab <profile.json> --vary key=a,b,c [--out dir]
  eye-fit lab --presets dark|light [--out dir]     compare the presets side by side
  eye-fit build <profile.json> [--out dir]         write Neovim, VS Code, Ghostty, kitty, Alacritty + preview
  eye-fit check <file>                             measure any theme: profile, palette JSON, VS Code theme, Ghostty/kitty/Alacritty file

Keys for --vary use dot paths: contrast.text, contrast.comment, background.L, background.H, hue,
chroma, accent, accentHue, signal, boldKeywords, italicComments, font.family, font.size, font.weight, font.lineHeight.`;

function args(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];
    else pos.push(argv[i]);
  }
  return { pos, opt };
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const parseValue = (v) => (v === "true" ? true : v === "false" ? false : Number.isFinite(+v) && v.trim() !== "" ? +v : v);

function setPath(obj, path, value) {
  const copy = structuredClone(obj);
  const keys = path.split(".");
  let o = copy;
  for (const k of keys.slice(0, -1)) o = o[k] = typeof o[k] === "object" && o[k] !== null ? o[k] : {};
  o[keys.at(-1)] = value;
  return copy;
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const letter = (i) => String.fromCharCode(65 + i);

function writePage(dir, file, html) {
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, file);
  writeFileSync(path, html);
  return path;
}

function measureLine(palette) {
  const m = measure(paletteToRoles(palette));
  const lc = (role) => m.rows.find((r) => r.role === role).Lc.toFixed(0);
  return `bg ${palette.bg}, text Lc ${lc("foreground")}, comment Lc ${lc("comment")}${m.warnings.length ? `, notes: ${[...new Set(m.warnings.map((w) => w.code))].join(", ")}` : ""}`;
}

const commands = {
  presets() {
    for (const [name, p] of Object.entries(PRESETS)) console.log(`${name.padEnd(16)}${p.description}`);
  },

  init({ pos, opt }) {
    const preset = PRESETS[pos[0]];
    if (!preset) throw new Error(`unknown preset "${pos[0]}". Run: eye-fit presets`);
    const { description, ...profile } = preset;
    profile.name = opt.name || "my-theme";
    const out = opt.out || "profile.json";
    if (existsSync(out) && !opt.force) throw new Error(`${out} exists; pass --force to overwrite`);
    writeFileSync(out, JSON.stringify(withDefaults(profile), null, 2) + "\n");
    console.log(`wrote ${resolve(out)}`);
  },

  lab({ pos, opt }) {
    const out = opt.out || "eye-fit-out";
    let variants, title;
    if (opt.presets) {
      const mode = opt.presets === true ? "dark" : opt.presets;
      const names = Object.keys(PRESETS).filter((n) => n.startsWith(mode));
      variants = names.map((n, i) => ({ label: letter(i), desc: n, palette: buildPalette({ ...PRESETS[n], name: n }) }));
      title = `Round: ${mode} presets`;
    } else {
      if (!pos[0] || !opt.vary) throw new Error("usage: eye-fit lab <profile.json> --vary key=a,b,c");
      const profile = readJson(pos[0]);
      const [key, list] = String(opt.vary).split("=");
      const values = list.split(",").map(parseValue);
      variants = values.map((v, i) => ({ label: letter(i), desc: `${key} = ${v}`, palette: buildPalette(setPath(profile, key, v)) }));
      title = `Round: ${key} (now ${JSON.stringify(getPath(withDefaults(profile), key))})`;
    }
    const path = writePage(out, "lab.html", labHtml({ title, variants }));
    for (const v of variants) console.log(`${v.label}  ${v.desc.padEnd(28)}${measureLine(v.palette)}`);
    console.log(`\nopen ${path}`);
  },

  build({ pos, opt }) {
    if (!pos[0]) throw new Error("usage: eye-fit build <profile.json>");
    const profile = readJson(pos[0]);
    const palette = buildPalette(profile);
    const out = opt.out || join("eye-fit-out", palette.name);
    const files = writeAll(palette, out);
    files.push(writePage(out, "preview.html", labHtml({ title: palette.name, variants: [{ label: palette.name, desc: "", palette }], blind: false })));
    console.log(formatReport(measure(paletteToRoles(palette))));
    console.log("\nwrote:\n" + files.map((f) => "  " + resolve(f)).join("\n"));
  },

  check({ pos }) {
    if (!pos[0]) throw new Error("usage: eye-fit check <file>");
    let roles;
    if (pos[0].endsWith(".json")) {
      const json = readJson(pos[0]);
      roles = json.contrast || json.hue !== undefined ? paletteToRoles(buildPalette(json)) : parseColors(pos[0]);
    } else roles = parseColors(pos[0]);
    console.log(`${basename(pos[0])}\n` + formatReport(measure(roles)));
  },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}
try {
  commands[cmd](args(rest));
} catch (e) {
  console.error(`eye-fit: ${e.message}`);
  process.exit(1);
}
