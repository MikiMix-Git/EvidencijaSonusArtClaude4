import { PageData } from '../types/App.types';

export interface Transaction {
  id: string;
  date: string;
  dateObj: Date;
  description: string;
  counterparty: string;
  amount: number;
  type: 'income' | 'expense';
  debit: number;
  credit: number;
  balance?: number;
  reference?: string;
  category?: string;
  rawLine: string;
  statementDate?: string;
}

export interface BankStatementSummary {
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  netChange: number;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  statementNumber?: number;
  turnover?: number;
  oldBalance?: number;
  balanceChange?: number;
  newBalance?: number;
}

const CATEGORIES: Record<string, string[]> = {
  'Plata': ['=plata', '=plate', '=plaća', '=plaće', '=plaću', '=salary', '=wages'], // '=' = cijela riječ (ne hvata "plaćanje" ni "naplaćena")
  'Hrana': ['restoran', 'market', 'supermarket', 'hrana', 'kafić', 'pekara'],
  'Režije': ['elektro', 'voda', 'plin', 'toplan', 'telekom', 'internet', 'struja'],
  'Gorivo': ['gorivo', 'benz', 'shell', 'ina', 'nis', 'petrol', 'fuel'],
  'Zdravlje': ['apotek', 'pharmacy', 'bolnic', 'klinika', 'doktor'],
  'Transport': ['taxi', 'uber', 'bolt', 'parking', 'registracija'],
  'Nakupovina': ['shopping', 'trgovina', 'boutique', 'fashion', 'sport'],
  'Stanovanje': ['stanarina', 'rent', 'kirija', 'nekretnin'],
  'Transfer': ['transfer', 'nalog', 'uplata', 'isplata', 'prebacivanje', 'prijenos'],
  'Banka': ['provizija', 'naknada', 'banka', 'commission', 'usluge'],
  'Konverzija': ['konverziju', 'konverzija', 'tečaj', 'tecaj', 'devize', 'exch'],
};

const WORD_CHARS = /[\p{L}\p{N}]/u;

/** Običan ključ: dio teksta. Ključ koji počinje sa '=' mora biti cijela riječ. */
function matchesKeyword(text: string, keyword: string): boolean {
  if (!keyword.startsWith('=')) return text.includes(keyword);
  const word = keyword.slice(1);
  let from = 0;
  while (true) {
    const idx = text.indexOf(word, from);
    if (idx === -1) return false;
    const before = idx === 0 ? '' : text[idx - 1];
    const after = text[idx + word.length] ?? '';
    if (!WORD_CHARS.test(before) && !WORD_CHARS.test(after)) return true;
    from = idx + 1;
  }
}

function categorize(description: string): string {
  const lower = description.toLowerCase();
  // Bankarska provizija ima prednost (opis često sadrži i "nalog", što bi je svrstalo u Transfer)
  if (lower.includes('provizij')) return 'Banka';
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((kw) => matchesKeyword(lower, kw))) {
      return category;
    }
  }
  return 'Ostalo';
}

const DATE_PATTERN = /(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/;

function parseDate(text: string): { date: string; dateObj: Date } | null {
  const match = text.match(DATE_PATTERN);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = parseInt(match[3]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1990 && year <= 2030) {
      const dateObj = new Date(year, month, day);
      const date = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
      return { date, dateObj };
    }
  }
  return null;
}

function detectCurrency(text: string, fileName?: string): string {
  if (fileName) {
    const upperFileName = fileName.toUpperCase();
    if (upperFileName.includes('_EUR') || upperFileName.includes('EUR')) return 'EUR';
    if (upperFileName.includes('_BAM') || upperFileName.includes('BAM')) return 'BAM';
  }
  
  const upper = text.toUpperCase();
  if (upper.includes('978') && upper.includes('EUR')) return 'EUR';
  if (upper.includes('BAM') || upper.includes('KM')) return 'BAM';
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
  if (upper.includes('USD') || upper.includes('$')) return 'USD';
  return 'EUR';
}

function parseNumber(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(/[€$KM]/g, '');
  if (/^-?\d{1,3}([.,]\d{3})*[.,]\d{2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }
  if (/^-?\d+[.,]\d{2}$/.test(cleaned)) {
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }
  return null;
}

type TextLine = {
  y: number;
  items: { text: string; x: number; width?: number }[];
};

function groupItemsIntoLines(items: { text: string; x: number; y: number; width?: number }[]): TextLine[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: TextLine[] = [];
  let currentLine: TextLine = { y: sorted[0].y, items: [] };

  for (const item of sorted) {
    if (Math.abs(item.y - currentLine.y) < 3) {
      currentLine.items.push({ text: item.text, x: item.x, width: item.width });
    } else {
      currentLine.items.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = { y: item.y, items: [{ text: item.text, x: item.x, width: item.width }] };
    }
  }
  currentLine.items.sort((a, b) => a.x - b.x);
  lines.push(currentLine);

  return lines;
}

function extractStatementNumber(text: string): number | undefined {
  const match = text.match(/IZVOD\s+br:\s*(\d+)/i);
  if (match) {
    return parseInt(match[1]);
  }
  return undefined;
}

/**
 * Desna ivica stavke. Iznosi u UniCredit izvodima su poravnati udesno, pa je
 * kolona (Duguje / Potražuje) pouzdano određena desnom ivicom, a ne početkom teksta.
 */
function rightEdge(item: { text: string; x: number; width?: number }): number {
  if (item.width && item.width > 0) return item.x + item.width;
  let w = 0;
  for (const ch of item.text) w += /[.,:\s]/.test(ch) ? 2.5 : ch === '-' ? 3 : 5;
  return item.x + w;
}

// BAM izvod: granica između kolone Duguje (desna ivica ≈ 486) i Potražuje (≈ 566)
const BAM_DEBIT_CREDIT_SPLIT = 525;
// Iznosi počinju desno od opisa; sve što završava lijevo od ove tačke nije iznos
const BAM_AMOUNT_MIN_RIGHT = 440;

function isBamAmount(item: { text: string; x: number; width?: number }): boolean {
  return parseNumber(item.text.trim()) !== null && rightEdge(item) >= BAM_AMOUNT_MIN_RIGHT;
}

/**
 * Parsira stavke BAM izvoda jedne stranice.
 *
 * U ovom izvodu se opis stavke zalama u više redova koji se nalaze i IZNAD i ISPOD
 * reda sa referencom, datumom i iznosima. Zato se red sa referencom/datumom/iznosom
 * koristi kao "sidro", a redovi koji sadrže samo opis dodjeljuju se najbližem sidru
 * po vertikali. Redovi ispod tabele (promet, saldo, obavještenje banke) se ignorišu.
 */
function parseBamPage(lines: TextLine[], pageNumber: number, statementDate: string | null, startIndex: number): Transaction[] {
  // Granice tabele: od zaglavlja (Referenca ... Potražuje) do reda "Promet u valuti" / salda
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].items.some((it) => /^Referenca$/i.test(it.text.trim()))) { start = i + 1; break; }
  }
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const text = lines[i].items.map((it) => it.text).join(' ');
    if (/Promet u valuti|Stari saldo|Saldo prometa|Novi saldo/i.test(text)) { end = i; break; }
  }
  const body = lines.slice(start, end);

  type Part = { y: number; x: number; text: string };
  type Anchor = { y: number; reference?: string; date: string; dateObj: Date; debit: number; credit: number; parts: Part[] };
  const anchors: Anchor[] = [];
  const anchorByLine = new Map<TextLine, Anchor>();

  const descriptionParts = (line: TextLine): Part[] =>
    line.items
      .filter((it) => it.x >= 140 && it.text.trim() && !isBamAmount(it))
      .map((it) => ({ y: line.y, x: it.x, text: it.text.trim() }));

  for (const line of body) {
    const dateItem = line.items.find((it) => it.x >= 80 && it.x < 135 && /^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}$/.test(it.text.trim()));
    const amounts = line.items.filter(isBamAmount);
    const dateInfo = dateItem ? parseDate(dateItem.text.trim()) : null;
    if (!dateInfo || amounts.length === 0) continue;

    let debit = 0;
    let credit = 0;
    for (const amount of amounts) {
      const value = parseNumber(amount.text.trim()) ?? 0;
      if (rightEdge(amount) < BAM_DEBIT_CREDIT_SPLIT) debit = debit || value;
      else credit = credit || value;
    }
    const refItem = line.items.find((it) => it.x < 80 && it.text.trim());
    const anchor: Anchor = {
      y: line.y,
      reference: refItem?.text.trim(),
      date: dateInfo.date,
      dateObj: dateInfo.dateObj,
      debit,
      credit,
      parts: descriptionParts(line),
    };
    anchors.push(anchor);
    anchorByLine.set(line, anchor);
  }

  // Redovi se spajaju u blokove: red sa iznosom plus redovi opisa iznad i ispod njega.
  // Novi blok počinje kad je razmak do prethodnog reda veći od BLOCK_GAP
  // (razmak između redova opisa je ~9, a između dvije stavke 15 i više).
  const BLOCK_GAP = 12;
  let block: TextLine[] = [];
  const flushBlock = () => {
    const blockAnchors = block.map((l) => anchorByLine.get(l)).filter((a): a is Anchor => !!a);
    if (blockAnchors.length > 0) {
      for (const line of block) {
        if (anchorByLine.has(line)) continue;
        const parts = descriptionParts(line);
        if (parts.length === 0) continue;
        // u bloku sa više stavki red opisa ide najbližoj stavci
        let best = blockAnchors[0];
        for (const a of blockAnchors) {
          if (Math.abs(a.y - line.y) < Math.abs(best.y - line.y)) best = a;
        }
        best.parts.push(...parts);
      }
    }
    block = [];
  };
  for (const line of body) {
    if (block.length > 0 && block[block.length - 1].y - line.y > BLOCK_GAP) flushBlock();
    block.push(line);
  }
  flushBlock();

  const result: Transaction[] = [];
  for (const a of anchors) {
    if (a.debit <= 0 && a.credit <= 0) continue;
    // odozgo prema dolje, unutar reda slijeva udesno
    const description = [...a.parts]
      .sort((p, q) => (Math.abs(q.y - p.y) < 3 ? p.x - q.x : q.y - p.y))
      .map((p) => p.text)
      .reduce((acc, text) => (/\d-$/.test(acc) && /^\d/.test(text) ? acc + text : acc ? `${acc} ${text}` : text), '')
      .replace(/\s+/g, ' ')
      .trim();
    result.push({
      id: `txn_${pageNumber}_${startIndex + result.length}`,
      date: a.date,
      dateObj: a.dateObj,
      description: description || 'Nepoznata stavka',
      counterparty: '',
      amount: Math.max(a.debit, a.credit),
      type: a.credit > a.debit ? 'income' : 'expense',
      credit: a.credit,
      debit: a.debit,
      balance: undefined,
      category: categorize(description),
      rawLine: description,
      reference: a.reference,
      statementDate: statementDate || undefined,
    });
  }
  return result;
}

function parseUnicreditFormat(pages: PageData[], fileName?: string): BankStatementSummary {
  const allText = pages.map((p) => p.text).join('\n');
  const currency = detectCurrency(allText, fileName);
  const isBAM = currency === 'BAM';
  const statementNumber = extractStatementNumber(allText);
  const transactions: Transaction[] = [];
  
  let turnover = 0;
  let oldBalance = 0;
  let balanceChange = 0;
  let newBalance = 0;

  for (const page of pages) {
    const items = page.items;
    const lines = groupItemsIntoLines(items);
    
    let currentTransaction: {
      reference?: string;
      dateKnj?: string;
      dateVal?: string;
      description: string[];
      debit: number;
      credit: number;
    } | null = null;

    let statementDate: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineText = line.items.map((item) => item.text).join(' ');

      const statementDateMatch = lineText.match(/Na\s+dan:\s*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i);
      if (statementDateMatch) {
        const dateInfo = parseDate(statementDateMatch[1]);
        if (dateInfo) {
          statementDate = dateInfo.date;
        }
      }

      if (lineText.match(/Stari saldo/i)) {
        const numbers: number[] = [];
        const xMin = 300;
        const xMax = isBAM ? 620 : 460;
        for (const item of line.items) {
          if (item.x >= xMin && item.x < xMax) {
            const num = parseNumber(item.text);
            if (num !== null) numbers.push(num);
          }
        }
        if (numbers.length > 0) {
          oldBalance = numbers[numbers.length - 1];
        }
        continue;
      }
      if (lineText.match(/Saldo prometa/i)) {
        const numbers: number[] = [];
        const xMin = 300;
        const xMax = isBAM ? 620 : 460;
        for (const item of line.items) {
          if (item.x >= xMin && item.x < xMax) {
            const num = parseNumber(item.text);
            if (num !== null) numbers.push(num);
          }
        }
        if (numbers.length > 0) {
          balanceChange = numbers[numbers.length - 1];
        }
        continue;
      }
      if (lineText.match(/Promet/i)) {
        const numbers: number[] = [];
        const xMin = isBAM ? 300 : 250;
        const xMax = isBAM ? 620 : 375;
        for (const item of line.items) {
          if (item.x >= xMin && item.x < xMax) {
            // BAM: uzmi samo ukupni promet kolone Duguje (po desnoj ivici)
            if (isBAM && rightEdge(item) >= BAM_DEBIT_CREDIT_SPLIT) continue;
            const num = parseNumber(item.text);
            if (num !== null) numbers.push(num);
          }
        }
        if (numbers.length > 0) {
          turnover = numbers[0];
        }
        continue;
      }
      if (lineText.match(/Novi saldo/i)) {
        const numbers: number[] = [];
        const xMin = 300;
        const xMax = isBAM ? 620 : 600;
        
        for (const item of line.items) {
          const num = parseNumber(item.text);
          if (num !== null && item.x >= xMin && item.x < xMax) {
            numbers.push(num);
          }
        }
        
        for (let i = 0; i < numbers.length; i++) {
          if (numbers[i] !== 0) {
            newBalance = numbers[i];
            break;
          }
        }
        continue;
      }

      if (isBAM) continue; // stavke BAM izvoda se parsiraju u parseBamPage()

      if (lineText.match(/IZVADAK|IZVOD|Strana:|Datum:|br:|SONUS|Klijent:|Adresa:|BIC:|IBAN:|ID broj:|Knjiženo|Šifra|\* KM protuvrijednost/i)) {
        continue;
      }

      if (line.items.some(item => item.text.match(/^(Referenca|Opis|Duguje|Potražuje)$/i))) {
        continue;
      }

      const reference: string[] = [];
      const dateKnj: string[] = [];
      const dateVal: string[] = [];
      const description: string[] = [];
      const debitEUR: number[] = [];
      const creditEUR: number[] = [];
      const debitBAM: number[] = [];
      const creditBAM: number[] = [];

      for (const item of line.items) {
        const text = item.text.trim();
        if (!text) continue;

        const x = item.x;
        
        if (isBAM) {
          if (x < 80) {
            reference.push(text);
          } else if (x >= 80 && x < 130) {
            dateKnj.push(text);
          } else if (x >= 144 && x < 440) {
            description.push(text);
          } else if (x >= 440 && x < 520) {
            const num = parseNumber(text);
            if (num !== null) debitBAM.push(num);
          } else if (x >= 520 && x < 600) {
            const num = parseNumber(text);
            if (num !== null) creditBAM.push(num);
          }
        } else {
          if (x < 60) {
            reference.push(text);
          } else if (x >= 60 && x < 110) {
            dateKnj.push(text);
          } else if (x >= 110 && x < 160) {
            dateVal.push(text);
          } else if (x >= 160 && x < 300) {
            const num = parseNumber(text);
            if (num !== null && x >= 250) {
              debitEUR.push(num);
            } else {
              description.push(text);
            }
          } else if (x >= 250 && x < 375) {
            const num = parseNumber(text);
            if (num !== null) debitEUR.push(num);
          } else if (x >= 375 && x < 460) {
            const num = parseNumber(text);
            if (num !== null) creditEUR.push(num);
          }
        }
      }

      const hasTransaction = dateKnj.length > 0 && (debitEUR.length > 0 || creditEUR.length > 0 || debitBAM.length > 0 || creditBAM.length > 0);
      
      if (hasTransaction) {
        if (currentTransaction && currentTransaction.dateKnj) {
          const desc = currentTransaction.description.join(' ').trim();
          if (currentTransaction.debit > 0 || currentTransaction.credit > 0) {
            const dateInfo = parseDate(currentTransaction.dateKnj);
            if (dateInfo) {
              let finalDesc = desc;
              if (finalDesc.length === 0) {
                const prevLineIndex = i - 1;
                if (prevLineIndex >= 0) {
                  const prevLine = lines[prevLineIndex];
                  const prevDesc: string[] = [];
                  for (const item of prevLine.items) {
                    if (item.x >= 144 && item.x < 440) {
                      prevDesc.push(item.text.trim());
                    }
                  }
                  finalDesc = prevDesc.join(' ').trim();
                }
              }
              
              transactions.push({
                id: `txn_${page.pageNumber}_${transactions.length}`,
                date: dateInfo.date,
                dateObj: dateInfo.dateObj,
                description: finalDesc || 'Nepoznata stavka',
                counterparty: '',
                amount: Math.max(currentTransaction.debit, currentTransaction.credit),
                type: currentTransaction.credit > currentTransaction.debit ? 'income' : 'expense',
                credit: currentTransaction.credit,
                debit: currentTransaction.debit,
                balance: undefined,
                category: categorize(finalDesc),
                rawLine: finalDesc,
                reference: currentTransaction.reference,
                statementDate: statementDate || undefined,
              });
            }
          }
        }

        let debitAmount = 0;
        let creditAmount = 0;
        
        if (debitEUR.length > 0 || creditEUR.length > 0) {
          debitAmount = debitEUR[0] || 0;
          creditAmount = creditEUR[0] || 0;
        } else if (debitBAM.length > 0 || creditBAM.length > 0) {
          debitAmount = debitBAM[0] || 0;
          creditAmount = creditBAM[0] || 0;
        }

        currentTransaction = {
          reference: reference[0],
          dateKnj: dateKnj[0],
          dateVal: dateVal[0],
          description: description,
          debit: debitAmount,
          credit: creditAmount,
        };
      } else if (currentTransaction && description.length > 0) {
        const filteredDescription = description.filter(item => 
          !item.match(/Promet u valuti:|Iznos odobrenog|overdrafta:|Stari saldo:|Novi saldo:|Saldo prometa:/i)
        );
        currentTransaction.description.push(...filteredDescription);
      }
    }

    if (isBAM) {
      transactions.push(...parseBamPage(lines, page.pageNumber, statementDate, transactions.length));
      continue;
    }

    if (currentTransaction && currentTransaction.dateKnj) {
      const desc = currentTransaction.description.join(' ').trim();
      if (desc.length > 0 && (currentTransaction.debit > 0 || currentTransaction.credit > 0)) {
        const dateInfo = parseDate(currentTransaction.dateKnj);
        if (dateInfo) {
          transactions.push({
            id: `txn_${page.pageNumber}_${transactions.length}`,
            date: dateInfo.date,
            dateObj: dateInfo.dateObj,
            description: desc,
            counterparty: '',
            amount: Math.max(currentTransaction.debit, currentTransaction.credit),
            type: currentTransaction.credit > currentTransaction.debit ? 'income' : 'expense',
            credit: currentTransaction.credit,
            debit: currentTransaction.debit,
            balance: undefined,
            category: categorize(desc),
            rawLine: desc,
            reference: currentTransaction.reference,
            statementDate: statementDate || undefined,
          });
        }
      }
    }
  }

  transactions.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (newBalance !== 0 && transactions.length > 0) {
    transactions[transactions.length - 1].balance = newBalance;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalIncome = round2(transactions.reduce((sum, t) => sum + t.credit, 0));
  const totalExpense = round2(transactions.reduce((sum, t) => sum + t.debit, 0));

  const firstBalance = transactions[0]?.balance;
  const lastBalance = transactions[transactions.length - 1]?.balance;
  const openingBalance: number = firstBalance !== undefined
    ? round2(firstBalance - (transactions[0].credit - transactions[0].debit))
    : oldBalance;
  const closingBalance: number = lastBalance !== undefined
    ? lastBalance
    : newBalance !== 0 ? newBalance : round2(openingBalance + totalIncome - totalExpense);

  return {
    transactions,
    totalIncome,
    totalExpense,
    netChange: totalIncome - totalExpense,
    openingBalance,
    closingBalance,
    currency,
    periodStart: transactions.length > 0 ? transactions[0].date : '',
    periodEnd: transactions.length > 0 ? transactions[transactions.length - 1].date : '',
    transactionCount: transactions.length,
    statementNumber,
    turnover,
    oldBalance,
    balanceChange,
    newBalance,
  };
}

export function parseBankStatement(pages: PageData[], fileName?: string): BankStatementSummary {
  return parseUnicreditFormat(pages, fileName);
}

export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    BAM: 'KM',
    USD: '$',
    RSD: 'RSD',
    HRK: 'kn',
  };
  const symbol = symbols[currency] || currency;
  const formatted = Math.abs(amount).toLocaleString('bs-BA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}${formatted} ${symbol}`;
}
