---
name: shawarma
description: "Plan one settled ticket as a brief whose claims ran before it froze, then run it to a PR: executed tests, then code, then a review wave. The orchestrator owns git and every human gate; `retro` reviews the method."
disable-model-invocation: true
---

One ticket → one **brief** → one **run** → one PR. The brief is the whole contract: an agent reading only it and its named files can do its part. **Invoking `run` is the go.** The human's checkpoints are the design interview, rulings and `run` — never the PR: a decision "left for the PR" is one you made alone. A number, SHA or count written anywhere (ticket, comment, brief, PR) is pasted beside its command or marked `unexecuted`.

## House rules

Before any branch, read the repo's `docs/plans/README.md` if it exists: every mechanic this skill leaves to "house rules". It says *how*, this skill *what*: cite its commands, never restate them. With none, defaults on the base branch: brief `docs/plans/<date>-<ticket>-<name>/plan.md`, lessons `docs/plans/lessons.md`, retros `docs/retros/<date>-<topic>/`.

## Asking the human

One format, in prose, free-text answers welcome: the reading · the mechanism · which is wrong — rule, ticket or code · the options, one-line consequence and executed reading (or `unexecuted`) each, run at the values offered, recommendation first · where the residue goes. A **RULING** changes a numbered ruling, a ruled residue, a frozen line, a gate, a lesson the plan cites, or accepts a shape plan step 3(c) names; the ask quotes what it touches and waits. Anything else is a **DEFAULT**: `go` or silence accepts the recommendation; one the human strikes becomes a RULING. A DEFAULT may add a test, never flip one. For a pre-registered threshold, recommend a reading; never draft the replacement number before the ruling.

## State files

At plan step 1 and run Wave 0, write `.shawarma/active` (Write tool) at the root of the step's tree, beside `.shawarma/.gitignore` holding `*`: the plan dir, then `plan <step>` or `run W<n>`; rewrite it each step or wave; delete it at every stop. Each RULING and DEFAULT appends `<date> | <label> | <decision> | <why>` to the plan dir's `decisions.md`, mirroring §9 once `run` starts.

## Triage

- **Trivial** — judged by reading (a check that changes nothing tracked may narrow the fix; its command, reading and input alphabet (spike.md q2) go in the note): the ticket names the change; it fits one small diff with one test or command red on the base (say how); its worst case, following the changed error paths, is an inconvenience — never a plan-step-3 (c)/(d) class, its own checks' readings included. An ADR or decision record is never trivial. Anything beyond the ticket's words is a one-line question, never folded in. The ticket note, per house rules: the sites · the red check · the worst case · a source per outside behaviour touched (plan step 1), or `no outside behaviour` with the command that listed what the diff touches; stop. On the go, do it per house rules, claiming on the ticket, as in run step 6, the readings standing in for the review wave.
- **Settled?** (i) The design is decided — measured evidence with weighed options, an ADR, or the human's rulings — AND (ii) the gate is evaluable today: it names its metric and dataset unambiguously and the data exists (no dataset? a unit test plus one executed stand-in probe). An ADR waives (i)'s evidence, never (ii); a gate observed to read two ways on executed data is not settled. Not settled ⇒ the design interview ([interview.md](interview.md)), then plan.
- **Two paths only.** Every change that reaches a PR is trivial or briefed; a fix an investigation finds is a new ticket, triaged before any code. Scrapping or superseding a ticket greps for its id; each DEFAULT, residue or TICKET row resting on it reopens on its own ticket.
- **Siblings** fold into one brief and one PR only when they share a file or are not shippable apart, and never when the sibling's fix errs the corrupting way.

## Dispatch

- `plan <ticket>` → read [plan.md](plan.md); [interview.md](interview.md) when Settled? fails; [brief-template.md](brief-template.md) at plan step 1, whose slots steps 1–5 fill; [spike.md](spike.md) and [lanes.md](lanes.md) at plan step 2; [run.md](run.md) on a trivial go.
- `run <ticket>` → read [run.md](run.md), [brief-template.md](brief-template.md) and [plan.md](plan.md) (step 3's classes).
- `retro` → read [retro.md](retro.md).
- At every lane launch (0a, 3a, 3b, fix-review) read [lanes.md](lanes.md) and paste the lane's cell into its prompt. A file read earlier and no longer in context is re-read at the step that uses it.
