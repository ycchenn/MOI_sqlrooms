import type { ProfilesData } from '@/hooks/useProfiles';

// 人口背景分組：把每個代理人依某個 profile 欄位（學歷/收入/年齡/職業）分到一個群組，
// 給 DemographicSelector 的甜甜圈與地圖篩選共用。
// 資料裡沒有性別欄位，所以不提供性別分類。

export type DemoDimension = 'education' | 'income' | 'age' | 'occupation';
export const DEMO_DIMENSIONS: DemoDimension[] = ['education', 'income', 'age', 'occupation'];

// 人數排不進前 MAX_NAMED_GROUPS 名的值、以及空值，都併進「其他」
export const OTHER_GROUP = '__other__';
const MAX_NAMED_GROUPS = 6;

// 年齡是連續數字，分成固定的年齡層（依序排列，不依人數排）
const AGE_BINS: { key: string; range: string; max: number }[] = [
  { key: 'age:0-17', range: '0–17', max: 17 },
  { key: 'age:18-29', range: '18–29', max: 29 },
  { key: 'age:30-44', range: '30–44', max: 44 },
  { key: 'age:45-64', range: '45–64', max: 64 },
  { key: 'age:65+', range: '65+', max: Infinity },
];

// 類別配色：dataviz 參考配色的前 6 格（深色版，已用 validate_palette.js 在 --color-dash-panel
// 上驗證過色盲辨識與對比度），依固定順序指派、不循環；「其他」固定灰色。
// 顏色跟著群組走（依全體人數排名決定一次），不會因為播放時間或篩選而重新上色。
const CATEGORY_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c'];
const OTHER_COLOR = '#71717a';

export type DemoGroup = {
  key: string;
  color: string;
  // 顯示文字：資料原值直接顯示（不翻譯，見 i18n 規則）；年齡層/其他由元件翻譯
  label: string | null;
  ageRange?: string;
};

export type DemographicIndex = {
  groups: DemoGroup[];
  groupOf: (agentId: number) => string; // 找不到 profile 的代理人也歸「其他」（不篩掉，但不會出現在甜甜圈上）
};

const otherGroup = (): DemoGroup => ({ key: OTHER_GROUP, color: OTHER_COLOR, label: null });

export const buildDemographicIndex = (profiles: ProfilesData, dim: DemoDimension): DemographicIndex => {
  const agentGroup = new Map<number, string>();
  let groups: DemoGroup[];
  // 有沒有人會被歸到「其他」（沒資料、或排不進前幾名）；沒有就不顯示那一塊，免得圖例多一列 0%
  let hasOther = false;

  if (dim === 'age') {
    const present = new Set<string>();
    for (const entry of Object.values(profiles)) {
      const age = Number(entry.profile?.age);
      if (!Number.isFinite(age)) {
        hasOther = true;
        continue;
      }
      const bin = AGE_BINS.find((b) => age <= b.max)!;
      agentGroup.set(Number(entry.id), bin.key);
      present.add(bin.key);
    }
    groups = AGE_BINS.filter((b) => present.has(b.key)).map((b, i) => ({
      key: b.key,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      label: null,
      ageRange: b.range,
    }));
  } else {
    const counts = new Map<string, number>();
    const valueOf = new Map<number, string>();
    for (const entry of Object.values(profiles)) {
      const raw = entry.profile?.[dim];
      const value = raw == null ? '' : String(raw).trim();
      if (!value) {
        hasOther = true;
        continue;
      }
      valueOf.set(Number(entry.id), value);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const named = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_NAMED_GROUPS)
      .map(([value]) => value);
    const namedSet = new Set(named);
    if (counts.size > named.length) hasOther = true;
    for (const [id, value] of valueOf) {
      if (namedSet.has(value)) agentGroup.set(id, `${dim}:${value}`);
    }
    groups = named.map((value, i) => ({ key: `${dim}:${value}`, color: CATEGORY_COLORS[i], label: value }));
  }

  if (hasOther) groups.push(otherGroup());
  return { groups, groupOf: (id) => agentGroup.get(id) ?? OTHER_GROUP };
};
