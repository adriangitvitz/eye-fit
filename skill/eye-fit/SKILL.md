---
name: eye-fit
description: Build a code editor and terminal color theme tuned to one person's eyes, by showing side-by-side variants and adjusting one thing at a time from their scores. Use when someone says a theme hurts or tires their eyes, mentions eye strain, glare, halos, blurry or "bleeding" text, astigmatism, migraines, light sensitivity, Irlen, low vision or aging eyes, or asks for a calm, comfortable, low-contrast or accessible theme for Neovim, VS Code, Ghostty, kitty or Alacritty. Also use to measure an existing theme ("is my theme readable", "check the contrast of this theme").
---

# eye-fit

Contrast standards give a floor, not a comfortable setting. Comfort is personal and the window can be narrow: a few Lc too low and text merges into the background, a few too high and it tires the eyes. This skill finds that window by showing the person variants, one change per round, until their scores settle.

The person never needs to know anything about color. They answer a few questions, look at a page, and score what they see. You run everything else.

All commands are `node scripts/eye-fit.mjs ...`, run from the directory this SKILL.md is in, or with the full path to it. They need Node 18 or newer and have no other dependencies. Write the person's files in their current directory, or wherever they ask.

## Measure an existing theme

If they only want to check a theme, run `check` on the file and explain the notes in plain words. It accepts a VS Code theme JSON, Ghostty, kitty or Alacritty theme files, a `{ "role": "#hex" }` JSON, or an eye-fit profile.

```sh
node scripts/eye-fit.mjs check path/to/theme
```

Explain what each note means for them. Don't paste the table back. If the notes point at a real problem (HALATION, GLARE, BRIGHT-TEXT, DARK-BLUE), offer to build a calibrated theme.

## Calibrate a theme

### 1. Ask (one AskUserQuestion call)

- Dark or light background? They can answer "not sure" and you compare both.
- What bothers them now? Multi-select: bright text, glare, blurry or haloed letters, too many colors, text too faint, eyes tire after a while.
- Which editors and terminals they use.
- Their code font and size, if they know them.

### 2. First round: presets

```sh
node scripts/eye-fit.mjs lab --presets dark     # or light
```

Open the page for them (`open` on macOS, `xdg-open` on Linux, `start` on Windows). Ask them to score each panel and paste back the text from "Copy results". The panels are labeled A, B and C, and the settings stay hidden until they press "Show settings", so they score what they see rather than the numbers.

Start from the winner. Pass their name for the theme:

```sh
node scripts/eye-fit.mjs init dark-soft --name my-theme --out profile.json
```

If they told you their font, set `font.family`, `font.size` and `font.weight` in `profile.json` now. The page uses their installed font, and letter shape changes how contrast feels.

### 3. Refine, one variable per round

Run each round with three values: a bit lower, the current value, and a bit higher.

```sh
node scripts/eye-fit.mjs lab profile.json --vary contrast.text=66,70,74
```

Choose the order from their complaint, and stop a line of rounds as soon as the scores stop moving:

| complaint | vary first | step |
|---|---|---|
| bright text, eyes tire, halos | `contrast.text`, then `background.L` | 4 Lc; 0.02 L |
| text too faint, merges into the background | `contrast.text`, then `contrast.mid` | 4 Lc |
| comments or punctuation hard to see | `contrast.comment`, `contrast.low` | 4 Lc |
| glare (light mode) | `background.L` | 0.02 |
| too many colors, colors jump | `accent` (lower), `signal` | 0.01 |
| everything looks the same | `accent` (higher), `boldKeywords` | 0.01 |
| letters crowd or blur | `font.size`, `font.lineHeight`, `font.weight` | 1 px; 0.1; 100 |

After each round, write the winning value into `profile.json` and move on. Read `references/protocol.md` before the second round. It explains why scores from different rounds can't be compared and when to stop.

### 4. Build and install

```sh
node scripts/eye-fit.mjs build profile.json --out eye-fit-out/my-theme
```

The build writes `preview.html` along with the theme files. Show them the preview, then install only for the tools they use:

- **Neovim**: copy `nvim/colors/<name>.lua` to `~/.config/nvim/colors/`, then run `:colorscheme <name>`.
- **VS Code**: copy the folder `vscode/<name>/` to `~/.vscode/extensions/<name>/`, reload the window, and pick the theme under Preferences → Color Theme.
- **Ghostty**: copy `ghostty/<name>` to `~/.config/ghostty/themes/` and set `theme = <name>`.
- **kitty**: add `include <path>/kitty/<name>.conf` to `kitty.conf`.
- **Alacritty**: add the file to `general.import` in `alacritty.toml`.

Ask before writing into their config directories.

### 5. Real use

A short look at a page is not a working day. Ask them to use the theme for a few sessions and come back with what bothers them. Then make one change with `lab --vary` on the same profile and rebuild. Changes made after real use are usually small, around 2 to 4 Lc.

## What the profile controls

`profile.json` describes the theme in a few numbers, and the build derives every color from them.

- `background`: OKLCH `L`, `C`, `H`. A hex string also works.
- `hue`: the base hue for text.
- `contrast.text`, `contrast.mid`, `contrast.low`, `contrast.comment`: target APCA Lc for the main text, for types and parameters, for punctuation and constants, and for comments. Each target is turned into a lightness.
- `chroma`: how tinted the text is.
- `accent` and `accentHue`: color for strings and constants.
- `signal`: color for errors, diff lines and the terminal ANSI colors.
- Style: `boldKeywords`, `italicComments`, and `font`.

The themes are calm by design. Roles differ mostly by lightness, plus bold and a little color, not by many saturated hues. If someone wants a vivid rainbow theme, this is the wrong tool; say so.

## Honesty rules

- APCA is not a legal standard. If they need compliance, report WCAG 2 ratios as well; the `check` table shows both.
- Don't claim a theme treats or is clinically proven for any eye condition. It is tuned to their own ratings, nothing more.
