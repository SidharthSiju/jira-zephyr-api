/**
 * GetCreatedIssuesPage.js
 *
 * Page Object for the Jira issue list view that appears after a successful
 * bulk import. This page scrapes the name and URL of every issue in the list
 * so they can be matched back to their corresponding CSV rows.
 */

import { expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

export default class GetCreatedIssuesPage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // All rows in the native issue table (used for counting)
    this.rows = page.locator('[data-vc="issue-table"] tr');

    // Cell containing the clickable issue key link (e.g. "KAL-123")
    this.issueLinkLocator = '[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]';

    // Cell containing the issue summary/name text
    this.issueNameLocator = '[data-testid="native-issue-table.common.ui.issue-cells.issue-summary.issue-summary-cell"]';
  }

  /**
   * Refreshes the issue list and scrapes the name and absolute URL of each issue row.
   *
   * @returns {Promise<Array<{ issueName: string, issueLink: string }>>}
   *   An array of objects, one per issue, containing:
   *     - issueName: the issue summary text (used to match against CSV rows)
   *     - issueLink: the full absolute URL to the issue (used in the evidence upload step)
   *
   * Approach:
   *  1. Clicks the refresh button to ensure the list reflects the latest import.
   *  2. Waits 5 seconds for the table to re-render after refresh.
   *  3. Iterates over every tbody row, extracting the link href and summary text.
   *  4. Converts relative hrefs to absolute URLs by prepending the base domain.
   */
  async getIssueRows() {
    // Refresh the list to ensure all newly imported issues are shown
    await this.page.locator('[data-testid="issue-navigator.common.ui.refresh-button.refresh-button"]').click();
    await this.page.waitForTimeout(5000);

    // Count the number of data rows in the table body
    const count = await this.page.locator('[data-vc="issue-table"] tbody tr').count();
    console.log(`Total number of issue rows: ${count}`);

    const issues = [];

    for (let i = 0; i < count; i++) {
      const row = this.page.locator('[data-vc="issue-table"] tbody tr').nth(i);

      // Extract the href attribute from the issue key cell
      let issueLink = await row.locator(this.issueLinkLocator).first().getAttribute('href');

      if (!issueLink) {
        throw new Error(`Unable to find link of issue created`);
      }

      // The href may be relative — prepend the base URL to make it absolute
      issueLink = 'https://okducagile.atlassian.net/' + issueLink;

      // Extract and trim the issue summary text from the name cell
      const issueNameLocator = row.locator(this.issueNameLocator).first();
      const issueName = (await issueNameLocator.innerText()).trim();

      console.log(`${i} Issue Name: ${issueName}`);
      console.log(`${i} Issue Link: ${issueLink}`);

      issues.push({ issueName, issueLink });
    }

    return issues;
  }
}
