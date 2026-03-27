import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, Loader2, Sparkles, ChevronDown, ChevronUp, AlertCircle, Clock, Lightbulb, SlidersHorizontal, X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchResult } from './SearchResult';
import { useSearch } from '@/hooks/useSearch';
import { useUiStore } from '@/stores/uiStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useT } from '@/i18n';
import { getSpaces } from '@/api/spaces';
import { getTags } from '@/api/tags';
import { getAllUsers } from '@/api/permissions';
import type { SearchResult as SearchResultType, Space } from '@/types';
import type { SearchFilters } from '@/api/search';

// Group results by space
function groupBySpace(results: SearchResultType[]) {
  const groups: { space: SearchResultType['space']; results: SearchResultType[] }[] = [];
  const spaceMap = new Map<string, SearchResultType[]>();
  const spaceOrder: string[] = [];

  for (const result of results) {
    const key = result.space.id;
    if (!spaceMap.has(key)) {
      spaceMap.set(key, []);
      spaceOrder.push(key);
    }
    spaceMap.get(key)!.push(result);
  }

  for (const key of spaceOrder) {
    const items = spaceMap.get(key);
    const first = items?.[0];
    if (items && first) {
      groups.push({ space: first.space, results: items });
    }
  }

  return groups;
}

interface FilterOption { id: string; label: string }

export function SearchPalette() {
  const t = useT();
  const { searchOpen, setSearchOpen } = useUiStore();
  const {
    query, setQuery, filters, setFilters, clearFilters, results, loading, selectedIndex, setSelectedIndex,
    searchMode, expandedQuery, timing, didYouMean, suggestions, trackClick,
  } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [showExpanded, setShowExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter data (loaded lazily)
  const [spaces, setSpaces] = useState<FilterOption[]>([]);
  const [authors, setAuthors] = useState<FilterOption[]>([]);
  const [tags, setTags] = useState<FilterOption[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Need multiple spaces for grouping to be useful
  const grouped = useMemo(() => groupBySpace(results), [results]);
  const hasMultipleSpaces = grouped.length > 1;

  const hasActiveFilters = !!(filters.spaceId || filters.authorId || filters.tagId || filters.dateFrom || filters.dateTo);

  useKeyboardShortcut('k', () => setSearchOpen(true), { meta: true });

  // Load filter data when filter panel opens
  useEffect(() => {
    if (showFilters && !filtersLoaded) {
      Promise.all([getSpaces(), getTags(), getAllUsers()]).then(([s, tg, u]) => {
        setSpaces((s as Space[]).map(sp => ({ id: sp.id, label: sp.name })));
        setTags((tg as { id: string; name: string }[]).map(t => ({ id: t.id, label: t.name })));
        setAuthors((u as { id: string; name: string | null; email: string }[]).map(usr => ({
          id: usr.id,
          label: usr.name || usr.email,
        })));
        setFiltersLoaded(true);
      }).catch(() => {});
    }
  }, [showFilters, filtersLoaded]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setShowExpanded(false);
      setShowFilters(false);
    }
  }, [searchOpen, setQuery]);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nexus:recent-searches') || '[]'); }
    catch { return []; }
  });

  const saveRecentSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((s) => s !== q)].slice(0, 5);
      localStorage.setItem('nexus:recent-searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSelect = (index: number) => {
    const result = results[index];
    if (result) {
      saveRecentSearch(query);
      trackClick(result.id);
      if (result.type === 'attachment' && result.attachmentMeta?.pageId) {
        // Navigate to the page that contains this attachment
        // We don't have the page slug, so navigate to space and let the user find it
        navigate(`/${result.space.slug}`);
      } else if (result.type === 'attachment') {
        navigate(`/${result.space.slug}`);
      } else {
        navigate(`/${result.space.slug}/${result.slug}`);
      }
      setSearchOpen(false);
    }
  };

  const handleDidYouMean = () => {
    if (didYouMean) setQuery(didYouMean);
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  const updateFilter = (key: keyof SearchFilters, value: string | undefined) => {
    setFilters({ ...filters, [key]: value || undefined });
  };

  // Get display name for active filter chip
  const getFilterLabel = (key: keyof SearchFilters, value: string) => {
    if (key === 'spaceId') return spaces.find(s => s.id === value)?.label || value;
    if (key === 'authorId') return authors.find(a => a.id === value)?.label || value;
    if (key === 'tagId') return tags.find(t => t.id === value)?.label || value;
    if (key === 'dateFrom' || key === 'dateTo') return value;
    return value;
  };

  // Flatten grouped results into a flat index → result map for keyboard nav
  let flatIndex = 0;

  return (
    <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2"
          onKeyDown={handleKeyDown}
        >
          <Dialog.Title className="sr-only">{t('search.title')}</Dialog.Title>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden"
            data-testid="search-palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-border-primary">
              {loading ? (
                <Loader2 className="h-4 w-4 text-text-muted animate-spin shrink-0" />
              ) : (
                <Search className="h-4 w-4 text-text-muted shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                className="flex-1 h-12 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                data-testid="search-input"
              />
              {searchMode === 'semantic' && !loading && results.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-400 shrink-0">
                  <Sparkles className="h-3 w-3" />
                  AI
                </span>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  showFilters || hasActiveFilters
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
                title={t('search.filters')}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
              <kbd className="text-[10px] font-mono text-text-muted border border-border-primary rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>

            {/* Filter bar */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-border-primary"
                >
                  <div className="px-4 py-2.5 flex flex-wrap items-center gap-2">
                    {/* Space filter */}
                    <select
                      value={filters.spaceId || ''}
                      onChange={(e) => updateFilter('spaceId', e.target.value)}
                      className="h-7 px-2 text-xs rounded-md bg-bg-tertiary border border-border-primary text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="">{t('search.allSpaces')}</option>
                      {spaces.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>

                    {/* Author filter */}
                    <select
                      value={filters.authorId || ''}
                      onChange={(e) => updateFilter('authorId', e.target.value)}
                      className="h-7 px-2 text-xs rounded-md bg-bg-tertiary border border-border-primary text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="">{t('search.allAuthors')}</option>
                      {authors.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>

                    {/* Tag filter */}
                    <select
                      value={filters.tagId || ''}
                      onChange={(e) => updateFilter('tagId', e.target.value)}
                      className="h-7 px-2 text-xs rounded-md bg-bg-tertiary border border-border-primary text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="">{t('search.allTags')}</option>
                      {tags.map(tg => <option key={tg.id} value={tg.id}>{tg.label}</option>)}
                    </select>

                    {/* Date range */}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-text-muted" />
                      <input
                        type="date"
                        value={filters.dateFrom || ''}
                        onChange={(e) => updateFilter('dateFrom', e.target.value)}
                        className="h-7 px-1.5 text-xs rounded-md bg-bg-tertiary border border-border-primary text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                        title={t('search.filterDateFrom')}
                      />
                      <span className="text-[10px] text-text-muted">—</span>
                      <input
                        type="date"
                        value={filters.dateTo || ''}
                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                        className="h-7 px-1.5 text-xs rounded-md bg-bg-tertiary border border-border-primary text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                        title={t('search.filterDateTo')}
                      />
                    </div>

                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="ml-auto text-[10px] text-text-muted hover:text-accent transition-colors"
                      >
                        {t('search.clearFilters')}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active filter chips (always visible when filters active) */}
            {hasActiveFilters && !showFilters && (
              <div className="px-4 py-1.5 border-b border-border-primary flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{t('search.activeFilters')}:</span>
                {(Object.entries(filters) as [keyof SearchFilters, string | undefined][]).map(([key, value]) => {
                  if (!value) return null;
                  const labelMap: Record<string, string> = {
                    spaceId: t('search.filterSpace'),
                    authorId: t('search.filterAuthor'),
                    tagId: t('search.filterTag'),
                    dateFrom: t('search.filterDateFrom'),
                    dateTo: t('search.filterDateTo'),
                  };
                  return (
                    <span key={key} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-accent/15 text-accent">
                      {labelMap[key]}: {getFilterLabel(key, value)}
                      <button
                        onClick={() => updateFilter(key, undefined)}
                        className="hover:text-accent-hover"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Suggestions (before results arrive) */}
            {query && results.length === 0 && !loading && suggestions.length > 0 && !didYouMean && (
              <div className="px-4 py-2 border-b border-border-primary">
                <div className="text-[11px] text-text-muted mb-1">{t('search.suggestions')}</div>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      className="text-xs px-2 py-1 rounded-md bg-bg-tertiary text-text-secondary hover:bg-accent/15 hover:text-accent transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata bar: timing + expanded query */}
            {query && results.length > 0 && !loading && (
              <div className="px-4 py-1.5 border-b border-border-primary flex items-center gap-2 text-[11px] text-text-muted">
                <span>
                  {t('search.resultCount', { count: results.length, timing: String(timing) })}
                </span>
                {searchMode === 'trigram' && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium">
                    {t('search.fuzzy')}
                  </span>
                )}
                {searchMode === 'semantic' && (
                  <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 text-[10px] font-medium">
                    {t('search.semantic')}
                  </span>
                )}
                {expandedQuery && (
                  <button
                    onClick={() => setShowExpanded(!showExpanded)}
                    className="ml-auto flex items-center gap-1 hover:text-text-primary transition-colors"
                  >
                    {t('search.expandedQuery')}
                    {showExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
            )}

            {/* Expanded query detail */}
            <AnimatePresence>
              {showExpanded && expandedQuery && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-border-primary"
                >
                  <div className="px-4 py-2 text-[11px] text-text-muted bg-bg-tertiary/50">
                    <span className="text-violet-400">{t('search.aiTerms')}</span>{' '}
                    {expandedQuery}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto p-2">
              <AnimatePresence mode="wait">
                {query && results.length === 0 && !loading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-6 text-center"
                  >
                    <div className="text-sm text-text-muted">
                      {t('search.noResults', { query })}
                    </div>
                    {didYouMean && (
                      <button
                        onClick={handleDidYouMean}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {t('search.didYouMean')} <span className="font-medium underline">{didYouMean}</span>
                      </button>
                    )}
                    {!didYouMean && suggestions.length === 0 && (
                      <div className="mt-3 text-xs text-text-muted space-y-0.5">
                        <p>{t('search.tryDifferent')}</p>
                        <p>{t('search.checkSpelling')}</p>
                      </div>
                    )}
                  </motion.div>
                ) : hasMultipleSpaces ? (
                  // Grouped by space
                  grouped.map((group) => (
                    <div key={group.space.id}>
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {group.space.name}
                      </div>
                      {group.results.map((result) => {
                        const idx = flatIndex++;
                        return (
                          <SearchResult
                            key={result.id}
                            result={result}
                            active={idx === selectedIndex}
                            onClick={() => handleSelect(results.indexOf(result))}
                            hideSpace
                          />
                        );
                      })}
                    </div>
                  ))
                ) : (
                  // Flat list (single space or few results)
                  results.map((result, i) => (
                    <SearchResult
                      key={result.id}
                      result={result}
                      active={i === selectedIndex}
                      onClick={() => handleSelect(i)}
                    />
                  ))
                )}
              </AnimatePresence>

              {!query && (
                <div className="py-4 px-2">
                  {/* Recent searches */}
                  {recentSearches.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                        <Clock className="h-3 w-3" />
                        {t('search.recentSearches')}
                      </div>
                      {recentSearches.map((s) => (
                        <button
                          key={s}
                          onClick={() => setQuery(s)}
                          className="w-full text-left px-3 py-1.5 text-sm text-text-secondary rounded-md hover:bg-bg-hover hover:text-text-primary transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Search tips */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                      <Lightbulb className="h-3 w-3" />
                      {t('search.suggestions')}
                    </div>
                    <div className="space-y-1 px-1 text-xs text-text-muted">
                      <p>{t('search.tipKeywords')}</p>
                      <p>{t('search.tipSemantic')}</p>
                      <p>{t('search.tipPhrase')}</p>
                      <p>{t('search.tipExclude')}</p>
                      <p>{t('search.tipOr')}</p>
                      <p>{t('search.tipField')}</p>
                      <p>{t('search.tipEnter')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {query && results.length > 0 && !loading && (
              <div className="px-4 py-1.5 border-t border-border-primary flex items-center justify-between text-[10px] text-text-muted">
                <div className="flex items-center gap-3">
                  <span><kbd className="font-mono bg-bg-tertiary px-1 rounded">↑↓</kbd> {t('search.navigate')}</span>
                  <span><kbd className="font-mono bg-bg-tertiary px-1 rounded">↵</kbd> {t('search.open')}</span>
                </div>
                {didYouMean && (
                  <button
                    onClick={handleDidYouMean}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    {t('search.didYouMean')} {didYouMean}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
