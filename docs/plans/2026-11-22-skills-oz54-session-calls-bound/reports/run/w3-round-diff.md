## W3 review round: `git diff 1a6d0cc..3391a63 -- <§3 files>`

Behaviour hunks: register.tsx `readMainCwd` (+1 line) and `stale` (+4 lines); V14, V15 added. Prose hunks: register.tsx `isCwdLost` doc comment, README :40, CHANGELOG 0.3.4.

```diff
diff --git a/mods/shawarma-companion/CHANGELOG.md b/mods/shawarma-companion/CHANGELOG.md
index 0a91bbd..40df8f2 100644
--- a/mods/shawarma-companion/CHANGELOG.md
+++ b/mods/shawarma-companion/CHANGELOG.md
@@ -8,7 +8,7 @@ The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 ## [0.3.4] - unreleased
 
 ### Fixed
-- A call to the session that never answered held the update with no end: a `/cd` folder, project root or context figure that never came held the Write, Edit, NotebookEdit or Bash call before it ran, the turn end, or a band drawing with `context` on. Each such call now gives up after 2 seconds, as the README said, and counts as failed. When the working directory cannot be read, the mod forgets it and draws nothing until the main session reads it again, so it does not label the trees by the folder it last read (skills-oz54).
+- A call to the session that never answered held the update with no end: a `/cd` folder, project root or context figure that never came held the Write, Edit, NotebookEdit or Bash call before it ran, the turn end, or a band drawing with `context` on. Each such call now gives up after 2 seconds, as the README said, and counts as failed. When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets it and draws nothing until it reads it again, at the next tool call, turn end or 15-second check; it then finds the worktrees from the folder it reads (skills-oz54).
 
 ## [0.3.3] - unreleased
 
diff --git a/mods/shawarma-companion/README.md b/mods/shawarma-companion/README.md
index 1687fdc..c6e11dc 100644
--- a/mods/shawarma-companion/README.md
+++ b/mods/shawarma-companion/README.md
@@ -37,7 +37,7 @@ A session claims a worktree when:
 
 The mod checks the working directory and the project root at each update and every 15 seconds while a row is shown. It checks the folders of the last 64 files the session wrote at each update, so a worktree made and written in the same turn is claimed once git lists it. Subagents' calls count, but a subagent's own working directory does not.
 
-Claims only grow: a worktree stays claimed for the rest of the session, even after the session moves away. A session that claims no worktree saves nothing. Each call to the session or the store gives up after 2 seconds; a call that gives up claims nothing that update. They survive `/clear`. The mod saves them in its store, keyed by the session id, so `--resume` brings them back. A saved entry not updated for 30 days is deleted. The mod looks for such entries at a session's first update that reads the session's own entry, and stops looking 2 seconds after it starts. So the first update waits at most about 6 seconds for the store: 2 for the session's own entry, 2 for the clean-up, 2 to save its claims. Every 2-second limit relies on the engine's timer; if the engine never fires it, a session or store call that never answers holds the update. A session call that gives up counts as one that failed. When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets the one it knew and draws nothing until a later tool call or turn end of the main session reads it again, so it does not go on labelling the trees by the folder it last read. An update that cannot learn when the session started draws nothing too; so does a drawing with `context` on that cannot learn how full the context is. So a session that never answers holds each Write, Edit, NotebookEdit or Bash call 2 seconds before it runs. One update asks the session at most eight things, so it waits at most 16 seconds for the session, on top of its waits for git, files and the store. The mod skips an entry it cannot read, or that reads as unset (no value). Sessions usually start at different entries, so one entry that never answers does not stop every session's clean-up.
+Claims only grow: a worktree stays claimed for the rest of the session, even after the session moves away. A session that claims no worktree saves nothing. Each call to the session or the store gives up after 2 seconds; a call that gives up claims nothing that update. They survive `/clear`. The mod saves them in its store, keyed by the session id, so `--resume` brings them back. A saved entry not updated for 30 days is deleted. The mod looks for such entries at a session's first update that reads the session's own entry, and stops looking 2 seconds after it starts. So the first update waits at most about 6 seconds for the store: 2 for the session's own entry, 2 for the clean-up, 2 to save its claims. Every 2-second limit relies on the engine's timer; if the engine never fires it, a session or store call that never answers holds the update. A session call that gives up counts as one that failed. When the working directory cannot be read after a tool call, at a turn end or in the 15-second check, the mod forgets the one it knew and the worktrees it found from it, and draws nothing until the working directory is read again: at the main session's next tool call or turn end, at the next 15-second check, or when a session starts. It then finds the worktrees again from the folder it reads. An update that cannot learn when the session started draws nothing too; so does a drawing with `context` on that cannot learn how full the context is. So a session that never answers holds each Write, Edit, NotebookEdit or Bash call 2 seconds before it runs. One update asks the session at most eight things, so it waits at most 16 seconds for the session, on top of its waits for git, files and the store. The mod skips an entry it cannot read, or that reads as unset (no value). Sessions usually start at different entries, so one entry that never answers does not stop every session's clean-up.
 
 The *current* worktree is the one that holds the working directory, or else the one that holds the project root. Its rows come first. Rows from the other claimed worktrees start with `other tree: `.
 
diff --git a/mods/shawarma-companion/hooks/register.tsx b/mods/shawarma-companion/hooks/register.tsx
index 2563517..8a4eeed 100644
--- a/mods/shawarma-companion/hooks/register.tsx
+++ b/mods/shawarma-companion/hooks/register.tsx
@@ -74,8 +74,9 @@ let mainCwd: string | null = null
  * skills-oz54 Q1: set when a read of the main working directory gave up or failed
  * (after a tool call, at a turn end, in the 15 s check); cleared when a main read
  * answers or a session starts. While set, every refresh draws nothing, a
- * subagent's or the check's included, so no row is labelled by a folder the
- * session may have left (attack B1, B4 d).
+ * subagent's or the check's included, and the trees found before are dropped, so
+ * the next refresh finds them again from the directory it reads (attack B1, B4 d;
+ * W3-R1: the 15 s check reads it and redraws).
  */
 let isCwdLost = false
 /**
@@ -621,6 +622,7 @@ async function readMainCwd($: EngineInterface): Promise<void> {
   const read = await bounded($, $.session.cwd()).catch(() => null)
   mainCwd = read
   isCwdLost = read === null
+  if (isCwdLost) lastTrees = null
 }
 
 /**
@@ -682,7 +684,11 @@ async function stale($: EngineInterface): Promise<void> {
   if (rows.length === 0 && moreText(hidden.markers, hidden.trees, hidden.others ?? 0) === null && lastScan.status !== 'failed') {
     return watch($, false)
   }
-  if (lastTrees === null) return refresh($)
+  if (lastTrees === null) {
+    // W3-R1: after a lost read, the check reads the directory again and finds the trees from it.
+    if (isCwdLost) await readMainCwd($)
+    return refresh($)
+  }
   const trees = lastTrees
   const list = lister($)
   const scan = scanned(trees)
diff --git a/mods/shawarma-companion/tests/band.test.tsx b/mods/shawarma-companion/tests/band.test.tsx
index 5c11354..3255799 100644
--- a/mods/shawarma-companion/tests/band.test.tsx
+++ b/mods/shawarma-companion/tests/band.test.tsx
@@ -3581,6 +3581,38 @@ describe('skills-oz54: every session call gives up after 2 s', () => {
     expect({ seen, after: await band($) }).toEqual({ seen: [[], [], []], after: ['w · trivial · since 14:00', 'other tree: m · trivial · since 14:00'] })
   })
 
+  // W3-R1 (review 3a F1): the 15 s check after a lost read must find the trees again, not reuse those found before a move.
+  test('V14 after a move, a cwd read given up, then the 15 s check with the cwd answering: the rows are labelled by the new folder', { options: ON }, async ($, on) => {
+    let late = false
+    let dir = ROOT
+    let clock: any
+    const hold = { 'session.cwd': () => (late ? clock.sleep(3_000).then(() => undefined) : undefined) }
+    clock = world(on, new Map([at(ROOT, 'm'), at(WT, 'w')]), ROOT, [], new Set(), { cwdNow: () => dir, claimed: [ROOT, WT], root: ROOT, hold })
+    await $.session.start({ source: 'startup', cwd: ROOT } as any)
+    await bash($, 'true')
+    dir = WT
+    late = true
+    void bash($, 'true')
+    for (let i = 0; i < 10; i++) { await clock.advance(1_000); await settle(3) }
+    const lost = await band($)
+    late = false
+    for (let i = 0; i < 10; i++) { await clock.advance(1_000); await settle(3) }
+    expect({ lost, afterCheck: await band($) }).toEqual({ lost: [], afterCheck: ['w · trivial · since 14:00', 'other tree: m · trivial · since 14:00'] })
+  })
+
+  // W3-R1: the rows come back at the first check that reads the directory, with no tool call or turn end (README :40).
+  test('V15 a cwd read rejected after a Bash call, no move: nothing drawn, then the 15 s check draws the rows again', { options: ON }, async ($, on) => {
+    let fail = false
+    const clock = world(on, new Map([at(ROOT, 'm')]), ROOT, [], new Set(), { hold: { 'session.cwd': () => (fail ? Promise.reject(new Error('x')) : undefined) } })
+    await bash($, 'true')
+    fail = true
+    await bash($, 'true')
+    const lost = await band($)
+    fail = false
+    await clock.advance(15_000); await settle(30); await clock.advance(15_000); await settle(30)
+    expect({ lost, afterCheck: await band($) }).toEqual({ lost: [], afterCheck: ['m · trivial · since 14:00'] })
+  })
+
   test('V7 session calls answering at once: after a Bash call, a band draw with context on and a 10 s advance, no 2 s timer resolves', { options: { ...ON, context: true } }, async ($, on) => {
     const fired: number[] = []
     const tapped = ((name: string, ...args: any[]) => {
```
