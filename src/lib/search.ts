import Fuse from 'fuse.js';
import type * as arrow from 'apache-arrow';

import { getAgentCache, getAgentStateAt } from './agentCache';
import { DAY_SECONDS, parseHHMM } from './schedule';
import { translate, modeKey, locationKey } from '@/i18n';
import type { AgentActivity, ProfilesData } from '@/hooks/useProfiles';

// 代理人模糊搜尋（fuzzy search）：一個搜尋框同時能用「背景」找人、也能用「當下在做什麼」找人。
// 每個代理人組成一筆文件：背景欄位（學歷/職業/收入/年齡/可用運具）＋ 目前播放時間的狀態
// （活動名稱、地點、地點類型、正在用的運具）。地點類型與運具同時放中英文，兩種語言都搜得到。
// 「當下」的部分會隨時間變，所以文件要依時間重建（呼叫端以分鐘為單位重算，不是每幀）。

export type SearchDoc = {
  id: number;
  education: string;
  occupation: string;
  income: string;
  age: string;
  mobility: string;
  activity: string;
  place: string;
  locationType: string; // 中英文標籤 + 原始代碼，例如「住家 Home Home」
  mode: string;         // 正在用的運具（中英文），停留在活動地點時是空字串
  // 給結果列表顯示用（不參與比對）
  current: AgentActivity | null;
  modeBit: number | null;
};

export const SEARCH_RESULT_LIMIT = 20;

const bothLanguages = (key: ReturnType<typeof modeKey>) =>
  key ? `${translate('zh', key)} ${translate('en', key)}` : '';

const currentActivity = (activities: AgentActivity[], todaySec: number) =>
  activities.find((a) => todaySec >= parseHHMM(a.start_time) && todaySec < parseHHMM(a.end_time)) ?? null;

export const buildSearchDocs = (profiles: ProfilesData, trajectories: arrow.Table, time: number): SearchDoc[] => {
  const agentsById = new Map<number, ReturnType<typeof getAgentCache>[number]>();
  for (const agent of getAgentCache(trajectories)) {
    if (agent.id != null) agentsById.set(agent.id, agent);
  }
  const todaySec = time % DAY_SECONDS;

  return Object.values(profiles).map((entry) => {
    const id = Number(entry.id);
    const p = entry.profile ?? ({} as Partial<typeof entry.profile>);
    const act = currentActivity(entry.activities ?? [], todaySec);
    const agent = agentsById.get(id);
    const state = agent ? getAgentStateAt(agent, time) : null;
    return {
      id,
      education: p.education ?? '',
      occupation: p.occupation ?? '',
      income: p.income ?? '',
      age: p.age != null ? String(p.age) : '',
      mobility: (p.mobility ?? []).join(' '),
      activity: act?.Activity ?? '',
      place: act?.place ?? '',
      locationType: act ? `${bothLanguages(locationKey(act.location_type))} ${act.location_type}` : '',
      mode: state ? bothLanguages(modeKey(state.mode)) : '',
      current: act,
      modeBit: state?.mode ?? null,
    };
  });
};

// 權重：「在做什麼」跟「職業/學歷」最常被拿來搜，給高一點；年齡只是數字，權重最低。
// threshold 0.35：允許少打/打錯一兩個字，但不會把八竿子打不著的也撈進來。
// ignoreLocation：關鍵字出現在欄位的任何位置都算（預設只看開頭附近）。
export const createAgentSearch = (docs: SearchDoc[]) =>
  new Fuse(docs, {
    keys: [
      { name: 'activity', weight: 2 },
      { name: 'occupation', weight: 2 },
      { name: 'education', weight: 1.5 },
      { name: 'locationType', weight: 1.5 },
      { name: 'place', weight: 1.2 },
      { name: 'income', weight: 1 },
      { name: 'mode', weight: 1 },
      { name: 'mobility', weight: 0.8 },
      { name: 'age', weight: 0.5 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  });
