/**
 * bulkCreateIssues.spec.js  —  Stage 1: CSV Import
 *
 * Drives the Zephyr Squad bulk-import wizard to create Jira test issues
 * from a CSV file.  After a successful import it captures the URL of the
 * "Check created issues" page and persists it to link.json so that the
 * next stage (attachFilesParallel.spec.js) can navigate to it directly.
 *
 * Playwright project:  setup
 * Run command:         npx playwright test --project=setup
 */

import { test, chromium, expect } from '@playwright/test';
import HomePage from '../pages/HomePage';
import CreateIssuePage from '../pages/CreateIssuePage';
import BulkCreateSetupPage from '../pages/BulkCreateSetupPage';
import EvidenceFilePage from '../pages/EvidenceFilePage';
import SettingPage from '../pages/SettingPage';
import MappingFieldsPage from '../pages/MappingFieldsPage';
import GetCreatedIssuesPage from '../pages/getCreatedIssuesPage';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// Load environment variables from the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Reads a CSV file and returns its rows as an array of objects.
 * Each row is augmented with null placeholders for testLink and testStatus,
 * which are populated later when the created issues are scraped.
 *
 * @param {string} csvPath - Absolute path to the CSV file.
 * @returns {Promise<Array<object>>} Parsed CSV records with added testLink/testStatus fields.
 * @throws {Error} If the CSV file is empty or contains no data rows.
 */
async function readTestCasesData(csvPath) {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const records = parse(csvContent, {
        columns: (header) => header.map(col => col.trim()), // Trim whitespace from column names
        skip_empty_lines: true,
        trim: true,
        on_record: (record) => ({
            ...record,
            testLink: null,   // To be filled after issues are created in Jira
            testStatus: null  // To be set to 'Created' or 'Not Created' after mapping
        })
    });

    if (records.length === 0) {
        throw new Error(`CSV file ${csvPath} is empty or has no data rows`);
    }
    return records;
}

/**
 * Matches the created Jira issues back to their originating CSV rows by comparing
 * the issue name (Summary field) to the issueName returned by the issues list page.
 *
 * @param {Array<object>} dataFromCSV    - CSV records (from readTestCasesData).
 * @param {Array<{issueName: string, issueLink: string}>} createdIssues - Scraped from Jira.
 * @returns {Promise<Array<object>>} The CSV records with testLink and testStatus populated.
 */
async function mapIssuesCreated(dataFromCSV, createdIssues) {
    for (const record of dataFromCSV) {
        const matchingIssue = createdIssues.find(issue => issue.issueName === record.Summary);
        if (matchingIssue) {
            record.testLink = matchingIssue.issueLink;
            record.testStatus = 'Created';
        } else {
            record.testStatus = 'Not Created';
        }
    }
    return dataFromCSV;
}

// Use the saved browser auth state to avoid needing to log in during the test
test.use({ storageState: 'auth.json' });

test.describe('Import (serial)', () => {
    // Run tests in this describe block sequentially (not in parallel)
    test.describe.configure({ mode: 'serial' });

    test('Import issues', async ({ page }, testInfo) => {
        // Extend timeout — large CSVs take considerable time to import
        await test.setTimeout(500000);

        // Navigate to the Jira home page and wait for the UI to load
        await page.goto(process.env.JIRA_BASE_URL, { waitUntil: 'domcontentloaded' });

        // Read paths from environment variables defined in .env
        const folderPath = process.env.TEST_DATA_PATH;
        const resultsPath = process.env.OUTPUT_PATH;
        const folderName = process.env.FOLDER_NAME;

        // Scan the test data folder for the CSV file to import
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        const csvFile = files
            .filter(f => f.isFile())
            .map(f => f.name)
            .find(name => name.toLowerCase().endsWith('.csv'));

        // ── Step 1: Navigate to Zephyr Squad → Create a Test ──────────────────
        const homePage = new HomePage(page);
        await homePage.createATest();

        // ── Step 2: Click "Import Issues" to open the CSV import wizard ────────
        const createIssuePage = new CreateIssuePage(page);
        await createIssuePage.importIssues();

        // ── Step 3: Upload the CSV file in the wizard's first step ─────────────
        const bulkCreateSetupPage = new BulkCreateSetupPage(page);
        await bulkCreateSetupPage.importIssues(csvFile, folderPath);

        // ── Step 4: Select the target Jira project ─────────────────────────────
        const settingPage = new SettingPage(page);
        await settingPage.updateImportSettings(process.env.JIRA_PROJECT_KEY);

        // ── Step 5: Map CSV columns to Jira fields ─────────────────────────────
        const mappingFieldsPage = new MappingFieldsPage(page);
        const fieldMap = {
            'Description': 'Description',
            'Epic Link': 'Epic Link',
            'Expected Result': 'Expected Result',
            'Issue Type': 'Issue Type',
            'Labels': 'Labels',
            'Priority': 'Priority',
            'Story Link': 'link "TestCase"',
            'Summary': 'Summary'
        };
        await mappingFieldsPage.updateFieldMappings(fieldMap);

        // ── Step 6: Start the actual import ────────────────────────────────────
        await mappingFieldsPage.beginImport();

        // ── Step 7: Verify all CSV rows were imported successfully ─────────────
        const numberOfIssuesSuccessfullyImported = await mappingFieldsPage.getTheNumberOfSuccessfullyMappedIssues();
        const csvRowCount = await mappingFieldsPage.getTheNumberOfIssuesFromCSV(`${folderPath}\\${csvFile}`);
        expect(numberOfIssuesSuccessfullyImported).toBe(csvRowCount);

        // ── Step 8: Navigate to the created issues list and save the URL ───────
        await mappingFieldsPage.clickCheckCreatedIssues();
        const link = page.url();

        // Persist the issues list URL to disk — consumed by attachFilesParallel.spec.js
        const filePath = `link.json`;
        fs.writeFileSync(filePath, JSON.stringify({ link }));
    });
});
