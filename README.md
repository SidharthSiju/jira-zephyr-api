# Jira Zephyr Squad — Bulk Import & Evidence Upload Automation

Automates the end-to-end workflow of bulk-importing test cases from a CSV file into Jira (via the Zephyr Squad plugin), attaching `.docx` evidence files to each created issue, and setting each issue's status to **Pass**.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A folder containing:
  - A single `.csv` file with your test cases
  - One `.docx` evidence file per test case, named exactly after the **Summary** column value (e.g. `My Test Case.docx`)

---

## Setup

### 1. CD to project directory (folder containing the tests folder)

### 2. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root (or edit the existing one):

```env
TEST_DATA_PATH=C:/path/to/your/test-data-folder
OUTPUT_PATH=C:/path/to/your/results-folder
FOLDER_NAME=your-folder-name
JIRA_BASE_URL=https://your-domain.atlassian.net/
JIRA_EMAIL=your-jira-email
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=your-jira-project
```

| Variable         | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `TEST_DATA_PATH` | Absolute path to the folder containing the CSV and `.docx` files  |
| `OUTPUT_PATH`    | Absolute path where the output results CSV will be saved          |
| `FOLDER_NAME`    | Name of the folder (used for labelling in output)                 |

### 5. Save browser authentication state

Run the following command, log in to Jira in the browser that opens, then close it:

```bash
npx playwright codegen --save-storage=auth.json https://okducagile.atlassian.net/
```

This saves your login session to `auth.json` so tests can reuse it without logging in every time.

---

## Running Tests

### Full pipeline (import → collect issues → upload evidence)

```bash
npx playwright test --project=full-process
```

### Import CSV only

```bash
npx playwright test --project=setup
```

### Collect created issue links (after import)

```bash
npx playwright test --project=scenarios-only
```

### Upload evidence only (if import is already done)

```bash
npx playwright test --project=evidence-only
```

### Download CSV

```bash
npx playwright test --project=download-csv
```

## How It Works

The automation runs in three sequential stages:

```
[setup]         bulkCreateIssues.spec.js
                  → Navigates to Jira, opens Zephyr Squad
                  → Uploads the CSV via the bulk import wizard
                  → Configures project settings and field mappings
                  → Verifies all rows were imported successfully
                  → Saves the resulting issues-list URL to link.json

[scenarios]     attachFilesParallel.spec.js
                  → Reads link.json to navigate to the issues list
                  → Scrapes all created issue names and links
                  → Matches them against the original CSV rows
                  → Saves the matched map to issues.json

[evidence]      uploadEvidence.spec.js
                  → Reads issues.json (one test per issue, runs in parallel)
                  → Navigates to each issue page
                  → Attaches the matching .docx file
                  → Sets the issue status to Pass
                  → Writes a timestamped results CSV to OUTPUT_PATH
[download-csv]   downloadCSV.spec.js
                  → Downloads the test results CSV of the currently added records
                  → Saves it into the output folder
```

---

## Project Structure

```
jira_zephyr_3/
├── tests/
│   ├── bulkCreateIssues.spec.js       # Stage 1: CSV import wizard
│   ├── attachFilesParallel.spec.js    # Stage 2: Collect created issue links
│   ├── uploadEvidence.spec.js         # Stage 3: Attach evidence & set Pass
│   └── downloadCSV.spec.js            # Stage 4: Download test results CSV 
│
├── pages/
│   ├── HomePage.js                    # Jira top nav → Apps → Zephyr Squad
│   ├── CreateIssuePage.js             # Clicks the "Import Issues" button
│   ├── BulkCreateSetupPage.js         # Uploads the CSV in the import wizard
│   ├── SettingPage.js                 # Selects the target Jira project
│   └── MappingFieldsPage.js           # Maps CSV columns to Jira fields
│
├── utils/
│   └── retryHelper.js                 # Retry wrapper for flaky UI interactions
│
├── playwright.config.js               # Project definitions and shared settings
├── .env                               # Environment variables (not committed)
├── auth.json                          # Saved browser auth state (not committed)
├── link.json                          # Runtime: URL of the created issues list
└── issues.json                        # Runtime: matched issue names + links
```

---

## Output

After a successful run, a timestamped CSV is written to `OUTPUT_PATH`:

```
your_csv_file_results.csv
```

Each row contains the original CSV data plus:
- `testLink` — the Jira issue URL
- `testStatus` — `Pass`, `Not Created`, or `Fail`

---

## Notes

- `link.json` and `issues.json` are intermediate runtime files written to the project root. They are read by the next stage in the pipeline.
- Evidence files **must** be named exactly as the `Summary` field in the CSV, with a `.docx` extension.
- The `auth.json` file contains sensitive session tokens — do not commit it to version control. It is already listed in `.gitignore`.
