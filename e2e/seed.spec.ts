import { openApp, test } from './fixtures';

test('seed', async ({ page }) => {
  await openApp(page);
});
