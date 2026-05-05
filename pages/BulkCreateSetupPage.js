/**
 * BulkCreateSetupPage.js
 *
 * Page Object for the first step of the Zephyr Squad CSV import wizard.
 * On this step the user selects the CSV file to import.
 * After the file is chosen and confirmed, clicking "Next" advances
 * the wizard to the project settings step (handled by SettingPage).
 */

import { expect } from '@playwright/test';
import path from 'path';

export default class BulkCreateSetupPage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // "Next" button that advances the wizard to the next step
    this.nextButton = page.locator('#nextButton');
  }

  /**
   * Uploads the CSV file into the import wizard's file input and advances to the next step.
   *
   * @param {string} filePath   - The filename of the CSV (e.g. "test-cases.csv").
   * @param {string} folderPath - Absolute path to the folder containing the CSV.
   *
   * Steps:
   *  1. Builds the full absolute path from folderPath + filePath.
   *  2. Attaches the file to the hidden file input (#csvFile).
   *  3. Waits for the filename to appear on screen to confirm the upload registered.
   *  4. Waits briefly for the UI to settle before clicking Next.
   */
  async importIssues(filePath, folderPath) {
    const testDataPath = path.join(folderPath, filePath);

    // Attach the CSV file to the hidden file input element
    await this.page.locator('#csvFile').setInputFiles(testDataPath);

    // Confirm the filename label appeared, meaning the file was accepted
    await this.page.getByText(filePath).waitFor({ state: 'visible', timeout: 5000 });

    // Allow the UI to finish its post-upload animations before proceeding
    await this.page.waitForTimeout(1500);

    // Advance to the next step of the import wizard
    await this.nextButton.click();
  }
}
