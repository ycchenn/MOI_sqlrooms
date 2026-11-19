import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import { modeKey, useT } from '@/i18n';
import { SEARCH_RESULT_LIMIT } from '@/lib/search';
import type { AgentSearchResult } from '@/hooks/useAgentSearch';

// 代理人模糊搜尋框：可以用背景（學歷、職業…）找人看他「現在」在做什麼，
// 也可以用活動（上班、購物…）找「現在」正在做這件事的人。點一筆結果 = 選取那個人
// （跟在地圖上點他一樣）；勾「只在地圖顯示搜尋結果」時，地圖只留下搜尋到的人。
export const AgentSearch = ({ search }: { search: AgentSearchResult }) => {
  const { query, mapOnly, setQuery, setMapOnly, selectAgent } = useMapStore(
    useShallow((s) => ({
      query: s.searchQuery,
      mapOnly: s.searchMapOnly,
      setQuery: s.setSearchQuery,
      setMapOnly: s.setSearchMapOnly,
      selectAgent: s.setSelectedAgentId,
    })),
  );
  const t = useT();
  const hasQuery = query.trim().length > 0;

  return (
    <div className="bg-dash-panel/90 border border-dash-border p-3 rounded-lg font-mono flex flex-col gap-2 shadow-xl">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="w-full rounded-md border border-dash-border bg-dash-surface/60 px-3 py-2 pr-8 text-xs text-dash-text placeholder:text-dash-text-faint outline-none focus:border-dash-accent"
        />
        {hasQuery && (
          <button
            onClick={() => setQuery('')}
            aria-label={t('search.clear')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-dash-text-faint hover:text-dash-text text-sm leading-none"
          >
            ×
          </button>
        )}
      </div>

      {hasQuery && (
        <>
          <div className="flex items-center justify-between text-[11px] text-dash-text-muted">
            <span>
              {search.total > 0 ? t('search.count', { count: search.total.toLocaleString() }) : t('search.noResults')}
              {search.total > SEARCH_RESULT_LIMIT && ` · ${t('search.showingTop', { limit: SEARCH_RESULT_LIMIT })}`}
            </span>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-dash-text-soft cursor-pointer">
            <input
              type="checkbox"
              checked={mapOnly}
              onChange={(e) => setMapOnly(e.target.checked)}
              className="accent-dash-accent w-3.5 h-3.5"
            />
            {t('search.mapOnly')}
          </label>

          {search.results.length > 0 && (
            <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto scrollbar-subtle">
              {search.results.map((r) => {
                const background = [r.occupation, r.education, r.age && t('search.age', { age: r.age })]
                  .filter(Boolean)
                  .join(' · ');
                const modeLabel = r.modeBit != null ? t(modeKey(r.modeBit) ?? 'mode.unknown') : null;
                // 有行程：活動 @ 地點（正在用的運具）；行程之間的空檔在移動：移動中（運具）
                const doing = r.current
                  ? [r.current.Activity, r.current.place && `@ ${r.current.place}`].filter(Boolean).join(' ') +
                    (modeLabel ? t('search.modeWrap', { mode: modeLabel }) : '')
                  : modeLabel
                    ? t('search.moving', { mode: modeLabel })
                    : t('search.noActivity');
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => selectAgent(r.id)}
                      className="w-full text-left rounded-md px-2 py-1.5 bg-dash-surface/40 hover:bg-dash-track/50 transition-colors"
                    >
                      <div className="text-xs text-dash-text truncate">
                        <span className="text-dash-text-strong font-bold">#{r.id}</span>
                        {background && <span className="text-dash-text-muted"> · {background}</span>}
                      </div>
                      <div className="text-[11px] text-dash-text-soft truncate">
                        {t('search.nowLine', { doing })}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
