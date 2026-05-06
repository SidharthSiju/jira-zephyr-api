/**
 * CreateIssuePage.js
 *
 * Page Object for the Zephyr Squad "Create a Test" landing page.
 * This page appears after navigating via Apps → Zephyr Squad → Create a Test
 * and presents options including "Import Issues from CSV".
 */

import { expect } from '@playwright/test';

export default class CreateIssuePage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // The "Import Issues" button/link that launches the CSV bulk-import wizard
    this.importIssuesLocator = page.locator('#import-issues');
  }

  /**
   * Clicks the "Import Issues" button to open the CSV import wizard.
   * Waits up to 15 seconds for the button to become visible first,
   * as the page may still be loading when this is called.
   */
  async importIssues() {
    await this.importIssuesLocator.waitFor({ state: 'visible', timeout: 30000 });
    await this.importIssuesLocator.click();
  }
}
