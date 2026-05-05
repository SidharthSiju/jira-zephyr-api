/**
 * MappingFieldsPage.js
 *
 * Page Object for the third step of the Zephyr Squad CSV import wizard — field mapping.
 * On this step each column from the CSV is mapped to a corresponding Jira field.
 * After mapping, the user triggers the actual import and waits for a success message.
 */

import { expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

export default class MappingFieldsPage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // Shared "Next" / "Begin Import" button (same element ID used across wizard steps)
    this.nextButton = page.locator('#nextButton');
    this.beginMappingButton = page.locator('#nextButton');
  }

  /**
   * Waits for the DOM to finish loading before interacting with the page.
   */
  async waitForJiraToLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Fills in the field-mapping dropdowns for each CSV column.
   *
   * @param {Record<string, string>} fieldMap - An object where each key is a CSV
   *   column name and each value is the Jira field to map it to.
   *   Example: { 'Summary': 'Summary', 'Priority': 'Priority' }
   *
   * For each entry the function:
   *  1. Finds the table row that contains the CSV column name using an XPath locator.
   *  2. Targets the autocomplete input inside that row.
   *  3. Types the desired Jira field name and presses Enter to confirm.
   *
   * After all mappings are set, clicks Next to proceed to the "Begin Import" step.
   */
  async updateFieldMappings(fieldMap) {
    await this.waitForJiraToLoad();

    for (const [columnName, mappingValue] of Object.entries(fieldMap)) {
      // Locate the table row containing this CSV column name via XPath
      const row = this.page.locator("//span[text()='" + columnName + "']/../..");

      // Find the mapping dropdown/autocomplete input inside the row
      const dropdown = row.locator('.field-group input');

      // Type and confirm the Jira field name
      await dropdown.fill(mappingValue);
      await dropdown.press('Enter');
    }

    // Advance to the "Begin Import" confirmation step
    await this.nextButton.click();
  }

  /**
   * Clicks the "Begin Import" button to start the actual Jira issue creation.
   * This is the final confirmation step after field mapping.
   */
  async beginImport() {
    await this.beginMappingButton.click();
  }

  /**
   * Reads the success banner after the import completes and extracts the count
   * of successfully created issues.
   *
   * @returns {Promise<number|null>} The number of successfully imported issues,
   *   or null if the count could not be parsed from the message.
   *
   * Waits up to 60 seconds for the success message — large imports can be slow.
   */
  async getTheNumberOfSuccessfullyMappedIssues() {
    const successLocator = this.page.locator('.aui-message-success');

    // Large CSV files may take a while to import — extend the timeout
    await successLocator.waitFor({
      state: 'visible',
      timeout: 180000
    });

    const successMessage = await successLocator.innerText();

    // Extract the number from messages like "Successfully imported 42 work items"
    const match = successMessage.match(/(\d+)\s+work items/);
    const result = match ? Number(match[1]) : null;
    console.log(`Issues successfully imported: ${result}`);
    return result;
  }

  /**
   * Counts the data rows in a CSV file (excluding the header row).
   * Used to verify that the number of imported issues matches the CSV row count.
   *
   * @param {string} csvPath - Absolute path to the CSV file.
   * @returns {Promise<number>} Number of data rows in the CSV.
   */
  async getTheNumberOfIssuesFromCSV(csvPath) {
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // Parse without treating the first row as headers (raw array of arrays)
    const records = parse(csvContent, { headers: true });

    // Subtract 1 to exclude the header row from the count
    return records.length - 1;
  }

  /**
   * Clicks the "Check created issues." link that appears after a successful import.
   * This navigates to the Jira issue list filtered to the newly created issues.
   *
   * Waits 5 seconds first to ensure the import result page has fully rendered.
   */
  async clickCheckCreatedIssues() {
    await this.page.waitForTimeout(5000);
    await this.page.locator('a', { hasText: 'Check created issues.' }).click();
  }
}
