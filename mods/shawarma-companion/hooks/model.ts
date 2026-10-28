// Stub for the tests commit: the signatures only. The code commit replaces it.
export const MARKER_TAIL = '/.shawarma/active'
export type Marker = { planDir: string; step: string }
export function parseMarker(_text: string, _markerPath: string): Marker | null { return null }
export function clean(text: string, _keepNewlines = false): string { return text }
export function redSet(_plan: string): string | null { return null }
export type Decisions = { decisions: number }
export function parseDecisions(_text: string): Decisions { return { decisions: 0 } }
export function parseTitle(_plan: string): string | null { return null }
export function section(_plan: string, _n: number): string | null { return null }
export function clockTime(_ms: number, _now?: number): string { return '' }
export type RowInput = {
  title: string; step: string; since: number; isEarlier: boolean; isUnconfirmed?: boolean
  decisions: number; context?: number; problem?: string
}
export function rowText(_row: RowInput, _columns: number, _now?: number): string { return '' }
