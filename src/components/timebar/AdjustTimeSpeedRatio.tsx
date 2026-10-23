// 確保 shadcn/ui 的路徑正確
import { Button } from "@/components/ui/button";
import { useMapStore } from "@/zustand/useMapStore";

export const AdjustTimeSpeedRatio = () => {
  // 改用 Zustand
  const timeScale = useMapStore((state) => state.timeScale)
  const setTimeScale = useMapStore((state) => state.setTimeScale)

  return (
    <div className="flex items-center bg-dash-app border border-dash-border rounded-lg p-1 gap-1">
      <span className="text-[11px] font-bold text-dash-text-faint px-2 uppercase tracking-widest">
        Ratio
      </span>
      
      {[30, 60, 120, 240].map((ratio) => {
        const isActive = timeScale === ratio;
        
        return (
          <Button 
            key={ratio}
            variant="ghost"
            size="sm"
            onClick={() => setTimeScale(ratio)}
            className={`
              h-7 px-2 text-xs font-mono rounded-md transition-all
              ${isActive 
                // 選中時：亮藍綠色背景 + 深色文字
                ? 'bg-dash-accent text-dash-on-accent hover:bg-dash-accent-bright hover:text-dash-on-accent shadow-sm' 
                // 未選中時：暗色文字 + hover 效果
                : 'text-dash-text-muted hover:text-dash-text-strong hover:bg-dash-track'
              }
            `}
          >
            x{ratio}
          </Button>
        );
      })}
    </div>
  );
};