#!/usr/bin/env node
// Stub for the tests commit of skills-s262: the signatures of scripts/plantime.mjs, no behaviour.
export const DEFAULTS = { suite: '(?!)', probe: '(?!)', lint: '(?!)' };
export const ts = (s) => Date.parse(s);
export const bashKind = () => 'exec:other-shell';
export const toolKind = () => 'tool:other';
export const classify = () => 'other';
export const records = () => ({ recs: [], bad: 0 });
export const split = () => ({ buckets: new Map(), turns: 0, waits: [], limited: 0 });
export const planStarts = () => [];
export const parsePlans = () => [];
export const sessionFile = () => '';
export const fmt = () => '';
export const measure = () => ({ lines: [], data: [] });
export const main = () => [];
export const isIso = () => false;
export const isProbe = () => false;
export const waitStats = () => ({ median: 0, max: 0 });
