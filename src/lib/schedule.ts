// "HH:MM" → 當天秒數。schedule 的時間是一天制（00:00–24:00），跟模擬可能跨日的
// 全域 time（見 setSelectedAgentId 旁註）不是同一個軸，比對前要對齊成「當天時刻」。
export const parseHHMM = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
};

export const DAY_SECONDS = 86400;
