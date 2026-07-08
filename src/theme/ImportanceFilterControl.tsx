import type { ImportanceFilter } from './filter';

const OPTIONS: { value: ImportanceFilter; label: string }[] = [
  { value: 1, label: '★1のみ' },
  { value: 2, label: '★1〜2' },
  { value: 3, label: 'すべて' },
];

type ImportanceFilterControlProps = {
  value: ImportanceFilter;
  onChange: (value: ImportanceFilter) => void;
};

export function ImportanceFilterControl({
  value,
  onChange,
}: ImportanceFilterControlProps) {
  return (
    <fieldset
      aria-label="頻出度フィルタ"
      className="m-0 flex overflow-hidden rounded-lg border-0 bg-white p-0 shadow dark:bg-slate-800"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="px-3 py-1.5 text-sm aria-pressed:bg-sky-600 aria-pressed:text-white"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
