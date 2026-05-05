/**
 * uploadEvidence.spec.js  —  Stage 3: Attach Evidence & Set Status to Pass
 *
 * Generates one Playwright test per row in the CSV file (which always exists
 * before the pipeline starts).  The Jira issue link for each test is read from
 * issues.json at runtime inside beforeAll — by which point stage 2 has already
 * written it.
 *
 * WHY TESTS ARE GENERATED FROM THE CSV, NOT FROM issues.json:
 *   Playwright collects all spec files and registers every test() call BEFORE
 *   running any tests.  On a first-ever full-pipeline run issues.json does not
 *   exist at collection time (stage 2 hasn't run yet), so it cannot be used to
 *   drive test generation.  The CSV, however, is the pipeline's original input
 *   and is always present.  Using it for test titles means tests are correctly
 *   discovered on the very first run, and issues.json is only needed at
 *   execution time (inside beforeAll / inside each test body) — safely after
 *   stage 2 has finished.
 *
 * WHY PER-ISSUE SCRATCH FILES INSTEAD OF MUTATING AN ARRAY IN MEMORY:
 *   Playwright runs each parallel worker in a separate Node.js process, so
 *   in-memory mutations are invisible across workers.  Each worker writes a
 *   uniquely-named scratch file (keyed by CSV row index) — no locking needed.
 *   afterAll merges them all into the final results CSV.
 *
 * Playwright project:  stage-3-evidence  (full pipeline, depends on stage-2-collect)
 *                      evidence-only     (standalone re-run)
 * Run command (full):  npx playwright test --project=stage-1-import --project=stage-2-collect --project=stage-3-evidence
 * Run command (alone): npx playwright test --project=evidence-only
 */

import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { retryAction } from '../utils/retryHelper';

// Load .env — safe at module level, only populates process.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Module-level path constants (no file I/O) ─────────────────────────────────
const folderPath = process.env.TEST_DATA_PATH;
const resultsPath = process.env.OUTPUT_PATH;
const issuesFilePath = path.resolve(__dirname, '../issues.json');
const SCRATCH_DIR = path.resolve(__dirname, '../results-scratch');

// ── Read the CSV at collection time ───────────────────────────────────────────
// The CSV is the pipeline's original input and is always present before any
// stage runs.  Reading it here is safe and gives us the test titles we need.
//
// folderPath comes from .env which is loaded above, so it is available now.
const csvFileName = fs.readdirSync(folderPath, { withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => f.name)
    .find(name => name.toLowerCase().endsWith('.csv'));

if (!csvFileName) {
    throw new Error(`No CSV file found in TEST_DATA_PATH: ${folderPath}`);
}

const csvRows = parse(
    fs.readFileSync(path.join(folderPath, csvFileName), 'utf8'),
    {
        columns: header => header.map(col => col.trim()),
        skip_empty_lines: true,
        trim: true,
    }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reads issues.json at runtime (called from beforeAll, never at collection time).
 * Returns a Map keyed by Summary for O(1) lookup inside each test.
 *
 * @returns {Map<string, object>} Summary → issue record
 */
function loadIssuesBySummary() {
    if (!fs.existsSync(issuesFilePath)) {
        throw new Error(
            `issues.json not found at ${issuesFilePath}.\n` +
            `Ensure stage-2-collect has completed before running stage-3-evidence.`
        );
    }
    const records = JSON.parse(fs.readFileSync(issuesFilePath, 'utf8'));
    return new Map(records.map(r => [r.Summary, r]));
}

/**
 * Writes the outcome for one issue to an isolated scratch file.
 * Filename = CSV row index, guaranteeing uniqueness across parallel workers.
 *
 * @param {number} index
 * @param {string} testStatus  'Pass' | 'Fail'
 */
function writeResult(index, testStatus) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(SCRATCH_DIR, `${index}.json`),
        JSON.stringify({ index, testStatus }),
        'utf8'
    );
}

// ── Spec ──────────────────────────────────────────────────────────────────────

test.use({ storageState: 'auth.json' });

test.describe('Upload evidence (parallel)', () => {
    test.describe.configure({ mode: 'parallel' });

    // issuesBySummary is populated in beforeAll (runtime) and used in each test.
    // It is declared here so it is in scope for every test in this describe block.
    let issuesBySummary = new Map();

    // ── beforeAll: load issues.json now that stage 2 has finished ─────────────
    // beforeAll runs at execution time, not at collection time, so issues.json
    // is guaranteed to exist by the time this runs in the full pipeline.
    test.beforeAll(async () => {
        issuesBySummary = loadIssuesBySummary();
    });

    // ── afterAll: merge scratch files → write final CSV ───────────────────────
    test.afterAll(async () => {
        // Build a status map from every scratch file written by all workers
        const statusMap = {};
        if (fs.existsSync(SCRATCH_DIR)) {
            for (const file of fs.readdirSync(SCRATCH_DIR)) {
                if (!file.endsWith('.json')) continue;
                try {
                    const { index, testStatus } = JSON.parse(
                        fs.readFileSync(path.join(SCRATCH_DIR, file), 'utf8')
                    );
                    statusMap[index] = testStatus;
                } catch {
                    // Corrupt scratch file — record keeps its issues.json status
                }
            }
        }

        // Re-read issues.json here in case afterAll runs in a different worker
        // process than the beforeAll that populated issuesBySummary above.
        const issuesRecords = JSON.parse(fs.readFileSync(issuesFilePath, 'utf8'));

        // Merge statuses back in original CSV order.
        // Rows that were skipped or 'Not Created' keep their existing status.
        const finalRecords = issuesRecords.map((record, index) => ({
            ...record,
            testStatus: statusMap[index] ?? record.testStatus,
        }));

        const outputCsvPath = path.join(
            resultsPath,
            `${csvFileName}_results_${new Date().toISOString().replace(/:/g, '-')}.csv`
        );
        fs.writeFileSync(
            outputCsvPath,
            stringify(finalRecords, {
                header: true,
                quoted: value => typeof value === 'string' && value.includes('\n'),
            }),
            'utf8'
        );
        console.log(`Results written to ${outputCsvPath}`);

        // Clean up scratch directory now that the CSV is safely written
        fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
    });

    // ── One test per CSV row ───────────────────────────────────────────────────
    // csvRows is read from the CSV at collection time (always available), so
    // Playwright can register all test titles on the very first pipeline run
    // before issues.json exists.  The Jira link is resolved at runtime below.
    csvRows.forEach((row, index) => {

        test(`Upload for ${row.Summary}`, async ({ page }) => {
            test.setTimeout(500000);

            // ── Resolve the Jira link at runtime from the loaded issues map ───
            // issuesBySummary was populated in beforeAll, which ran after stage 2
            // finished writing issues.json.
            const issue = issuesBySummary.get(row.Summary);

            if (!issue || issue.testStatus === 'Not Created') {
                // Issue was not created during import — nothing to upload
                console.log(`Skipping "${row.Summary}" — not found in issues.json`);
                test.skip();
                return;
            }

            // Navigate to the Jira issue page
            await page.goto(issue.testLink, { waitUntil: 'domcontentloaded' });
            await page.getByText('Apps', { exact: true }).waitFor({ state: 'visible' });

            const wordFileName = `${row.Summary}.docx`;
            const wordFilePath = path.join(folderPath, wordFileName);

            // ── Skip: already passed in a previous run ─────────────────────────
            if (
                await page.getByRole('button', { name: 'Pass' }).isVisible() &&
                await page.locator(`text=${wordFileName}`).first().isVisible()
            ) {
                test.skip();
                return;
            }

            // ── Skip: already failed in a previous run ─────────────────────────
            if (await page.getByRole('button', { name: 'Failed' }).isVisible()) {
                writeResult(index, 'Fail');
                test.skip();
                return;
            }

            // ── Open the quick-add attachment dropdown ─────────────────────────
            const addBtn = page.getByTestId(
                'issue-view-foundation.quick-add.quick-add-items-compact.add-button-dropdown--trigger'
            );
            const attachBtn = page.getByTestId(
                'issue.issue-view.views.issue-base.foundation.quick-add.quick-add-item.add-attachment'
            );

            await addBtn.waitFor({ state: 'visible' });

            await retryAction({
                action: async () => { await addBtn.click(); },
                successCheck: async () => {
                    try {
                        await attachBtn.waitFor({ state: 'visible', timeout: 1000 });
                        return true;
                    } catch { return false; }
                },
                retries: 20,
                name: `open attachment dropdown for ${row.Summary}`,
            });

            // ── Attach the .docx evidence file ─────────────────────────────────
            if (!fs.existsSync(wordFilePath)) {
                //writeResult(index, 'Fail');
                throw new Error(`Evidence file not found: ${wordFilePath}`);
            }

            const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                attachBtn.click(),
            ]);
            await fileChooser.setFiles(wordFilePath);

            // Wait for the filename to confirm the upload completed
            await page.locator(`text=${wordFileName}`).first().waitFor({ timeout: 30000 });

            // ── Set issue status to Pass ────────────────────────────────────────
            await page.getByTestId(
                'issue-field-status.ui.status-view.status-button.status-button'
            ).click();
            await page.getByRole('option', { name: 'Pass' }).click();
            await page.waitForTimeout(1000);

            // ── Write this issue's result immediately ──────────────────────────
            //writeResult(index, 'Pass');
        });
    });
});