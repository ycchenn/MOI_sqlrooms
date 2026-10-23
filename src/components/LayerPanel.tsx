import { useShallow } from '@sqlrooms/room-shell';

import { LAYER_CONFIG, type LayerId } from '../constants/layers';
import { useMapStore } from '../zustand/useMapStore';
import { useT } from '@/i18n';

export const LayerPanel = () => {
  const { visibleLayers, toggleLayer } = useMapStore(
    useShallow((s) => ({
      visibleLayers: s.visibleLayers,
      toggleLayer: s.toggleLayer,
    })),
  );
  const t = useT();

  return (
    <div className="bg-dash-panel/90 border border-dash-border p-4 rounded-lg text-dash-text-strong flex flex-col gap-3 font-mono shadow-xl backdrop-blur-sm">
      <span className="text-xs font-bold uppercase tracking-wider text-dash-text-muted border-b border-dash-border pb-2">
        {t('layers.title')}
      </span>
      {LAYER_CONFIG.map((layer) => {
        const isChecked = visibleLayers[layer.id] ?? false;
        return (
          <label key={layer.id} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleLayer(layer.id as LayerId)}
              className="accent-dash-accent w-4 h-4 cursor-pointer"
            />
            <span
              className={`text-sm transition-colors ${
                isChecked ? 'text-dash-text-strong' : 'text-dash-text-faint group-hover:text-dash-text-soft'
              }`}
            >
              {t(`layer.${layer.id}`)}
            </span>
          </label>
        );
      })}
    </div>
  );
};
