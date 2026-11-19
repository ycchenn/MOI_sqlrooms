import type * as arrow from 'apache-arrow';
import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import { useModeShares } from '@/hooks/useModeShares';
import { modeKey, useT } from '@/i18n';
import { DonutChart } from './DonutChart';
import {
  AGENT_MODE_TRIP_COLORS,
  MOBILITY_MODE_BITS,
  ORDERED_MOBILITY_MODES,
} from '../constants/map';

// 每塊的顏色跟地圖上軌跡/點位同一份顏色表（AGENT_MODE_TRIP_COLORS），用 log2(bit) 對照
const MODES = ORDERED_MOBILITY_MODES.map((name) => {
  const bit = MOBILITY_MODE_BITS[name];
  const [r, g, b] = AGENT_MODE_TRIP_COLORS[Math.floor(Math.log2(bit))] ?? [255, 255, 255];
  return { bit, color: `rgb(${r}, ${g}, ${b})` };
});

// 運具甜甜圈圖：每塊大小 = 目前播放時間正在使用該運具的 agent 數；點一塊就切換該運具
// 在地圖上顯示與否（可複選，寫入 selectedModes）。visibleIds 是人口甜甜圈篩選後留下的人。
export const ModeSelector = ({ arrowTable, visibleIds }: { arrowTable: arrow.Table; visibleIds: Set<number> | null }) => {
  const { selectedModes, toggleMode } = useMapStore(
    useShallow((s) => ({ selectedModes: s.selectedModes, toggleMode: s.toggleMode })),
  );
  const { counts } = useModeShares(arrowTable, visibleIds);
  const t = useT();

  return (
    <DonutChart
      title={t('modes.title')}
      slices={MODES.map((m) => ({
        key: String(m.bit),
        label: t(modeKey(m.bit) ?? 'mode.unknown'),
        color: m.color,
        count: counts[m.bit] ?? 0,
        selected: selectedModes.includes(m.bit),
      }))}
      onToggle={(key) => toggleMode(Number(key))}
      onShowAll={() => MODES.forEach((m) => !selectedModes.includes(m.bit) && toggleMode(m.bit))}
    />
  );
};
