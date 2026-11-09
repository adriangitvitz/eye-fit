# Calibration protocol

Rules for running the rating rounds. Each one prevents a round that teaches nothing.

## Change one variable per round

If a round changes the palette and the font at once and every variant scores low, nobody can tell which change caused it. With `--vary`, only one key moves per page, so keep it that way. If they want to try a different font, run a font-only round.

## Scores only compare within a round

Eyes adapt between rounds. The same unchanged variant can score 8/10 in one round and 2/10 a few rounds later. So use scores only to rank the panels on the same page, and never say "this scored 8 before, so it's good".

## Read the notes, not just the numbers

The notes say which direction to move. "Merges with the background" means more contrast. "Whites swim" or "tires" means less. "Letters crowd" means size or line height, not color. If the notes in a round contradict each other, run that round again with values further apart.

## Render the way they read

Typography moves scores as much as color. A terminal that draws all text in bold hides the bold-keyword cue and makes two close lightness levels look identical. Before round 2, put their real font, size, weight and line height in the profile. If their terminal or editor forces bold, set `font.weight` to 700.

## The comfortable window can be narrow

It can be as small as about 6 Lc between "merges into the background" and "tires the eyes". When scores flip between neighbouring values, narrow the step to 2 Lc instead of 4.

## Near-black is rarely the answer

Pure or near-black backgrounds (Y < 0.005) under bright text cause halation, where text glows and bleeds, for many people with astigmatism. Warm dark greys around Y 0.01 to 0.03 usually do better. In light mode, near-white backgrounds (Y > 0.92) glare. Sand or cream backgrounds lower than you'd expect, around Y 0.65 to 0.8, are worth testing.

## Hue jumps hurt more than any one hue

Many saturated hues next to each other read as noise, and the jump from one hue to the next can be what hurts, not any hue in particular. The fix is usually fewer hues: one base hue, roles separated by lightness, bold on keywords, and a slight tint on strings. Start with low `accent` and raise it only if they say everything looks the same.

## When to stop

Stop refining when, for two rounds in a row, the current value wins or ties and they have no new complaint. Then build the theme and switch to real use. A page view lasts minutes, and a working day can reveal problems a page doesn't. Changes after real use tend to be small, about 2 to 4 Lc.
