import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, X, Save, AlertCircle, Tag, Download, Upload } from 'lucide-react';
import { GroupingRule, parseTags, parseRulesFile, mergeRules } from '../types/GroupingRule';

interface GroupingRulesPanelProps {
  rules: GroupingRule[];
  onRulesChange: (rules: GroupingRule[]) => void;
  onClose: () => void;
}

// Komponenta za autocomplete tagova
function TagAutocomplete({ 
  value, 
  onChange, 
  existingTags,
  placeholder 
}: { 
  value: string;
  onChange: (value: string) => void;
  existingTags: string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Više tagova se odvaja zarezom; autocomplete radi nad tagom koji se trenutno kuca (iza zadnjeg zareza)
  const lastComma = value.lastIndexOf(',');
  const prefix = lastComma >= 0 ? value.slice(0, lastComma + 1) : '';
  const currentPart = (lastComma >= 0 ? value.slice(lastComma + 1) : value).trim();
  const alreadyUsed = useMemo(
    () => new Set(parseTags(prefix).map(t => t.toLowerCase())),
    [prefix]
  );

  const filteredTags = useMemo(() => {
    return existingTags.filter(tag =>
      !alreadyUsed.has(tag.toLowerCase()) &&
      (!currentPart || tag.toLowerCase().includes(currentPart.toLowerCase()))
    );
  }, [existingTags, currentPart, alreadyUsed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleSelectTag = (tag: string) => {
    const head = prefix ? prefix.trimEnd() + ' ' : '';
    onChange(`${head}${tag}, `);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  // Izbor tastaturom: strelice gore/dolje, Enter potvrđuje, Esc zatvara listu
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredTags.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (i + 1) % filteredTags.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => (i <= 0 ? filteredTags.length - 1 : i - 1));
    } else if (isOpen && e.key === 'Enter' && activeIndex >= 0 && activeIndex < filteredTags.length) {
      e.preventDefault();
      handleSelectTag(filteredTags[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    setIsOpen(false);
    // Očisti razmake, prazne i duplirane tagove tek kad korisnik napusti polje
    const cleaned = parseTags(value).join(', ');
    if (cleaned !== value) onChange(cleaned);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder={placeholder || "Izaberi ili unesi tagove (odvojene zarezom)"}
          className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg text-cyan-400 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>
      
      {isOpen && filteredTags.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredTags.map((tag, index) => (
            <button
              key={index}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectTag(tag)}
              ref={index === activeIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              className={`w-full px-3 py-2 text-left text-sm text-white transition-colors flex items-center gap-2 ${
                index === activeIndex ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              <Tag size={12} className="text-cyan-400" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Autocomplete za naziv grupe: nudi nazive grupa koji već postoje u pravilima
function GroupNameAutocomplete({
  value,
  onChange,
  existingNames,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  existingNames: string[];
  placeholder?: string;
  className: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const typed = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    return existingNames.filter((name) => {
      const lower = name.toLowerCase();
      return lower !== typed && (!typed || lower.includes(typed));
    });
  }, [existingNames, typed]);

  const select = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((name, index) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(name)}
              ref={index === activeIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              className={`w-full px-3 py-2 text-left text-sm text-white transition-colors ${
                index === activeIndex ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupingRulesPanel({ rules, onRulesChange, onClose }: GroupingRulesPanelProps) {
  const [newPattern, setNewPattern] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newExclude, setNewExclude] = useState('');
  const [newIsRegex, setNewIsRegex] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ rules: GroupingRule[]; skipped: number } | null>(null);
  const [fileMessage, setFileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFileMessage = (type: 'success' | 'error', text: string) => {
    setFileMessage({ type, text });
    setTimeout(() => setFileMessage(null), 5000);
  };

  const handleExportRules = () => {
    const payload = {
      type: 'sonusart-grouping-rules',
      version: 1,
      exportDate: new Date().toISOString(),
      rules,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pravila-grupisanja-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFileMessage('success', `Izvezeno ${rules.length} pravila.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseRulesFile(await file.text());
      if (rules.length === 0) {
        onRulesChange(parsed.rules);
        showFileMessage('success', `Uvezeno ${parsed.rules.length} pravila${parsed.skipped ? ` (preskočeno neispravnih: ${parsed.skipped})` : ''}.`);
      } else {
        setPendingImport(parsed);
      }
    } catch (err) {
      showFileMessage('error', err instanceof Error ? err.message : 'Fajl nije ispravan.');
    }
  };

  const applyImport = (mode: 'replace' | 'merge') => {
    if (!pendingImport) return;
    if (mode === 'replace') {
      onRulesChange(pendingImport.rules);
      showFileMessage('success', `Postojeća pravila zamijenjena. Uvezeno: ${pendingImport.rules.length}.`);
    } else {
      const { rules: merged, added } = mergeRules(rules, pendingImport.rules);
      onRulesChange(merged);
      showFileMessage('success', `Dodano ${added} novih pravila (duplikati preskočeni: ${pendingImport.rules.length - added}).`);
    }
    setPendingImport(null);
  };

  // Svi nazivi grupa koji već postoje u pravilima (bez duplikata, abecedno)
  const existingGroupNames = useMemo(() => {
    const names = new Map<string, string>();
    rules.forEach((rule) => {
      const name = rule.groupName.trim();
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    });
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [rules]);

  // Izvuci sve postojeće tagove iz pravila
  const existingTags = useMemo(() => {
    const tags = new Set<string>();
    rules.forEach(rule => {
      parseTags(rule.tag).forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [rules]);

  const addRule = () => {
    if (!newPattern.trim() || !newGroupName.trim()) {
      setError('Pattern i naziv grupe su obavezni');
      return;
    }
    
    // Testiraj regex ako je uključen
    if (newIsRegex) {
      try {
        new RegExp(newPattern, 'i');
        newExclude.split(',').forEach(c => c.trim() && new RegExp(c.trim(), 'i'));
      } catch (err) {
        setError('Nevažeći regex pattern');
        return;
      }
    }
    
    const newRule: GroupingRule = {
      id: `rule_${Date.now()}`,
      pattern: newPattern.trim(),
      groupName: newGroupName.trim(),
      isRegex: newIsRegex,
      enabled: true,
      exclude: newExclude.trim() || undefined,
      tag: parseTags(newTag).join(', ') || undefined,
    };
    
    onRulesChange([...rules, newRule]);
    setNewPattern('');
    setNewGroupName('');
    setNewExclude('');
    setNewIsRegex(false);
    setNewTag('');
    setError(null);
  };

  const removeRule = (id: string) => {
    onRulesChange(rules.filter(r => r.id !== id));
  };

  const toggleRule = (id: string) => {
    onRulesChange(rules.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const updateRule = (id: string, updates: Partial<GroupingRule>) => {
    onRulesChange(rules.map(r => 
      r.id === id ? { ...r, ...updates } : r
    ));
  };



  return (
    <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          📌 Manuelna pravila grupisanja
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      <p className="text-sm text-slate-400">
        Definišite pravila za grupisanje transakcija. Pravila se primenjuju po redosledu (prvo match-ovano pravilo pobeđuje).
        Čuvaju se u istoj bazi (.db) kao i izvodi, pa ostaju i kad obrišete sve izvode.
      </p>

      {/* Izvoz / uvoz pravila */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleExportRules}
          disabled={rules.length === 0}
          className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          <Download size={14} /> Izvezi pravila
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          <Upload size={14} /> Uvezi pravila
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
        {fileMessage && (
          <span className={`text-sm ${fileMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {fileMessage.text}
          </span>
        )}
      </div>

      {pendingImport && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 space-y-2">
          <p className="text-sm text-slate-200">
            U fajlu je {pendingImport.rules.length} pravila
            {pendingImport.skipped > 0 && ` (neispravnih preskočeno: ${pendingImport.skipped})`}.
            Trenutno imate {rules.length}. Šta želite?
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => applyImport('replace')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors">
              Zamijeni postojeća
            </button>
            <button onClick={() => applyImport('merge')} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
              Dodaj postojećim
            </button>
            <button onClick={() => setPendingImport(null)} className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors">
              Odustani
            </button>
          </div>
        </div>
      )}

      {/* Add New Rule */}
      <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-white">Dodaj novo pravilo</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Pattern (tekst ili regex)</label>
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="npr. ELEKTRONIKA, KONVERZIJA, KAMATA"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Naziv grupe</label>
            <GroupNameAutocomplete
              value={newGroupName}
              onChange={setNewGroupName}
              existingNames={existingGroupNames}
              placeholder="npr. Dobavljač - Elektronika"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          
          <div>
            <label className="text-xs text-slate-400 mb-1 block">🏷️ Tagovi (opciono, odvojeni zarezom)</label>
            <TagAutocomplete
              value={newTag}
              onChange={setNewTag}
              existingTags={existingTags}
              placeholder="npr. Gorivo, Vozilo (više tagova odvojite zarezom)"
            />
          </div>
        </div>
        
        <div>
          <label className="text-xs text-slate-400 mb-1 block">🚫 Izuzmi (opciono) — transakcije koje sadrže ovo ne ulaze u ovo pravilo</label>
          <input
            type="text"
            value={newExclude}
            onChange={(e) => setNewExclude(e.target.value)}
            placeholder="npr. Naplaćena provizija (više uslova odvojite zarezom)"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsRegex}
              onChange={(e) => setNewIsRegex(e.target.checked)}
              className="w-4 h-4 bg-slate-700 border-slate-600 text-purple-500 rounded"
            />
            <span className="text-sm text-slate-300">Koristi regex</span>
          </label>
          
          <button
            onClick={addRule}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Dodaj pravilo
          </button>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      {/* Existing Rules */}
      {rules.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Aktivna pravila ({rules.length})</h4>
          
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={`bg-slate-900/50 rounded-lg p-3 flex items-start gap-3 ${
                  !rule.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex flex-col items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500 font-mono">#{index + 1}</span>
                  
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                    className="w-4 h-4 bg-slate-700 border-slate-600 text-green-500 rounded"
                    title={rule.enabled ? 'Onemogući pravilo' : 'Omogući pravilo'}
                  />
                </div>
                
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Pattern input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rule.pattern}
                      onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                      placeholder="uslov1, uslov2, uslov3..."
                      className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700/50 rounded text-sm text-purple-400 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                    <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={rule.isRegex}
                        onChange={(e) => updateRule(rule.id, { isRegex: e.target.checked })}
                        className="w-3.5 h-3.5 bg-slate-700 border-slate-600 text-blue-500 rounded"
                      />
                      <span className="text-xs text-slate-400">Regex</span>
                    </label>
                  </div>
                  
                  {/* Izuzeci */}
                  <div>
                    <label className="text-xs text-slate-500 mb-0.5 block">🚫 Izuzmi (transakcije koje sadrže ovo ne ulaze u pravilo)</label>
                    <input
                      type="text"
                      value={rule.exclude || ''}
                      onChange={(e) => updateRule(rule.id, { exclude: e.target.value.trim() ? e.target.value : undefined })}
                      placeholder="npr. Naplaćena provizija"
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700/50 rounded text-sm text-red-300 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                  </div>

                  {/* Group name input */}
                  <GroupNameAutocomplete
                    value={rule.groupName}
                    onChange={(value) => updateRule(rule.id, { groupName: value })}
                    existingNames={existingGroupNames}
                    placeholder="Naziv grupe"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700/50 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  />
                  
                  {/* Tag input */}
                  <div>
                    <label className="text-xs text-slate-500 mb-0.5 block">🏷️ Tagovi (odvojeni zarezom)</label>
                    <TagAutocomplete
                      value={rule.tag || ''}
                      onChange={(value) => updateRule(rule.id, { tag: value.trim() ? value : undefined })}
                      existingTags={existingTags}
                      placeholder="npr. Gorivo, Vozilo (više tagova odvojite zarezom)"
                    />
                  </div>
                </div>
                
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  title="Obriši pravilo"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
        <strong>💡 Kako funkcioniše:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Pravila se primenjuju po redosledu (prvo match-ovano pravilo pobeđuje)</li>
          <li>Pattern može biti običan tekst ili regex (ako je uključeno)</li>
          <li>Jedno pravilo može sadržati više uslova odvojenih zarezom (OR logika)</li>
          <li>U polju <strong>Izuzmi</strong> navedite uslove (odvojene zarezom) koji isključuju transakciju iz pravila — ona ide na sljedeće pravilo ili u "Negrupisano"</li>
          <li>Match-ovane transakcije se grupišu pod nazivom grupe</li>
          <li>Uz svako pravilo možete dodati jedan ili više <strong>tagova</strong> (odvojenih zarezom, npr. <code>Gorivo, Vozilo</code>) — transakcija će se pojaviti u svakom od tih tagova</li>
          <li>Kod tagova možete <strong>izabrati postojeći</strong> iz liste ili <strong>uneti novi</strong></li>
          <li>Sve transakcije koje ne matchuju nijedno pravilo idu u "Negrupisano"</li>
        </ul>
      </div>
    </div>
  );
}
