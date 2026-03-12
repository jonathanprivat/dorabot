import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, FileCode, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchMode = 'messages' | 'files';

type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
  rpc: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  viewRoot: string;
  onOpenFile: (filePath: string) => void;
  onOpenSession: (sessionId: string, channel: string | null, chatId: string | null) => void;
};

// Message search types
type MemoryResult = {
  id: number;
  sessionId: string;
  type: string;
  timestamp: string;
  channel: string | null;
  chatId: string | null;
  senderName: string | null;
  sessionCreatedAt: string | null;
  preview: string;
  rank: number;
};

// File search types
type SearchMatch = { path: string; line: number; text: string };
type GroupedResult = { path: string; relPath: string; matches: { line: number; text: string }[] };

// Unified flat item for keyboard navigation
type FlatItem =
  | { kind: 'message'; result: MemoryResult; index: number }
  | { kind: 'file'; path: string; line: number; text: string; index: number };

export function GlobalSearch({ open, onClose, rpc, viewRoot, onOpenFile, onOpenSession }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('messages');
  const [memoryResults, setMemoryResults] = useState<MemoryResult[]>([]);
  const [fileResults, setFileResults] = useState<GroupedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultsRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo((): FlatItem[] => {
    if (mode === 'messages') {
      return memoryResults.map((r, i) => ({ kind: 'message' as const, result: r, index: i }));
    }
    const items: FlatItem[] = [];
    fileResults.forEach(group => {
      group.matches.forEach(m => {
        items.push({ kind: 'file' as const, path: group.path, line: m.line, text: m.text, index: items.length });
      });
    });
    return items;
  }, [mode, memoryResults, fileResults]);

  const doSearch = useCallback(async (q: string, searchMode: SearchMode) => {
    if (!q.trim()) {
      setMemoryResults([]);
      setFileResults([]);
      return;
    }
    setLoading(true);
    try {
      if (searchMode === 'messages') {
        const res = await rpc('search.memory', { query: q.trim(), limit: 30 }) as { results: MemoryResult[] };
        setMemoryResults(res.results || []);
      } else {
        if (!viewRoot) {
          setFileResults([]);
          return;
        }
        const res = await rpc('search.ripgrep', { path: viewRoot, query: q.trim() }) as { results: SearchMatch[] };
        const map = new Map<string, GroupedResult>();
        for (const m of (res.results || [])) {
          let group = map.get(m.path);
          if (!group) {
            const rel = m.path.startsWith(viewRoot) ? m.path.slice(viewRoot.length + 1) : m.path;
            group = { path: m.path, relPath: rel, matches: [] };
            map.set(m.path, group);
          }
          group.matches.push({ line: m.line, text: m.text });
        }
        setFileResults(Array.from(map.values()));
      }
      setSelected(0);
    } catch {
      setMemoryResults([]);
      setFileResults([]);
    } finally {
      setLoading(false);
    }
  }, [rpc, viewRoot]);

  // Re-search when query or mode changes
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(query, mode), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, open, doSearch]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setMemoryResults([]);
      setFileResults([]);
      setSelected(0);
      setMode('messages');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-idx="${selected}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const activateItem = useCallback((item?: FlatItem) => {
    if (!item) return;
    if (item.kind === 'message') {
      onOpenSession(item.result.sessionId, item.result.channel, item.result.chatId);
      onClose();
    } else {
      onOpenFile(item.path);
      onClose();
    }
  }, [onOpenFile, onOpenSession, onClose]);

  if (!open) return null;

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (diffDays === 0) return `Today ${time}`;
      if (diffDays === 1) return `Yesterday ${time}`;
      if (diffDays < 7) return `${diffDays}d ago ${time}`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`;
    } catch { return ts.slice(0, 16); }
  };

  const typeLabel = (type: string) => {
    if (type === 'user') return 'You';
    if (type === 'assistant') return 'Agent';
    if (type === 'result') return 'Result';
    return type;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/35 backdrop-blur-[1px] flex items-start justify-center pt-20 px-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-popover shadow-2xl overflow-hidden flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="border-b border-border px-3 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault();
                setMode(m => m === 'messages' ? 'files' : 'messages');
                return;
              }
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(v => Math.min(v + 1, flatItems.length - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)); return; }
              if (e.key === 'Enter') { e.preventDefault(); activateItem(flatItems[selected]); return; }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
            }}
            placeholder={mode === 'messages' ? 'Search conversations...' : 'Search in files...'}
            className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
            autoFocus
          />
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-border px-3 gap-1">
          <button
            className={cn(
              'px-2.5 py-1.5 text-[11px] font-medium transition-colors flex items-center gap-1.5 border-b-2 -mb-px',
              mode === 'messages'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('messages')}
          >
            <MessageSquare className="w-3 h-3" />
            Messages
          </button>
          <button
            className={cn(
              'px-2.5 py-1.5 text-[11px] font-medium transition-colors flex items-center gap-1.5 border-b-2 -mb-px',
              mode === 'files'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('files')}
          >
            <FileCode className="w-3 h-3" />
            Files
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground/40 self-center">Tab to switch</span>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[420px] overflow-y-auto">
          {loading && <div className="px-3 py-4 text-[11px] text-muted-foreground">Searching...</div>}
          {!loading && query.trim() && flatItems.length === 0 && (
            <div className="px-3 py-4 text-[11px] text-muted-foreground">No results</div>
          )}

          {/* Message results */}
          {!loading && mode === 'messages' && memoryResults.map((r, i) => (
            <button
              key={`${r.sessionId}:${r.id}`}
              data-idx={i}
              className={cn(
                'w-full text-left px-3 py-2 transition-colors border-b border-border/50 last:border-0',
                i === selected ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/50',
              )}
              onMouseEnter={() => setSelected(i)}
              onClick={() => activateItem(flatItems[i])}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  r.type === 'user' ? 'bg-blue-500/10 text-blue-400' :
                  r.type === 'assistant' ? 'bg-purple-500/10 text-purple-400' :
                  'bg-muted text-muted-foreground',
                )}>
                  {typeLabel(r.type)}
                </span>
                {r.channel && (
                  <span className="text-[10px] text-muted-foreground/60">{r.channel}</span>
                )}
                <span className="text-[10px] text-muted-foreground/40 ml-auto">{formatTimestamp(r.timestamp)}</span>
              </div>
              <p className="text-[12px] leading-relaxed line-clamp-2 text-foreground/80">{r.preview}</p>
            </button>
          ))}

          {/* File results */}
          {!loading && mode === 'files' && (() => {
            let flatIdx = 0;
            return fileResults.map(group => (
              <div key={group.path}>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/30 sticky top-0 flex items-center gap-1.5">
                  <FileCode className="w-3 h-3 shrink-0" />
                  <span className="truncate">{group.relPath}</span>
                  <span className="ml-auto text-muted-foreground/50">{group.matches.length}</span>
                </div>
                {group.matches.map(m => {
                  const idx = flatIdx++;
                  return (
                    <button
                      key={`${group.path}:${m.line}:${idx}`}
                      data-idx={idx}
                      className={cn(
                        'w-full text-left px-3 py-1 transition-colors flex items-baseline gap-2',
                        idx === selected ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/50',
                      )}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={() => activateItem(flatItems[idx])}
                    >
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0 w-8 text-right">{m.line}</span>
                      <span className="text-[12px] truncate">{m.text}</span>
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>,
    document.body,
  );
}
