export type Snapshot = {
  /** Absolute path of the marker the row was read from. */
  marker: string
  /** `# <ticket> — <title>` of plan.md, else the plan dir's name. */
  title: string
  /** The marker's second line, as written: `plan <step>` or `run W<n> ...`. */
  step: string
  /** The marker's mtime, ms since the epoch. */
  since: number
  /** True when the marker is older than this session. */
  isEarlier: boolean
  /** True when the marker is newer than this session's start but no Write or Edit of this session wrote it. */
  isUnconfirmed: boolean
  ruled: number
  defaults: number
  /** Lines of decisions.md that are neither blank nor a decision row. */
  unreadable: number
  /** Absolute plan dir. */
  planDir: string
  /** A short line naming the file that could not be read, when one could not. */
  problem?: string
}

declare module 'claude-code' {
  interface PluginState {
    'shawarma-companion': { snap: Snapshot | null; marker: string | null; own: string[] }
  }
}
