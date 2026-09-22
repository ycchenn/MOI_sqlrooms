export const INITIAL_VIEW_STATE = {
  longitude: 121.4945181576129,
  latitude: 25.111019220248266,
  zoom: 10.6078,
  pitch: 0,
  bearing: 0,
}

// 整張地圖能縮放的範圍。放大超過 MAP_MAX_ZOOM 對這份資料的解析度沒有意義（軌跡/站點都不會再更細），
// 縮小超過 MAP_MIN_ZOOM 畫面會太瑣碎。useStopCountsLayer 的聚合設定要跟著這個上限調。
export const MAP_MIN_ZOOM = 10;
export const MAP_MAX_ZOOM = 15;

// 索引＝bit 的 log2（0=1, 1=2, 2=4, 3=8, 4=16），跟實際資料的 mode 編碼對齊
// （sim_data README：1=walk 2=car 8=bus 16=metro，4 從未出現；
// 但 local_archive 的 data.parquet 裡 modes 欄位實際會出現 4，語意未知，
// 暫時歸類成 OTHER／「其他」，用這個位置本來就保留的顏色，等確認實際運具類型後再改標籤）。
export const AGENT_MODE_TRIP_COLORS = [
  [ 28, 197, 248, 150], // WALK      // 淡藍
  [230,  41,  41, 150], // CAR       // 紅
  [217, 138, 241, 150], // OTHER     // 紫（bit=4，語意待確認）
  [239, 201,  74, 150], // BUS       // 橘黃
  [114, 225,  84, 150]  // RAIL      // 綠
]

export const AGENT_MODE_TRIP_LENGTH = [
  20, // WALK
  20, // CAR
  20, // BUS
  20  // RAIL
]

export enum MOBILITY_MODES {
  WALK = "walk",
  CAR = "car",
  OTHER = "other",
  BUS = "bus",
  RAIL = "rail"
}

export const ORDERED_MOBILITY_MODES = [
  MOBILITY_MODES.WALK,
  MOBILITY_MODES.CAR,
  MOBILITY_MODES.OTHER,
  MOBILITY_MODES.BUS,
  MOBILITY_MODES.RAIL
]

// 固定 bit 值，不要用陣列 index 位移推算——1<<index 會讓 BUS/RAIL 對不上實際資料的 8/16 bit。
export const MOBILITY_MODE_BITS: Record<MOBILITY_MODES, number> = {
  [MOBILITY_MODES.WALK]: 1,
  [MOBILITY_MODES.CAR]: 2,
  [MOBILITY_MODES.OTHER]: 4,
  [MOBILITY_MODES.BUS]: 8,
  [MOBILITY_MODES.RAIL]: 16,
}

export const INITIAL_SELETED_MOBILITY_MODES = [MOBILITY_MODES.WALK, MOBILITY_MODES.CAR, MOBILITY_MODES.OTHER, MOBILITY_MODES.BUS, MOBILITY_MODES.RAIL]
export const INITIAL_SELETED_MOBILITY_MODES_BITS = [1,2,4,8,16]

// bit 值 → 中文標籤，給 Points 圖層的 tooltip 用（哪個路徑、什麼運具）
export const MODE_BIT_LABELS: Record<number, string> = {
  [MOBILITY_MODE_BITS[MOBILITY_MODES.WALK]]: '走路',
  [MOBILITY_MODE_BITS[MOBILITY_MODES.CAR]]: '開車',
  [MOBILITY_MODE_BITS[MOBILITY_MODES.OTHER]]: '其他',
  [MOBILITY_MODE_BITS[MOBILITY_MODES.BUS]]: '公車',
  [MOBILITY_MODE_BITS[MOBILITY_MODES.RAIL]]: '捷運',
}

// 靜態設施點位顏色（02_points/）。刻意不用 AGENT_MODE_TRIP_COLORS 裡的任何一色，
// 避免跟軌跡/agent 點位混淆——地圖底圖是深色，這兩色在深色背景上都夠亮、夠獨立。
export const FACILITY_STATION_COLOR: [number, number, number, number] = [255, 255, 255, 230]; // 站點（公車站+捷運站合併一色）
export const FACILITY_SHELTER_COLOR: [number, number, number, number] = [236, 72, 153, 230]; // 避難所

// 避難所飽和度分級顏色。⚠ 04_shelter_capacity/ 實際 status 欄位值是
// empty/normal/crowded/near_full/over_capacity（不是文件寫的 empty/low/medium/high/over），
// 之前 key 對不上，除了 empty 以外全部 fallback 成灰白色——這才是「圈都是白色半透明」的真正原因。
// 高飽和度的藍→綠→黃→橘→紅色相漸層，alpha 跟著嚴重度一起遞增，色相＋透明度雙重強化區隔。
export const SHELTER_STATUS_COLORS: Record<string, [number, number, number, number]> = {
  empty: [37, 99, 235, 150],
  normal: [16, 185, 129, 170],
  crowded: [250, 204, 21, 195],
  near_full: [249, 115, 22, 215],
  over_capacity: [220, 38, 38, 235],
}
