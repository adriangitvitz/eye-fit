import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NVIM_GROUPS = readFileSync(new URL("./nvim-groups.lua", import.meta.url), "utf8");

function neovim(p) {
  const table = { ...p, float_bg: p.surface, bar_bg: p.surface, bar_nc: p.bg_alt };
  const entries = Object.entries(table)
    .filter(([, v]) => typeof v === "string" && v.startsWith("#"))
    .map(([k, v]) => `  ${k} = "${v}",`)
    .join("\n");
  return `vim.cmd("hi clear")
if vim.fn.exists("syntax_on") == 1 then vim.cmd("syntax reset") end
vim.o.termguicolors = true
vim.o.background = "${p.mode}"
vim.g.colors_name = "${p.name}"

local p = {
${entries}
}
local italic = ${p.style.italicComments}

${NVIM_GROUPS}
if not ${p.style.boldKeywords} then
  for _, spec in pairs(groups) do if spec.fg == p.keyword then spec.bold = nil end end
end
for group, spec in pairs(groups) do vim.api.nvim_set_hl(0, group, spec) end

local ansi = { ${p.ansi.map((c) => `"${c}"`).join(", ")} }
for i, c in ipairs(ansi) do vim.g["terminal_color_" .. (i - 1)] = c end
`;
}

function vscode(p) {
  const rule = (scope, foreground, fontStyle) => ({ scope, settings: fontStyle ? { foreground, fontStyle } : { foreground } });
  const kw = p.style.boldKeywords ? "bold" : undefined;
  const theme = {
    name: p.name,
    type: p.mode,
    colors: {
      "editor.background": p.bg,
      "editor.foreground": p.fg,
      "editor.selectionBackground": p.sel,
      "editor.lineHighlightBackground": p.bg_alt,
      "editorLineNumber.foreground": p.linenr,
      "editorLineNumber.activeForeground": p.fg,
      "editorCursor.foreground": p.fg,
      "editorIndentGuide.background1": p.bg_alt,
      "editorWhitespace.foreground": p.linenr,
      "editorError.foreground": p.err,
      "editorWarning.foreground": p.warn,
      "editorInfo.foreground": p.info,
      "sideBar.background": p.bg,
      "sideBar.foreground": p.fg,
      "activityBar.background": p.bg,
      "activityBar.foreground": p.fg,
      "statusBar.background": p.surface,
      "statusBar.foreground": p.fg,
      "titleBar.activeBackground": p.bg,
      "titleBar.activeForeground": p.fg,
      "tab.activeBackground": p.surface,
      "tab.inactiveBackground": p.bg,
      "tab.inactiveForeground": p.comment,
      "editorGroupHeader.tabsBackground": p.bg,
      "panel.background": p.bg,
      "terminal.background": p.bg,
      "terminal.foreground": p.fg,
      "input.background": p.surface,
      "dropdown.background": p.surface,
      "list.activeSelectionBackground": p.sel,
      "list.hoverBackground": p.bg_alt,
      "editorWidget.background": p.surface,
      "editorSuggestWidget.background": p.surface,
      "editorSuggestWidget.selectedBackground": p.sel,
      "focusBorder": p.border,
      "diffEditor.insertedTextBackground": p.add_bg,
      "diffEditor.removedTextBackground": p.del_bg,
      "gitDecoration.addedResourceForeground": p.add,
      "gitDecoration.deletedResourceForeground": p.del,
      "gitDecoration.modifiedResourceForeground": p.chg,
      ...Object.fromEntries(
        ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"].flatMap((n, i) => [
          [`terminal.ansi${n}`, p.ansi[i]],
          [`terminal.ansiBright${n}`, p.ansi[8 + i]],
        ]),
      ),
    },
    tokenColors: [
      rule(["comment", "punctuation.definition.comment"], p.comment, p.style.italicComments ? "italic" : undefined),
      rule(["keyword", "storage.type", "storage.modifier", "keyword.control"], p.keyword, kw),
      rule(["string", "string.quoted", "string.template"], p.str),
      rule(["entity.name.function", "support.function", "meta.function-call"], p.fn),
      rule(["support.type", "entity.name.type", "entity.name.class", "storage.type.primitive"], p.type),
      rule(["constant.numeric", "constant.language", "constant.other"], p.const),
      rule(["variable.parameter"], p.param),
      rule(["punctuation", "keyword.operator", "meta.brace"], p.punct),
      rule(["variable", "source"], p.fg),
    ],
    semanticHighlighting: true,
  };
  const pkg = {
    name: p.name,
    displayName: p.name,
    version: "0.0.1",
    engines: { vscode: "^1.70.0" },
    categories: ["Themes"],
    contributes: { themes: [{ label: p.name, uiTheme: p.mode === "dark" ? "vs-dark" : "vs", path: "./theme.json" }] },
  };
  return { theme, pkg };
}

const terminal = (p) => ({ bg: p.bg, fg: p.fg, sel: p.sel, ansi: p.ansi });

function ghostty(p) {
  const t = terminal(p);
  return [
    `background = ${t.bg}`,
    `foreground = ${t.fg}`,
    `cursor-color = ${t.fg}`,
    `cursor-text = ${t.bg}`,
    `selection-background = ${t.sel}`,
    `selection-foreground = ${t.fg}`,
    ...t.ansi.map((c, i) => `palette = ${i}=${c}`),
  ].join("\n") + "\n";
}

function kitty(p) {
  const t = terminal(p);
  return [
    `background ${t.bg}`,
    `foreground ${t.fg}`,
    `cursor ${t.fg}`,
    `cursor_text_color ${t.bg}`,
    `selection_background ${t.sel}`,
    `selection_foreground ${t.fg}`,
    ...t.ansi.map((c, i) => `color${i} ${c}`),
  ].join("\n") + "\n";
}

function alacritty(p) {
  const t = terminal(p);
  const names = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
  const block = (title, offset) => [`[colors.${title}]`, ...names.map((n, i) => `${n} = "${t.ansi[offset + i]}"`)].join("\n");
  return [
    "[colors.primary]",
    `background = "${t.bg}"`,
    `foreground = "${t.fg}"`,
    "",
    "[colors.selection]",
    `background = "${t.sel}"`,
    `text = "${t.fg}"`,
    "",
    block("normal", 0),
    "",
    block("bright", 8),
  ].join("\n") + "\n";
}

export function writeAll(p, outDir) {
  const files = {
    [`nvim/colors/${p.name}.lua`]: neovim(p),
    [`ghostty/${p.name}`]: ghostty(p),
    [`kitty/${p.name}.conf`]: kitty(p),
    [`alacritty/${p.name}.toml`]: alacritty(p),
  };
  const vs = vscode(p);
  files[`vscode/${p.name}/theme.json`] = JSON.stringify(vs.theme, null, 2) + "\n";
  files[`vscode/${p.name}/package.json`] = JSON.stringify(vs.pkg, null, 2) + "\n";
  for (const [rel, content] of Object.entries(files)) {
    const path = join(outDir, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }
  return Object.keys(files).map((rel) => join(outDir, rel));
}
