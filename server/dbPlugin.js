import * as store from './db.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : null);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function handler(req, res, next) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();

  try {
    const p = url.pathname;
    const m = req.method;

    if (p === '/api/stats' && m === 'GET') return send(res, 200, store.stats());

    if (p === '/api/rules' && m === 'GET') return send(res, 200, { rules: store.getSetting('groupingRules') });
    if (p === '/api/rules' && m === 'PUT') {
      const rules = await readBody(req);
      if (!Array.isArray(rules)) return send(res, 400, { error: 'Očekuje se niz pravila' });
      store.setSetting('groupingRules', rules);
      return send(res, 200, { ok: true, count: rules.length });
    }

    if (p === '/api/statements' && m === 'GET') {
      return send(res, 200, url.searchParams.get('light') === '1' ? store.getAllLight() : store.getAll());
    }
    if (p === '/api/statements' && m === 'DELETE') { store.clear(); return send(res, 200, { ok: true }); }
    if (p === '/api/statements/replace' && m === 'POST') {
      const list = await readBody(req);
      if (!Array.isArray(list)) return send(res, 400, { error: 'Očekuje se niz izvoda' });
      store.replaceAll(list);
      return send(res, 200, { ok: true, count: list.length });
    }

    const one = p.match(/^\/api\/statements\/([^/]+)$/);
    if (one && m === 'GET') {
      const stmt = store.getOne(decodeURIComponent(one[1]));
      return stmt ? send(res, 200, stmt) : send(res, 404, { error: 'Izvod nije pronađen' });
    }
    if (one && m === 'PUT') {
      const stmt = await readBody(req);
      if (!stmt || typeof stmt !== 'object') return send(res, 400, { error: 'Neispravan izvod' });
      store.upsert({ ...stmt, id: decodeURIComponent(one[1]) });
      return send(res, 200, { ok: true });
    }
    if (one && m === 'DELETE') {
      store.remove(decodeURIComponent(one[1]));
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'Nepoznata ruta' });
  } catch (err) {
    console.error('[db api]', err);
    return send(res, 500, { error: String(err?.message ?? err) });
  }
}

export function sqliteApi() {
  return {
    name: 'sonus-sqlite-api',
    configureServer(server) {
      server.middlewares.use(handler);
      server.httpServer?.on('close', store.closeDB);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
