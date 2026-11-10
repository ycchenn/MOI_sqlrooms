import { useMemo } from 'react';
import type * as arrow from 'apache-arrow';
import { useShallow } from '@sqlrooms/room-shell';
import { useMapStore } from '@/zustand/useMapStore';
import { LAYER_IDS } from '@/constants/layers';
import { ArrowODArcLayer } from '@/components/custom_layer/arrowODArcLayer/ArrowODArcLayer';
import { buildODTable } from '@/lib/odFromSchedule';
import type { ProfilesData } from '@/hooks/useProfiles';

// archive 資料沒有現成的 OD parquet，改從 profiles.json 的行程推算（見 lib/odFromSchedule.ts）：
// 相鄰兩個活動 = 一趟移動，運具查軌跡。只在 profiles/軌跡換掉時重算一次，播放時不會重建表。
export const useODArcLayer = (arrowTable: arrow.Table | undefined, profiles: ProfilesData | null) => {
  const { timeRange, selectedModes, odVisible } = useMapStore(
    useShallow((state) => ({
      timeRange: state.timeRange,
      selectedModes: state.selectedModes,
      odVisible: state.visibleLayers[LAYER_IDS.OD_ARC] ?? false,
    }))
  );

  const odTable = useMemo(() => {
    if (!arrowTable || !profiles) return null;
    const { table, stats } = buildODTable(profiles, arrowTable);
    console.info('[useODArcLayer] OD 推算完成', stats);
    return table;
  }, [arrowTable, profiles]);

  return useMemo(() => {
    if (!odTable || odTable.numRows === 0 || !odVisible) return null;

    return new ArrowODArcLayer({
      id: 'od-arc-layer',
      data: odTable,
      visible: true,
      widthMinPixels: 2,
      timeRange: timeRange as [number, number],
      filterMode: selectedModes,
    });
  }, [odTable, odVisible, timeRange, selectedModes]);
};
