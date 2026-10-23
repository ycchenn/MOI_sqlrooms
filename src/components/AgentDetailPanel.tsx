import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import type { ProfilesData } from '@/hooks/useProfiles';
import { locationKey, useT } from '@/i18n';

type AgentDetailPanelProps = {
  agentId: number;
  profiles: ProfilesData | null;
};

// "HH:MM" → 當天秒數。schedule 的時間是一天制（00:00–24:00），跟模擬可能跨日的
// 全域 time（見 setSelectedAgentId 旁註）不是同一個軸，比對前要對齊成「當天時刻」。
const parseHHMM = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
};

const DAY_SECONDS = 86400;


export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({ agentId, profiles }) => {
  const { time, setSelectedAgentId } = useMapStore(
    useShallow((s) => ({ time: s.time, setSelectedAgentId: s.setSelectedAgentId }))
  );

  const t = useT();
  const entry = profiles?.[String(agentId)];

  const activities = useMemo(() => {
    if (!entry) return [];
    return entry.activities.map((act) => ({
      ...act,
      startSec: parseHHMM(act.start_time),
      endSec: parseHHMM(act.end_time),
    }));
  }, [entry]);

  // 跟 timebar 連動的核心：全域 time 可能 > 86400（情境模擬可以跑到 72 小時），
  // schedule 只有「一天」的資料，mod 86400 對齊回當天時刻，才能找出「現在這個人在幹嘛」。
  const todaySec = time % DAY_SECONDS;
  const currentIndex = useMemo(
    () => activities.findIndex((a) => todaySec >= a.startSec && todaySec < a.endSec),
    [activities, todaySec],
  );

  const currentItemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  if (!profiles) {
    return (
      <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong font-mono shadow-xl">
        <div className="text-xs text-dash-text-faint">{t('agent.loading')}</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong font-mono shadow-xl flex flex-col gap-2">
        <div className="text-xs text-dash-text-muted">{t('agent.notFound', { id: agentId })}</div>
        <button className="text-xs text-dash-accent-bright hover:underline text-left" onClick={() => setSelectedAgentId(null)}>
          {t('common.backToOverview')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong flex flex-col gap-4 font-mono shadow-xl max-h-[calc(100vh-40px)] overflow-y-auto scrollbar-subtle">
      <div className="flex items-center justify-between border-b border-dash-border pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-dash-text-muted">{t('agent.title', { id: agentId })}</span>
        <button className="text-xs text-dash-accent-bright hover:underline" onClick={() => setSelectedAgentId(null)}>
          {t('common.backToOverview')}
        </button>
      </div>

      {/* Schedule 逐筆列表，跟著主時間軸的 time 同步反白目前這一筆。Profile 移到地圖上的資訊框（MapView tooltip）。 */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-dash-text-muted uppercase tracking-wide">{t('agent.schedule')}</div>
        <div className="flex flex-col gap-1">
          {activities.map((act, i) => {
            const isCurrent = i === currentIndex;
            return (
              <div
                key={i}
                ref={isCurrent ? currentItemRef : undefined}
                className={`text-xs p-2 rounded-md border transition-colors ${
                  isCurrent ? 'bg-dash-accent/20 border-dash-accent' : 'bg-dash-surface/40 border-transparent'
                }`}
              >
                <div className="flex justify-between text-[10px] text-dash-text-muted">
                  <span>{act.start_time} - {act.end_time}</span>
                  <span>{locationKey(act.location_type) ? t(locationKey(act.location_type)!) : act.location_type}</span>
                </div>
                <div className={isCurrent ? 'text-dash-accent-soft' : 'text-dash-text'}>{act.Activity}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
