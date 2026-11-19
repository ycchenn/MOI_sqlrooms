import { useMemo } from 'react';
import type * as arrow from 'apache-arrow';

import { useMapStore } from '@/zustand/useMapStore';
import { buildSearchDocs, createAgentSearch, SEARCH_RESULT_LIMIT, type SearchDoc } from '@/lib/search';
import type { ProfilesData } from '@/hooks/useProfiles';

export type AgentSearchResult = {
  results: SearchDoc[];          // 最相關的前 SEARCH_RESULT_LIMIT 筆，給列表顯示
  total: number;                 // 全部符合的人數
  matchedIds: Set<number> | null; // 全部符合的代理人；沒輸入搜尋字時是 null（= 不篩選）
};

const EMPTY: AgentSearchResult = { results: [], total: 0, matchedIds: null };

// 搜尋「當下」的狀態會隨播放時間改變，但不用每幀重建索引：以「分鐘」為單位，
// 時間跨到下一分鐘才重算（selector 只回傳分鐘數，同一分鐘內這個 hook 不會重新 render）。
export const useAgentSearch = (profiles: ProfilesData | null, arrowTable: arrow.Table | undefined): AgentSearchResult => {
  const query = useMapStore((s) => s.searchQuery).trim();
  const minute = useMapStore((s) => Math.floor(s.time / 60));

  const fuse = useMemo(() => {
    if (!query || !profiles || !arrowTable) return null;
    return createAgentSearch(buildSearchDocs(profiles, arrowTable, minute * 60));
  }, [query.length > 0, profiles, arrowTable, minute]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    if (!fuse || !query) return EMPTY;
    const hits = fuse.search(query);
    return {
      results: hits.slice(0, SEARCH_RESULT_LIMIT).map((h) => h.item),
      total: hits.length,
      matchedIds: new Set(hits.map((h) => h.item.id)),
    };
  }, [fuse, query]);
};
