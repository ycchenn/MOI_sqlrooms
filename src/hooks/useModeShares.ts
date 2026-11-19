import { useMemo } from 'react';
import type * as arrow from 'apache-arrow';

import { useMapStore } from '@/zustand/useMapStore';
import { getAgentCache, getAgentStateAt } from '@/lib/agentCache';

// 目前播放時間（time）這一刻，各運具「正在使用中」的 agent 數，給 ModeSelector 的甜甜圈圖用。
// 統計的是全部運具（包含沒勾選的），這樣取消勾選某個運具時它的那一塊還在，只是變暗，
// 使用者才知道它還能點回來。用跟 usePointsLayer 同一份 agent 快取與同一套 segment 判斷，
// 數字才會跟地圖上看到的小點一致。
// visibleIds：人口甜甜圈篩選後留下的代理人（null = 沒篩選），只算這些人，兩張甜甜圈互相連動。
export const useModeShares = (arrowTable: arrow.Table, visibleIds: Set<number> | null = null) => {
  const time = useMapStore((s) => s.time);

  return useMemo(() => {
    const counts: Record<number, number> = {};
    let total = 0;
    for (const agent of getAgentCache(arrowTable)) {
      if (visibleIds && (agent.id == null || !visibleIds.has(agent.id))) continue;
      const state = getAgentStateAt(agent, time);
      if (!state) continue;
      counts[state.mode] = (counts[state.mode] ?? 0) + 1;
      total += 1;
    }
    return { counts, total };
  }, [arrowTable, time, visibleIds]);
};
