import { useMemo } from 'react';
import type * as arrow from 'apache-arrow';

import { useAgentDistanceStats } from '@/hooks/useAgentDistanceStats';
import type { ProfilesData } from '@/hooks/useProfiles';
import { locationKey, useT } from '@/i18n';

// profiles.json 的 activities[].location_type 實測只有這三種值（Home/Work/Others），
// 沒有土地使用分區那種細分類——這裡就是「Agent's Destination」能做到的上限，見討論紀錄。
// 顯示名稱在 i18n 的 location.* 裡。

type AgentOverviewPanelProps = {
  arrowTable: arrow.Table | undefined;
  profiles: ProfilesData | null;
  profilesLoading: boolean;
};

// profiles 從 MainView 統一抓一次、往下傳——這份 JSON 約 13MB，微觀視圖（AgentDetailPanel）
// 也要用到同一份資料，不要兩邊各自呼叫 useProfiles() 重複 fetch。
export const AgentOverviewPanel: React.FC<AgentOverviewPanelProps> = ({ arrowTable, profiles, profilesLoading }) => {
  const { agentCount, avgDistanceKm } = useAgentDistanceStats(arrowTable);
  const t = useT();

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
    <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong flex flex-col gap-4 font-mono shadow-xl">
      <span className="text-xs font-bold uppercase tracking-wider text-dash-text-muted border-b border-dash-border pb-2">
        {t('overview.title')}
      </span>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dash-surface/60 rounded-md p-3">
          <div className="text-[10px] text-dash-text-muted uppercase tracking-wide">{t('overview.agentCount')}</div>
          <div className="text-xl font-bold text-dash-accent-bright">{agentCount.toLocaleString()}</div>
        </div>
        <div className="bg-dash-surface/60 rounded-md p-3">
          <div className="text-[10px] text-dash-text-muted uppercase tracking-wide">{t('overview.avgDistance')}</div>
          <div className="text-xl font-bold text-dash-accent-bright">
            {avgDistanceKm.toFixed(1)} <span className="text-xs font-normal text-dash-text-muted">{t('unit.km')}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-dash-text-muted uppercase tracking-wide">{t('overview.destination')}</div>
        {profilesLoading || !destinationCounts ? (
          <div className="text-xs text-dash-text-faint">{t('common.loading')}</div>
        ) : (
          Object.entries(destinationCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => {
              const pct = destinationTotal > 0 ? (count / destinationTotal) * 100 : 0;
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-dash-text-soft">
                    <span>{locationKey(key) ? t(locationKey(key)!) : key}</span>
                    <span className="text-dash-text-muted">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-dash-track rounded-full overflow-hidden">
                    <div className="h-full bg-dash-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
        )}
        <div className="text-[9px] text-dash-text-faint mt-1 leading-tight">
          {t('overview.destinationNote')}
        </div>
      </div>
    </div>
  );
};
