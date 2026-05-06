/**
 * attachFilesParallel.api.spec.js
 *
 * Reads created Jira issues from link.json results
 * and generates issues.json entirely through APIs.
 */

import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '..');

const jiraBaseUrl = process.env.JIRA_BASE_URL;
const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;

const authHeader = {
  Authorization:
    'Basic ' +
    Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64'),
  Accept: 'application/json',
};

async function searchIssues() {

  const response = await axios.post(
    `${jiraBaseUrl}/rest/api/3/search/jql`,
    {
      jql: `
                project=${process.env.JIRA_PROJECT_KEY}
                AND creator=currentUser()
                ORDER BY created DESC
            `,
      maxResults: 500,
      fields: ['summary']
    },
    {
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.values || response.data.issues || [];
}

function readCsvRows(folderPath) {

  const csvFile = fs.readdirSync(folderPath, { withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => f.name)
    .find(name => name.toLowerCase().endsWith('.csv'));

  if (!csvFile) {
    throw new Error(`No CSV file found in: ${folderPath}`);
  }

  return parse(
    fs.readFileSync(path.join(folderPath, csvFile), 'utf8'),
    {
      columns: header => header.map(col => col.trim()),
      skip_empty_lines: true,
      trim: true,
    }
  );
}

function mapIssues(csvRows, jiraIssues) {

  return csvRows.map(row => {

    const match = jiraIssues.find(issue => {

      const summary =
        issue.fields?.summary ||
        issue.summary ||
        '';

      return summary === row.Summary;
    });

    if (!match) {
      return {
        ...row,
        issueKey: null,
        testLink: null,
        testStatus: 'Not Created',
      };
    }

    return {
      ...row,
      issueKey: match.key,
      testLink: `${jiraBaseUrl}/browse/${match.key}`,
      testStatus: 'Created',
    };
  });
}

test.describe('Generate issues.json via API', () => {

  test('Build issues.json', async () => {

    const folderPath = process.env.TEST_DATA_PATH;

    const csvRows = readCsvRows(folderPath);

    const jiraIssues = await searchIssues();

    const mapped = mapIssues(csvRows, jiraIssues);

    const issuesFilePath = path.join(
      PROJECT_ROOT,
      'issues.json'
    );

    fs.writeFileSync(
      issuesFilePath,
      JSON.stringify(mapped, null, 2),
      'utf8'
    );

    console.log(
      `issues.json written to ${issuesFilePath}`
    );
  });
});