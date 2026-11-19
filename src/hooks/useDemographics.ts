import { useMemo } from 'react';
import type * as arrow from 'apache-arrow';
import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import { getAgentCache, getAgentStateAt } from '@/lib/agentCache';
import { buildDemographicIndex, type DemographicIndex } from '@/lib/demographics';
import type { ProfilesData } from '@/hooks/useProfiles';

// 目前選的分類方式（學歷/收入/…）下，每個代理人屬於哪個群組
export const useDemographicIndex = (profiles: ProfilesData | null): DemographicIndex | null => {
  const dim = useMapStore((s) => s.demoDimension);
  return useMemo(() => (profiles ? buildDemographicIndex(profiles, dim) : null), [profiles, dim]);
};

// 人口篩選後要留在地圖上的代理人 id；沒有隱藏任何群組時回傳 null（= 不篩選）
export const useVisibleAgentIds = (
  arrowTable: arrow.Table | undefined,
  index: DemographicIndex | null,
): Set<number> | null => {
  const hidden = useMapStore(useShallow((s) => s.hiddenDemoGroups));
  return useMemo(() => {
    if (!arrowTable || !index || hidden.length === 0) return null;
    const hiddenSet = new Set(hidden);
    const ids = new Set<number>();
    for (const agent of getAgentCache(arrowTable)) {
      if (agent.id != null && !hiddenSet.has(index.groupOf(agent.id))) ids.add(agent.id);
    }
    return ids;
  }, [arrowTable, index, hidden]);
};

// 人口甜甜圈的每塊大小：目前播放時間「正在移動」、且運具有被選取的代理人，依群組計數。
// 跟運具甜甜圈互相連動（各自只受「另一個」甜甜圈的篩選影響），兩張圖與地圖是同一群人。
export const useDemographicShares = (arrowTable: arrow.Table, index: DemographicIndex | null) => {
  const { time, selectedModes } = useMapStore(
    useShallow((s) => ({ time: s.time, selectedModes: s.selectedModes })),
  );

  return useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    if (!index) return { counts, total };
    for (const agent of getAgentCache(arrowTable)) {
      if (agent.id == null) continue;
      const state = getAgentStateAt(agent, time);
      if (!state || !selectedModes.includes(state.mode)) continue;
      const group = index.groupOf(agent.id);
      counts[group] = (counts[group] ?? 0) + 1;
      total += 1;
    }
    return { counts, total };
  }, [arrowTable, index, time, selectedModes]);
};
