export type PhraseHandler<Ctx> = (
  ctx: Ctx,
  ...args: string[]
) => Promise<void> | void;

export function createRegistry<Ctx>() {
  const entries: { pattern: RegExp; handler: PhraseHandler<Ctx> }[] = [];
  return {
    phrase(pattern: RegExp, handler: PhraseHandler<Ctx>) {
      entries.push({ pattern, handler });
    },
    resolves(text: string): boolean {
      return entries.some((entry) => entry.pattern.test(text));
    },
    async run(ctx: Ctx, text: string) {
      for (const entry of entries) {
        const matched = text.match(entry.pattern);
        if (matched) {
          await entry.handler(ctx, ...matched.slice(1));
          return;
        }
      }
      throw new Error(`未定義のフレーズ: ${text}`);
    },
  };
}
