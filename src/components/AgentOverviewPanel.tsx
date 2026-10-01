import { useMemo } from 'react';
import type * as arrow from 'apache-arrow';

import { useAgentDistanceStats } from '@/hooks/useAgentDistanceStats';
import { useProfiles } from '@/hooks/useProfiles';

// profiles.json 的 activities[].location_type 實測只有這三種值（Home/Work/Others），
// 沒有土地使用分區那種細分類——這裡就是「Agent's Destination」能做到的上限，見討論紀錄。
const DESTINATION_LABELS: Record<string, string> = {
  Home: '住家',
  Work: '工作',
  Others: '其他',
};

export const AgentOverviewPanel: React.FC<{ arrowTable: arrow.Table | undefined }> = ({ arrowTable }) => {
  const { agentCount, avgDistanceKm } = useAgentDistanceStats(arrowTable);
  const { profiles, isLoading: profilesLoading } = useProfiles();

  const destinationCounts = useMemo(() => {
    if (!profiles) return null;
    const counts: Record<string, number> = {};
    for (const agent of Object.values(profiles)) {
      for (const act of agent.activities ?? []) {
        const key = act.location_type || 'Others';
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [profiles]);

  const destinationTotal = destinationCounts
    ? Object.values(destinationCounts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="bg-[#2B2B38]/90 border border-slate-700 p-4 rounded-lg text-white flex flex-col gap-4 font-mono shadow-xl">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-2">
        City Overview
      </span>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 rounded-md p-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">Number of Agent</div>
          <div className="text-xl font-bold text-cyan-400">{agentCount.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/60 rounded-md p-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">Average Distance</div>
          <div className="text-xl font-bold text-cyan-400">
            {avgDistanceKm.toFixed(1)} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-slate-400 uppercase tracking-wide">Agent's Destination</div>
        {profilesLoading || !destinationCounts ? (
          <div className="text-xs text-slate-500">載入中...</div>
        ) : (
          Object.entries(destinationCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => {
              const pct = destinationTotal > 0 ? (count / destinationTotal) * 100 : 0;
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{DESTINATION_LABELS[key] ?? key}</span>
                    <span className="text-slate-400">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
        )}
        <div className="text-[9px] text-slate-500 mt-1 leading-tight">
          * 依資料實際欄位分類（住家／工作／其他），非土地使用分區
        </div>
      </div>
    </div>
  );
};
