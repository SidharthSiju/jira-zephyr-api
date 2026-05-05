/**
 * EvidenceFilePage.js
 *
 * Page Object for individual Jira issue pages.
 * Handles attaching a .docx evidence file to the issue and setting
 * the test status to Pass or Fail depending on whether the file exists.
 *
 * Note: This class is used by the sequential evidence upload flow.
 * The parallel flow in uploadEvidence.spec.js performs the same steps inline.
 */

import { expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

export default class EvidenceFilePage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // The "+" / Add button that opens the quick-add dropdown (attachment, link, etc.)
    this.dropdownTrigger = page.getByTestId(
      'issue-view-foundation.quick-add.quick-add-items-compact.add-button-dropdown--trigger'
    );

    // The "Add Attachment" option inside the quick-add dropdown
    this.addAttachmentButton = page.getByTestId(
      'issue.issue-view.views.issue-base.foundation.quick-add.quick-add-item.add-attachment'
    );

    // The issue status field button (shows the current status, e.g. "To Do")
    this.statusButton = page.getByTestId(
      'issue-field-status.ui.status-view.status-button.status-button'
    );

    // "Pass" status option in the status transition dropdown
    // .last() targets the Pass option (index 3 lozenges, last = Pass)
    this.passButton = page.getByTestId(
      'issue.fields.status.common.ui.status-lozenge.3'
    ).last();

    // "Fail" status option in the status transition dropdown
    // .first() targets the first lozenge at index 3 (Fail)
    this.failButton = page.getByTestId(
      'issue.fields.status.common.ui.status-lozenge.3'
    ).first();
  }

  /**
   * Returns a locator for the uploaded file's name link on the issue page.
   * Used to confirm that the attachment was successfully uploaded.
   *
   * @param {string} fileName - The filename to look for (e.g. "My Test Case.docx").
   * @returns {import('@playwright/test').Locator}
   */
  locateFileName(fileName) {
    return this.page.locator(`text=${fileName}`).first();
  }

  /**
   * Iterates over a list of issue records, navigates to each issue, attaches
   * the corresponding .docx evidence file, and sets the test status accordingly.
   *
   * @param {Array<{ Summary: string, testLink: string, testStatus: string }>} scenarioMap
   *   Array of issue records (from issues.json). Each record must have:
   *     - Summary:    The issue name (used to build the expected filename).
   *     - testLink:   The absolute URL of the Jira issue.
   *     - testStatus: Set to 'Created' for issues that should be processed.
   *
   * @param {string} folderPath - Absolute path to the folder containing .docx evidence files.
   *
   * Behaviour per record:
   *  - Skips records whose testStatus is not 'Created'.
   *  - If the matching .docx file exists: attaches it and sets status to Pass.
   *  - If the matching .docx file is missing: sets testStatus to 'Fail' and marks the issue as Failed.
   */
  async attachEvidenceFilesToIssues(scenarioMap, folderPath) {
    for (const record of scenarioMap) {
      // Skip issues that were not successfully created during the import step
      if (record.testStatus !== 'Created') continue;

      // Navigate to the individual issue page
      await this.page.goto(record.testLink);
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000); // Allow the dynamic issue page to fully render

      // Open the quick-add dropdown to reveal the attachment option
      await this.dropdownTrigger.click();
      await this.addAttachmentButton.waitFor({ state: 'visible' });

      // Trigger the file chooser dialog by clicking "Add Attachment"
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser'),
        this.addAttachmentButton.click()
      ]);

      // Evidence files are expected to be named exactly as the issue Summary + .docx
      const fileName = `${record.Summary}.docx`;
      const filePath = path.join(folderPath, fileName);

      if (fs.existsSync(filePath)) {
        // File found — attach it and mark the record as passed
        await fileChooser.setFiles(filePath);
        record.testStatus = 'Pass';
      } else {
        // File missing — mark as failed and set the Jira status to Failed
        record.testStatus = 'Fail';
        await this.statusButton.click();
        await this.failButton.click();
        continue; // Skip to the next record
      }

      // Wait for the filename to appear in the attachments section as upload confirmation
      await this.locateFileName(fileName).waitFor({ timeout: 30000 });

      // Set the Jira issue status to Pass
      await this.statusButton.click();
      await this.passButton.click();
    }
  }
}
