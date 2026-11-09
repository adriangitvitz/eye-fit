# eye-fit

A Claude skill that builds an editor and terminal theme tuned to your eyes. You score side-by-side variants of real code, and it changes one thing at a time until the theme is comfortable for you. It exports to Neovim, VS Code, Ghostty, kitty and Alacritty.

Made for anyone bothered by glare, halos, bright text or too many colors.

## Install

```sh
git clone https://github.com/adriangitvitz/eye-fit
cp -r eye-fit/skill/eye-fit ~/.claude/skills/
```

It needs Node 18 or newer. There are no other dependencies.

## Use

Tell Claude something like "my theme tires my eyes" or "make me a calm dark theme for Neovim and Ghostty". You can also run the CLI yourself from any folder:

```sh
node ~/.claude/skills/eye-fit/scripts/eye-fit.mjs presets
node ~/.claude/skills/eye-fit/scripts/eye-fit.mjs lab --presets dark
node ~/.claude/skills/eye-fit/scripts/eye-fit.mjs init dark-soft --name my-theme
node ~/.claude/skills/eye-fit/scripts/eye-fit.mjs lab profile.json --vary contrast.text=66,70,74
node ~/.claude/skills/eye-fit/scripts/eye-fit.mjs build profile.json
node ~/.claude/skills/eye-fit/scripts/eye-fit.mjs check ~/.config/ghostty/themes/whatever
```
