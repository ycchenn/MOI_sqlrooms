import { useShallow } from '@sqlrooms/room-shell';

import { useMapStore } from '@/zustand/useMapStore';
import { useT, type Lang } from '@/i18n';

// 按鈕上的字固定用各自語言的自稱（中 / EN），不跟著介面語言翻，切到另一種語言的人才找得到
const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'zh', label: '中' },
  { lang: 'en', label: 'EN' },
];

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useMapStore(
    useShallow((s) => ({ language: s.language, setLanguage: s.setLanguage })),
  );
  const t = useT();

  return (
    <div role="group" aria-label={t('lang.switch')} className="inline-flex self-start rounded-md border border-dash-border bg-dash-surface/60 p-0.5 font-mono text-xs">
      {OPTIONS.map(({ lang, label }) => {
        const active = language === lang;
        return (
          <button
            key={lang}
            aria-pressed={active}
            onClick={() => setLanguage(lang)}
            className={`px-2.5 py-1 rounded transition-colors ${
              active ? 'bg-dash-accent text-dash-on-accent font-bold' : 'text-dash-text-muted hover:text-dash-text'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
