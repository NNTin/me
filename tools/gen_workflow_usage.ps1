<#
.SYNOPSIS
    Tracks reusable workflow usage from the nntin/d-flows repository across GitHub.

.DESCRIPTION
    This script monitors how many times reusable workflows from the nntin/d-flows 
    repository are being used across all GitHub repositories. It uses the GitHub API
    to search for workflow files that reference the reusable workflows and counts
    their execution history.
    
    The script maintains a CSV file with cumulative totals and daily increments for
    each tracked workflow, allowing you to track usage trends over time.

.OUTPUTS
    Creates/updates a CSV file at: output/workflow-usage.csv
    
    CSV Structure:
    - Date: The date of the measurement (yyyy-MM-dd)
    - step-summary-total: Cumulative runs of step-summary.yml
    - step-summary-daily: New runs since last measurement
    - discord-notify-total: Cumulative runs of discord-notify.yml
    - discord-notify-daily: New runs since last measurement

.NOTES
    Requires:
    - GitHub Personal Access Token in environment variable: WORKFLOW_USAGE_TOKEN
    - Token permissions needed: public_repo (for public repositories)
    
    API Rate Limits:
    - Code Search API: 10 requests per minute
    - REST API: 5,000 requests per hour for authenticated requests
    
    The script implements retry logic and rate limit handling to ensure reliable
    operation even with API constraints.

.EXAMPLE
    .\gen_workflow_usage.ps1
    
    Tracks workflow usage and updates the CSV file with current statistics.
#>

# Preparation
Import-Module "$PSScriptRoot/common.psm1" -Force

Write-Host "=== Workflow Usage Tracking Script ===" -ForegroundColor Cyan
Write-Host "TOOLS_DIR : $TOOLS_DIR"
Write-Host "ROOT_DIR  : $ROOT_DIR"
Write-Host "OUTPUT_DIR: $OUTPUT_DIR"
Write-Host "TMP_DIR   : $TMP_DIR"
Write-Host ""

# Define paths and configuration
$csvPath = Join-Path -Path $OUTPUT_DIR -ChildPath "workflow-usage.csv"

# Target workflows to track from nntin/d-flows repository
$targetWorkflows = @(
    @{
        Name = "step-summary"
        Path = "nntin/d-flows/.github/workflows/step-summary.yml"
        FileName = "step-summary.yml"
    },
    @{
        Name = "discord-notify"
        Path = "nntin/d-flows/.github/workflows/discord-notify.yml"
        FileName = "discord-notify.yml"
    }
)

#region Helper Functions

<#
.SYNOPSIS
    Makes authenticated requests to the GitHub API.
#>
function Invoke-GitHubApi {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Uri,
        
        [Parameter()]
        [string]$Method = "GET",
        
        [Parameter()]
        [int]$MaxRetries = 3
    )
    
    $token = $env:WORKFLOW_USAGE_TOKEN
    if (-not $token) {
        throw "GitHub token not found. Please set the WORKFLOW_USAGE_TOKEN environment variable."
    }
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Accept" = "application/vnd.github+json"
        "User-Agent" = "PowerShell-WorkflowUsageTracker"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    
    $retryCount = 0
    $backoffSeconds = 2
    
    while ($retryCount -le $MaxRetries) {
        try {
            $response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $headers -ErrorAction Stop
            return $response
        }
        catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            
            # Handle rate limiting (403 with rate limit headers)
            if ($statusCode -eq 403) {
                $rateLimitRemaining = $_.Exception.Response.Headers["X-RateLimit-Remaining"]
                $rateLimitReset = $_.Exception.Response.Headers["X-RateLimit-Reset"]
                
                if ($rateLimitRemaining -eq "0" -and $rateLimitReset) {
                    $resetTime = [DateTimeOffset]::FromUnixTimeSeconds([int]$rateLimitReset).LocalDateTime
                    $waitSeconds = ($resetTime - (Get-Date)).TotalSeconds + 5
                    
                    if ($waitSeconds -gt 0) {
                        Write-Warning "Rate limit exceeded. Waiting until $resetTime ($([math]::Ceiling($waitSeconds)) seconds)..."
                        Start-Sleep -Seconds $waitSeconds
                        continue
                    }
                }
            }
            
            # Handle authentication errors
            if ($statusCode -eq 401) {
                throw "Authentication failed. Please check your WORKFLOW_USAGE_TOKEN is valid and has the required permissions."
            }
            
            # Handle not found errors gracefully
            if ($statusCode -eq 404) {
                Write-Verbose "Resource not found: $Uri"
                return $null
            }
            
            # Retry on network errors
            if ($retryCount -lt $MaxRetries) {
                $retryCount++
                Write-Warning "Request failed (attempt $retryCount/$MaxRetries): $($_.Exception.Message). Retrying in $backoffSeconds seconds..."
                Start-Sleep -Seconds $backoffSeconds
                $backoffSeconds *= 2
                continue
            }
            
            # Final failure
            throw "GitHub API request failed after $MaxRetries retries: $($_.Exception.Message)"
        }
    }
}

<#
.SYNOPSIS
    Finds all repositories that use a specific reusable workflow.
#>
function Find-RepositoriesUsingWorkflow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WorkflowPath
    )
    
    Write-Host "Searching for repositories using workflow: $WorkflowPath" -ForegroundColor Yellow
    
    $repositories = @{}
    
    # Search for both .yml and .yaml extensions
    $extensions = @("yml", "yaml")
    
    foreach ($ext in $extensions) {
        # Construct search query for GitHub Code Search API
        $query = "uses: $WorkflowPath in:file extension:$ext"
        $encodedQuery = [System.Web.HttpUtility]::UrlEncode($query)
        $searchUri = "https://api.github.com/search/code?q=$encodedQuery&per_page=100"
        
        Write-Verbose "Searching with query: $query"
        
        try {
            $page = 1
            $hasMorePages = $true
            
            while ($hasMorePages -and $page -le 10) {  # Limit to 1000 results (10 pages * 100 per page)
                $currentUri = if ($page -eq 1) { $searchUri } else { "$searchUri&page=$page" }
                
                # Code Search API has strict rate limiting (10 requests/minute)
                if ($page -gt 1) {
                    Write-Verbose "Waiting 6 seconds for Code Search API rate limit..."
                    Start-Sleep -Seconds 6
                }
                
                $response = Invoke-GitHubApi -Uri $currentUri
                
                if ($null -eq $response -or $response.items.Count -eq 0) {
                    $hasMorePages = $false
                    break
                }
                
                # Extract unique repository names
                foreach ($item in $response.items) {
                    $repoFullName = $item.repository.full_name
                    if (-not $repositories.ContainsKey($repoFullName)) {
                        $repositories[$repoFullName] = $true
                        Write-Verbose "Found repository: $repoFullName"
                    }
                }
                
                # Check if there are more pages
                $hasMorePages = ($response.items.Count -eq 100)
                $page++
            }
        }
        catch {
            Write-Warning "Error searching for .$ext files: $($_.Exception.Message)"
        }
    }
    
    $repoList = @($repositories.Keys)
    Write-Host "Found $($repoList.Count) unique repositories using this workflow" -ForegroundColor Green
    
    return $repoList
}

<#
.SYNOPSIS
    Gets the count of workflow runs for a specific workflow in a repository.
#>
function Get-WorkflowRunCount {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryFullName,
        
        [Parameter(Mandatory)]
        [string]$WorkflowFileName
    )
    
    Write-Verbose "Querying workflow runs for $RepositoryFullName/$WorkflowFileName"
    
    try {
        # GitHub API endpoint for workflow runs
        # Filter by event=workflow_call to get only reusable workflow invocations
        $uri = "https://api.github.com/repos/$RepositoryFullName/actions/workflows/$WorkflowFileName/runs?event=workflow_call&per_page=100"
        
        $response = Invoke-GitHubApi -Uri $uri
        
        # If workflow doesn't exist in this repository, return 0
        if ($null -eq $response) {
            return 0
        }
        
        # The total_count field gives us the total number of runs
        $totalCount = $response.total_count
        
        Write-Verbose "Found $totalCount runs in $RepositoryFullName"
        return $totalCount
    }
    catch {
        Write-Warning "Could not query workflow runs for ${RepositoryFullName}: $($_.Exception.Message)"
        return 0
    }
}

<#
.SYNOPSIS
    Aggregates usage statistics for all tracked workflows.
#>
function Get-WorkflowUsageStatistics {
    [CmdletBinding()]
    param()
    
    Write-Host "`nGathering workflow usage statistics..." -ForegroundColor Cyan
    $startTime = Get-Date
    
    $statistics = @{}
    
    foreach ($workflow in $targetWorkflows) {
        Write-Host "`n--- Processing workflow: $($workflow.Name) ---" -ForegroundColor Magenta
        
        # Find all repositories using this workflow
        $repositories = Find-RepositoriesUsingWorkflow -WorkflowPath $workflow.Path
        
        if ($repositories.Count -eq 0) {
            Write-Warning "No repositories found using $($workflow.Name)"
            $statistics["$($workflow.Name)Total"] = 0
            continue
        }
        
        # Count workflow runs across all repositories
        $totalRuns = 0
        $processedCount = 0
        
        foreach ($repo in $repositories) {
            $processedCount++
            Write-Host "[$processedCount/$($repositories.Count)] Querying $repo..." -ForegroundColor Gray
            
            $runCount = Get-WorkflowRunCount -RepositoryFullName $repo -WorkflowFileName $workflow.FileName
            $totalRuns += $runCount
            
            # Add a small delay to avoid hitting rate limits
            if ($processedCount % 30 -eq 0) {
                Write-Verbose "Processed 30 repositories, brief pause..."
                Start-Sleep -Seconds 1
            }
        }
        
        $statistics["$($workflow.Name)Total"] = $totalRuns
        Write-Host "Total runs for $($workflow.Name): $totalRuns" -ForegroundColor Green
    }
    
    $elapsed = (Get-Date) - $startTime
    Write-Host "`nStatistics gathering completed in $($elapsed.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Cyan
    
    return $statistics
}

<#
.SYNOPSIS
    Reads previous statistics from the CSV file.
#>
function Read-PreviousCsvData {
    [CmdletBinding()]
    param()
    
    $previousStats = @{
        "StepSummaryPreviousTotal" = 0
        "DiscordNotifyPreviousTotal" = 0
    }
    
    if (-not (Test-Path -Path $csvPath)) {
        Write-Host "No existing CSV file found. This is the first run." -ForegroundColor Yellow
        return $previousStats
    }
    
    try {
        $csvData = Import-Csv -Path $csvPath
        
        if ($csvData.Count -eq 0) {
            Write-Host "CSV file is empty. Starting fresh." -ForegroundColor Yellow
            return $previousStats
        }
        
        # Get the most recent entry (last row)
        $lastEntry = $csvData[-1]
        
        $previousStats["StepSummaryPreviousTotal"] = [int]$lastEntry.'step-summary-total'
        $previousStats["DiscordNotifyPreviousTotal"] = [int]$lastEntry.'discord-notify-total'
        
        Write-Host "Previous totals loaded from $($lastEntry.Date):" -ForegroundColor Cyan
        Write-Host "  step-summary: $($previousStats['StepSummaryPreviousTotal'])"
        Write-Host "  discord-notify: $($previousStats['DiscordNotifyPreviousTotal'])"
    }
    catch {
        Write-Warning "Error reading CSV file: $($_.Exception.Message). Starting with zero values."
    }
    
    return $previousStats
}

<#
.SYNOPSIS
    Updates the CSV file with new workflow usage statistics.
#>
function Update-WorkflowUsageCsv {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$CurrentStats,
        
        [Parameter(Mandatory)]
        [hashtable]$PreviousStats
    )
    
    Write-Host "`nUpdating CSV file..." -ForegroundColor Cyan
    
    # Calculate daily increments
    $stepSummaryDaily = $CurrentStats['step-summaryTotal'] - $PreviousStats['StepSummaryPreviousTotal']
    $discordNotifyDaily = $CurrentStats['discord-notifyTotal'] - $PreviousStats['DiscordNotifyPreviousTotal']
    
    # Ensure daily increments are not negative (in case of data issues)
    $stepSummaryDaily = [Math]::Max(0, $stepSummaryDaily)
    $discordNotifyDaily = [Math]::Max(0, $discordNotifyDaily)
    
    # Create new CSV row
    $newRow = [PSCustomObject]@{
        "Date" = Get-Date -Format "yyyy-MM-dd"
        "step-summary-total" = $CurrentStats['step-summaryTotal']
        "step-summary-daily" = $stepSummaryDaily
        "discord-notify-total" = $CurrentStats['discord-notifyTotal']
        "discord-notify-daily" = $discordNotifyDaily
    }
    
    # Ensure output directory exists
    if (-not (Test-Path -Path $OUTPUT_DIR)) {
        Write-Host "Creating output directory: $OUTPUT_DIR" -ForegroundColor Yellow
        New-Item -Path $OUTPUT_DIR -ItemType Directory -Force | Out-Null
    }
    
    # Append to CSV (or create new file if it doesn't exist)
    try {
        if (Test-Path -Path $csvPath) {
            $newRow | Export-Csv -Path $csvPath -Append -NoTypeInformation -Force
            Write-Host "CSV file updated successfully" -ForegroundColor Green
        }
        else {
            $newRow | Export-Csv -Path $csvPath -NoTypeInformation -Force
            Write-Host "CSV file created successfully" -ForegroundColor Green
        }
        
        Write-Host "`nUpdated statistics for $(Get-Date -Format 'yyyy-MM-dd'):" -ForegroundColor Cyan
        Write-Host "  step-summary: $($CurrentStats['step-summaryTotal']) total (+$stepSummaryDaily today)"
        Write-Host "  discord-notify: $($CurrentStats['discord-notifyTotal']) total (+$discordNotifyDaily today)"
        Write-Host "`nCSV file location: $csvPath"
    }
    catch {
        throw "Failed to update CSV file: $($_.Exception.Message)"
    }
}

#endregion

#region Main Execution

try {
    $scriptStartTime = Get-Date
    
    # Validate environment setup
    if (-not $env:WORKFLOW_USAGE_TOKEN) {
        throw @"
GitHub Personal Access Token not found!

Please set the WORKFLOW_USAGE_TOKEN environment variable with a token that has 'public_repo' permissions.

To create a token:
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with 'public_repo' scope
3. Set the environment variable: `$env:WORKFLOW_USAGE_TOKEN = "your_token_here"

For persistent setup, add it to your PowerShell profile or system environment variables.
"@
    }
    
    Write-Host "Starting workflow usage tracking for nntin/d-flows reusable workflows..." -ForegroundColor Green
    Write-Host "Tracking workflows: step-summary.yml, discord-notify.yml`n"
    
    # Load System.Web for URL encoding
    Add-Type -AssemblyName System.Web
    
    # Get current usage statistics
    $currentStats = Get-WorkflowUsageStatistics
    
    # Read previous statistics
    $previousStats = Read-PreviousCsvData
    
    # Update CSV file
    Update-WorkflowUsageCsv -CurrentStats $currentStats -PreviousStats $previousStats
    
    # Display execution summary
    $scriptElapsed = (Get-Date) - $scriptStartTime
    Write-Host "`n=== Workflow Usage Tracking Completed ===" -ForegroundColor Green
    Write-Host "Total execution time: $($scriptElapsed.TotalMinutes.ToString('F2')) minutes"
}
catch {
    Write-Error "Workflow usage tracking failed: $($_.Exception.Message)"
    Write-Host "`nStack trace:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace
    exit 1
}

#endregion
