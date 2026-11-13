import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Putanja do .db fajla (može se promijeniti preko SONUS_DB_PATH)
export const DB_PATH = process.env.SONUS_DB_PATH
  ? path.resolve(process.env.SONUS_DB_PATH)
  : path.resolve(__dirname, '..', 'data', 'evidencija.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS statements (
    id          TEXT PRIMARY KEY,
    file_name   TEXT NOT NULL,
    upload_date TEXT NOT NULL,
    data        TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const qGetSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const qSetSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

/** Vraća JSON vrijednost postavke ili null ako nikad nije sačuvana */
export function getSetting(key) {
  const row = qGetSetting.get(key);
  return row ? JSON.parse(row.value) : null;
}

export function setSetting(key, value) {
  qSetSetting.run(key, JSON.stringify(value));
}

const qAll = db.prepare('SELECT data FROM statements ORDER BY upload_date ASC');
// Lagani prikaz: bez sirovih stranica PDF-a (najveći dio podataka), učitavaju se tek kad zatrebaju
const qAllLight = db.prepare("SELECT json_remove(data, '$.pages') AS data FROM statements ORDER BY upload_date ASC");
const qOne = db.prepare('SELECT data FROM statements WHERE id = ?');
const qUpsert = db.prepare(`
  INSERT INTO statements (id, file_name, upload_date, data)
  VALUES (@id, @file_name, @upload_date, @data)
  ON CONFLICT(id) DO UPDATE SET
    file_name = excluded.file_name,
    upload_date = excluded.upload_date,
    data = excluded.data
`);
const qDelete = db.prepare('DELETE FROM statements WHERE id = ?');
const qClear = db.prepare('DELETE FROM statements');
const qCount = db.prepare('SELECT COUNT(*) AS c FROM statements');

function toRow(stmt) {
  return {
    id: String(stmt.id),
    file_name: String(stmt.fileName ?? ''),
    upload_date: new Date(stmt.uploadDate ?? Date.now()).toISOString(),
    data: JSON.stringify(stmt),
  };
}

export function getAll() {
  return qAll.all().map((r) => JSON.parse(r.data));
}

export function getAllLight() {
  return qAllLight.all().map((r) => JSON.parse(r.data));
}

export function getOne(id) {
  const row = qOne.get(id);
  return row ? JSON.parse(row.data) : null;
}

export function upsert(stmt) {
  qUpsert.run(toRow(stmt));
}

export const replaceAll = db.transaction((list) => {
  qClear.run();
  for (const s of list) qUpsert.run(toRow(s));
});

export function remove(id) {
  qDelete.run(id);
}

export function clear() {
  qClear.run();
}

export function stats() {
  const count = qCount.get().c;
  let sizeBytes = 0;
  try {
    db.pragma('wal_checkpoint(PASSIVE)');
    sizeBytes = fs.statSync(DB_PATH).size;
  } catch {}
  return { count, sizeBytes, path: DB_PATH };
}

export function closeDB() {
  try { db.close(); } catch {}
}
