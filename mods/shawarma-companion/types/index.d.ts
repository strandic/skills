export type Snapshot = {
  /** The ticket, from the marker's file name `active-<ticket>`. */
  ticket: string
  /** Absolute path of the marker the row was read from. */
  marker: string
  /** The tree root whose `.shawarma/` holds the marker. */
  tree: string
  /** `# <ticket> — <title>` of plan.md, else the plan dir's name; the ticket for a trivial marker. */
  title: string
  /** The marker's second line, as written: `plan <step>`, `run W<n> ...` or `trivial`; empty when malformed. */
  step: string
  /** The marker's mtime, ms since the epoch. */
  since: number
  /** True unless the marker's modification time is more than 1 ms past this session's start (D5: a row reads current only then). */
  isEarlier: boolean
  /** Q5: true when the marker was not rewritten for 12 h or is dated more than 1 min ahead; the check re-tests it on the clock. */
  isStale: boolean
  /** Lines of decisions.md that start with a date and `|`: the row's count. */
  decisions: number
  /** Absolute plan dir; empty when the marker is malformed or trivial, or its plan dir is outside its tree. */
  planDir: string
  /** plan.md's `mtimeMs` when listed, null when missing: the check compares it. */
  planAt: number | null
  /** decisions.md's `mtimeMs` when listed, null when missing: the check compares it. */
  decisionsAt: number | null
  /**
   * What is wrong with the row, when something is: `malformed marker`, `plan dir outside its tree`,
   * `plan dir not found: <dir>` or `plan dir not readable: <dir>`.
   */
  problem?: string
}

declare module 'claude-code' {
  interface PluginState {
    'shawarma-companion': { rows: Snapshot[]; chosen: string | null; hidden: { markers: number; trees: number } }
  }
}
