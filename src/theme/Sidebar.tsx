import type { ThemeIndexEntry } from './schema';

type SidebarProps = {
  entries: readonly ThemeIndexEntry[];
  selectedThemeId: string | undefined;
  onSelectTheme: (id: string) => void;
};

export function Sidebar({
  entries,
  selectedThemeId,
  onSelectTheme,
}: SidebarProps) {
  const sortedEntries = [...entries].sort((a, b) => a.order - b.order);
  return (
    <nav aria-label="テーマ一覧">
      <ul>
        {sortedEntries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelectTheme(entry.id)}
              aria-current={entry.id === selectedThemeId ? 'true' : undefined}
              className="block w-full px-4 py-3 text-left hover:bg-slate-100 aria-[current=true]:bg-sky-100 dark:hover:bg-slate-800 dark:aria-[current=true]:bg-sky-900"
            >
              <span className="block font-medium">{entry.title}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {entry.era}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
