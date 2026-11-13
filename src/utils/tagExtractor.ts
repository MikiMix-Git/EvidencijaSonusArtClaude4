import { Transaction } from './BankStatementParser';
import { GroupingRule, applyRules, parseTags } from '../types/GroupingRule';

export type { GroupingRule };
export { applyRules };

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TaggedTransaction extends Transaction {
  tags: Tag[];
}

export interface TagGroup {
  tag: Tag;
  transactions: TaggedTransaction[];
  totalAmount: number;
  totalDebit: number;
  totalCredit: number;
  count: number;
  avgAmount: number;
}

// Boje za tagove
const TAG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6',
];

/**
 * Taguj transakcije koristeći manuelna pravila
 * Svako pravilo sa tag-om dodeljuje taj tag match-ovanim transakcijama
 */
export function tagTransactionsWithRules(
  transactions: Transaction[],
  rules: GroupingRule[]
): TaggedTransaction[] {
  // Filtriraj samo pravila koja imaju bar jedan tag i enabled su
  const rulesWithTags = rules.filter(r => r.enabled && parseTags(r.tag).length > 0);

  // Ista boja za isti tag, bez obzira na pravilo (redoslijed prvog pojavljivanja)
  const colorByTag = new Map<string, string>();
  for (const rule of rulesWithTags) {
    for (const name of parseTags(rule.tag)) {
      const key = name.toLowerCase();
      if (!colorByTag.has(key)) {
        colorByTag.set(key, TAG_COLORS[colorByTag.size % TAG_COLORS.length]);
      }
    }
  }

  return transactions.map(t => {
    const tags: Tag[] = [];
    const added = new Set<string>();

    // Proveri svako pravilo sa tagom; jedno pravilo može dodijeliti više tagova (odvojeni zarezom)
    for (const rule of rulesWithTags) {
      if (!applyRules(t.description, [rule])) continue;
      for (const name of parseTags(rule.tag)) {
        const key = name.toLowerCase();
        if (added.has(key)) continue; // isti tag samo jednom po transakciji
        added.add(key);
        tags.push({
          id: `tag_${key}`,
          name,
          color: colorByTag.get(key)!,
        });
      }
    }

    return { ...t, tags };
  });
}

/**
 * Grupiši tagovane transakcije po tagovima
 */
export function groupByTags(taggedTransactions: TaggedTransaction[]): TagGroup[] {
  const tagMap = new Map<string, TagGroup>();
  
  taggedTransactions.forEach(t => {
    t.tags.forEach(tag => {
      if (!tagMap.has(tag.name)) {
        tagMap.set(tag.name, {
          tag,
          transactions: [],
          totalAmount: 0,
          totalDebit: 0,
          totalCredit: 0,
          count: 0,
          avgAmount: 0,
        });
      }
      
      const group = tagMap.get(tag.name)!;
      group.transactions.push(t);
      group.totalDebit += t.debit;
      group.totalCredit += t.credit;
      group.totalAmount += Math.max(t.debit, t.credit);
      group.count += 1;
    });
  });
  
  // Izračunaj prosek
  tagMap.forEach(group => {
    group.avgAmount = group.totalAmount / group.count;
  });
  
  return Array.from(tagMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Filtriraj grupe po pretrazi
 */
export function filterTagGroups(
  groups: TagGroup[],
  searchTerm: string
): TagGroup[] {
  if (!searchTerm) return groups;
  
  const lower = searchTerm.toLowerCase();
  return groups.filter(g => 
    g.tag.name.toLowerCase().includes(lower) ||
    g.transactions.some(t => t.description.toLowerCase().includes(lower))
  );
}
