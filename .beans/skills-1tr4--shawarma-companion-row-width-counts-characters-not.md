---
# skills-1tr4
title: 'shawarma-companion: row width counts characters, not screen cells'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-10-29T16:45:44Z
updated_at: 2026-10-29T16:45:44Z
---

The row in mods/shawarma-companion is cut to bodyColumns by string length (rowText in hooks/model.ts). A CJK or emoji title takes two cells per character, so the row wraps past the window. Found by the adversarial lane in skills-pi0y review round 1 (F5). Worst case: a wrapped row; no false text.

## Also (skills-pi0y fix review, F8)

`clean` lets some invisible or direction-changing characters through, and they are drawn as they are: U+202E (right-to-left override), U+200B (zero-width space), U+FEFF (byte-order mark), U+FFF9. Cutting the title can also split an emoji in two, which draws U+FFFD (at 41 columns: `"😀�… · run W1 …"`). Both concern how the row is cut and drawn, so fix them with the width change.

## Design interview (2026-11-22)

Research: `docs/plans/2026-11-22-skills-1tr4-row-width-cells/reports/research/report.md`. The host measures with its internal Bun `stringWidth` (ambiguous narrow) plus extra cells; the mod runtime has no `Bun`, but has `Intl.Segmenter` and Unicode 17 regex data.

- **Q1 RULING A** (owner: "Go with reco"): the mod measures cells per grapheme cluster (Unicode 17 wide table, rounded up where the host adds cells) and cuts on cluster boundaries; the row's `<Text>` gets `wrap="truncate-end"` as a backstop. Executed: never below public Bun 1.3.11 `stringWidth` plus the host's +1 list on all 1,112,064 code points and the 5,225 Emoji 17 test sequences; above it on 984 and 30.
- **Q2 RULING A** (owner: "Go with reco"): `clean` drops characters that draw nothing (Default_Ignorable_Code_Point plus U+FFF9–FFFB, U+1107F, U+13430–1343F, U+16FE4), kept inside an RGI emoji and for a variation selector after its cluster's start.
- Error directions: measuring short wraps the row (Q1's backstop cuts its end instead); measuring long cuts the title early. Neither draws false text.
- U+202E is already blanked on main (`clean`, the skills-pi0y F5 fix); the "Also" list's other three are covered by Q2.
- Real inputs: 3,980 plan.md titles on this machine, 0 holding a wide or invisible character (aggregate count).
