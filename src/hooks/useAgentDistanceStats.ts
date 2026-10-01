import { useMemo, useRef } from 'react';
import * as arrow from 'apache-arrow';

// 跟 usePointsLayer.ts 算時速用的粗略平面換算不同，這裡要給使用者看的統計數字，
// 用真正的 haversine 公式算球面距離，單位公里。
const haversineKm = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export type AgentDistanceStats = {
  agentCount: number;
  avgDistanceKm: number;
};

// 跟 usePointsLayer 一樣的快取模式：只在 arrowTable 換掉時才重新掃一次全部 agent，
// 不是每次重新渲染（例如播放動畫時）都重算一次 2000 個 agent 的完整路徑長度。
export const useAgentDistanceStats = (arrowTable: arrow.Table | undefined): AgentDistanceStats => {
  const cacheRef = useRef<{ source: arrow.Table } & AgentDistanceStats | null>(null);

  return useMemo(() => {
    if (!arrowTable) return { agentCount: 0, avgDistanceKm: 0 };
    if (cacheRef.current?.source === arrowTable) {
      const { agentCount, avgDistanceKm } = cacheRef.current;
      return { agentCount, avgDistanceKm };
    }

    const rows = arrowTable.toArray();
    let totalDistanceKm = 0;
    let countedAgents = 0;

    for (const row of rows as any[]) {
      const rawPaths = row.paths?.toJSON ? row.paths.toJSON() : Array.from(row.paths ?? []);
      const isFlat = rawPaths.length > 0 && typeof rawPaths[0] === 'number';
      const pathFlat: number[] = isFlat
        ? (rawPaths as number[])
        : (rawPaths as any[]).flatMap((pt: any) => [Number(pt[0]), Number(pt[1])]);

      const numPoints = pathFlat.length / 2;
      if (numPoints < 2) continue;

      let dist = 0;
      for (let i = 0; i < numPoints - 1; i++) {
        dist += haversineKm(
          pathFlat[i * 2], pathFlat[i * 2 + 1],
          pathFlat[(i + 1) * 2], pathFlat[(i + 1) * 2 + 1],
        );
      }
      totalDistanceKm += dist;
      countedAgents += 1;
    }

    const result: AgentDistanceStats = {
      agentCount: rows.length,
      avgDistanceKm: countedAgents > 0 ? totalDistanceKm / countedAgents : 0,
    };
    cacheRef.current = { source: arrowTable, ...result };
    return result;
  }, [arrowTable]);
};
