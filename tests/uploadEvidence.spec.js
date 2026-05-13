/**
 * uploadEvidence.api.spec.js
 *
 * Fully API-based Jira evidence uploader.
 *
 * No browser.
 * No auth.json.
 * No Playwright UI automation.
 * No login required.
 */

import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import { parse } from 'csv-parse/sync';

// ─────────────────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────────────────

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const folderPath = process.env.TEST_DATA_PATH;
const jiraBaseUrl = process.env.JIRA_BASE_URL;
const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;

const issuesFilePath = path.resolve(__dirname, '../issues.json');

if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
    throw new Error(
        'Missing Jira environment variables. Check .env file.'
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HEADER
// ─────────────────────────────────────────────────────────────────────────────

const authHeader = {
    Authorization:
        'Basic ' +
        Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64'),
    Accept: 'application/json',
};

// ─────────────────────────────────────────────────────────────────────────────
// LOAD CSV
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function loadIssuesBySummary() {
    if (!fs.existsSync(issuesFilePath)) {
        throw new Error(`issues.json not found: ${issuesFilePath}`);
    }

    const records = JSON.parse(fs.readFileSync(issuesFilePath, 'utf8'));

    return new Map(records.map(r => [r.Summary, r]));
}

/**
 * Upload attachment to Jira issue
 */
async function uploadAttachment(issueKey, filePath) {
    const form = new FormData();

    form.append('file', fs.createReadStream(filePath));

    const url = `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/attachments`;

    await axios.post(url, form, {
        headers: {
            ...authHeader,
            ...form.getHeaders(),
            'X-Atlassian-Token': 'no-check',
        },
        maxBodyLength: Infinity,
    });
}

/**
 * Get all transitions for an issue
 */
async function getTransitions(issueKey) {
    const url = `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/transitions`;

    const response = await axios.get(url, {
        headers: authHeader,
    });

    return response.data.transitions;
}

/**
 * Move issue to Pass status
 */
async function transitionIssueToPass(issueKey) {
    const transitions = await getTransitions(issueKey);

    const passTransition = transitions.find(
        t => t.name.toLowerCase() === 'pass'
    );

    if (!passTransition) {
        throw new Error(
            `No 'Pass' transition found for issue ${issueKey}`
        );
    }

    const url = `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/transitions`;

    await axios.post(
        url,
        {
            transition: {
                id: passTransition.id,
            },
        },
        {
            headers: {
                ...authHeader,
                'Content-Type': 'application/json',
            },
        }
    );
}

/**
 * Extract Jira issue key from issue URL
 * Example:
 * https://company.atlassian.net/browse/QA-123
 * -> QA-123
 */
function extractIssueKey(issueUrl) {
    const parts = issueUrl.split('/');
    return parts[parts.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Upload evidence via Jira API', () => {

    let issuesBySummary = new Map();

    test.beforeAll(async () => {
        issuesBySummary = loadIssuesBySummary();
    });

    csvRows.forEach((row) => {

        test(`Upload evidence for ${row.Summary}`, async () => {

            const issue = issuesBySummary.get(row.Summary);

            if (!issue || issue.testStatus === 'Not Created') {
                test.skip();
                return;
            }

            const issueKey = extractIssueKey(issue.testLink);

            const wordFileName = `${row.Summary}.docx`;
            const wordFilePath = path.join(folderPath, wordFileName);

            if (!fs.existsSync(wordFilePath)) {
                console.log(`Evidence file not found: ${wordFilePath}`);
                test.skip();
            }

            console.log(`Uploading attachment for ${issueKey}`);

            // Upload evidence
            await uploadAttachment(issueKey, wordFilePath);

            console.log(`Transitioning ${issueKey} to Pass`);

            // Set status to Pass
            await transitionIssueToPass(issueKey);

            console.log(`Completed ${issueKey}`);
        });
    });
});
