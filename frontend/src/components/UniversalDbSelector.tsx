import React, { useState } from 'react';
import { DatabaseEngine, DATABASE_CATALOG, DatabaseCategory } from '../types';
import { Search, ChevronDown, Check } from 'lucide-react';
import { DbBrandLogo } from './DbBrandLogo';


interface UniversalDbSelectorProps {
  selectedEngine: DatabaseEngine;
  onSelectEngine: (engine: DatabaseEngine) => void;
  label?: string;
}

export const UniversalDbSelector: React.FC<UniversalDbSelectorProps> = ({
  selectedEngine,
  onSelectEngine,
  label = 'Selected Engine',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DatabaseCategory | 'all' | 'top_ranked'>('top_ranked');
  const [searchFilter, setSearchFilter] = useState('');

  const currentDb = DATABASE_CATALOG.find((d) => d.id === selectedEngine) || DATABASE_CATALOG[0];

  const categories: { id: DatabaseCategory | 'all' | 'top_ranked'; label: string; icon: string }[] = [
    { id: 'top_ranked', label: '🏆 Top Ranked', icon: '🏆' },
    { id: 'all', label: `All DBs (${DATABASE_CATALOG.length})`, icon: '🌐' },
    { id: 'relational', label: 'Relational (SQL)', icon: '🏛️' },
    { id: 'olap', label: 'Analytics & OLAP', icon: '📊' },
    { id: 'document', label: 'Document NoSQL', icon: '📄' },
    { id: 'keyvalue', label: 'Key-Value & Memory', icon: '⚡' },
    { id: 'vector', label: 'Vector AI', icon: '🧠' },
    { id: 'search', label: 'Search Engines', icon: '🔍' },
    { id: 'graph', label: 'Graph DBs', icon: '🕸️' },
    { id: 'timeseries', label: 'Time-Series', icon: '📈' },
    { id: 'wide_column', label: 'Wide-Column', icon: '📦' },
    { id: 'baas_embedded', label: 'BaaS & Embedded', icon: '🚀' },
    { id: 'geo_spatial', label: 'Spatial & Geo', icon: '🗺️' },
    { id: 'streaming_ledger', label: 'Streaming & Ledger', icon: '📼' },
  ];

  const filteredDatabases = DATABASE_CATALOG.filter((d) => {
    let matchesCategory = true;
    if (activeCategory === 'top_ranked') {
      matchesCategory = !!d.rank && d.rank <= 50;
    } else if (activeCategory !== 'all') {
      matchesCategory = d.category === activeCategory;
    }

    const matchesSearch =
      d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.categoryLabel.toLowerCase().includes(searchFilter.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="relative">
      {/* Trigger Button */}
      <div className="flex items-center gap-2">
        {label && <span className="text-xs font-bold text-slate-700 hidden sm:inline">{label}:</span>}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-purple-200/80 shadow-sm hover:border-purple-300 transition text-xs font-bold text-slate-900"
        >
          <DbBrandLogo engineId={currentDb.id} size={18} />
          <span>{currentDb.name}</span>
          {currentDb.rank && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-mono">
              #{currentDb.rank}
            </span>
          )}
          <span className="text-[10px] font-normal text-slate-500 hidden md:inline">
            ({currentDb.categoryLabel})
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Popover / Modal Dropdown */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-x-3 top-20 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-[calc(100vw-24px)] sm:w-[540px] md:w-[620px] max-h-[75vh] sm:max-h-[500px] bg-white rounded-2xl shadow-2xl border border-purple-200/90 z-50 p-3.5 sm:p-4 space-y-3 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header & Search */}
            <div className="flex items-center justify-between gap-2.5 border-b border-purple-100 pb-2.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`Search across ${DATABASE_CATALOG.length} database engines...`}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-purple-200 text-xs bg-purple-50/40 focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 shrink-0"
              >
                Done
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition flex items-center gap-1 active:scale-95 ${
                    activeCategory === cat.id
                      ? 'bg-purple-600 text-white shadow-sm font-bold'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Results Grid */}
            <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pr-1 flex-1 max-h-64 sm:max-h-72 scrollbar-thin">
              {filteredDatabases.slice(0, 100).map((db) => {
                const isSelected = db.id === selectedEngine;
                return (
                  <button
                    key={db.id}
                    type="button"
                    onClick={() => {
                      onSelectEngine(db.id);
                      setIsOpen(false);
                    }}
                    className={`p-2 rounded-xl text-left text-xs transition flex items-center justify-between border active:scale-95 ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold shadow-sm'
                        : 'bg-white border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 text-slate-800'
                    }`}
                  >
                  <div className="flex items-center gap-2 truncate">
                    <DbBrandLogo engineId={db.id} size={18} className="shrink-0" />
                    <div className="truncate">
                      <div className="truncate font-semibold text-[11px]">{db.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{db.categoryLabel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {db.rank && (
                      <span className="text-[9px] font-mono text-purple-700 bg-purple-100/80 px-1 rounded">
                        #{db.rank}
                      </span>
                    )}
                    {isSelected && <Check className="w-3 h-3 text-purple-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredDatabases.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-400">
              No database engines matching "{searchFilter}".
            </div>
          )}

            <div className="text-[10px] text-slate-400 text-right border-t border-purple-100 pt-2">
              Showing {Math.min(75, filteredDatabases.length)} of {filteredDatabases.length} filtered systems (DB-Engines Index)
            </div>
          </div>
        </>
      )}
    </div>
  );
};

