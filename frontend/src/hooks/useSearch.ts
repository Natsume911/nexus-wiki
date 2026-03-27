import { useState, useCallback, useRef, useEffect } from 'react';
import { search, logSearchClick, searchSuggestions, type SearchFilters } from '@/api/search';
import type { SearchResult } from '@/types';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<'semantic' | 'fulltext' | 'trigram'>('fulltext');
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [timing, setTiming] = useState<number>(0);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const filtersRef = useRef<SearchFilters>({});
  filtersRef.current = filters;

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await search(q, filtersRef.current);
      setResults(data.results);
      setSearchMode(data.mode);
      setExpandedQuery(data.expandedQuery);
      setTiming(data.timing);
      setDidYouMean(data.didYouMean);
      setSearchId(data.searchId ?? null);
      setSuggestions([]);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await searchSuggestions(q);
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const updateQuery = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(timerRef.current);
    clearTimeout(suggestTimerRef.current);

    if (!q.trim()) {
      setResults([]);
      setExpandedQuery(null);
      setTiming(0);
      setDidYouMean(null);
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => doSearch(q), 300);
    suggestTimerRef.current = setTimeout(() => fetchSuggestions(q), 150);
  }, [doSearch, fetchSuggestions]);

  // Re-search when filters change (if query exists)
  const updateFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    // Trigger search with new filters after state update
    setTimeout(() => {
      if (query.trim()) {
        doSearch(query);
      }
    }, 0);
  }, [query, doSearch]);

  const clearFilters = useCallback(() => {
    setFilters({});
    if (query.trim()) {
      setTimeout(() => doSearch(query), 0);
    }
  }, [query, doSearch]);

  const trackClick = useCallback((pageId: string) => {
    if (searchId) {
      logSearchClick(searchId, pageId).catch(() => {});
    }
  }, [searchId]);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(suggestTimerRef.current);
    };
  }, []);

  return {
    query,
    setQuery: updateQuery,
    filters,
    setFilters: updateFilters,
    clearFilters,
    results,
    loading,
    selectedIndex,
    setSelectedIndex,
    searchMode,
    expandedQuery,
    timing,
    didYouMean,
    suggestions,
    trackClick,
  };
}
