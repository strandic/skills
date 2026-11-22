# skills-1tr4 research lane: how wide a status row is

All work was read-only. I wrote scratch files only, under `/private/tmp/claude-502/1tr4-research/`:
- `modcopy/`: a copy of the mod. I deleted its tests and added `tests/probe.test.tsx`.
- `probe.out`: the probe's output.
- `bunprobe/sw.js`: the public Bun probe.
- `ucd/EastAsianWidth.txt`: EastAsianWidth 17.0.0, downloaded from unicode.org.

I edited no tracked file and installed nothing. The worktree HEAD is bb89183. The `model.ts` line numbers below are at that commit: `clean` at :199, `cut` at :276–277, `rowText` at :286, and `fit` at :288.

## Summary
- **The host does not count UTF-16 units.** It measures with `oe(s) = Bun.stringWidth(s, {ambiguousIsNarrow:true}) + hxt(s)`. `hxt` adds extra cells that depend on the terminal. It covers Indic spacing marks and some emoji. It also covers ZWJ, skin-tone and tag sequences, but only after the terminal has been probed.
- **The host uses this measure for both layout and cutting.** The Text measure function, wrapping and `truncate-end` all use `oe`. The host cuts on cell columns with `Bun.sliceAnsi`. It shortens the cut until `oe` fits, then adds "…".
- **The mod cannot call the host's function.** `Bun` is undefined in the mod runtime, so the mod cannot call `Bun.stringWidth`. I ran the probe.
- **The mod runtime's Unicode data is version 17 (at least).** `\p{Emoji_Presentation}` matches U+1FAEA, an Emoji 17 character. Unicode 17 scripts such as Sidetic, Beria Erfe and Tai Yo are assigned. `Intl.Segmenter` and `toWellFormed` both exist. I did not test whether any Unicode 18 data is present.
- **The host's own tables are older for the newest emoji.** I could not run the host's Bun build (v1.4.4). Public Bun 1.3.11 counts U+1FAE9 (Emoji 16) and U+1FAEA (Emoji 17) as 1 cell. Unicode says they are Wide.
- **Hidden characters can widen a row.** The host has a "show hidden characters" mode. It is off by default. It is switched on by `CLAUDE_CODE_SHOW_HIDDEN_CHARACTERS` or by a feature flag. In this mode, an invisible character in a Text is drawn as a marker like `<U+200B>`, and the host measures it that way. So a title holding U+200B can grow by 8 cells. Removing invisible characters in `clean()` avoids this.

## 1. The host's width rule (Claude Code 2.1.330)

### The width function
It lives in chunk `chunk-mgh1y10w.js`, at byte offset about 288,996,000 of the binary. Its export `oe` is imported by more than 60 chunks, including the renderer.

```js
var M={ambiguousIsNarrow:!0};function oe(e){return cDo(e)+hxt(e)}function cDo(e){return Bun.stringWidth(e,M)}
function hxt(e){return v_n(e)?C(e).extra:0}
function v_n(e){return N.test(e)||!!a&&x.test(e)}
function Zta(e,u){return Math.max(Math.min(e.split(m).length-1,A)+Number(u===1&&e0r.test(e)),a&&x.test(e)?(a(e)??0)-u:0)}
```

What the pieces are:
- **`m`** is a class of Indic spacing vowel signs. It covers U+093B, U+093E–0940, U+0949–094C, and the matching signs in Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam.
- **`e0r`** is this list: `[ឤ៘☝⛹✌✍⸺⸻㉈-㉏\u{1f1e6}-\u{1f1ff}\u{1f3cb}\u{1f3cc}\u{1f574}\u{1f575}\u{1f590}\u{1f93b}\u{1f946}]`. That is regional indicators, emoji modifier bases that default to text style, and a few other characters.
- **`x`** is `[‍\u{1f3fb}-\u{1f3ff}\u{e0020}-\u{e007f}]`: ZWJ, skin-tone modifiers and tag characters.
- **`a`** is a per-terminal width probe. It is set only when the new renderer runs on a TTY: `this.renderers&&h.stdout.isTTY)q$l(FS())`.
- Segmentation uses the internal `Bun.ant.CellSegmenter({ambiguousIsNarrow:!0,...})`. Its error message reads: "Run Claude Code on the @anthropic-ai/bun-internal version pinned in package.json". The embedded Bun version string is "Bun v1.4.4".

The extra cells per grapheme are the larger of two numbers:
- the count of spacing marks, capped at 8, plus 1 when Bun counted the grapheme as 1 cell and it contains an `e0r` character;
- for ZWJ, skin-tone and tag sequences, the probed terminal width minus Bun's width.

So the host's measure is never smaller than `Bun.stringWidth(ambiguousIsNarrow: true)`.

### Layout uses `oe`
Ink's measure function, in the chunk at about 312,27x,xxx:
- `measure(h){... let T=oe(h) ...}` is a cache of `oe`.
- `QC(h,v)` takes the widest line, measured with that cache.
- `bR` is the measure function of the `ink-text` node.

Wrapping: `Au` and `K` call `Bun.wrapAnsi` after replacing hard clusters with placeholders. They check each result with `oe(c)<=s`.

`truncate-end` does this:
```js
function Nr(h,v,T){let M=gxt(h,v,T);while(T>v&&oe(M)>T-v)T--,M=gxt(h,v,T);return M}
function G7n(h,v,T){h=o$e(h);let M=oe(h);if(M<=v)return null;...return{head:Nr(h,0,v-1),tail:""}}
function bg(h,v,T){if(v<1)return"";let M=o$e(h),O=G7n(M,v,T);return O===null?M:O.head+LIe+O.tail}   // LIe="…"
```

`gxt` is `Bun.sliceAnsi`, after mapping the host's column counts onto Bun's.

### Characters the host replaces or marks
- **Bidi controls become U+FFFD** when measured and drawn: `vTt=[[1564,1564],[8234,8238],[8294,8297]]` (U+061C, U+202A–202E, U+2066–2069), with `ih(h)=...h.replace(ofn,"�")`. U+200E and U+200F are not in this list.
- **The host's hidden-character table** is `jLs=[[173,173],[847,847],[1564,1564],[4447,4448],[6068,6069],[6155,6159],[8203,8207],[8234,8238],[8288,8303],[12644,12644],[65024,65039],[65279,65279],[65440,65440],[65520,65531],[69759,69759],[78896,78911],[94180,94180],[113824,113827],[119155,119162],[917504,921599]]`. It also counts C0 except tab and LF, DEL, C1, U+2028 and U+2029. Compared with Default_Ignorable_Code_Point, it adds U+FFF9–FFFB, U+1107F, U+13430–1343F and U+16FE4.
- **Marker mode:** `Rq(){return ...showHiddenCharactersEnabled??=s.CLAUDE_CODE_SHOW_HIDDEN_CHARACTERS??b("tengu_bubbly_gadget",!1)}`. Markers are made by `A(e)`: `e<32` gives the control picture U+2400 plus e, DEL gives ␡, and anything else gives `<U+XXXX>`. `bR` measures the text with these markers in it (`h.showsHiddenCharacters?O6t(M):...ls(h)`).
- The flag is copied from the root container (`F.showsHiddenCharacters=T.showsHiddenCharacters`). Whether a plugin's Text gets it is my inference: **unsourced**.

### The plugin API doc (`types/claude-code.d.ts`, bundled 2.1.330)
- **:13586–13591, on `bodyColumns`:** "Cells the band's tree is laid out in … A wider tree wraps or truncates as its Text props say; size a table to it rather than to `viewport.columns`."
- **:16826–16833, on Text `wrap`:** "What a line too wide for its Box does. `wrap`, the default, breaks it into rows. The others keep it on one row with an ellipsis: `end`, `truncate` and `truncate-end` at its end … (Desktop and VS Code always cut the end). … A phone wraps a cut at the end all the same unless `maxLines` is set."
- **:9393–9394, on a pane title:** "An unpaired surrogate half (a `.slice()` through an emoji) is drawn as U+FFFD; a control character is refused." :2870 and :18511 say the same for toast text and tool descriptions.
- **:11456:** prompt paint ranges have their "boundary moved back to its grapheme's start".

### Public Bun 1.3.11 `Bun.stringWidth` (the host runs 1.4.4, so this is a proxy)
Output of `bunprobe/sw.js`. Columns are: ambiguous narrow / ambiguous wide / ANSI counted.

| Input | Widths |
|---|---|
| 漢字 | 4 |
| Family ZWJ sequence | 2 |
| 🇯🇵 (flag) | 2 |
| Lone regional indicator | 1 |
| ❤️ (U+2764 + VS16) | 2 |
| ❤ (U+2764 alone) | 1 |
| ❤︎ (U+2764 + VS15) | 1 |
| 1️⃣ (keycap) | 2 |
| é (e + U+0301) | 1 |
| U+200B, U+FEFF, U+00AD, U+200E, U+200D, U+2060, U+FE00, U+E0100, tag character | 0 |
| U+FFF9 | 1 |
| U+202E (RLO) | 1 |
| U+2028 | 1 |
| U+180B (Mongolian variation selector) | 1 |
| Tab, NUL, BEL, C1 controls | 0 |
| Lone high surrogate | 0 |
| ─ (U+2500) | 1 / 2 |
| → (U+2192) | 1 / 2 |
| ™ | 1 / 2 |
| Private-use U+E000 | 1 / 2 |
| U+1FAE9 (Emoji 16), U+1FAEA (Emoji 17) | 1 |
| U+1FA77 (Emoji 15) | 2 |
| Hangul jamo L+V+T | 4 |
| U+3164 | 2 |
| ANSI SGR or OSC 8 around "ab" | 2 (9 and 18 with ANSI counted) |
| ☝ (U+261D) | 1 |
| ☝🏽 (U+261D + skin tone) | 2 |

## 2. Specifications and the sweep lists
These come from the runtime probe, which runs on Unicode 17 regex data.

- **Default_Ignorable_Code_Point:** `00AD,034F,061C,115F-1160,17B4-17B5,180B-180F,200B-200F,202A-202E,2060-206F,3164,FE00-FE0F,FEFF,FFA0,FFF0-FFF8,1BCA0-1BCA3,1D173-1D17A,E0000-E0FFF`
- **Bidi_Control:** `061C,200E-200F,202A-202E,2066-2069`
- **Cf:** `00AD,0600-0605,061C,06DD,070F,0890-0891,08E2,180E,200B-200F,202A-202E,2060-2064,2066-206F,FEFF,FFF9-FFFB,110BD,110CD,13430-1343F,1BCA0-1BCA3,1D173-1D17A,E0001,E0020-E007F`
  - These Cf characters are not default-ignorable: the visible prepended concatenation marks 0600–0605, 06DD, 070F, 0890–0891, 08E2, 110BD and 110CD; the interlinear annotation marks FFF9–FFFB; and the Egyptian format controls 13430–1343F.
- **Variation_Selector:** `180B-180D,180F,FE00-FE0F,E0100-E01EF`
- **Emoji_Modifier:** `1F3FB-1F3FF`
- **Regional_Indicator:** `1F1E6-1F1FF`
- **Emoji_Presentation:** 1219 code points. The full list is in `probe.out`. Its top ranges are `…1FA70-1FA7C,1FA80-1FA8A,1FA8E-1FAC6,1FAC8,1FACD-1FADC,1FADF-1FAEA,1FAEF-1FAF8`.
- **Other counts:** Extended_Pictographic 2848, Emoji 1438. `\p{RGI_Emoji}` with the `v` flag works and matches U+1FAEA.
- **East_Asian_Width W or F at Unicode 17.0.0:** 123 ranges, 182,876 code points. F alone is 3 ranges and 104 code points. A is 179 ranges and 138,739 code points. Computed from `ucd/EastAsianWidth.txt`:
  `1100-115F,231A-231B,2329-232A,23E9-23EC,23F0,23F3,25FD-25FE,2614-2615,2630-2637,2648-2653,267F,268A-268F,2693,26A1,26AA-26AB,26BD-26BE,26C4-26C5,26CE,26D4,26EA,26F2-26F3,26F5,26FA,26FD,2705,270A-270B,2728,274C,274E,2753-2755,2757,2795-2797,27B0,27BF,2B1B-2B1C,2B50,2B55,2E80-2E99,2E9B-2EF3,2F00-2FD5,2FF0-303E,3041-3096,3099-30FF,3105-312F,3131-318E,3190-31E5,31EF-321E,3220-3247,3250-A48C,A490-A4C6,A960-A97C,AC00-D7A3,F900-FAFF,FE10-FE19,FE30-FE52,FE54-FE66,FE68-FE6B,FF01-FF60,FFE0-FFE6,16FE0-16FE4,16FF0-16FF6,17000-18CD5,18CFF-18D1E,18D80-18DF2,1AFF0-1AFF3,1AFF5-1AFFB,1AFFD-1AFFE,1B000-1B122,1B132,1B150-1B152,1B155,1B164-1B167,1B170-1B2FB,1D300-1D356,1D360-1D376,1F004,1F0CF,1F18E,1F191-1F19A,1F200-1F202,1F210-1F23B,1F240-1F248,1F250-1F251,1F260-1F265,1F300-1F320,1F32D-1F335,1F337-1F37C,1F37E-1F393,1F3A0-1F3CA,1F3CF-1F3D3,1F3E0-1F3F0,1F3F4,1F3F8-1F43E,1F440,1F442-1F4FC,1F4FF-1F53D,1F54B-1F54E,1F550-1F567,1F57A,1F595-1F596,1F5A4,1F5FB-1F64F,1F680-1F6C5,1F6CC,1F6D0-1F6D2,1F6D5-1F6D8,1F6DC-1F6DF,1F6EB-1F6EC,1F6F4-1F6FC,1F7E0-1F7EB,1F7F0,1F90C-1F93A,1F93C-1F945,1F947-1F9FF,1FA70-1FA7C,1FA80-1FA8A,1FA8E-1FAC6,1FAC8,1FACD-1FADC,1FADF-1FAEA,1FAEF-1FAF8,20000-2FFFD,30000-3FFFD`
  - Unassigned code points in 3400–4DBF, 4E00–9FFF and F900–FAFF, and in planes 2 and 3, default to W.
  - JS regex has no East_Asian_Width property. Prior art embeds a table: get-east-asian-width ships the data, and wcwidth has `WIDE_EASTASIAN` tables per version. The mod could combine `\p{Emoji_Presentation}` with a few hard-coded ranges (Hangul jamo 1100–115F, CJK and Kana blocks, FF01–FF60, FFE0–FFE6, plane 2 and 3, and so on). That last idea is my own and **unsourced**.
- **Grapheme segmentation in the runtime (`Intl.Segmenter`):**
  - The family ZWJ sequence, the keycap, a tag flag, a skin-tone sequence, e plus two combining marks, Devanagari क्ष (rule GB9c) and Hangul L+V+T are each one cluster.
  - `🇯🇵🇺🇸🇫` splits into pairs plus a lone indicator.
  - `a`+ZWJ joins the `a` cluster.
  - U+200B, U+FEFF, U+FFF9 and U+FFFB are each their own cluster (Grapheme_Cluster_Break=Control).
  - A tag character such as U+E0041 joins the previous cluster as an extender.
  - A lone surrogate is its own cluster.
  - 👩 followed by ZWJ stays one cluster, so a cut can leave a dangling ZWJ.
  - `'\uD83Dx'.toWellFormed()` gives U+FFFD.

## 3. Prior art
- **sindresorhus string-width 9.0.0.** Dependencies: `get-east-asian-width ^1.7.0` and `strip-ansi ^7.2.0`. It segments into graphemes. It skips Default_Ignorable, Control, Format (except visible prepended marks), Mn and Me. A cluster that starts with an RGI emoji, a regional indicator, or `[\d#*]` plus U+FE0F counts 2. Emoji ZWJ sequences count 2. A Hangul block takes the width of its first code point. A wide BMP emoji plus VS15 counts 1. Anything else sums East Asian Width up to the first ZWJ. A lone surrogate counts as U+FFFD. It deliberately keeps U+2028 and U+2029 at 1 cell.
- **get-east-asian-width** returns 1 or 2, with `ambiguousAsWide` defaulting to false. It "uses the latest Unicode data". Its readme gives no version number.
- **Python wcwidth 0.2.13** (local). Its tables go up to 15.1.0. `wcwidth()` returns 1 for printable ASCII and -1 for C0/C1. It returns 0 for its ZERO_WIDTH table, and otherwise 1 plus 1 if wide. `wcswidth()` skips a ZWJ and the character after it. It adds 1 for VS16 after a character in `VS16_NARROW_TO_WIDE`. It returns -1 for any control character. Measured results:

  | Input | wcswidth |
  |---|---|
  | Family ZWJ sequence | 2 |
  | 🇯🇵 | 2 (1+1) |
  | ❤️ | 2 |
  | 1️⃣ | 2 |
  | U+200B, U+FEFF, U+FFF9, U+E0041, U+00AD | 0 |
  | U+1FAEA (Emoji 17) | 1 |
  | U+1FA77 | 2 |
  | ─ | 1 |
  | ESC… | -1 |
  | Devanagari क + U+093E (spacing mark) | 1 |
  | U+3164 | 2 |

- **Bun.stringWidth** claims: "The API matches the "string-width" npm package … It passes `string-width`'s tests." My probe shows it differs from string-width 9: it counts U+FFF9 and U+202E as 1, and Emoji 16/17 as 1.
- **Ink** (upstream) measures with `widest-line` (string-width). Its `wrap-text.ts` uses `wrapAnsi` and `cliTruncate`, according to a summary; I did not get the source verbatim. Claude Code's fork replaces all of this with `oe`, `Bun.wrapAnsi` and `Bun.sliceAnsi` (see section 1).
- **Terminals.** Mitchell Hashimoto measured the farmer emoji 🧑‍🌾:
  - 2 cells: Ghostty, Contour, Foot, iTerm, WezTerm;
  - 4 cells: Alacritty, Gnome, kitty, tmux, Warp, Xfce, xterm;
  - 5 cells: Windows Terminal;
  - 6 cells: Terminal.app.

  Ghostty and Foot fall back to wcwidth unless mode 2027 (grapheme clustering) is on. kitty's text-sizing spec says VS16 widens the previous cell to 2 and VS15 narrows it to 1, and that "the rule for U+FE0E is particularly problematic". This spread between terminals is why the host probes the terminal (the sample strings in `Eo`: ambiguous ─, e+U+0301, ❤️, keycap, flag, a joined emoji, and Emoji 12/14/15/16/17).

### Hazard classes
1. **Width disagreement.** The mod's table, the host's Bun tables and the terminal can each count differently. Known cases: Emoji 16/17, ZWJ sequences, VS16 and VS15, lone regional indicators, Ambiguous characters, and Indic spacing marks.
2. **A cut through a grapheme or surrogate pair.** This draws U+FFFD, or a base character without its marks.
3. **Invisible characters passing through.** ZWSP, BOM, U+FFF9–FFFB, tag characters U+E0000–E007F, variation selectors, U+180B–180F, U+3164 and U+FFA0 (fillers that draw wide or narrow). In the host's marker mode, each one draws as `<U+…>`.
4. **A cut leaving a dangling ZWJ, combining mark or modifier,** or half of a regional-indicator pair.
5. **Bidi controls reordering the row.** U+200E and U+200F are not replaced by the host.

## 4. Which way each width rule errs
"Wraps" means the mod measures smaller than the host: the row is too wide and breaks onto a second line. "Early cut" means the mod measures larger: the title is cut sooner than it needed to be. Nothing is broken, only shorter.

- **(a) Reimplement the host's rule (grapheme clusters, string-width-like, Unicode 17 data).**
  - Wraps on the host's terminal extras the mod cannot see: Indic spacing marks; ZWJ, skin-tone or tag sequences on terminals probed wider; and `e0r` characters such as a lone regional indicator, ☝ or ✌ when Bun says 1.
  - Wraps on characters Bun counts 1 but a default-ignorable rule counts 0: U+FFF9–FFFB and U+180B. Also U+202E and U+2066–2069, which the host draws as U+FFFD (1 cell). `clean()` already turns these bidi controls into spaces.
  - Early cut on Emoji 16/17: the mod's Unicode 17 data says 2 where Bun 1.3.11 says 1. Bun 1.4.4 is not verified, so this is **unsourced** for the host.
- **(b) A wcwidth-like per-code-point table.**
  - Wraps on VS16 emoji and keycaps if the VS16 rule is left out (1 instead of 2).
  - Wraps on Emoji 16/17 if the table is older than 16 (wcwidth 0.2.13 says 1). This one matches the host, which may itself draw too wide for the terminal.
  - Early cut on ZWJ sequences if each code point is summed (family = 6 instead of 2). Using the ZWJ-skip rule gives 2.
  - Wraps on spacing marks (0 instead of 1 or more).
  - Controls give -1, so they must be cleaned first.
- **(c) Every non-ASCII code point counts 2.**
  - I found no input where it measures less than the host. Each code point counts at least as much as the host counts per character. The terminal probe's extra (probed width minus Bun's width) seems smaller than 2 × the code point count for the samples I saw. This is my reasoning, not a proof: **unsourced**.
  - Early cut everywhere outside CJK: é counts 2 instead of 1, the family ZWJ sequence 10 instead of 2, the flag 4 instead of 2, U+200B 2 instead of 0.
- **(d) Let the host truncate (Text `wrap="truncate-end"`).**
  - It matches the host by construction (`oe` plus a cell-based slice, then "…"). The row never wraps in the terminal UI. The only remaining error is host versus terminal, which the probe reduces.
  - It cuts the end of whatever Text it is set on. Today's single-string row would lose its right-hand context rather than the title. The title would need its own shrinkable Text, with the other fields set not to shrink.
  - Desktop and VS Code "always cut the end". A phone wraps unless `maxLines` is set.
  - It does nothing about invisible or bidi characters.

## Sources
| Sentence it supports | Source | Verbatim quote | Found by |
|---|---|---|---|
| The host measures width with Bun.stringWidth (ambiguous narrow) plus extras | binary 2.1.330, offset ~288,996,000 | `function oe(e){return cDo(e)+hxt(e)}function cDo(e){return Bun.stringWidth(e,M)}` | `grep -a -b -o 'Bun.stringWidth('`, then `dd` |
| The extras depend on a terminal probe | binary ~312,522,649 | `this.renderers&&h.stdout.isTTY)q$l(FS())` | Python `re` search for `q\$l\(` |
| The host's Bun is internal, v1.4.4 | binary | `Run Claude Code on the @anthropic-ai/bun-internal version pinned in package.json`; `Bun v1.4.4` | `grep -a -o 'Bun v1\.…'` |
| The Text measure function uses `oe` | binary ~312,27x,xxx | `measure(h){let v=this.#e.get(h);if(v!==void 0)return v;let T=oe(h)` | search for `ink-text` |
| truncate-end shortens the cut until it fits | same | `function Nr(h,v,T){let M=gxt(h,v,T);while(T>v&&oe(M)>T-v)T--,M=gxt(h,v,T);return M}` | search for `"truncate-end"` |
| Bidi controls become U+FFFD | binary ~292,839,027 | `vTt=Object.freeze([[1564,1564],[8234,8238],[8294,8297]])` | mmap find `bTs=` |
| Hidden-character marker mode | binary ~297,105,088 | `showHiddenCharactersEnabled??=s.CLAUDE_CODE_SHOW_HIDDEN_CHARACTERS??b("tengu_bubbly_gadget",!1)`; `` `<U+${e.toString(16).toUpperCase().padStart(4,"0")}>` `` | mmap find `Wyi=` |
| The host's hidden-character table | binary ~288,221,190 | `var jLs=[[173,173],[847,847],…,[917504,921599]]` | mmap find `jLs=` |
| A wider tree wraps or truncates | claude-code.d.ts:13586–13591 | "A wider tree wraps or truncates as its Text props say" | `grep -n bodyColumns` |
| Text wrap values and platforms | claude-code.d.ts:16826–16833 | "(Desktop and VS Code always cut the end)" | `grep -n 'wrap?:'` |
| A slice through an emoji draws U+FFFD | claude-code.d.ts:9393 | "An unpaired surrogate half (a `.slice()` through an emoji) is drawn as U+FFFD" | `grep -n U+FFFD` |
| The mod runtime has Unicode 17 data and no Bun | probe.out | `"EP U+1FAEA (E17 distorted face)": true`, `"hasBun": "undefined"` | `claude plugin test modcopy` |
| The Default_Ignorable_Code_Point list | probe.out | `"DICP": "00AD,034F,…,E0000-E0FFF"` | same |
| Bun 1.3.11 counts Emoji 17 as 1 and U+FFF9 as 1 | bunprobe output | `E17 [1, 1, 1]`, `fff9 [1, 1, 1]` | `bun bunprobe/sw.js` |
| The EAW 17 defaults | ucd/EastAsianWidth.txt:19–27 | "The unassigned code points in the following blocks default to "W"" | `curl` unicode.org 17.0.0 |
| wcwidth's ZWJ rule | wcwidth 0.2.13 `wcswidth` | `if char == u'‍': # Zero Width Joiner, do not measure this or next character` | `inspect.getsource` |
| string-width's algorithm | github sindresorhus/string-width index.js | "Clusters starting with an RGI emoji (\p{RGI_Emoji}), regional indicators, or a digit/#/* with VS16 are double-width" | WebFetch |
| The string-width version | its package.json | `"version": "9.0.0"` | WebFetch |
| Bun claims parity with string-width | bun.sh/docs/api/utils | "It passes `string-width`'s tests." | WebFetch |
| Ink measures with widest-line | ink src/measure-text.ts | `const width = widestLine(text);` | WebFetch |
| Terminals disagree on ZWJ width | mitchellh.com/writing/grapheme-clusters-in-terminals | "Depending on your terminal emulator, it may have moved 2, 4, 5, or 6 cells." | WebFetch |
| kitty on VS15 | sw.kovidgoyal.net/kitty/text-sizing-protocol | "the rule for `U+FE0E` is particularly problematic for terminals" | WebFetch |
| UAX #11 (Revision 46, Unicode 18) on Ambiguous | unicode.org/reports/tr11 | "If the context cannot be established reliably, they should be treated as narrow characters by default." | WebFetch |
| UAX #29 (Revision 49) on Control | unicode.org/reports/tr29 | "General_Category = Format … and not U+200C … and not U+200D … and not Prepended_Concatenation_Mark = Yes" | WebFetch |
| UTS #51 (Revision 31) on keycaps | unicode.org/reports/tr51 | `emoji_keycap_sequence := [0-9#*] \x{FE0F 20E3}` | WebFetch |

## Found nothing
- These names do not appear in the binary: `string-width`, `eastAsianWidth`, `get-east-asian-width`, `isFullwidthCodePoint`, `emoji-regex`, `isWide(` (counted with `grep -a -o -F`).
- The two `wcwidth` hits are only the libc import `_wcwidth`. `getStringWidth` appears only in Bun's internal `node:util` and readline.
- `BUN_BE_BUN=1` on the host binary just prints the Claude version, so I could not run the host's own Bun 1.4.4. Bun 1.4.4 behaviour is **unsourced**. I used public Bun 1.3.11 as a proxy.
- `Bun` is not available in the mod runtime (probe: `"hasBun": "undefined"`), and there is no `process`, so no ICU version.
- The claude-code.d.ts mentions nothing about East Asian, grapheme width or `stringWidth`. It gives no Unicode version of the host's tables. The terminal-profile chunk has an Emoji-version table (`Da`, tagging 12, 14, 15, 16 and 17), so the host knows at least Emoji 17.
- Ink's `wrap-text.ts`: WebFetch would not reproduce the source, only a summary.
- UTS #51 gives no statement on terminal width. It says emoji "typically have about the same … advance width as CJK ideographs".
- I did not test whether a Unicode 18 character is assigned in the runtime.
- I did not read the source of cli-truncate, slice-ansi, wrap-ansi, iTerm2's or Terminal.app's width settings, or the Ghostty mode 2027 spec. They are cited only through the Mitchell Hashimoto article.
- Whether `Bun.sliceAnsi` always cuts on grapheme boundaries: **unsourced**.
