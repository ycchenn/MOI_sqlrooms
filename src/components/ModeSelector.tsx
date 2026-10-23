import { useState, type KeyboardEvent } from 'react';
import type * as arrow from 'apache-arrow';
import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import { useModeShares } from '@/hooks/useModeShares';
import { modeKey, useT } from '@/i18n';
import {
  AGENT_MODE_TRIP_COLORS,
  MOBILITY_MODE_BITS,
  ORDERED_MOBILITY_MODES,
} from '../constants/map';

const SIZE = 136;
const CENTER = SIZE / 2;
const OUTER_R = 62;
const INNER_R = 42;
const HOVER_GROW = 4; // hover 的那一塊往外凸幾 px
const SURFACE = 'var(--color-dash-panel)'; // 卡片底色（index.css），當作每塊之間 2px 間隔的描邊色

// 每塊的顏色跟地圖上軌跡/點位同一份顏色表（AGENT_MODE_TRIP_COLORS），用 log2(bit) 對照
const MODES = ORDERED_MOBILITY_MODES.map((name) => {
  const bit = MOBILITY_MODE_BITS[name];
  const [r, g, b] = AGENT_MODE_TRIP_COLORS[Math.floor(Math.log2(bit))] ?? [255, 255, 255];
  return { name, bit, color: `rgb(${r}, ${g}, ${b})` };
});

// 角度從 12 點鐘方向開始、順時針
const polar = (r: number, angle: number) => [CENTER + r * Math.sin(angle), CENTER - r * Math.cos(angle)];

const arcPath = (start: number, end: number, outer: number, inner: number): string => {
  // 單一運具佔 100% 時，SVG arc 起終點重合會畫不出來，切成兩個半圓
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

// 運具甜甜圈圖：每塊大小 = 目前播放時間正在使用該運具的 agent 數；點一塊就切換該運具
// 在地圖上顯示與否（可複選，跟原本的勾選框行為一樣，寫入同一個 selectedModes）。
export const ModeSelector = ({ arrowTable }: { arrowTable: arrow.Table }) => {
  const { selectedModes, toggleMode } = useMapStore(
    useShallow((s) => ({ selectedModes: s.selectedModes, toggleMode: s.toggleMode })),
  );
  const { counts, total } = useModeShares(arrowTable);
  const t = useT();
  const [hoveredBit, setHoveredBit] = useState<number | null>(null);

  const allSelected = MODES.every((m) => selectedModes.includes(m.bit));
  const selectAll = () => MODES.forEach((m) => !selectedModes.includes(m.bit) && toggleMode(m.bit));

  let cursor = 0;
  const slices = MODES.map((m) => {
    const count = counts[m.bit] ?? 0;
    const start = cursor;
    cursor += total ? (count / total) * Math.PI * 2 : 0;
    return { ...m, label: t(modeKey(m.bit) ?? 'mode.unknown'), count, start, end: cursor };
  });

  const hovered = slices.find((s) => s.bit === hoveredBit);

  const onKey = (bit: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMode(bit);
    }
  };

  return (
    <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong flex flex-col gap-3 font-mono shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-dash-border pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-dash-text-muted">{t('modes.title')}</span>
        {!allSelected && (
          <button onClick={selectAll} className="text-xs text-dash-accent-bright hover:text-dash-accent-soft">
            {t('modes.showAll')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 overflow-visible">
          {total === 0 ? (
            <path d={arcPath(0, Math.PI * 2, OUTER_R, INNER_R)} fill="var(--color-dash-empty)" opacity={0.4} />
          ) : (
            slices
              .filter((s) => s.count > 0)
              .map((s) => {
                const isSelected = selectedModes.includes(s.bit);
                const grow = s.bit === hoveredBit ? HOVER_GROW : 0;
                return (
                  <path
                    key={s.bit}
                    d={arcPath(s.start, s.end, OUTER_R + grow, INNER_R)}
                    fill={s.color}
                    opacity={isSelected ? 1 : 0.2}
                    stroke={SURFACE}
                    strokeWidth={2}
                    className="cursor-pointer transition-opacity outline-none"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={t('modes.ariaSlice', { label: s.label, count: s.count, pct: formatPct(s.count, total) })}
                    onClick={() => toggleMode(s.bit)}
                    onKeyDown={onKey(s.bit)}
                    onMouseEnter={() => setHoveredBit(s.bit)}
                    onMouseLeave={() => setHoveredBit(null)}
                    onFocus={() => setHoveredBit(s.bit)}
                    onBlur={() => setHoveredBit(null)}
                  />
                );
              })
          )}
          {/* 中心：hover 某塊時顯示該運具，否則顯示目前移動中的總人數 */}
          <text x={CENTER} y={CENTER - 4} textAnchor="middle" className="fill-dash-text-strong text-[18px] font-bold">
            {(hovered ? hovered.count : total).toLocaleString()}
          </text>
          <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-dash-text-muted text-[11px]">
            {hovered ? `${hovered.label} ${formatPct(hovered.count, total)}` : t('modes.moving')}
          </text>
        </svg>

        {/* 圖例：顏色之外再用文字標出運具名稱與數字（BUS/RAIL 兩色對紅綠色盲不好分），
            0 人的運具在圓環上沒有那一塊，也要能從這裡點選 */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {slices.map((s) => {
            const isSelected = selectedModes.includes(s.bit);
            return (
              <button
                key={s.bit}
                aria-pressed={isSelected}
                onClick={() => toggleMode(s.bit)}
                onMouseEnter={() => setHoveredBit(s.bit)}
                onMouseLeave={() => setHoveredBit(null)}
                className={`flex items-center gap-2 rounded px-1 py-0.5 text-xs text-left hover:bg-dash-track/50 transition-opacity ${
                  isSelected ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border-2"
                  style={{ borderColor: s.color, backgroundColor: isSelected ? s.color : 'transparent' }}
                />
                <span className="text-dash-text flex-1 whitespace-nowrap">{s.label}</span>
                <span className="text-dash-text tabular-nums shrink-0">{formatPct(s.count, total)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
