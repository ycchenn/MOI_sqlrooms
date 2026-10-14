import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import type { ProfilesData } from '@/hooks/useProfiles';

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

// 跟 AgentOverviewPanel 的 DESTINATION_LABELS 同一組分類，顏色拿來畫下面的迷你時間軸。
const LOCATION_TYPE_COLOR: Record<string, string> = {
  Home: 'bg-sky-500',
  Work: 'bg-amber-500',
  Others: 'bg-violet-500',
};
const LOCATION_TYPE_LABEL: Record<string, string> = {
  Home: '住家',
  Work: '工作',
  Others: '其他',
};

export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({ agentId, profiles }) => {
  const { time, setSelectedAgentId } = useMapStore(
    useShallow((s) => ({ time: s.time, setSelectedAgentId: s.setSelectedAgentId }))
  );

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
      <div className="bg-[#2B2B38]/90 border border-slate-700 p-4 rounded-lg text-white font-mono shadow-xl">
        <div className="text-xs text-slate-500">載入 agent 資料中...</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="bg-[#2B2B38]/90 border border-slate-700 p-4 rounded-lg text-white font-mono shadow-xl flex flex-col gap-2">
        <div className="text-xs text-slate-400">找不到 agent #{agentId} 的資料</div>
        <button className="text-xs text-cyan-400 hover:underline text-left" onClick={() => setSelectedAgentId(null)}>
          ← 回到總覽
        </button>
      </div>
    );
  }

  const { profile } = entry;

  return (
    <div className="bg-[#2B2B38]/90 border border-slate-700 p-4 rounded-lg text-white flex flex-col gap-4 font-mono shadow-xl max-h-[calc(100vh-40px)] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent #{agentId}</span>
        <button className="text-xs text-cyan-400 hover:underline" onClick={() => setSelectedAgentId(null)}>
          ← 回到總覽
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-slate-400 uppercase tracking-wide">Profile</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div><span className="text-slate-500">年齡</span> {profile.age}</div>
          <div><span className="text-slate-500">教育</span> {profile.education}</div>
          <div className="col-span-2"><span className="text-slate-500">職業</span> {profile.occupation}</div>
          <div className="col-span-2"><span className="text-slate-500">收入</span> {profile.income}</div>
        </div>
        {profile.mobility?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {profile.mobility.map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-cyan-300">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 迷你時間軸（Timebar）：一天 24 小時的橫條，依 location_type 上色，
          白色直線標出目前模擬時間落在哪一段——跟下面逐筆 schedule 列表是同一份資料的兩種呈現。 */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-slate-400 uppercase tracking-wide">Daily Timebar</div>
        <div className="relative h-4 rounded-sm overflow-hidden bg-slate-800">
          {activities.map((act, i) => (
            <div
              key={i}
              className={`absolute top-0 h-full ${LOCATION_TYPE_COLOR[act.location_type] ?? 'bg-slate-600'} ${
                i === currentIndex ? 'opacity-100' : 'opacity-50'
              }`}
              style={{
                left: `${(act.startSec / DAY_SECONDS) * 100}%`,
                width: `${((act.endSec - act.startSec) / DAY_SECONDS) * 100}%`,
              }}
            />
          ))}
          <div
            className="absolute top-0 h-full w-[2px] bg-white"
            style={{ left: `${(todaySec / DAY_SECONDS) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>00:00</span>
          <span>12:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Schedule 逐筆列表，跟著上面時間軸、也跟著主時間軸的 time 同步反白目前這一筆 */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-slate-400 uppercase tracking-wide">Schedule</div>
        <div className="flex flex-col gap-1">
          {activities.map((act, i) => {
            const isCurrent = i === currentIndex;
            return (
              <div
                key={i}
                ref={isCurrent ? currentItemRef : undefined}
                className={`text-xs p-2 rounded-md border transition-colors ${
                  isCurrent ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800/40 border-transparent'
                }`}
              >
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{act.start_time} - {act.end_time}</span>
                  <span>{LOCATION_TYPE_LABEL[act.location_type] ?? act.location_type}</span>
                </div>
                <div className={isCurrent ? 'text-cyan-300' : 'text-slate-200'}>{act.Activity}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
