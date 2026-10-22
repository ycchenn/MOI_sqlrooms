import { useMemo } from 'react';
import { useSql } from '@sqlrooms/duckdb';
import { useShallow } from '@sqlrooms/room-shell';
import { useMapStore } from '@/zustand/useMapStore';
import { LAYER_IDS } from '@/constants/layers';
import { ArrowODArcLayer } from '@/components/custom_layer/arrowODArcLayer/ArrowODArcLayer';

export const useODArcLayer = () => {
  const { timeRange, selectedModes, odVisible } = useMapStore(
    useShallow((state) => ({
      timeRange: state.timeRange,
      selectedModes: state.selectedModes,
      odVisible: state.visibleLayers[LAYER_IDS.OD_ARC] ?? false,
    }))
  );

  // ⚠ 預留：archive 資料沒有 OD parquet，目前查一個保證 0 列、不碰網路的 SQL，圖層勾了也不會畫東西。
  // 之後有 OD 資料（或改從軌跡算起迄點）時，把這裡換成真正的查詢即可，下面的圖層邏輯不用動。
  const query = `SELECT NULL WHERE FALSE`;

  const { data: queryResult } = useSql<Record<string, unknown>>({ query });
  const arrowTable = queryResult?.arrowTable;

  return useMemo(() => {
    if (!arrowTable || !odVisible) return null;

    return new ArrowODArcLayer({
      id: 'od-arc-layer',
      data: arrowTable,
      visible: true,
      widthMinPixels: 2,
      timeRange: timeRange as [number, number],
      filterMode: selectedModes,
    });
  }, [arrowTable, odVisible, timeRange, selectedModes]);
};
