import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import { stringify } from 'csv-stringify/sync';

// ─────────────────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────────────────

dotenv.config({
    path: path.resolve(__dirname, '../.env')
});

// ─────────────────────────────────────────────────────────────────────────────
// PATHS
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');

const outputPath = process.env.OUTPUT_PATH;

const resultsFile = process.env.FOLDER_NAME;

const jiraBaseUrl = process.env.JIRA_BASE_URL;

const jiraEmail = process.env.JIRA_EMAIL;

const jiraApiToken = process.env.JIRA_API_TOKEN;

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

const authHeader = {

    Authorization:
        'Basic ' +
        Buffer.from(
            `${jiraEmail}:${jiraApiToken}`
        ).toString('base64'),

    Accept: 'application/json',
};

// ─────────────────────────────────────────────────────────────────────────────
// GET IMPORT TIMESTAMP
// ─────────────────────────────────────────────────────────────────────────────

function getImportTimestamp() {

    const linkFilePath = path.join(
        PROJECT_ROOT,
        'link.json'
    );

    if (!fs.existsSync(linkFilePath)) {

        throw new Error(
            `link.json not found at ${linkFilePath}`
        );
    }

    const data = JSON.parse(
        fs.readFileSync(linkFilePath, 'utf8')
    );

    if (!data.createdAt) {

        throw new Error(
            'createdAt missing from link.json'
        );
    }

    return data.createdAt;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH ISSUES
// ─────────────────────────────────────────────────────────────────────────────

async function searchIssues() {

    const createdAfter = getImportTimestamp();

    // ─────────────────────────────────────────────────────────────────────
    // READ issues.json
    // ─────────────────────────────────────────────────────────────────────

    const issuesFilePath = path.join(
        PROJECT_ROOT,
        'issues.json'
    );

    if (!fs.existsSync(issuesFilePath)) {

        throw new Error(
            `issues.json not found at ${issuesFilePath}`
        );
    }

    const importedIssues = JSON.parse(
        fs.readFileSync(issuesFilePath, 'utf8')
    );

    // Count ONLY successfully created issues
    const createdIssuesCount = importedIssues.filter(
        issue => issue.testStatus === 'Created'
    ).length;

    console.log(
        `Using maxResults=${createdIssuesCount}`
    );

    // ─────────────────────────────────────────────────────────────────────
    // SEARCH JIRA
    // ─────────────────────────────────────────────────────────────────────

    const response = await axios.post(

        `${jiraBaseUrl}/rest/api/3/search/jql`,

        {
            jql: `
                project=${process.env.JIRA_PROJECT_KEY}
                AND creator=currentUser()
                ORDER BY created DESC
            `,

            maxResults: createdIssuesCount,

            fields: [
                'summary',
                'status',
                'priority',
                'created',
                'reporter'
            ]
        },

        {
            headers: {
                ...authHeader,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.values ||
        response.data.issues ||
        [];
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Download CSV via API', () => {

    test('Generate CSV results', async () => {

        const issues = await searchIssues();

        console.log(
            `Found ${issues.length} issues created in this run`
        );

        const rows = issues.map(issue => ({

            Key: issue.key || '',

            Summary:
                issue.fields?.summary ||
                issue.summary ||
                '',

            Status:
                issue.fields?.status?.name ||
                issue.status?.name ||
                '',

            Priority:
                issue.fields?.priority?.name ||
                issue.priority?.name ||
                '',

            Created:
                issue.fields?.created ||
                issue.created ||
                '',

            Reporter:
                issue.fields?.reporter?.displayName ||
                issue.reporter?.displayName ||
                '',
        }));

        const csv = stringify(rows, {
            header: true,
        });

        fs.mkdirSync(
            outputPath,
            {
                recursive: true,
            }
        );

        const outputFile = path.join(
            outputPath,
            `${resultsFile}_results.csv`
        );

        fs.writeFileSync(
            outputFile,
            csv,
            'utf8'
        );

        console.log(
            `CSV saved to ${outputFile}`
        );

        console.log(
            `Total issues exported: ${rows.length}`
        );
    });
});