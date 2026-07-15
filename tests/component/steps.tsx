import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { expect, vi } from 'vitest';
import { App } from '../../src/app/App';
import { isWebgl2Supported } from '../../src/shared/webgl';
import { createRegistry } from '../spec-runner/registry';
import { fetchControl, mapErrorHandlerRef, mapHandlers } from './mocks';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markerSelector(kind: 'city' | 'terrain', name: string): string {
  return `button[data-marker-kind="${kind}"][aria-label="${name}"]`;
}

async function findMarker(
  kind: 'city' | 'terrain',
  name: string,
): Promise<HTMLElement> {
  return await waitFor(() => {
    const element = document.querySelector(markerSelector(kind, name));
    if (!element) throw new Error(`マーカーが見つからない: ${name}`);
    return element as HTMLElement;
  });
}

async function selectThemeByName(name: string): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: new RegExp(escapeRegExp(name)) }),
  );
}

function renderApp(): void {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

function stubMatchMedia(matches: (query: string) => boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: matches(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

export const registry = createRegistry<Record<string, never>>();

registry.phrase(/^アプリを開いている$/, () => {
  renderApp();
});

registry.phrase(/^クエリ「(.+)」でアプリを開いている$/, (_ctx, query) => {
  window.history.replaceState(null, '', `/${query}`);
  renderApp();
});

registry.phrase(/^モバイル幅である$/, () => {
  stubMatchMedia((query) => query === '(max-width: 767px)');
});

registry.phrase(/^OS のカラースキームがダークである$/, () => {
  stubMatchMedia((query) => query === '(prefers-color-scheme: dark)');
});

registry.phrase(/^WebGL2 に対応していない環境である$/, () => {
  vi.mocked(isWebgl2Supported).mockReturnValue(false);
});

registry.phrase(/^マニフェストの取得が失敗する状態である$/, () => {
  fetchControl.manifest = 'fail';
});

registry.phrase(/^テーマ一覧の取得が失敗する状態である$/, () => {
  fetchControl.themeIndex = 'fail';
});

registry.phrase(/^テーマ本体の取得が失敗する状態である$/, () => {
  fetchControl.themeBody = 'fail';
});

registry.phrase(
  /^テーマ「(.+)」を選択(?:する|している)$/,
  async (_ctx, name) => {
    await selectThemeByName(name);
  },
);

registry.phrase(
  /^都市マーカー「(.+)」を(?:クリックする|選択している)$/,
  async (_ctx, name) => {
    await userEvent.click(await findMarker('city', name));
  },
);

registry.phrase(
  /^都市マーカー「(.+)」が表示されている$/,
  async (_ctx, name) => {
    await findMarker('city', name);
  },
);

registry.phrase(
  /^都市マーカー「(.+)」が表示されていない$/,
  async (_ctx, name) => {
    await waitFor(() =>
      expect(document.querySelector(markerSelector('city', name))).toBeNull(),
    );
  },
);

registry.phrase(
  /^頻出度フィルタを「(.+)」に切り替える$/,
  async (_ctx, label) => {
    const group = await screen.findByRole('group', { name: '頻出度フィルタ' });
    await userEvent.click(within(group).getByRole('button', { name: label }));
  },
);

registry.phrase(/^解説パネルの閉じるボタンをクリックする$/, async () => {
  const panel = await screen.findByTestId('detail-panel');
  await userEvent.click(within(panel).getByRole('button', { name: '閉じる' }));
});

registry.phrase(/^地図の余白をクリックする$/, async () => {
  await waitFor(() => {
    if (!mapHandlers.get('click'))
      throw new Error('地図の click ハンドラが未登録');
  });
  act(() => {
    mapHandlers.get('click')?.();
  });
});

registry.phrase(/^メニューボタンでドロワーを開く$/, async () => {
  await userEvent.click(
    await screen.findByRole('button', { name: 'テーマ一覧を開く' }),
  );
});

registry.phrase(/^カラーテーマトグルをクリックする$/, async () => {
  await userEvent.click(
    await screen.findByRole('button', { name: 'カラーテーマを切り替える' }),
  );
});

registry.phrase(/^データ取得を正常に戻す$/, async () => {
  // Wait until the failure surfaces before restoring, so a deferred fetch
  // (the theme index runs only after the manifest resolves) fails first.
  await screen.findByRole('alert');
  fetchControl.manifest = 'ok';
  fetchControl.themeIndex = 'ok';
  fetchControl.themeBody = 'ok';
});

registry.phrase(/^再試行ボタンをクリックする$/, async () => {
  await userEvent.click(await screen.findByRole('button', { name: '再試行' }));
});

registry.phrase(/^地図の読み込みエラーが発生する$/, async () => {
  await screen.findByTestId('map-view');
  await waitFor(() => {
    if (!mapErrorHandlerRef.current) {
      throw new Error('地図の onError ハンドラが未登録');
    }
  });
  act(() => {
    mapErrorHandlerRef.current?.('地図の読み込みに失敗しました');
  });
});

registry.phrase(/^地図の代わりに非対応の案内が表示されている$/, async () => {
  expect(await screen.findByText(/WebGL2/)).toBeInTheDocument();
  expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
});

registry.phrase(/^テーマ選択を促すメッセージが表示されている$/, async () => {
  expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
});

registry.phrase(/^テーマ選択を促すメッセージが表示されていない$/, async () => {
  await waitFor(() =>
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument(),
  );
});

registry.phrase(
  /^URL のクエリが「(.+)」を含んでいる$/,
  async (_ctx, fragment) => {
    await waitFor(() => expect(window.location.search).toContain(fragment));
  },
);

registry.phrase(/^URL から theme パラメータが除去されている$/, async () => {
  await waitFor(() =>
    expect(new URLSearchParams(window.location.search).has('theme')).toBe(
      false,
    ),
  );
});

registry.phrase(
  /^サイドバーにテーマ「(.+)」が表示されている$/,
  async (_ctx, name) => {
    expect(
      await screen.findByRole('button', {
        name: new RegExp(escapeRegExp(name)),
      }),
    ).toBeInTheDocument();
  },
);

registry.phrase(
  /^サイドバーのテーマが「(.+)」の順に並んでいる$/,
  async (_ctx, order) => {
    const nav = await screen.findByRole('navigation', { name: 'テーマ一覧' });
    await waitFor(() => {
      const titles = within(nav)
        .getAllByRole('button')
        .map((button) => button.querySelector('span')?.textContent ?? '');
      expect(titles).toEqual(order.split(','));
    });
  },
);

registry.phrase(
  /^解説パネルに「(.+)」と表示されている$/,
  async (_ctx, text) => {
    expect(await screen.findByTestId('detail-panel')).toHaveTextContent(text);
  },
);

registry.phrase(/^解説パネルが表示されていない$/, async () => {
  await waitFor(() =>
    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument(),
  );
});

registry.phrase(/^ダークテーマが適用されている$/, async () => {
  await waitFor(() =>
    expect(document.documentElement).toHaveAttribute(
      'data-color-theme',
      'dark',
    ),
  );
});

registry.phrase(/^再試行ボタンが表示されている$/, async () => {
  expect(
    await screen.findByRole('button', { name: '再試行' }),
  ).toBeInTheDocument();
});

registry.phrase(
  /^エラーメッセージ「(.+)」が表示されている$/,
  async (_ctx, message) => {
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  },
);

registry.phrase(/^エラーメッセージが表示されていない$/, async () => {
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
});

registry.phrase(/^ドロワーが閉じている$/, async () => {
  expect(
    await screen.findByRole('button', { name: 'テーマ一覧を開く' }),
  ).toHaveAttribute('aria-expanded', 'false');
});

registry.phrase(/^ドロワーが開いている$/, async () => {
  expect(
    await screen.findByRole('button', { name: 'テーマ一覧を開く' }),
  ).toHaveAttribute('aria-expanded', 'true');
});

registry.phrase(/^サイドバーが操作不能になっている$/, async () => {
  expect(await screen.findByRole('complementary')).toHaveAttribute('inert');
});
