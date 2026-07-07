import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportanceFilterControl } from './ImportanceFilterControl';

describe('ImportanceFilterControl', () => {
  it('3 段階の選択肢を表示する', () => {
    render(<ImportanceFilterControl value={3} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '★1のみ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '★1〜2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'すべて' })).toBeInTheDocument();
  });

  it('選択中の値に aria-pressed が付く', () => {
    render(<ImportanceFilterControl value={1} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '★1のみ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('クリックで onChange が呼ばれる', async () => {
    const onChange = vi.fn();
    render(<ImportanceFilterControl value={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '★1〜2' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
