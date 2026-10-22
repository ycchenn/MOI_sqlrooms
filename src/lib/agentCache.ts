import type * as arrow from 'apache-arrow';

// 每個 agent 的軌跡快取：arrowTable 轉成 JS 陣列只做一次，地圖小點（usePointsLayer）
// 跟運具甜甜圈圖（useModeShares）共用同一份，算出來的「某時間點用什麼運具」才會一致。
export type AgentCache = {
  id: number | undefined;
  pathFlat: number[];   // 正規化後永遠是 flat: [x0,y0,x1,y1,...]
  timestamps: number[];
  modes: number[];      // 可以是 per-segment 或 per-trip 單一值
};

const cache = new WeakMap<arrow.Table, AgentCache[]>();

export const getAgentCache = (arrowTable: arrow.Table): AgentCache[] => {
  const cached = cache.get(arrowTable);
  if (cached) return cached;

  const agents = arrowTable.toArray().map((row: any): AgentCache => {
    // paths: List<FixedSizeList<2,Float32>> → toJSON() 回傳 [[x0,y0],...] 或已是 flat
    const rawPaths = row.paths?.toJSON ? row.paths.toJSON() : Array.from(row.paths ?? []);
    const isFlat = rawPaths.length > 0 && typeof rawPaths[0] === 'number';
    const pathFlat: number[] = isFlat
      ? Array.from(rawPaths as number[])
      : (rawPaths as any[]).flatMap((pt: any) => [Number(pt[0]), Number(pt[1])]);

    const rawTs = row.timestamps?.toJSON ? row.timestamps.toJSON() : Array.from(row.timestamps ?? []);
    const rawModes = row.modes?.toJSON ? row.modes.toJSON() : Array.from(row.modes ?? []);

    return {
      id: row.id != null ? Number(row.id) : undefined,
      pathFlat,
      timestamps: (rawTs as any[]).map(Number),
      modes: (rawModes as any[]).map(Number),
    };
  });

  cache.set(arrowTable, agents);
  return agents;
};

// timestamps 對每個 agent 是遞增排序，二分搜尋找出 time 落在哪個 segment：
// 回傳 j 使得 timestamps[j] <= time <= timestamps[j+1]。
// 取代原本「每幀都從 0 開始線性掃描」的作法，時間複雜度從 O(numPoints) 降到 O(log numPoints)，
// 且不受時間倒退（拖曳/循環重播）影響，不需要跨幀快取 index。
export const findSegmentIndex = (timestamps: number[], time: number): number => {
  let lo = 0;
  let hi = timestamps.length - 2;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timestamps[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

// agent 在 time 這一刻落在哪個 segment、用什麼運具；不在自己的時間範圍內（還沒出發/已結束）回傳 null。
export const getAgentStateAt = (agent: AgentCache, time: number): { segment: number; mode: number } | null => {
  const { pathFlat, timestamps, modes } = agent;
  const numPoints = timestamps.length;
  if (!pathFlat.length || numPoints < 2) return null;
  if (time < timestamps[0] || time > timestamps[numPoints - 1]) return null;

  const segment = findSegmentIndex(timestamps, time);
  // modes 可能是 per-segment（長度 = numPoints-1）或 per-trip（長度 1）
  const mode = modes.length > 1 ? modes[segment] : (modes[0] ?? 1);
  return { segment, mode };
};
