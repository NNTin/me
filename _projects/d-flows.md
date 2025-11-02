---
title: 'd-flows'
excerpt: 'd-flows'
categories:
  - projects
tags:
#  - projects
---
## 📊 Project Summary

[![GitHub Stars](https://img.shields.io/github/stars/nntin/d-flows)](https://github.com/nntin/d-flows/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/nntin/d-flows)](https://github.com/nntin/d-flows/network)
[![GitHub Issues](https://img.shields.io/github/issues/nntin/d-flows)](https://github.com/nntin/d-flows/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/nntin/d-flows)](https://github.com/nntin/d-flows/pulls)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/nntin/d-flows)](https://github.com/nntin/d-flows/commits)
[![GitHub Language Count](https://img.shields.io/github/languages/count/nntin/d-flows)](https://github.com/nntin/d-flows)
[![Top Language](https://img.shields.io/github/languages/top/nntin/d-flows)](https://github.com/nntin/d-flows)

**d-flows** is a collection of reusable GitHub Actions workflows designed to streamline CI/CD across multiple repositories.

<img src="https://raw.githubusercontent.com/nntin/me/output/badges/d-flows_discord-notify-daily_usage.svg">  
<img src="https://raw.githubusercontent.com/nntin/me/output/badges/d-flows_discord-notify-total_usage.svg">  
<img src="https://raw.githubusercontent.com/nntin/me/output/badges/d-flows_step-summary-daily_usage.svg">  
<img src="https://raw.githubusercontent.com/nntin/me/output/badges/d-flows_step-summary-total_usage.svg">  


---

## ⚙️ What d-flows does

- `step-summary.yml` — Sets GitHub Actions step summaries with custom Markdown. Supports appending or overwriting, with optional titles.
- `discord-notify.yml` — Sends Discord notifications via webhooks. Supports simple messages and rich embeds (optional fields, colors, JSON field arrays).

In addition, d-flows implements a semantic versioning and release system via two coordinated workflows:

- `bump-version.yml` — Calculates version numbers and triggers releases.
- `release.yml` — Creates GitHub releases and manages version tags.

---

## 🧩 Technical challenges

1) Reusable workflow design

- Flexible but easy-to-consume inputs for both simple and advanced use cases.
- Embed support in `discord-notify.yml` with optional fields and color theming.
- Summary handling in `step-summary.yml` with append/overwrite modes.

2) Semantic versioning automation

- Branch-based constraints: `main` tracks the latest major; `release/vX` maintains older majors.
- First release validation: ensure first releases originate from `main`.
- Major tag management: keep lightweight tags (`v1`, `v2`, …) pointing to the latest patch within a major.
- Correctly bump major/minor/patch depending on branch and state.

3) Cross-repository usage tracking

- Accurately count invocations via the Actions API with `event=workflow_call`.
- Implement retry and rate limit handling for reliability.
- Maintain a historical CSV on the `output` branch and compute daily deltas.

---

## 📈 Dynamic counter: usage tracking via nntin/me repo

### How `gen_workflow_usage.ps1` works

The script tracks usage of the reusable workflows through a simple pipeline:

1. API query: ask the `d-flows` repo for workflow runs filtered by `event=workflow_call` (the `total_count` gives cumulative invocations).
2. Historical state: fetch the previous CSV directly from the `output` branch using `git show output:workflow-usage.csv` (with a preceding `git fetch origin output:output`).
3. Delta calculation: compute daily increments from the last known totals.
4. CSV update: update or overwrite the row for today’s date; otherwise append.
5. Badges: generate SVG badges for totals and daily increments.

API example (PowerShell):

```powershell
$uri = "https://api.github.com/repos/nntin/d-flows/actions/workflows/$($workflow.FileName)/runs?event=workflow_call&per_page=1"
```

Historical data retrieval (text parsed as CSV):

```powershell
git fetch origin output:output
git show output:workflow-usage.csv | ConvertFrom-Csv
```

### How `gen_badges.ps1` contributes

Although `gen_badges.ps1` primarily generates commit-based badges for repos in `repos.json`, it provides the shared badge infrastructure via `common.psm1`:

- Virtual environment setup: `Initialize-VirtualEnvironment` creates a platform-specific venv and installs dependencies.
- Badge templating: `New-Badge` leverages the Cookiecutter template `cookiecutter/cookiecutter-badges` (custom left/right text, colors, filenames).
- Output management: badges are staged in a temp dir and moved to `output/badges/` with consistent naming.

The usage script calls `New-Badge` four times per tracked workflow: total and daily badges for both `step-summary` and `discord-notify`.

### Complete flow

<div class="mermaid" id="workflow-flowchart">
flowchart TD
    A["gen_workflow_usage.ps1"] --> B["Query GitHub API (event = workflow_call)"]
    B --> C["git show output: workflow-usage.csv (after git fetch)"]
    C --> D["Calculate daily increments"]
    D --> E["Write/update output/workflow-usage.csv"]
    E --> F["New-Badge (common.psm1)"]
    F --> G["Initialize-VirtualEnvironment"]
    G --> H["Cookiecutter template -> SVG"]
    H --> I["Move to output/badges/"]
    I --> J["Repeat for both workflows (total + daily)"]
</div>


This creates a dynamic counter system where:

- The CSV file maintains historical usage data.
- Badges provide visual representations of current usage.
- Daily increments show adoption trends.
- All data is version-controlled on the `output` branch.

The system runs periodically via a scheduled GitHub Actions workflow to keep statistics up to date for all repositories consuming d-flows.