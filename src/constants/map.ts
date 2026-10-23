export const INITIAL_VIEW_STATE = {
  longitude: 121.4945181576129,
  latitude: 25.111019220248266,
  zoom: 10.6078,
  pitch: 0,
  bearing: 0,
}

// 整張地圖能縮放的範圍。放大超過 MAP_MAX_ZOOM 對這份資料的解析度沒有意義（軌跡不會再更細），
// 縮小超過 MAP_MIN_ZOOM 畫面會太瑣碎。
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
