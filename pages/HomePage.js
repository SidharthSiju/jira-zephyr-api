/**
 * HomePage.js
 *
 * Page Object for the Jira top navigation bar.
 * Responsible for navigating from the Jira home screen into the
 * Zephyr Squad plugin and reaching the "Create a Test" entry point.
 */

import { expect } from '@playwright/test';
import { retryAction } from '../utils/retryHelper';

export default class HomePage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // Top navigation "Apps" menu trigger
    this.appsLink = page.getByText('Apps', { exact: true });

    // Zephyr Squad item inside the Apps dropdown
    this.zephyrSquadLink = page.getByText('Zephyr Squad', { exact: true });

    // "Create a Test" link inside the Zephyr Squad submenu
    this.createTestLink = page.getByText('Create a Test', { exact: true });
  }

  /**
   * Waits for the DOM to finish loading before interacting with the page.
   * Should be called at the start of any action sequence.
   */
  async waitForJiraToLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigates through the Jira top nav to the Zephyr Squad "Create a Test" page.
   *
   * Uses retryAction for both the "Apps" click and the "Zephyr Squad" click
   * because Jira's navigation menus can open and close unpredictably due to
   * lazy rendering and dropdown animations.
   */
  async createATest() {
    await this.waitForJiraToLoad();

    // Wait for the Apps link to be visible before attempting to click
    await this.appsLink.waitFor({ state: 'visible', timeout: 15000 });

    // Click "Apps" and retry until the Zephyr Squad option becomes visible
    await retryAction({
      action: async () => {
        await this.appsLink.click();
      },
      successCheck: async () => {
        return await this.zephyrSquadLink.isVisible();
      },
    });

    // Click "Zephyr Squad" and retry until "Create a Test" becomes visible
    await retryAction({
      action: async () => {
        await this.zephyrSquadLink.click();
      },
      successCheck: async () => {
        return await this.createTestLink.isVisible();
      },
    });

    // Click "Create a Test" to open the import/creation wizard
    await this.createTestLink.click();
  }
}
