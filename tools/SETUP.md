# Tools Setup Guide

This guide covers setup requirements for the automation scripts in the `tools` directory. Most scripts work out of the box, but some require additional configuration for external API access.

## GitHub Personal Access Token for Workflow Usage Tracking

The `gen_workflow_usage.ps1` script tracks usage of reusable workflows from the `nntin/d-flows` repository across all GitHub repositories. This functionality requires authentication via a GitHub Personal Access Token (PAT) to query the GitHub API for workflow run statistics.

### Required Permissions

The Personal Access Token must have the following scopes:

- **`repo`** - Full control of private repositories (needed to access workflow run data)
- **`actions:read`** - Read access to Actions workflows and runs

These permissions are required to query the GitHub API for workflow run statistics across repositories, specifically to count how many times the reusable workflows have been invoked.

### Creating a Personal Access Token

Follow these steps to create a GitHub Personal Access Token with the required permissions:

1. Navigate to **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give the token a descriptive name (e.g., `Workflow Usage Tracker`)
4. Set an appropriate expiration date (recommended: 90 days or 1 year with a reminder to rotate)
5. Select the required scopes:
   - ✓ `repo` (Full control of private repositories)
   - ✓ `actions:read` (Read access to Actions)
6. Click **"Generate token"** at the bottom of the page
7. **Important**: Copy the token immediately - it won't be shown again

**Security Note**: Never commit the token to the repository or share it publicly. GitHub tokens should be treated as passwords and kept secure.

### Configuring the Repository Secret

After creating the token, configure it as a repository secret so the GitHub Actions workflow can access it:

1. Navigate to your repository's **Settings** tab
2. In the left sidebar, click **"Secrets and variables"** → **"Actions"**
3. Click **"New repository secret"**
4. Set the name to: `WORKFLOW_USAGE_TOKEN` (must match exactly)
5. Paste the PAT you created in the previous step into the value field
6. Click **"Add secret"**

The GitHub Actions workflow will automatically use this secret when running `gen_workflow_usage.ps1`.

### Verifying the Setup

To verify that your setup is working correctly:

1. Trigger the "generate badges" workflow manually:
   - Go to the **Actions** tab
   - Select the "generate badges" workflow
   - Click **"Run workflow"** → **"Run workflow"**

2. Check the workflow run logs:
   - Click on the running workflow
   - Expand the **"Generate workflow usage statistics"** step
   - Verify that the step completes successfully without authentication errors

3. Check the output branch for the generated files:
   - Navigate to the `output` branch of your repository
   - Verify the presence of the following files:
     - `workflow-usage.csv` - CSV file with usage statistics
     - `badges/d-flows_step-summary-total_usage.svg` - Badge for step-summary total usage
     - `badges/d-flows_step-summary-daily_usage.svg` - Badge for step-summary daily usage
     - `badges/d-flows_discord-notify-total_usage.svg` - Badge for discord-notify total usage
     - `badges/d-flows_discord-notify-daily_usage.svg` - Badge for discord-notify daily usage

## Troubleshooting

### Error: "WORKFLOW_USAGE_TOKEN environment variable is not set"

**Solution**: Ensure the repository secret is named exactly `WORKFLOW_USAGE_TOKEN` and the workflow has been updated to pass it as an environment variable in the workflow YAML file.

### Error: "Bad credentials (HTTP 401)"

**Solution**: The PAT may be invalid or expired. Generate a new token following the steps above and update the repository secret with the new value.

### Error: "Rate limit exceeded (HTTP 403)"

**Solution**: The GitHub API has rate limits (5,000 requests per hour for authenticated requests). Wait for the rate limit to reset (check the error message for reset time) or reduce the frequency of workflow runs. The script includes automatic rate limit handling and will wait if necessary.

### "No repositories found using the workflows"

**Solution**: This is expected if no repositories are currently using the reusable workflows from `nntin/d-flows`. The badges will show 0 usage counts, which is correct. As repositories begin using the workflows, the counts will increase.

## Additional Notes

- The workflow runs automatically every 24 hours via cron schedule (`0 */24 * * *`)
- The `workflow-usage.csv` file accumulates historical data, showing both total usage counts and daily increments over time
- Badges are automatically updated on each workflow run and are available via GitHub raw URLs from the output branch
- Badge URLs follow the pattern:
  ```
  https://raw.githubusercontent.com/nntin/me/output/badges/d-flows_step-summary-total_usage.svg
  https://raw.githubusercontent.com/nntin/me/output/badges/d-flows_discord-notify-total_usage.svg
  ```
- The CSV data can be used for additional analysis or visualization of workflow adoption trends
