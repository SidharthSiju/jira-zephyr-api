import { expect } from '@playwright/test';

export default class PlaywrightHomePage {
  constructor(page) {
    this.page = page;
    this.url = 'https://playwright.dev/';
    this.getStartedLink = page.getByRole('link', { name: 'Get started' });
    this.installationHeading = page.getByRole('heading', { name: 'Installation' });
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickGetStarted() {
    await this.getStartedLink.click();
  }

  async expectTitleContainsPlaywright() {
    await expect(this.page).toHaveTitle(/Playwright/);
  }

  async expectInstallationHeadingVisible() {
    await expect(this.installationHeading).toBeVisible();
  }
}
