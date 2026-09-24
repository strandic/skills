// Retrospective on this method, run by `/shawarma retro` with the Workflow tool:
//   Workflow({ scriptPath: "<this file>", args: { repo, skillDir, lessons, since, outDir, research? } })
//     repo      absolute path of the project
//     skillDir  absolute path of this skill's folder
//     lessons   absolute path of the project's lessons file (run stats + lessons since the last retro)
//     since     ISO date of the last retro ("" for the first one)
//     outDir    absolute path of the new retros folder, <repo>/docs/retros/<date>-<topic>/ (created by the orchestrator)
//     research  optional array of extra research topics (strings)
// Everything here is READ-ONLY apart from reports written into outDir. It ends with propositions, not
// edits: the human rules on them (grill, one question at a time), the orchestrator drafts the new
// wording into <outDir>/draft/, and — before the human sees the drafts — replays `plan` with the draft
// on past tickets: one throwaway detached worktree per ticket at the commit just before its real plan,
// a rubric per ticket written and committed FIRST (the trap that caught the real run), a planner that
// sees only the draft, a proxy answering from the rulings on record and volunteering nothing, a fresh
// planner resuming, a scorer crediting each rubric item and listing the sentences used, ignored or
// misread. Any new mechanism is tested as a second arm with its adoption rule written beforehand —
// and a mechanism that itself spawns an agent (a lane the planner launches) must be played by the
// replay script as its own stage: workflow subagents have no Agent tool (2026-09-22 round).
export const meta = {
  name: 'shawarma-retro',
  description: 'Retrospective on the shawarma method: audit the run record against the artifacts, research with fetched quotes, propose from a lean and a rigor lens, consolidate, then replay, critique and verify. Read-only; ends in propositions for the human.',
  phases: [
    { title: 'Evidence + Research', detail: 'artifact auditors and sourced researchers, concurrently' },
    { title: 'Propose', detail: 'two proposers with opposing lenses (lean vs rigor)' },
    { title: 'Consolidate', detail: 'one numbered proposition list with exact proposed wording' },
    { title: 'Test, Argue, Verify', detail: 'replay against the recorded runs, two critics, citation re-fetch' },
  ],
}

const A = args
const RULES = `
HARD RULES:
- READ-ONLY. Edit nothing in ${A.repo} or in ${A.skillDir}. The only place you may write is ${A.outDir}/.
- Read-only git only (log, show, diff). Start no servers. Follow the repo's data rules (docs/plans/README.md): never open real or personal data, never quote content from it. Tickets, briefs, PR bodies and code are fine.
- The method under review: ${A.skillDir}/SKILL.md, spike.md, brief-template.md. House rules: ${A.repo}/docs/plans/README.md. The run record: ${A.lessons}${A.since ? ` (entries since ${A.since})` : ''} — read it first. Earlier retros, if any: ${A.repo}/docs/retros/.
- Concrete and terse. Every statement ties to a specific run or artifact, or to a source you fetched.
- A proposed rule names the CLASS of failure it prevents, never the case that prompted it, in words a stranger's repo could use.`

const EVIDENCE = { type: 'object', required: ['corrections', 'extra_observations', 'report_path'], properties: {
  corrections: { type: 'array', items: { type: 'object', required: ['record_claim', 'artifact', 'finding'], properties: { record_claim: { type: 'string' }, artifact: { type: 'string' }, finding: { type: 'string' } } } },
  extra_observations: { type: 'array', items: { type: 'object', required: ['run', 'observation', 'artifact'], properties: { run: { type: 'string' }, observation: { type: 'string' }, artifact: { type: 'string' }, kind: { type: 'string' } } } },
  measures: { type: 'array', items: { type: 'string' }, description: 'the pre-registered measures from the last retro, each with its reading over these runs' },
  report_path: { type: 'string' } } }
const RESEARCH = { type: 'object', required: ['findings', 'report_path'], properties: {
  findings: { type: 'array', items: { type: 'object', required: ['claim', 'source_url', 'quote', 'relevance'], properties: { claim: { type: 'string' }, source_url: { type: 'string' }, quote: { type: 'string', description: 'VERBATIM from the fetched page' }, relevance: { type: 'string' } } } },
  not_found: { type: 'array', items: { type: 'string' } }, report_path: { type: 'string' } } }
const PROPOSALS = { type: 'object', required: ['propositions'], properties: {
  propositions: { type: 'array', items: { type: 'object', required: ['title', 'problem', 'evidence_refs', 'change', 'where', 'cost'], properties: { title: { type: 'string' }, problem: { type: 'string' }, evidence_refs: { type: 'array', items: { type: 'string' } }, change: { type: 'string' }, where: { type: 'string' }, cost: { type: 'string' }, research_support: { type: 'array', items: { type: 'string' } } } } },
  deletions: { type: 'array', items: { type: 'string' } } } }
const CONSOLIDATED = { type: 'object', required: ['propositions', 'report_path'], properties: {
  propositions: { type: 'array', items: { type: 'object', required: ['id', 'title', 'problem', 'evidence', 'proposed_wording', 'where', 'expected_benefit', 'cost'], properties: { id: { type: 'string' }, title: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } }, research_support: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, quote: { type: 'string' } } } }, proposed_wording: { type: 'string' }, where: { type: 'string' }, expected_benefit: { type: 'string' }, cost: { type: 'string' } } } },
  report_path: { type: 'string' } } }
const REPLAY = { type: 'object', required: ['results'], properties: { results: { type: 'array', items: { type: 'object', required: ['id', 'would_have_helped', 'would_have_hurt', 'net'], properties: { id: { type: 'string' }, would_have_helped: { type: 'array', items: { type: 'string' } }, would_have_hurt: { type: 'array', items: { type: 'string' } }, added_cost_per_run: { type: 'string' }, net: { type: 'string', description: 'strong_win | win | neutral | loss' } } } } } }
const CRITIQUE = { type: 'object', required: ['critiques'], properties: { critiques: { type: 'array', items: { type: 'object', required: ['id', 'verdict', 'argument'], properties: { id: { type: 'string' }, verdict: { type: 'string', description: 'keep | modify | drop' }, argument: { type: 'string' }, modification: { type: 'string' } } } }, missing: { type: 'array', items: { type: 'string' } } } }
const CITES = { type: 'object', required: ['checks'], properties: { checks: { type: 'array', items: { type: 'object', required: ['url', 'quote', 'status'], properties: { url: { type: 'string' }, quote: { type: 'string' }, status: { type: 'string', description: 'verified | paraphrased | not_found | unreachable' }, note: { type: 'string' } } } } } }

const WEB = 'Load web tools with ToolSearch ("select:WebSearch,WebFetch"). Every finding comes from a page you fetched, with a VERBATIM quote and its URL; prefer primary sources; if you cannot fetch it, do not cite it. List what you searched for and did not find.'
const TOPICS = [
  { key: 'orchestration', text: 'orchestrating LLM coding agents: single writer vs parallel writers, subagent briefs, shared vs isolated working trees, model routing, token economics, scope-creep and spec-deviation failure modes' },
  { key: 'spec-and-tests', text: 'specification-first and test-first practice: independent test authorship and the oracle problem, predicting failing tests, impact analysis for existing tests, mutation and property-based testing as evidence, bugs carried by code sketches inside specs' },
  { key: 'gates-and-review', text: 'gates, review and human checkpoints: pre-registration and how pre-registered criteria turn out mis-specified, Goodhart effects, what code review and executed adversarial testing actually find, LLM-as-reviewer bias, approval fatigue, pruning process' },
  ...((A.research || []).map((t, i) => ({ key: `extra-${i + 1}`, text: t }))),
]

phase('Evidence + Research')
const stage1 = await parallel([
  () => agent(`You are an evidence auditor for a retrospective on a coding method.${RULES}
Audit the OLDER half of the runs in the record against the real artifacts (briefs under docs/plans/, PR bodies via \`gh pr view\`, tickets, \`git log\`). Confirm or correct every claim the record makes about them; extract what it missed (brief-vs-shipped deviations, gate amendments and their wording, review findings and their disposition, which brief sections carried weight, sizes, and each run's plan window from git author dates — first plan note to brief commit, pasted with the command); read the last retro's pre-registered measures, if any, and give each its reading. Write the full report to ${A.outDir}/evidence-older-runs.md.`, { label: 'evidence:older runs', phase: 'Evidence + Research', schema: EVIDENCE }),
  () => agent(`You are an evidence auditor for a retrospective on a coding method.${RULES}
Audit the NEWER half of the runs in the record against the real artifacts (briefs under docs/plans/, PR bodies via \`gh pr view\`, tickets, \`git log\`) — and look for runs of the method that the record omits entirely. Confirm or correct every claim; extract what it missed (as above); give each pre-registered measure its reading. Write the full report to ${A.outDir}/evidence-newer-runs.md.`, { label: 'evidence:newer runs', phase: 'Evidence + Research', schema: EVIDENCE }),
  ...TOPICS.map(tp => () => agent(`You are a researcher for a retrospective on a coding method (a written brief whose claims are executed before freezing; tests written blind by a different agent; one implementer; read-only review lanes with executed attacks; gates written before the run and amended only by a human).${RULES}
${WEB}
TOPIC: ${tp.text}. Aim for 10–16 findings, each mapped to a rule of the method or to a friction item in the run record, saying whether it supports, contradicts or refines it. Write your notes to ${A.outDir}/research-${tp.key}.md.`, { label: `research:${tp.key}`, phase: 'Evidence + Research', schema: RESEARCH })),
])
const evidence = stage1.slice(0, 2)
const research = stage1.slice(2).filter(Boolean)
log(`evidence: ${evidence.filter(Boolean).reduce((n, e) => n + e.corrections.length, 0)} corrections; research: ${research.reduce((n, r) => n + r.findings.length, 0)} sourced findings`)

phase('Propose')
const INPUTS = `\nAUDITED EVIDENCE: ${JSON.stringify(evidence)}\n\nSOURCED RESEARCH: ${JSON.stringify(research)}`
const lens = {
  lean: 'LEAN. The best rule is the one deleted. Propose the smallest set of changes that would have prevented the most friction actually observed; prefer deleting or shortening text, replacing prose with a mechanical check, and moving repo mechanics into the house rules. List what the method should STOP saying. 6–12 propositions.',
  rigor: 'RIGOR. Every failure that reached a human round-trip, every silent deviation from a brief, every place the orchestrator graded its own homework is a hole. Propose changes that close the holes actually observed, with the concrete wording and the cost per run. 8–14 propositions.',
}
const proposers = await parallel(Object.entries(lens).map(([k, v]) => () =>
  agent(`You are proposing changes to the method after the recorded runs.${RULES}\nYOUR LENS: ${v} Tie every proposition to evidence.${INPUTS}`, { label: `propose:${k}`, phase: 'Propose', schema: PROPOSALS })))

phase('Consolidate')
const consolidated = await agent(`Consolidate two independent proposal sets into ONE numbered list.${RULES}
Merge duplicates; keep genuine disagreements between the lenses as separate alternatives (P4a / P4b); drop nothing silently. For each, write the EXACT proposed wording and where it goes (SKILL.md, spike.md, brief-template.md, the repo's house rules, a kept tool). Keep the method's voice: terse, imperative. Order by expected benefit. Apply nothing.
LEAN: ${JSON.stringify(proposers[0])}\nRIGOR: ${JSON.stringify(proposers[1])}${INPUTS}
Write the document to ${A.outDir}/propositions.md.`, { label: 'consolidate', phase: 'Consolidate', schema: CONSOLIDATED })
const PROPS = JSON.stringify(consolidated)

phase('Test, Argue, Verify')
const cites = research.flatMap(r => r.findings.map(f => ({ url: f.source_url, quote: f.quote })))
const [replay, criticLean, criticRigor, citeCheck] = await parallel([
  () => agent(`TEST each proposition by replaying it against every recorded run.${RULES}
Which specific incident would it have prevented or shortened, in which run, and how — mechanically? Where would it have HURT? Estimate the added cost per run. A proposition that would have changed nothing is "neutral" however sensible it sounds; be willing to return "loss".\nPROPOSITIONS: ${PROPS}\nEVIDENCE: ${JSON.stringify(evidence)}`, { label: 'test:replay', phase: 'Test, Argue, Verify', schema: REPLAY }),
  () => agent(`You are the LEAN CRITIC. Refute.${RULES}
For each proposition argue why NOT: ceremony, a rule that will be ignored, duplication, a cheaper mechanical alternative, evidence too thin. Default to "drop" when the benefit is speculative, "modify" with the smaller version when one exists. Total up what adopting every "keep" would add to the method's text, in words, and say whether it still reads in one pass. List rules in the CURRENT method that the runs suggest deleting.\nPROPOSITIONS: ${PROPS}`, { label: 'argue:lean critic', phase: 'Test, Argue, Verify', schema: CRITIQUE }),
  () => agent(`You are the RIGOR CRITIC. Find what is still broken.${RULES}
For each proposition: does it close the hole it names, or restate the intent? Could an agent satisfy the wording while repeating the failure? What new failure mode does it create? Then list every friction item NO proposition addresses, and every place the orchestrator still grades its own homework.\nPROPOSITIONS: ${PROPS}\nEVIDENCE: ${JSON.stringify(evidence)}`, { label: 'argue:rigor critic', phase: 'Test, Argue, Verify', schema: CRITIQUE }),
  () => agent(`You are a citation verifier.${RULES}\n${WEB}\nRE-FETCH every URL below yourself and check the quote appears verbatim. Check every pair; if there are more than 45, check the first 45 and say how many you skipped.\nPAIRS: ${JSON.stringify(cites)}`, { label: 'verify:citations', phase: 'Test, Argue, Verify', schema: CITES }),
])

return { evidence, research_counts: research.map(r => r.findings.length), research_not_found: research.flatMap(r => r.not_found || []), consolidated, replay, criticLean, criticRigor, citeCheck, outDir: A.outDir }
