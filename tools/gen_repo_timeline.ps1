<#
  .DESCRIPTION
    Generates repository timeline data for the projects V2 page.
    The script clones/updates repositories from _data/repos.json, reads commit history,
    and groups commit activity into multiple ranges split by inactivity gaps.

  .OUTPUTS
    JSON file at _data/repo_timeline.json with:
    - ordered repositories
    - first/last commit
    - per-repository activity ranges
    - summary metrics

  .EXAMPLE
    pwsh ./tools/gen_repo_timeline.ps1
    pwsh ./tools/gen_repo_timeline.ps1 -InactivityGapDays 45
#>

param(
    [int]$InactivityGapDays = 3,
    [string]$ReposPath = "",
    [string]$OutputPath = ""
)

#------------------------------------------------------ Preparation -----------------------------------------------#

Import-Module "$PSScriptRoot/common.psm1" -Force

if ([string]::IsNullOrWhiteSpace($ReposPath)) {
    $ReposPath = Join-Path -Path $ROOT_DIR -ChildPath "_data/repos.json"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path -Path $ROOT_DIR -ChildPath "_data/repo_timeline.json"
}

$gitDir = Join-Path -Path $TMP_DIR -ChildPath "git"

if (-not (Test-Path $TMP_DIR)) {
    New-Item -ItemType Directory -Path $TMP_DIR -Force | Out-Null
}

if (-not (Test-Path $gitDir)) {
    New-Item -ItemType Directory -Path $gitDir -Force | Out-Null
}

if (-not (Test-Path $ReposPath)) {
    throw "Repository configuration not found: $ReposPath"
}

#------------------------------------------------------ Functions -------------------------------------------------#

function Get-GitHubCloneToken {
    <#
    .DESCRIPTION
        Returns the first available GitHub token for clone/fetch operations.
    #>

    $tokenSources = @(
        @{ Name = "BADGE_REPOS_TOKEN"; Value = $env:BADGE_REPOS_TOKEN },
        @{ Name = "WORKFLOW_USAGE_TOKEN"; Value = $env:WORKFLOW_USAGE_TOKEN },
        @{ Name = "GITHUB_TOKEN"; Value = $env:GITHUB_TOKEN }
    )

    foreach ($source in $tokenSources) {
        if (-not [string]::IsNullOrWhiteSpace($source.Value)) {
            return [PSCustomObject]@{
                Name  = $source.Name
                Value = $source.Value.Trim()
            }
        }
    }

    return $null
}

function Invoke-GitCommand {
    <#
    .DESCRIPTION
        Executes a git command and can retry with token-based auth.
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [string]$GitHubToken,
        [switch]$RetryWithTokenOnFailure
    )

    git @Arguments
    if ($LASTEXITCODE -eq 0) {
        return $true
    }

    if (-not $RetryWithTokenOnFailure -or [string]::IsNullOrWhiteSpace($GitHubToken)) {
        return $false
    }

    Write-Warning "Git command failed without auth. Retrying with GitHub token..."

    if ($Arguments.Count -ge 3 -and $Arguments[0] -eq "clone") {
        $cloneTargetPath = $Arguments[$Arguments.Count - 1]
        if (Test-Path $cloneTargetPath) {
            Remove-Item -Path $cloneTargetPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $urlRewriteConfig = "url.https://x-access-token:$GitHubToken@github.com/.insteadOf=https://github.com/"
    git -c $urlRewriteConfig @Arguments

    return ($LASTEXITCODE -eq 0)
}

function Sync-Repositories {
    <#
    .DESCRIPTION
        Clones or fetches repositories listed in config.
    #>

    param(
        [Parameter(Mandatory = $true)]
        [array]$Repos,
        [Parameter(Mandatory = $true)]
        [string]$GitRoot
    )

    $tokenInfo = Get-GitHubCloneToken
    $gitHubToken = $null
    if ($tokenInfo) {
        $gitHubToken = $tokenInfo.Value
        Write-Host "Using GitHub token from $($tokenInfo.Name) as clone/fetch retry auth." -ForegroundColor Cyan
    }
    else {
        Write-Warning "No GitHub token found (checked BADGE_REPOS_TOKEN, WORKFLOW_USAGE_TOKEN, GITHUB_TOKEN)."
    }

    foreach ($repo in $Repos) {
        $owner = $repo.owner
        $repoName = $repo.repo
        $repoPath = Join-Path -Path $GitRoot -ChildPath $repoName
        $cloneUrl = "https://github.com/$owner/$repoName.git"
        $workspaceRepoName = Split-Path -Path $ROOT_DIR -Leaf
        $workspaceGitPath = Join-Path -Path $ROOT_DIR -ChildPath ".git"

        if (($repoName -eq $workspaceRepoName) -and (Test-Path $workspaceGitPath)) {
            Write-Host "Using local workspace repository for $owner/$repoName ($ROOT_DIR)" -ForegroundColor Cyan
            continue
        }

        if (Test-Path $repoPath) {
            Write-Host "Updating repository: $owner/$repoName" -ForegroundColor Yellow
            Push-Location -Path $repoPath
            try {
                $ok = Invoke-GitCommand -Arguments @("fetch", "--all", "--prune") -GitHubToken $gitHubToken -RetryWithTokenOnFailure
                if (-not $ok) {
                    Write-Warning "Failed to fetch repository: $owner/$repoName. Existing local clone will still be used."
                }
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Host "Cloning repository: $owner/$repoName" -ForegroundColor Yellow
            $ok = Invoke-GitCommand -Arguments @("clone", $cloneUrl, $repoPath) -GitHubToken $gitHubToken -RetryWithTokenOnFailure
            if (-not $ok) {
                Write-Warning "Failed to clone repository: $owner/$repoName. It will be included with empty activity."
            }
        }
    }
}

function New-ActivityRanges {
    <#
    .DESCRIPTION
        Groups sorted commit date list into ranges, splitting on inactivity gaps.
    #>

    param(
        [Parameter(Mandatory = $true)]
        [datetime[]]$SortedCommitDates,
        [Parameter(Mandatory = $true)]
        [int]$GapDays
    )

    if ($SortedCommitDates.Count -eq 0) {
        return @()
    }

    $ranges = [System.Collections.Generic.List[object]]::new()

    $currentStart = $SortedCommitDates[0]
    $currentEnd = $SortedCommitDates[0]
    $currentCommitCount = 1
    $currentActiveDays = [System.Collections.Generic.HashSet[string]]::new()
    [void]$currentActiveDays.Add($currentStart.ToString("yyyy-MM-dd"))

    for ($i = 1; $i -lt $SortedCommitDates.Count; $i++) {
        $commitDate = $SortedCommitDates[$i]
        $gap = ($commitDate.Date - $currentEnd.Date).Days

        if ($gap -gt $GapDays) {
            $ranges.Add([PSCustomObject]@{
                    start        = $currentStart.ToString("yyyy-MM-dd")
                    end          = $currentEnd.ToString("yyyy-MM-dd")
                    commit_count = $currentCommitCount
                    active_days  = $currentActiveDays.Count
                })

            $currentStart = $commitDate
            $currentEnd = $commitDate
            $currentCommitCount = 1
            $currentActiveDays = [System.Collections.Generic.HashSet[string]]::new()
            [void]$currentActiveDays.Add($commitDate.ToString("yyyy-MM-dd"))
            continue
        }

        $currentEnd = $commitDate
        $currentCommitCount++
        [void]$currentActiveDays.Add($commitDate.ToString("yyyy-MM-dd"))
    }

    $ranges.Add([PSCustomObject]@{
            start        = $currentStart.ToString("yyyy-MM-dd")
            end          = $currentEnd.ToString("yyyy-MM-dd")
            commit_count = $currentCommitCount
            active_days  = $currentActiveDays.Count
        })

    return $ranges.ToArray()
}

function Get-RepositoryTimelineRows {
    <#
    .DESCRIPTION
        Builds timeline rows in the same manual order as repos config.
    #>

    param(
        [Parameter(Mandatory = $true)]
        [array]$Repos,
        [Parameter(Mandatory = $true)]
        [string]$GitRoot,
        [Parameter(Mandatory = $true)]
        [int]$GapDays
    )

    $rows = [System.Collections.Generic.List[object]]::new()

    foreach ($repo in $Repos) {
        $owner = $repo.owner
        $repoName = $repo.repo
        $repoPath = Join-Path -Path $GitRoot -ChildPath $repoName
        $workspaceRepoName = Split-Path -Path $ROOT_DIR -Leaf
        $workspaceGitPath = Join-Path -Path $ROOT_DIR -ChildPath ".git"
        $analysisRepoPath = $repoPath

        if (($repoName -eq $workspaceRepoName) -and (Test-Path $workspaceGitPath)) {
            $analysisRepoPath = $ROOT_DIR
        }

        if (-not (Test-Path $analysisRepoPath)) {
            $rows.Add([PSCustomObject]@{
                    owner            = $owner
                    repo             = $repoName
                    first_commit     = $null
                    last_commit      = $null
                    total_commits    = 0
                    total_active_days = 0
                    ranges           = @()
                })
            continue
        }

        Push-Location -Path $analysisRepoPath
        try {
            git rev-parse --is-inside-work-tree | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Not a valid git repository: $analysisRepoPath"
                $rows.Add([PSCustomObject]@{
                        owner            = $owner
                        repo             = $repoName
                        first_commit     = $null
                        last_commit      = $null
                        total_commits    = 0
                        total_active_days = 0
                        ranges           = @()
                    })
                continue
            }

            $commitDatesRaw = git log --date=short --format="%ad"
            if ($LASTEXITCODE -ne 0 -or -not $commitDatesRaw) {
                $rows.Add([PSCustomObject]@{
                        owner            = $owner
                        repo             = $repoName
                        first_commit     = $null
                        last_commit      = $null
                        total_commits    = 0
                        total_active_days = 0
                        ranges           = @()
                    })
                continue
            }

            $parsedCommitDates = [System.Collections.Generic.List[datetime]]::new()
            foreach ($rawDate in @($commitDatesRaw)) {
                $candidate = $rawDate.ToString().Trim()
                if ([string]::IsNullOrWhiteSpace($candidate)) {
                    continue
                }

                try {
                    $parsedDate = [DateTime]::ParseExact($candidate, "yyyy-MM-dd", [System.Globalization.CultureInfo]::InvariantCulture)
                    $parsedCommitDates.Add($parsedDate)
                }
                catch {
                    # Skip unexpected date values.
                }
            }

            if ($parsedCommitDates.Count -eq 0) {
                $rows.Add([PSCustomObject]@{
                        owner            = $owner
                        repo             = $repoName
                        first_commit     = $null
                        last_commit      = $null
                        total_commits    = 0
                        total_active_days = 0
                        ranges           = @()
                    })
                continue
            }

            $sortedDates = @($parsedCommitDates | Sort-Object)
            $uniqueActiveDays = @($sortedDates | ForEach-Object { $_.ToString("yyyy-MM-dd") } | Sort-Object -Unique)
            $ranges = New-ActivityRanges -SortedCommitDates $sortedDates -GapDays $GapDays

            $rows.Add([PSCustomObject]@{
                    owner            = $owner
                    repo             = $repoName
                    first_commit     = $sortedDates[0].ToString("yyyy-MM-dd")
                    last_commit      = $sortedDates[$sortedDates.Count - 1].ToString("yyyy-MM-dd")
                    total_commits    = $sortedDates.Count
                    total_active_days = $uniqueActiveDays.Count
                    ranges           = $ranges
                })
        }
        catch {
            Write-Warning "Failed to analyze $owner/$repoName - $($_.Exception.Message)"
            $rows.Add([PSCustomObject]@{
                    owner            = $owner
                    repo             = $repoName
                    first_commit     = $null
                    last_commit      = $null
                    total_commits    = 0
                    total_active_days = 0
                    ranges           = @()
                })
        }
        finally {
            Pop-Location
        }
    }

    return $rows.ToArray()
}

#------------------------------------------------------ Script ----------------------------------------------------#

Write-Host "Generating repository timeline data..." -ForegroundColor Cyan
Write-Host "ReposPath: $ReposPath" -ForegroundColor Gray
Write-Host "OutputPath: $OutputPath" -ForegroundColor Gray
Write-Host "InactivityGapDays: $InactivityGapDays" -ForegroundColor Gray

$repos = Get-Content -Path $ReposPath | ConvertFrom-Json

Sync-Repositories -Repos $repos -GitRoot $gitDir
$timelineRows = Get-RepositoryTimelineRows -Repos $repos -GitRoot $gitDir -GapDays $InactivityGapDays

$timelineRowsArray = @($timelineRows)

$outputObject = [PSCustomObject]@{
    generated_at         = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    inactivity_gap_days  = $InactivityGapDays
    repo_count           = $timelineRowsArray.Count
    repos                = $timelineRowsArray
}

$outputDirectory = Split-Path -Path $OutputPath -Parent
if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$outputJson = $outputObject | ConvertTo-Json -Depth 8 -Compress:$false
$outputJson | Out-File -FilePath $OutputPath -Encoding UTF8

Write-Host "Timeline data written to: $OutputPath" -ForegroundColor Green
Write-Host "Processed repositories: $($timelineRowsArray.Count)" -ForegroundColor Green
