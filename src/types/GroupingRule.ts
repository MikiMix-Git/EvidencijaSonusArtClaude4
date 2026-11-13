export interface GroupingRule {
  id: string;
  pattern: string; // regex ili plain text
  groupName: string;
  isRegex: boolean;
  enabled: boolean;
  exclude?: string; // Opcioni izuzeci: ako opis sadrži neki od ovih uslova (odvojeni zarezom), pravilo se preskače
  tag?: string; // Opcioni tag(ovi) za grupisanje po tagovima; više tagova se razdvaja zarezom
}

/**
 * Razdvaja tagove pravila po zarezu: "Gorivo, Vozilo" → ["Gorivo", "Vozilo"].
 * Uklanja prazne vrijednosti i duplikate (bez obzira na veličinu slova).
 */
export function parseTags(tag?: string): string[] {
  if (!tag) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of tag.split(',')) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/**
 * Primenjuje manuelna pravila na opis transakcije
 * Vraća prvo matched pravilo ili null
 * Jedno pravilo može sadržati više uslova odvojenih zarezom (OR logika)
 */
export function applyRules(description: string, rules: GroupingRule[]): GroupingRule | null {
  const enabledRules = rules.filter(r => r.enabled);
  
  for (const rule of enabledRules) {
    try {
      if (!matchesAnyCondition(description, rule.pattern, rule.isRegex)) continue;
      // Izuzeci: transakcija koja odgovara izuzetku preskače ovo pravilo i ide na sljedeća
      if (rule.exclude && matchesAnyCondition(description, rule.exclude, rule.isRegex)) continue;
      return rule;
    } catch (err) {
      console.error('Greška u regex pravilu:', rule.pattern, err);
    }
  }
  
  return null;
}

/** Podijeli uslove po zarezu i provjeri da li opis odgovara bilo kojem (OR logika) */
function matchesAnyCondition(description: string, conditionsText: string, isRegex: boolean): boolean {
  const conditions = conditionsText.split(',').map(c => c.trim()).filter(c => c.length > 0);
  for (const condition of conditions) {
    const regex = isRegex
      ? new RegExp(condition, 'i')
      : new RegExp(condition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (regex.test(description)) return true;
  }
  return false;
}


/**
 * Čita fajl sa pravilima (izvezeni fajl pravila, običan niz pravila ili izvezena baza
 * koja sadrži polje "groupingRules"). Neispravna pravila se preskaču.
 */
export function parseRulesFile(text: string): { rules: GroupingRule[]; skipped: number } {
  const data = JSON.parse(text);
  const list: unknown = Array.isArray(data) ? data : (data?.rules ?? data?.groupingRules);
  if (!Array.isArray(list)) {
    throw new Error('Fajl ne sadrži pravila grupisanja.');
  }

  const rules: GroupingRule[] = [];
  const usedIds = new Set<string>();
  let skipped = 0;

  list.forEach((raw, index) => {
    const r = raw as Partial<GroupingRule> | null;
    const pattern = typeof r?.pattern === 'string' ? r.pattern.trim() : '';
    const groupName = typeof r?.groupName === 'string' ? r.groupName.trim() : '';
    if (!r || !pattern || !groupName) { skipped++; return; }

    const isRegex = r.isRegex === true;
    if (isRegex) {
      try { new RegExp(pattern, 'i'); } catch { skipped++; return; }
    }

    const exclude = typeof r.exclude === 'string' ? r.exclude.trim() : '';
    if (exclude && isRegex) {
      try { exclude.split(',').forEach((c) => c.trim() && new RegExp(c.trim(), 'i')); } catch { skipped++; return; }
    }

    let id = typeof r.id === 'string' && r.id ? r.id : `rule_${Date.now()}_${index}`;
    if (usedIds.has(id)) id = `rule_${Date.now()}_${index}`;
    usedIds.add(id);

    rules.push({
      id,
      pattern,
      groupName,
      isRegex,
      enabled: r.enabled !== false,
      exclude: exclude || undefined,
      tag: parseTags(typeof r.tag === 'string' ? r.tag : undefined).join(', ') || undefined,
    });
  });

  if (rules.length === 0) {
    throw new Error('U fajlu nema nijednog ispravnog pravila.');
  }
  return { rules, skipped };
}

/** Spaja uvezena pravila sa postojećim; duplikate (isti pattern, grupa, regex i tagovi) preskače. */
export function mergeRules(existing: GroupingRule[], incoming: GroupingRule[]): { rules: GroupingRule[]; added: number } {
  const sig = (r: GroupingRule) =>
    [r.pattern.toLowerCase(), (r.exclude ?? '').toLowerCase(), r.groupName.toLowerCase(), r.isRegex, parseTags(r.tag).join(',').toLowerCase()].join('|');
  const seen = new Set(existing.map(sig));
  const ids = new Set(existing.map((r) => r.id));
  const merged = [...existing];
  let added = 0;

  incoming.forEach((r, i) => {
    if (seen.has(sig(r))) return;
    seen.add(sig(r));
    const id = ids.has(r.id) ? `rule_${Date.now()}_${i}` : r.id;
    ids.add(id);
    merged.push({ ...r, id });
    added++;
  });
  return { rules: merged, added };
}
