# skills-1tr4 decisions

2026-11-22 | Q1 RULING | A: the mod measures cells per grapheme cluster (Unicode 17 wide table, rounded up where the host adds cells); the row Text gets wrap="truncate-end" as a backstop; reco A | the owner: "Go with reco". Never below Bun.stringWidth plus the host +1 list on every code point and the 5,225 Emoji 17 test sequences; the backstop covers terminal-probed ZWJ widths |
2026-11-22 | Q2 RULING | A: clean drops characters that draw nothing (Default_Ignorable_Code_Point plus U+FFF9-FFFB, U+1107F, U+13430-1343F, U+16FE4), kept inside an RGI emoji and for a variation selector after its cluster start; reco A | the owner: "Go with reco". The host draws them as nothing by default and as <U+XXXX> (8 cells) in its hidden-character mode |
