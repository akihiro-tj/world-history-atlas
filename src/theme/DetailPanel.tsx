import { featureKindLabel } from './labels';
import type { ThemeFeature } from './schema';

type DetailPanelProps = {
  feature: ThemeFeature;
  onClose: () => void;
};

export function DetailPanel({ feature, onClose }: DetailPanelProps) {
  return (
    <section
      data-testid="detail-panel"
      aria-label={feature.name}
      className="absolute z-20 bg-white shadow-lg max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-xl max-md:p-4 md:top-0 md:right-0 md:h-full md:w-80 md:overflow-y-auto md:p-6"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold">{feature.name}</h2>
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="rounded p-1 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 flex gap-2 text-sm text-slate-500">
        <span>{featureKindLabel(feature)}</span>
        <span>{`★${feature.importance}`}</span>
      </p>
      <p className="mt-3 leading-relaxed">{feature.description}</p>
    </section>
  );
}
