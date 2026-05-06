/**
 * bulkCreateIssues.spec.js
 *
 * ONLY UI-driven stage remaining.
 *
 * Uses the Zephyr/Jira CSV import wizard because
 * custom fields + test case imports are not fully
 * supported through public Jira REST APIs.
 *
 * After import completes:
 * - saves the created issues page URL
 * - later API stages consume that data
 */

import { test, expect } from '@playwright/test';

import HomePage from '../pages/HomePage';
import CreateIssuePage from '../pages/CreateIssuePage';
import BulkCreateSetupPage from '../pages/BulkCreateSetupPage';
import SettingPage from '../pages/SettingPage';
import MappingFieldsPage from '../pages/MappingFieldsPage';

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// ─────────────────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────────────────

dotenv.config({
    path: path.resolve(__dirname, '../.env')
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST
// ─────────────────────────────────────────────────────────────────────────────

test.use({
    storageState: 'auth.json'
});

test.describe('Import Issues (UI Only)', () => {

    test.describe.configure({
        mode: 'serial'
    });

    test('Import issues through Zephyr CSV wizard', async ({ page }) => {

        test.setTimeout(500000);

        // ─────────────────────────────────────────────────────────────────────
        // PATHS
        // ─────────────────────────────────────────────────────────────────────

        const folderPath = process.env.TEST_DATA_PATH;

        const files = fs.readdirSync(
            folderPath,
            { withFileTypes: true }
        );

        const csvFile = files
            .filter(f => f.isFile())
            .map(f => f.name)
            .find(name =>
                name.toLowerCase().endsWith('.csv')
            );

        if (!csvFile) {
            throw new Error(
                `No CSV file found in ${folderPath}`
            );
        }

        // ─────────────────────────────────────────────────────────────────────
        // OPEN JIRA
        // ─────────────────────────────────────────────────────────────────────

        await page.goto(
            process.env.JIRA_BASE_URL,
            {
                waitUntil: 'domcontentloaded'
            }
        );
        await page.waitForTimeout(3000);

        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: CREATE TEST
        // ─────────────────────────────────────────────────────────────────────

        const homePage = new HomePage(page);

        await homePage.createATest();

        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: OPEN IMPORT WIZARD
        // ─────────────────────────────────────────────────────────────────────

        const createIssuePage = new CreateIssuePage(page);

        await createIssuePage.importIssues();

        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: UPLOAD CSV
        // ─────────────────────────────────────────────────────────────────────

        const bulkCreateSetupPage =
            new BulkCreateSetupPage(page);

        await bulkCreateSetupPage.importIssues(
            csvFile,
            folderPath
        );

        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: CONFIGURE PROJECT
        // ─────────────────────────────────────────────────────────────────────

        const settingPage = new SettingPage(page);

        await settingPage.updateImportSettings(
            process.env.JIRA_PROJECT_KEY
        );

        // ─────────────────────────────────────────────────────────────────────
        // STEP 5: MAP FIELDS
        // ─────────────────────────────────────────────────────────────────────

        const mappingFieldsPage =
            new MappingFieldsPage(page);

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

        await mappingFieldsPage.updateFieldMappings(
            fieldMap
        );

        // ─────────────────────────────────────────────────────────────────────
        // STEP 6: BEGIN IMPORT
        // ─────────────────────────────────────────────────────────────────────

        await mappingFieldsPage.beginImport();

        // ─────────────────────────────────────────────────────────────────────
        // STEP 7: VERIFY IMPORT COUNT
        // ─────────────────────────────────────────────────────────────────────

        const successfullyImported =
            await mappingFieldsPage
                .getTheNumberOfSuccessfullyMappedIssues();

        const csvRowCount =
            await mappingFieldsPage
                .getTheNumberOfIssuesFromCSV(
                    `${folderPath}\\${csvFile}`
                );

        expect(successfullyImported)
            .toBe(csvRowCount);

        // ─────────────────────────────────────────────────────────────────────
        // STEP 8: OPEN CREATED ISSUES PAGE
        // ─────────────────────────────────────────────────────────────────────

        await mappingFieldsPage
            .clickCheckCreatedIssues();

        const link = page.url();

        // ─────────────────────────────────────────────────────────────────────
        // SAVE LINK.JSON
        // ─────────────────────────────────────────────────────────────────────

        const linkFilePath = path.resolve(
            __dirname,
            '../link.json'
        );

        fs.writeFileSync(
            linkFilePath,
            JSON.stringify(
                {
                    link,
                    createdAt: new Date().toISOString()
                },
                null,
                2
            ),
            'utf8'
        );

        console.log(
            `link.json written to ${linkFilePath}`
        );

        console.log(
            `Created issues page: ${link}`
        );
    });
});