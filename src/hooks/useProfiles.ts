import { useEffect, useState } from 'react';
import { ARCHIVE_PROFILES_URL, USE_ARCHIVE_DATA } from '@/constants/data';

export type AgentActivity = {
  Activity: string;
  location_type: string;
  start_time: string;
  end_time: string;
  during: number;
  lat: number;
  lon: number;
  place: string;
};

export type AgentProfile = {
  age: number;
  education: string;
  occupation: string;
  income: string;
  mobility: string[];
  life_quality: number;
  home: [number, number];
  work: [number, number];
};

export type AgentEntry = {
  id: number;
  profile: AgentProfile;
  activities: AgentActivity[];
};

export type ProfilesData = Record<string, AgentEntry>;

// profiles.json（archive 專屬，sim_data 沒有對應資料）不是 Parquet，不走 DuckDB，
// 是整份 fetch 下來快取在記憶體——13MB 左右，只在第一次掛載時抓一次。
export const useProfiles = () => {
  const [profiles, setProfiles] = useState<ProfilesData | null>(null);
  const [isLoading, setIsLoading] = useState(USE_ARCHIVE_DATA);

  useEffect(() => {
    if (!USE_ARCHIVE_DATA) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(ARCHIVE_PROFILES_URL)
      .then((res) => res.json())
      .then((data: ProfilesData) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err) => {
        console.error('[useProfiles] 讀取 profiles.json 失敗', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { profiles, isLoading };
};
