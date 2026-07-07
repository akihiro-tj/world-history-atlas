type ErrorViewProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded bg-white/90 p-4 shadow dark:bg-slate-800/90"
    >
      <p className="text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-sky-600 px-4 py-1.5 text-sm text-white hover:bg-sky-700"
      >
        再試行
      </button>
    </div>
  );
}
