export type Snapshot = {
  /** Absolute path of the marker the row was read from. */
  marker: string
  /** `# <ticket> — <title>` of plan.md, else the plan dir's name. */
  title: string
  /** The marker's second line, as written: `plan <step>` or `run W<n> ...`. */
  step: string
  /** The marker's mtime, ms since the epoch. */
  since: number
  /** True when the marker's modification time is before this session's start (a copy that keeps old times reads the same). */
  isEarlier: boolean
  /** True when the marker is newer than this session's start and no Write or Edit of this session was seen writing it: another session, or this one by other means. */
  isUnconfirmed: boolean
  /** Lines of decisions.md that start with a date and `|`: the row's count. */
  decisions: number
  /** Absolute plan dir; empty when the marker is malformed. */
  planDir: string
  /** plan.md's `mtimeMs` when read, null when missing: the check compares it. */
  planAt: number | null
  /** decisions.md's `mtimeMs` when read, null when missing: the check compares it. */
  decisionsAt: number | null
  /** A short line naming the file that could not be read, when one could not. */
  problem?: string
}

declare module 'claude-code' {
  interface PluginState {
    'shawarma-companion': { snap: Snapshot | null; marker: string | null; own: string[] }
  }
}
