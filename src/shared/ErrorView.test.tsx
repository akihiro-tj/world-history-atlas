import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorView } from './ErrorView';

describe('ErrorView', () => {
  it('メッセージと再試行ボタンを表示する', () => {
    render(
      <ErrorView message="データの取得に失敗しました" onRetry={() => {}} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'データの取得に失敗しました',
    );
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });

  it('再試行ボタンで onRetry が呼ばれる', async () => {
    const onRetry = vi.fn();
    render(<ErrorView message="失敗" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
