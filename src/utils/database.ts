import { openDB } from 'idb';
import type { BankStatement } from '../types/BankStatement';
import type { GroupingRule } from '../types/GroupingRule';

/**
 * Baza se čuva u lokalnom SQLite fajlu (data/evidencija.db).
 * Fajlu pristupa mali lokalni API (server/dbPlugin.js) koji radi uz Vite server.
 */

const API = '/api';
const DB_VERSION = 2;

// Stara IndexedDB baza — koristi se samo za jednokratnu migraciju
const LEGACY_DB_NAME = 'BankovniIzvodiDB';
const LEGACY_STORE = 'statements';
const MIGRATED_FLAG = 'sqliteMigrationDone';

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(`DB API greška: ${msg}`);
  }
  return res.json() as Promise<T>;
}

/** JSON gubi Date tip — rekonstruiši datume */
function reviveDates(stmt: any): BankStatement {
  return {
    ...stmt,
    pages: stmt.pages ?? [],
    uploadDate: new Date(stmt.uploadDate),
    summary: {
      ...stmt.summary,
      transactions: stmt.summary.transactions.map((t: any) => ({
        ...t,
        dateObj: new Date(t.dateObj),
      })),
    },
  };
}

/** Pročitaj sve izvode iz stare IndexedDB baze (ako postoji) */
async function readLegacyStatements(): Promise<any[]> {
  try {
    if (typeof indexedDB === 'undefined') return [];
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d.name === LEGACY_DB_NAME)) return [];
    }
    const legacy = await openDB(LEGACY_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(LEGACY_STORE)) {
          db.createObjectStore(LEGACY_STORE, { keyPath: 'id' });
        }
      },
    });
    const all = await legacy.getAll(LEGACY_STORE);
    legacy.close();
    return all;
  } catch (err) {
    console.warn('Čitanje stare IndexedDB baze nije uspjelo:', err);
    return [];
  }
}

/**
 * Jednokratno prebaci podatke iz IndexedDB u SQLite fajl.
 * Stara IndexedDB baza se NE briše (ostaje kao rezervna kopija).
 */
async function migrateLegacyIfNeeded(): Promise<void> {
  if (localStorage.getItem(MIGRATED_FLAG)) return;
  const { count } = await api<{ count: number }>('/stats');
  if (count === 0) {
    const legacy = await readLegacyStatements();
    if (legacy.length > 0) {
      await api('/statements/replace', { method: 'POST', body: JSON.stringify(legacy) });
      console.info(`Migrirano ${legacy.length} izvoda iz IndexedDB u SQLite.`);
    }
  }
  localStorage.setItem(MIGRATED_FLAG, '1');
}

/** Učitaj sve sačuvane izvode iz baze */
export async function loadAllStatements(options: { withPages?: boolean } = {}): Promise<BankStatement[]> {
  await migrateLegacyIfNeeded();
  // Bez sirovih stranica PDF-a (pages: []) — to je većina podataka i treba samo u detaljima izvoda
  const all = await api<any[]>(options.withPages ? '/statements' : '/statements?light=1');
  return all.map(reviveDates);
}

/** Učitaj jedan izvod zajedno sa sirovim stranicama PDF-a */
export async function loadStatementWithPages(id: string): Promise<BankStatement> {
  return reviveDates(await api<any>(`/statements/${encodeURIComponent(id)}`));
}

/** Sačuvaj jedan izvod u bazu (insert ili update) */
export async function saveStatement(statement: BankStatement): Promise<void> {
  await api(`/statements/${encodeURIComponent(statement.id)}`, {
    method: 'PUT',
    body: JSON.stringify(statement),
  });
}

/** Sačuvaj sve izvode u bazu (zamijeni cijelu bazu) */
export async function saveAllStatements(statements: BankStatement[]): Promise<void> {
  await api('/statements/replace', { method: 'POST', body: JSON.stringify(statements) });
}

/** Obriši jedan izvod iz baze po ID-u */
export async function deleteStatement(id: string): Promise<void> {
  await api(`/statements/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Obriši SVE izvode iz baze (prazna baza) */
export async function deleteAllStatements(): Promise<void> {
  await api('/statements', { method: 'DELETE' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Statistike o bazi (broj izvoda, stvarna veličina .db fajla, putanja) */
export async function getDBStats(): Promise<{ count: number; estimatedSize: string; path: string }> {
  const s = await api<{ count: number; sizeBytes: number; path: string }>('/stats');
  return { count: s.count, estimatedSize: formatBytes(s.sizeBytes), path: s.path };
}

/** Učitaj pravila grupisanja iz baze (jednokratno migrira stara pravila iz localStorage) */
export async function loadGroupingRules(): Promise<GroupingRule[]> {
  const { rules } = await api<{ rules: GroupingRule[] | null }>('/rules');
  if (rules) return rules;

  // Pravila još nikad nisu sačuvana u bazi → prebaci ih iz localStorage (ako postoje)
  try {
    const saved = localStorage.getItem('groupingRules');
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      await saveGroupingRules(parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('Migracija pravila iz localStorage nije uspjela:', err);
  }
  return [];
}

/** Sačuvaj pravila grupisanja u bazu (.db fajl) */
export async function saveGroupingRules(rules: GroupingRule[]): Promise<void> {
  await api('/rules', { method: 'PUT', body: JSON.stringify(rules) });
}

/** Exportuj cijelu bazu kao JSON string */
export async function exportDBAsJSON(): Promise<string> {
  const statements = await loadAllStatements({ withPages: true });
  const groupingRules = await loadGroupingRules();
  return JSON.stringify(
    {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      statementCount: statements.length,
      statements,
      groupingRules,
    },
    null,
    2
  );
}

/** Importuj bazu iz JSON stringa. @returns broj uvezenih izvoda */
export async function importDBFromJSON(jsonString: string): Promise<number> {
  const data = JSON.parse(jsonString);
  if (!data.statements || !Array.isArray(data.statements)) {
    throw new Error('Nevažeći format baze podataka. Očekuje se polje "statements".');
  }
  const statements: BankStatement[] = data.statements.map(reviveDates);
  await saveAllStatements(statements);

  // Pravila iz fajla se vraćaju samo ako trenutno nema nijednog pravila (postojeća se ne prepisuju)
  if (Array.isArray(data.groupingRules) && data.groupingRules.length > 0) {
    const current = await loadGroupingRules();
    if (current.length === 0) await saveGroupingRules(data.groupingRules);
  }
  return statements.length;
}

/** Provjeri da li baza ima podataka */
export async function isDatabaseEmpty(): Promise<boolean> {
  const { count } = await api<{ count: number }>('/stats');
  return count === 0;
}
