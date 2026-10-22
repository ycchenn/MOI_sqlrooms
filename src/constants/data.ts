// 資料來源設定：base URL 從環境變數推導（.env 的 VITE_DUCKDB_CONNECTION_STRING）。
export const DATA_BASE_URL =
  import.meta.env.VITE_DUCKDB_CONNECTION_STRING || 'http://localhost:7780';

const _baseUrl = DATA_BASE_URL.endsWith('/') ? DATA_BASE_URL : DATA_BASE_URL + '/';

const urlFor = (path: string) => new URL(path, _baseUrl).href;

// 資料來自 mentor 提供的 archive.zip（純本地、已 gitignore），http-server 直接指向解壓後的資料夾。
export const ARCHIVE_DATA_URL = urlFor('data.parquet');
// agent 的人口統計資料（profile）+ 逐筆行程（schedule），目前只有側欄 Dashboard 在用，
// 不是透過 DuckDB 查，是直接 fetch 整份 JSON（見 hooks/useProfiles.ts）。
export const ARCHIVE_PROFILES_URL = urlFor('profiles.json');
