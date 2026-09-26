import { SpinnerPane } from '@sqlrooms/ui';
import { useSql } from '@sqlrooms/duckdb';
import { useShallow } from '@sqlrooms/room-shell';

import { SCENARIO_CONFIG, USE_ARCHIVE_DATA, ARCHIVE_DATA_URL } from '../constants/data';
import { useMapStore } from '../zustand/useMapStore';
import { MapView } from './MapView';
import { ModeSelector } from './ModeSelector';
import { LayerPanel } from './LayerPanel';
import { ScenarioSwitcher } from './ScenarioSwitcher';
import { Timebar } from './timebar/Timebar';

export const MainView: React.FC = () => {
  const scenarioType = useMapStore(useShallow((s) => s.scenarioType));
  const dataUrl = USE_ARCHIVE_DATA ? ARCHIVE_DATA_URL : SCENARIO_CONFIG[scenarioType].dataUrl;

  // local_archive/data.parquet 的 paths/timestamps/modes 是逗號分隔的字串欄位（不是原本
  // sim_data 那種原生 List 型別），ArrowTripsLayer 直接挖 Arrow List 的底層 buffer，
  // 所以要先用 string_split + list_transform 轉成型別化陣列（FLOAT[] / UTINYINT[]）。
  const query = USE_ARCHIVE_DATA
    ? `
      SELECT
        id,
        list_transform(string_split(paths, ','), x -> CAST(x AS FLOAT)) AS paths,
        list_transform(string_split(timestamps, ','), x -> CAST(x AS FLOAT)) AS timestamps,
        list_transform(string_split(modes, ','), x -> CAST(x AS UTINYINT)) AS modes
      FROM read_parquet('${dataUrl}')
    `
    : `SELECT paths, timestamps, modes FROM read_parquet('${dataUrl}')`;

  const { data, isLoading, error } = useSql({ query });

  const arrowTable = data?.arrowTable;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#1e1e24]">
      {arrowTable && !isLoading ? (
        <>
          {/* 左側 Dashboard 側欄：固定寬度，跟地圖並排（不是疊在地圖上），
              情境切換／運具選擇／圖層控制都先搬進來，之後 profile/schedule 也會加在這裡。 */}
          <div className="w-[340px] shrink-0 h-full bg-[#2B2B38] border-r border-slate-700 overflow-y-auto p-4 flex flex-col gap-3 z-10">
            <ScenarioSwitcher />
            <ModeSelector />
            <LayerPanel />
          </div>

          {/* 右側：地圖 + 時間軸，佔側欄以外的剩餘寬度 */}
          <div className="relative flex-1 h-full">
            <div className="absolute inset-0 z-0">
              <MapView arrowTable={arrowTable} />
            </div>

            {/* 正下方：時間軸（相對這塊地圖區置中，不會跑到側欄底下） */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%] z-10 max-w-6xl">
              <Timebar />
            </div>
          </div>
        </>
      ) : (
        <SpinnerPane className="h-full w-full" />
      )}

      {/* 錯誤提示 */}
      {error && (
        <div className="absolute left-5 top-5 bg-red-500/90 text-white p-4 font-mono z-50 rounded shadow-lg backdrop-blur">
          {String(error)}
        </div>
      )}
    </div>
  );
};
