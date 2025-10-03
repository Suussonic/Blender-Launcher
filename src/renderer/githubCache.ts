// Simple GitHub data cache (in-memory + localStorage) to reduce unauthenticated API calls.
// We intentionally avoid any visual change: components read from cache first then optionally revalidate.

export interface RepoExtraStats { branches:number; commits:number; tags:number }
export interface RepoCacheEntry {
  meta?: any;              // Raw JSON from /repos/:owner/:repo
  readmeHtml?: string;     // Parsed README HTML
  licenseHtml?: string;    // Parsed LICENSE HTML
  extraStats?: RepoExtraStats;
  tsMeta?: number;
  tsReadme?: number;
  tsLicense?: number;
  tsExtra?: number;
}

const memoryCache = new Map<string, RepoCacheEntry>();
const LS_PREFIX = 'ghRepoCache:';
const META_TTL = 15 * 60 * 1000;      // 15 minutes
const CONTENT_TTL = 60 * 60 * 1000;    // 1 hour (README / LICENSE)
const STATS_TTL = 30 * 60 * 1000;      // 30 minutes (branches/commits/tags)

function now(){ return Date.now(); }

export function loadRepoCache(fullName:string): RepoCacheEntry | undefined {
  if (memoryCache.has(fullName)) return memoryCache.get(fullName);
  try {
    const raw = localStorage.getItem(LS_PREFIX+fullName);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache.set(fullName, parsed);
      return parsed;
    }
  } catch {}
  return undefined;
}

export function saveRepoCache(fullName:string, partial: Partial<RepoCacheEntry>) {
  const current = loadRepoCache(fullName) || {};
  const merged: RepoCacheEntry = { ...current, ...partial };
  memoryCache.set(fullName, merged);
  try { localStorage.setItem(LS_PREFIX+fullName, JSON.stringify(merged)); } catch {}
}

// Freshness helpers
export function needsMeta(entry?:RepoCacheEntry){ return !entry?.meta || !entry.tsMeta || (now() - entry.tsMeta) > META_TTL; }
export function needsReadme(entry?:RepoCacheEntry){ return !entry?.readmeHtml || !entry.tsReadme || (now() - entry.tsReadme) > CONTENT_TTL; }
export function needsLicense(entry?:RepoCacheEntry){ return !entry?.licenseHtml || !entry.tsLicense || (now() - entry.tsLicense) > CONTENT_TTL; }
export function needsExtra(entry?:RepoCacheEntry){ return !entry?.extraStats || !entry.tsExtra || (now() - entry.tsExtra) > STATS_TTL; }
