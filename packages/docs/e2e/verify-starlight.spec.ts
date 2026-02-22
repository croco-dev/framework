import path from 'node:path';
import { expect, test } from '@playwright/test';

test('verify starlight page', async ({ page }) => {
  await page.goto('http://localhost:4321');

  await expect(page).toHaveTitle(/Croco Framework Documentation/);

  const screenshotPath = path.resolve(process.cwd(), '../../.sisyphus/evidence/task-1-index-page.png');
  console.log(`Saving screenshot to: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath });
});
