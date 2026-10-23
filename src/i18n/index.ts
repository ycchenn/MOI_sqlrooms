import { useCallback } from 'react';
import { useMapStore } from '@/zustand/useMapStore';

// 介面語言：只管左側 dashboard 與地圖上的資訊框（tooltip），地圖底圖的地名/路名不在範圍內。
// profiles.json 裡的資料值（活動名稱、教育、職業、收入、運具）照原文顯示，不在這裡翻。
export type Lang = 'zh' | 'en';

const zh = {
  'lang.switch': '語言',

  'overview.title': '城市總覽',
  'overview.agentCount': '代理人數量',
  'overview.avgDistance': '平均移動距離',
  'overview.destination': '代理人目的地',
  'overview.destinationNote': '* 依資料實際欄位分類（住家／工作／其他），非土地使用分區',

  'common.loading': '載入中...',
  'unit.km': '公里',
  'unit.kmh': '公里/小時',
  'common.backToOverview': '← 回到總覽',

  'location.Home': '住家',
  'location.Work': '工作',
  'location.Others': '其他',

  'modes.title': '運具',
  'modes.showAll': '全部顯示',
  'modes.moving': '移動中',
  'modes.ariaSlice': '{label} {count} 人，{pct}',

  'mode.1': '走路',
  'mode.2': '開車',
  'mode.4': '其他',
  'mode.8': '公車',
  'mode.16': '捷運',
  'mode.unknown': '未知',

  'layers.title': '圖層',
  'layer.trips': '移動軌跡',
  'layer.heatmap': '路徑密度',
  'layer.od-arc': '起迄弧線',

  'agent.title': '代理人 #{id}',
  'agent.loading': '載入代理人資料中...',
  'agent.notFound': '找不到代理人 #{id} 的資料',
  'agent.schedule': '行程',

  'tooltip.pathId': '路徑編號',
  'tooltip.mode': '運具',
  'tooltip.speed': '目前路段時速',
  'tooltip.status.stopped': '幾乎靜止（塞車/等待中）',
  'tooltip.status.slow': '緩慢移動',
  'tooltip.statusWrap': '（{status}）',
  'tooltip.age': '年齡',
  'tooltip.education': '教育',
  'tooltip.occupation': '職業',
  'tooltip.income': '收入',
  'tooltip.mobility': '可用運具',
};

export type MessageKey = keyof typeof zh;

const en: Record<MessageKey, string> = {
  'lang.switch': 'Language',

  'overview.title': 'City Overview',
  'overview.agentCount': 'Number of Agents',
  'overview.avgDistance': 'Average Distance',
  'overview.destination': "Agents' Destinations",
  'overview.destinationNote': '* Based on the location type in the data (Home / Work / Others), not land-use zoning',

  'common.loading': 'Loading...',
  'unit.km': 'km',
  'unit.kmh': 'km/h',
  'common.backToOverview': '← Back to overview',

  'location.Home': 'Home',
  'location.Work': 'Work',
  'location.Others': 'Others',

  'modes.title': 'Mobility Modes',
  'modes.showAll': 'Show all',
  'modes.moving': 'Moving',
  'modes.ariaSlice': '{label}: {count} agents, {pct}',

  'mode.1': 'Walk',
  'mode.2': 'Car',
  'mode.4': 'Other',
  'mode.8': 'Bus',
  'mode.16': 'Rail',
  'mode.unknown': 'Unknown',

  'layers.title': 'Layers',
  'layer.trips': 'Trips',
  'layer.heatmap': 'Heatmap',
  'layer.od-arc': 'OD Arcs',

  'agent.title': 'Agent #{id}',
  'agent.loading': 'Loading agent data...',
  'agent.notFound': 'No data found for agent #{id}',
  'agent.schedule': 'Schedule',

  'tooltip.pathId': 'Path ID',
  'tooltip.mode': 'Mode',
  'tooltip.speed': 'Current speed',
  'tooltip.status.stopped': 'nearly stopped (congested / waiting)',
  'tooltip.status.slow': 'moving slowly',
  'tooltip.statusWrap': ' ({status})',
  'tooltip.age': 'Age',
  'tooltip.education': 'Education',
  'tooltip.occupation': 'Occupation',
  'tooltip.income': 'Income',
  'tooltip.mobility': 'Available modes',
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { zh, en };

export const translate = (lang: Lang, key: MessageKey, params?: Record<string, string | number>) => {
  const template = MESSAGES[lang][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
};

// 資料裡的固定代碼（mode bit、location_type）轉成翻譯 key；沒對應的就回傳 null，由呼叫端決定 fallback。
export const modeKey = (bit: number) => (`mode.${bit}` in zh ? (`mode.${bit}` as MessageKey) : null);
export const locationKey = (type: string) => (`location.${type}` in zh ? (`location.${type}` as MessageKey) : null);

export const useT = () => {
  const lang = useMapStore((s) => s.language);
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );
};
