/**
 * attachFilesParallel.spec.js  —  Stage 2: Collect Created Issue Links
 *
 * Reads the issues list URL saved by Stage 1 (link.json), navigates to it,
 * scrolls through the full virtual list to collect every issue, matches each
 * issue back to its CSV row, and writes issues.json for Stage 3.
 */

import { test, expect } from '@playwright/test';
import GetCreatedIssuesPage from '../pages/GetCreatedIssuesPage';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Resolve file paths relative to the project root (where playwright.config.js lives)
// Using __dirname (tests/) + '..' gives us the project root reliably regardless
// of where the `npx playwright test` command is invoked from.
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function readTestCasesData(csvPath) {
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const records = parse(csvContent, {
    columns: (header) => header.map(col => col.trim()),
    skip_empty_lines: true,
    trim: true,
    on_record: (record) => ({ ...record, testLink: null, testStatus: null })
  });
  if (records.length === 0) throw new Error(`CSV file is empty: ${csvPath}`);
  return records;
}

async function mapIssuesCreated(dataFromCSV, createdIssues) {
  for (const record of dataFromCSV) {
    const match = createdIssues.find(issue => issue.issueName === record.Summary);
    if (match) {
      record.testLink = match.issueLink;
      record.testStatus = 'Created';
    } else {
      record.testStatus = 'Not Created';
    }
  }
  return dataFromCSV;
}

test.use({ storageState: 'auth.json' });

test.describe('Get scenarios', () => {
  test.describe.configure({ mode: 'serial' });

  test('Collect created issue links', async ({ page }) => {
    test.setTimeout(500000);

    const folderPath = process.env.TEST_DATA_PATH;

    // ── Find the CSV ───────────────────────────────────────────────────────────
    const csvFile = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile())
      .map(f => f.name)
      .find(name => name.toLowerCase().endsWith('.csv'));

    if (!csvFile) throw new Error(`No CSV file found in: ${folderPath}`);

    // ── Read link.json from the project root ───────────────────────────────────
    const linkFilePath = path.join(PROJECT_ROOT, 'link.json');
    if (!fs.existsSync(linkFilePath)) {
      throw new Error(`link.json not found at ${linkFilePath} — has Stage 1 run?`);
    }
    const { link } = JSON.parse(fs.readFileSync(linkFilePath, 'utf8'));

    // ── Navigate and wait for the issue table to be fully ready ───────────────
    // 'networkidle' ensures Jira's async panel loading has settled before we
    // try to interact with the table or scroll container.
    await page.goto(link);

    // Wait for the table body to contain at least one row before proceeding
    await page.locator('[data-vc="issue-table"] tbody tr').first()
      .waitFor({ state: 'visible', timeout: 30000 });

    // Extra settle time — Jira continues rendering rows after the first one appears
    await page.waitForTimeout(3000);

    // ── Scrape all issues via scroll-and-collect ───────────────────────────────
    const getCreatedIssuesPage = new GetCreatedIssuesPage(page);
    const createdIssues = await getCreatedIssuesPage.getIssueRows();

    if (createdIssues.length === 0) {
      throw new Error('No issues were scraped — check the table locators or the link.json URL');
    }

    // ── Match back to CSV rows ─────────────────────────────────────────────────
    const dataFromCSV = await readTestCasesData(path.join(folderPath, csvFile));
    const scenarioMap = await mapIssuesCreated(dataFromCSV, createdIssues);

    const notCreated = scenarioMap.filter(r => r.testStatus === 'Not Created');
    if (notCreated.length > 0) {
      console.warn(`⚠ ${notCreated.length} CSV rows had no matching Jira issue:`);
      notCreated.forEach(r => console.warn(`  - ${r.Summary}`));
    }

    // ── Write issues.json to the project root ──────────────────────────────────
    const issuesFilePath = path.join(PROJECT_ROOT, 'issues.json');
    fs.writeFileSync(issuesFilePath, JSON.stringify(scenarioMap, null, 2), 'utf8');
    console.log(`issues.json written to ${issuesFilePath} (${scenarioMap.length} records)`);
  });
});
