import { When } from './fixtures';

When(
  /^頻出度フィルタを「(.+)」に切り替える$/,
  async ({ page }, label: string) => {
    await page
      .getByRole('group', { name: '頻出度フィルタ' })
      .getByRole('button', { name: label })
      .click();
  },
);
