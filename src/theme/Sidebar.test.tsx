import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const entries = [
  {
    id: 'ancient-greece',
    title: '古代ギリシア',
    era: '前800年頃〜前338年',
    order: 2,
  },
  {
    id: 'ancient-orient',
    title: '古代オリエント',
    era: '前3000年頃〜前330年',
    order: 1,
  },
];

describe('Sidebar', () => {
  it('テーマを order 順に表示する', () => {
    render(
      <Sidebar
        entries={entries}
        selectedThemeId={undefined}
        onSelectTheme={() => {}}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('古代オリエント');
    expect(buttons[1]).toHaveTextContent('古代ギリシア');
  });

  it('クリックで onSelectTheme が呼ばれる', async () => {
    const onSelectTheme = vi.fn();
    render(
      <Sidebar
        entries={entries}
        selectedThemeId={undefined}
        onSelectTheme={onSelectTheme}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /古代オリエント/ }),
    );
    expect(onSelectTheme).toHaveBeenCalledWith('ancient-orient');
  });

  it('選択中のテーマに aria-current が付く', () => {
    render(
      <Sidebar
        entries={entries}
        selectedThemeId="ancient-orient"
        onSelectTheme={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /古代オリエント/ }),
    ).toHaveAttribute('aria-current', 'true');
  });
});
