import { useState, type KeyboardEvent, type ReactNode } from 'react';

import { useT } from '@/i18n';

const SIZE = 136;
const CENTER = SIZE / 2;
const OUTER_R = 62;
const INNER_R = 42;
const HOVER_GROW = 4; // hover 的那一塊往外凸幾 px
const SURFACE = 'var(--color-dash-panel)'; // 卡片底色（index.css），當作每塊之間 2px 間隔的描邊色

export type DonutSlice = {
  key: string;
  label: string;
  color: string;
  count: number;
  selected: boolean;
};

// 角度從 12 點鐘方向開始、順時針
const polar = (r: number, angle: number) => [CENTER + r * Math.sin(angle), CENTER - r * Math.cos(angle)];

const arcPath = (start: number, end: number, outer: number, inner: number): string => {
  // 單一類別佔 100% 時，SVG arc 起終點重合會畫不出來，切成兩個半圓
  if (end - start >= Math.PI * 2 - 1e-6) {
    const mid = start + Math.PI;
    return arcPath(start, mid, outer, inner) + arcPath(mid, end, outer, inner);
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x0, y0] = polar(outer, start);
  const [x1, y1] = polar(outer, end);
  const [x2, y2] = polar(inner, end);
  const [x3, y3] = polar(inner, start);
  return `M${x0},${y0} A${outer},${outer} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${inner},${inner} 0 ${large} 0 ${x3},${y3} Z`;
};

const formatPct = (count: number, total: number) => {
  if (!total || !count) return '0%';
  const pct = (count / total) * 100;
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
};

type DonutChartProps = {
  title: string;
  slices: DonutSlice[];
  onToggle: (key: string) => void;
  onShowAll: () => void;
  // 標題列下方的額外控制（例如人口甜甜圈的分類分頁）
  controls?: ReactNode;
};

// 可點選的甜甜圈圖：每塊大小 = 目前移動中的人數，點一塊（或圖例那一列）切換該群在地圖上顯示與否，可複選。
// 沒選到的塊變暗但留在原位、還能點回來；0 人的類別圓環上沒有那一塊，只能從圖例點。
export const DonutChart = ({ title, slices, onToggle, onShowAll, controls }: DonutChartProps) => {
  const t = useT();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const allSelected = slices.every((s) => s.selected);

  let cursor = 0;
  const arcs = slices.map((s) => {
    const start = cursor;
    cursor += total ? (s.count / total) * Math.PI * 2 : 0;
    return { ...s, start, end: cursor };
  });
  const hovered = arcs.find((s) => s.key === hoveredKey);

  const onKey = (key: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(key);
    }
  };

  return (
    <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong flex flex-col gap-3 font-mono shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-dash-border pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-dash-text-muted">{title}</span>
        {!allSelected && (
          <button onClick={onShowAll} className="text-xs text-dash-accent-bright hover:text-dash-accent-soft">
            {t('common.showAll')}
          </button>
        )}
      </div>

      {controls}

      <div className="flex items-center gap-3">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 overflow-visible">
          {total === 0 ? (
            <path d={arcPath(0, Math.PI * 2, OUTER_R, INNER_R)} fill="var(--color-dash-empty)" opacity={0.4} />
          ) : (
            arcs
              .filter((s) => s.count > 0)
              .map((s) => (
                <path
                  key={s.key}
                  d={arcPath(s.start, s.end, OUTER_R + (s.key === hoveredKey ? HOVER_GROW : 0), INNER_R)}
                  fill={s.color}
                  opacity={s.selected ? 1 : 0.2}
                  stroke={SURFACE}
                  strokeWidth={2}
                  className="cursor-pointer transition-opacity outline-none"
                  role="button"
                  tabIndex={0}
                  aria-pressed={s.selected}
                  aria-label={t('donut.ariaSlice', { label: s.label, count: s.count, pct: formatPct(s.count, total) })}
                  onClick={() => onToggle(s.key)}
                  onKeyDown={onKey(s.key)}
                  onMouseEnter={() => setHoveredKey(s.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(s.key)}
                  onBlur={() => setHoveredKey(null)}
                />
              ))
          )}
          {/* 中心：hover 某塊時顯示該類別，否則顯示目前移動中的總人數 */}
          <text x={CENTER} y={CENTER - 4} textAnchor="middle" className="fill-dash-text-strong text-[18px] font-bold">
            {(hovered ? hovered.count : total).toLocaleString()}
          </text>
          <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-dash-text-muted text-[11px]">
            {hovered ? formatPct(hovered.count, total) : t('donut.moving')}
          </text>
        </svg>

        {/* 圖例：顏色之外再用文字標出名稱與比例（顏色不是唯一的辨識方式） */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {arcs.map((s) => (
            <button
              key={s.key}
              aria-pressed={s.selected}
              title={s.label}
              onClick={() => onToggle(s.key)}
              onMouseEnter={() => setHoveredKey(s.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex items-center gap-2 rounded px-1 py-0.5 text-xs text-left hover:bg-dash-track/50 transition-opacity ${
                s.selected ? 'opacity-100' : 'opacity-40'
              } ${s.key === hoveredKey ? 'bg-dash-track/50' : ''}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border-2"
                style={{ borderColor: s.color, backgroundColor: s.selected ? s.color : 'transparent' }}
              />
              <span className="text-dash-text flex-1 truncate">{s.label}</span>
              <span className="text-dash-text tabular-nums shrink-0">{formatPct(s.count, total)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
