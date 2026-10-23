import { SpinnerPane } from '@sqlrooms/ui';
import { useSql } from '@sqlrooms/duckdb';
import { useShallow } from '@sqlrooms/room-shell';

import { ARCHIVE_DATA_URL } from '../constants/data';
import { useMapStore } from '../zustand/useMapStore';
import { MapView } from './MapView';
import { ModeSelector } from './ModeSelector';
import { LayerPanel } from './LayerPanel';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Timebar } from './timebar/Timebar';
import { AgentOverviewPanel } from './AgentOverviewPanel';
import { AgentDetailPanel } from './AgentDetailPanel';
import { useProfiles } from '@/hooks/useProfiles';

export const MainView: React.FC = () => {
  const selectedAgentId = useMapStore(useShallow((s) => s.selectedAgentId));
  // 只在這裡抓一次 profiles.json（~13MB），宏觀/微觀兩個面板共用同一份，不重複 fetch。
  const { profiles, isLoading: profilesLoading } = useProfiles();
  // data.parquet 的 paths/timestamps/modes 是逗號分隔的字串欄位（不是原生 List 型別），ArrowTripsLayer 直接挖 Arrow List 的底層 buffer，
  // 所以要先用 string_split + list_transform 轉成型別化陣列（FLOAT[] / UTINYINT[]）。
  const query = `
      SELECT
        id,
        list_transform(string_split(paths, ','), x -> CAST(x AS FLOAT)) AS paths,
        list_transform(string_split(timestamps, ','), x -> CAST(x AS FLOAT)) AS timestamps,
        list_transform(string_split(modes, ','), x -> CAST(x AS UTINYINT)) AS modes
      FROM read_parquet('${ARCHIVE_DATA_URL}')
    `;

  const { data, isLoading, error } = useSql({ query });

  const arrowTable = data?.arrowTable;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-dash-app">
      {arrowTable && !isLoading ? (
        <>
          {/* 左側 Dashboard 側欄：固定寬度，跟地圖並排（不是疊在地圖上），
              情境切換／運具選擇／圖層控制都先搬進來，之後 profile/schedule 也會加在這裡。 */}
          <div className="w-[340px] shrink-0 h-full bg-dash-panel border-r border-dash-border overflow-y-auto scrollbar-subtle p-4 flex flex-col gap-3 z-10">
            {/* 中英切換：固定在側欄左上，總覽/agent 行程兩種畫面都看得到 */}
            <LanguageSwitcher />
            {/* 點了地圖上某個 agent 就切換成他的 profile+schedule（微觀），
                沒選取時顯示全體統計（宏觀）——兩者共用同一個 selectedAgentId 開關。 */}
            {selectedAgentId !== null ? (
              <AgentDetailPanel agentId={selectedAgentId} profiles={profiles} />
            ) : (
              <AgentOverviewPanel arrowTable={arrowTable} profiles={profiles} profilesLoading={profilesLoading} />
            )}
            {/* 選了某個 agent 時側欄只留他的 Schedule，總覽用的甜甜圈/圖層控制先收起來 */}
            {selectedAgentId === null && (
              <>
                <ModeSelector arrowTable={arrowTable} />
                <LayerPanel />
              </>
            )}
          </div>

          {/* 右側：地圖 + 時間軸，佔側欄以外的剩餘寬度 */}
          <div className="relative flex-1 h-full">
            <div className="absolute inset-0 z-0">
              <MapView arrowTable={arrowTable} profiles={profiles} />
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
        <div className="absolute left-5 top-5 bg-red-500/90 text-dash-text-strong p-4 font-mono z-50 rounded shadow-lg backdrop-blur">
          {String(error)}
        </div>
      )}
    </div>
  );
};
