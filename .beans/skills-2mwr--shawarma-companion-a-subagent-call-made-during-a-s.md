---
# skills-2mwr
title: 'shawarma-companion: a subagent call made during a slow main turn end''s tail is wiped before it is placed, so its worktree shows as 1 run in another worktree'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-23T07:37:21Z
updated_at: 2026-11-23T07:37:21Z
---

Found by the skills-oz54 round-6 fix review (docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview6/report.md, F2, probe a6.tail.tsx P3). claim copies turnFolders/turnWindows when it runs; turn.complete then empties both with splice(0), including entries added after the claim. A subagent Bash 0.5 s into a main turn end that writes marker k into X (not listed yet) loses its span when the turn end's tail is slow: a 1.5 s fs.read after the claim (pre-existing), or a session.usage give-up (since skills-oz54 W3-R6). After 70 more writes and git listing X, the band reads `1 run in another worktree` (truth and the all-instant run: `other tree: k`). Sibling of skills-5w5c (a long call's span open across the turn end). Candidate fix, executed by the reviewer (below; the reports folder keeps only .md files): snapshot records the turnFolders/turnWindows entries it saw before claim in mark.folders/mark.windows, refresh returns the whole mark, and turn.complete removes only those entries. Readings: the P3 probe reads k for all four triggers; N1-N3 unchanged; suite 321 pass / 0 fail.

```diff
--- fix (e0afed3) register.tsx
+++ try register.tsx
@@ -582,11 +582,14 @@
  * counted (Q6). A row whose files fail to read is drawn as an UNREAD problem
  * row: its ticket, nothing it would have read (cm2l Q1).
  */
-async function snapshot($: EngineInterface, trees: Trees, list: Lister, isSub = false, mark: { isPlaced: boolean } = { isPlaced: false }): Promise<{ rows: Snapshot[];
+async function snapshot($: EngineInterface, trees: Trees, list: Lister, isSub = false, mark: Mark = newMark()): Promise<{ rows: Snapshot[];
   hidden: { markers: number; trees: number; others: number; otherTickets: string[] }; listed: string; scan: Scan }> {
   const scan = scanned(trees)
   const answered = new Set<string>()
   const found = await markersOf(list, scan.roots, answered)
+  // fixreview6 try: the turn's entries as they stand before the claim; only these count as placed.
+  for (const one of turnFolders) mark.folders.add(one)
+  for (const one of turnWindows) mark.windows.add(one)
   const claims = await claim($, trees, found, isSub)
   // W3-R6: placed once the claim has run against a git list, even if a later step (the context figure) throws.
   mark.isPlaced = trees.isFromGit === true
@@ -631,8 +634,10 @@
  * `could not be read`, never with a value read earlier.
  * Returns true only when this refresh's claim placed the session's folders against a git list (W3-R5, W3-R6).
  */
-async function refresh($: EngineInterface, trees: Trees | null = null, list: Lister = lister($), isSub = false): Promise<boolean> {
-  const mark = { isPlaced: false }
+type Mark = { isPlaced: boolean; folders: Set<string>; windows: Set<{ from: number; to: number }> }
+const newMark = (): Mark => ({ isPlaced: false, folders: new Set(), windows: new Set() })
+async function refresh($: EngineInterface, trees: Trees | null = null, list: Lister = lister($), isSub = false): Promise<Mark> {
+  const mark = newMark()
   const next = await (async () => {
     const at = trees ?? (await discover($, isSub))
     if (isCwdLost) throw new Error('working directory not read')
@@ -650,7 +655,7 @@
   // cm2l Q3: a failed refresh while the check runs keeps it running, so the rows come back once the error clears.
   watch($, next.rows.length > 0 || moreText(next.hidden.markers, next.hidden.trees, next.hidden.others) !== null
     || (next.scan.status === 'failed' && check !== null))
-  return mark.isPlaced
+  return mark
 }
 
 /** cm2l Q3: a check that throws acts as a failed refresh: no rows, no counts, the scan failed; the check goes on. */
@@ -797,13 +802,16 @@
     folderReals.clear()
     const isMain = (e as { agentId?: unknown }).agentId === undefined
     if (isMain) await readMainCwd($)
-    const isPlaced = await refresh($, null, lister($), !isMain)
+    const mark = await refresh($, null, lister($), !isMain)
     // B4a2: the main turn's end placed this turn's folders and spans against a fresh git list; the last 64 carry
     // over. C6b3: a turn end listed by the fallback (git failed) keeps them for the next turn. W3-R4, W3-R5: so does a
     // turn end whose own refresh placed nothing (its cwd read was lost), even if a 15 s check read the directory meanwhile.
-    if (isMain && isPlaced) {
-      turnFolders.splice(0)
-      turnWindows.splice(0)
+    if (isMain && mark.isPlaced) {
+      // fixreview6 try: a folder or span added after the claim began (a subagent call in the turn end's tail) is kept.
+      const keptF = turnFolders.filter(one => !mark.folders.has(one))
+      const keptW = turnWindows.filter(one => !mark.windows.has(one))
+      turnFolders.splice(0, turnFolders.length, ...keptF)
+      turnWindows.splice(0, turnWindows.length, ...keptW)
     }
     return next(e)
   })
```
