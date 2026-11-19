import type * as arrow from 'apache-arrow';
import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import { useDemographicShares } from '@/hooks/useDemographics';
import { DEMO_DIMENSIONS, type DemographicIndex } from '@/lib/demographics';
import { useT } from '@/i18n';
import { DonutChart } from './DonutChart';

// 人口背景甜甜圈：上方分頁切換分類方式（學歷/收入/年齡/職業），每塊 = 目前移動中、
// 且運具有被選取的人數。點一塊切換該群在地圖上顯示與否（可複選）。
export const DemographicSelector = ({ arrowTable, index }: { arrowTable: arrow.Table; index: DemographicIndex | null }) => {
  const { dim, hidden, setDim, toggleGroup, showAll } = useMapStore(
    useShallow((s) => ({
      dim: s.demoDimension,
      hidden: s.hiddenDemoGroups,
      setDim: s.setDemoDimension,
      toggleGroup: s.toggleDemoGroup,
      showAll: s.showAllDemoGroups,
    })),
  );
  const { counts } = useDemographicShares(arrowTable, index);
  const t = useT();

  const tabs = (
    <div role="tablist" className="flex gap-1 rounded-md border border-dash-border bg-dash-surface/60 p-0.5 text-xs">
      {DEMO_DIMENSIONS.map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={d === dim}
          onClick={() => setDim(d)}
          className={`flex-1 rounded px-2 py-1 transition-colors ${
            d === dim ? 'bg-dash-accent text-dash-on-accent font-bold' : 'text-dash-text-muted hover:text-dash-text'
          }`}
        >
          {t(`demo.dim.${d}`)}
        </button>
      ))}
    </div>
  );

  if (!index) {
    return (
      <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg font-mono text-xs text-dash-text-faint">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <DonutChart
      title={t('demo.title')}
      controls={tabs}
      slices={index.groups.map((g) => ({
        key: g.key,
        // 資料原值照原文顯示（不翻譯）；年齡層、其他用翻譯字串
        label: g.label ?? (g.ageRange ? t('demo.ageRange', { range: g.ageRange }) : t('demo.other')),
        color: g.color,
        count: counts[g.key] ?? 0,
        selected: !hidden.includes(g.key),
      }))}
      onToggle={toggleGroup}
      onShowAll={showAll}
    />
  );
};
