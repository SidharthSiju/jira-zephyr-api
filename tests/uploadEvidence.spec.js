import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const folderPath = process.env.TEST_DATA_PATH;

const jiraBaseUrl = process.env.JIRA_BASE_URL;
const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;

const issuesFilePath = path.resolve(__dirname, '../issues.json');

const authHeader = {
    Authorization:
        'Basic ' +
        Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64'),
    Accept: 'application/json',
};

function loadIssues() {

    return JSON.parse(
        fs.readFileSync(issuesFilePath, 'utf8')
    );
}

async function uploadAttachment(issueKey, filePath) {

    const form = new FormData();

    form.append(
        'file',
        fs.createReadStream(filePath)
    );

    await axios.post(
        `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/attachments`,
        form,
        {
            headers: {
                ...authHeader,
                ...form.getHeaders(),
                'X-Atlassian-Token': 'no-check',
            },
            maxBodyLength: Infinity,
        }
    );
}

async function getTransitions(issueKey) {

    const response = await axios.get(
        `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/transitions`,
        {
            headers: authHeader,
        }
    );

    return response.data.transitions;
}

async function transitionToPass(issueKey) {

    const transitions = await getTransitions(issueKey);

    const passTransition = transitions.find(
        t => t.name.toLowerCase() === 'pass'
    );

    if (!passTransition) {
        throw new Error(
            `No Pass transition found for ${issueKey}`
        );
    }

    await axios.post(
        `${jiraBaseUrl}/rest/api/3/issue/${issueKey}/transitions`,
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

test.describe('Upload evidence via API', () => {

    const issues = loadIssues();

    issues.forEach(issue => {

        test(
            `Upload evidence for ${issue.Summary}`,
            async () => {

                if (
                    issue.testStatus === 'Not Created' ||
                    !issue.issueKey
                ) {
                    test.skip();
                    return;
                }

                const wordFilePath = path.join(
                    folderPath,
                    `${issue.Summary}.docx`
                );

                if (!fs.existsSync(wordFilePath)) {
                    throw new Error(
                        `Missing file: ${wordFilePath}`
                    );
                }

                console.log(
                    `Uploading attachment to ${issue.issueKey}`
                );

                await uploadAttachment(
                    issue.issueKey,
                    wordFilePath
                );

                console.log(
                    `Transitioning ${issue.issueKey} to Pass`
                );

                await transitionToPass(issue.issueKey);

                console.log(
                    `Completed ${issue.issueKey}`
                );
            }
        );
    });
});