import { Field, FixedSizeList, Float32, Int32, Table, Uint8, makeData, makeVector } from 'apache-arrow';
import type * as arrow from 'apache-arrow';

import type { AgentCache } from './agentCache';
import { getAgentCache, getAgentStateAt } from './agentCache';
import { parseHHMM } from './schedule';
import type { ProfilesData } from '@/hooks/useProfiles';

// 從 profiles.json 的行程推算 OD（起迄）：每個代理人相鄰的兩個活動 = 一趟移動。
//   起點 = 前一個活動的地點、終點 = 下一個活動的地點、
//   時間 = 前一個活動的結束時間（出發時刻，給時間軸篩選用）、
//   運具 = 這段移動期間軌跡上正在用的運具（跟甜甜圈圖/地圖小點同一套判斷）。
// 起迄同一點（例如 住家→住家）的弧線長度是 0，不畫。
//
// 產出的表格式就是 ArrowODArcLayer 要的：一列一條弧線，
//   paths:      FixedSizeList<4, Float32>  [起點經度, 起點緯度, 終點經度, 終點緯度]
//   timestamps: Float32  出發時刻（當天秒數）
//   modes:      Uint8    運具 bit（1/2/4/8/16）
//   agent_id:   Int32    之後要做 hover/點選時用

export type ODBuildStats = { trips: number; skippedSamePlace: number; skippedNoMode: number };

const isValidCoord = (lon: number, lat: number) =>
  Number.isFinite(lon) && Number.isFinite(lat) && !(lon === 0 && lat === 0);

// 行程時間跟軌跡不一定剛好對齊，依序試「移動期間的中點 → 出發後 → 抵達前」，
// 第一個落在軌跡範圍內的時間點就用它的運具。
const modeDuring = (agent: AgentCache | undefined, departSec: number, arriveSec: number): number | null => {
  if (!agent) return null;
  const candidates = arriveSec > departSec
    ? [(departSec + arriveSec) / 2, departSec + 1, arriveSec - 1]
    : [departSec];
  for (const t of candidates) {
    const state = getAgentStateAt(agent, t);
    if (state) return state.mode;
  }
  return null;
};

export const buildODTable = (
  profiles: ProfilesData,
  trajectories: arrow.Table,
): { table: Table; stats: ODBuildStats } => {
  const agentsById = new Map<number, AgentCache>();
  for (const agent of getAgentCache(trajectories)) {
    if (agent.id != null) agentsById.set(agent.id, agent);
  }

  const coords: number[] = [];
  const times: number[] = [];
  const modes: number[] = [];
  const agentIds: number[] = [];
  const stats: ODBuildStats = { trips: 0, skippedSamePlace: 0, skippedNoMode: 0 };

  for (const entry of Object.values(profiles)) {
    const acts = entry.activities ?? [];
    const agent = agentsById.get(Number(entry.id));
    for (let i = 0; i < acts.length - 1; i++) {
      const from = acts[i];
      const to = acts[i + 1];
      if (!isValidCoord(from.lon, from.lat) || !isValidCoord(to.lon, to.lat)) continue;
      if (from.lon === to.lon && from.lat === to.lat) {
        stats.skippedSamePlace++;
        continue;
      }

      const departSec = parseHHMM(from.end_time);
      const mode = modeDuring(agent, departSec, parseHHMM(to.start_time));
      if (mode == null) {
        stats.skippedNoMode++;
        continue;
      }

      coords.push(from.lon, from.lat, to.lon, to.lat);
      times.push(departSec);
      modes.push(mode);
      agentIds.push(Number(entry.id));
      stats.trips++;
    }
  }

  // 直接組成單一 chunk 的 Arrow Data：ArrowODArcLayer 讀的是每個 batch 的 data[0] 底層 buffer
  const n = times.length;
  const pathsType = new FixedSizeList(4, new Field('coord', new Float32(), false));
  const paths = makeVector(
    makeData({
      type: pathsType,
      length: n,
      nullCount: 0,
      child: makeData({ type: new Float32(), length: n * 4, nullCount: 0, data: new Float32Array(coords) }),
    }),
  );
  const table = new Table({
    paths,
    timestamps: makeVector(makeData({ type: new Float32(), length: n, nullCount: 0, data: new Float32Array(times) })),
    modes: makeVector(makeData({ type: new Uint8(), length: n, nullCount: 0, data: new Uint8Array(modes) })),
    agent_id: makeVector(makeData({ type: new Int32(), length: n, nullCount: 0, data: new Int32Array(agentIds) })),
  });

  return { table, stats };
};
