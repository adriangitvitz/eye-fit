# eye-fit

A Claude skill that builds an editor and terminal theme tuned to your eyes. You score side-by-side variants of real code, and it changes one thing at a time until the theme is comfortable for you. It exports to Neovim, VS Code, Ghostty, kitty and Alacritty.

## Install

```sh
git clone https://github.com/adriangitvitz/eye-fit
cp -r eye-fit/skill/eye-fit ~/.claude/skills/
```

It needs Node 18 or newer. There are no other dependencies.

## Use

Tell Claude something like "my theme tires my eyes" or "make me a calm dark theme for Neovim and Ghostty".

To run the CLI yourself, see [skill/eye-fit/README.md](skill/eye-fit/README.md).
