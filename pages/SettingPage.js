/**
 * SettingPage.js
 *
 * Page Object for the second step of the Zephyr Squad CSV import wizard.
 * On this step the user selects which Jira project the imported issues
 * should be created in.
 */

import { expect } from '@playwright/test';

export default class SettingPage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // The project selector dropdown (single-select)
    this.importToProject = page.locator('#CSV-select-single-select');

    // "Next" button that advances the wizard to the field-mapping step
    this.nextButton = page.locator('#nextButton');
  }

  /**
   * Types the project key/label into the project selector and advances the wizard.
   *
   * @param {string} importToProjectLabel - The Jira project key or name to type
   *                                        into the selector (e.g. "OKW_FMO_ADM_QA_21_25").
   *
   * Steps:
   *  1. Focuses the project input field and types the label.
   *  2. Presses Enter to confirm the selection in the autocomplete dropdown.
   *  3. Clicks Next to advance to field mapping.
   */
  async updateImportSettings(importToProjectLabel) {
    const importField = this.page.locator('#CSV-select-field');

    // Type the project label to filter the dropdown options
    await importField.fill(importToProjectLabel);

    // Confirm the selection (accepts the highlighted autocomplete suggestion)
    await importField.press('Enter');

    // Advance to the field mapping step
    await this.nextButton.click();
  }
}
