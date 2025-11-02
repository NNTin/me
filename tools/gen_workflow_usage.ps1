<#
.SYNOPSIS
    Tracks reusable workflow usage from the nntin/d-flows repository across GitHub.

.DESCRIPTION
    This script monitors how many times reusable workflows from the nntin/d-flows 
    repository are being called across all GitHub repositories. It queries the GitHub 
    Actions API to get the total_count of workflow runs with event=workflow_call 
    directly from the d-flows repository, which accurately tracks all invocations 
    of the reusable workflows.
    
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
    
    SVG badge files in the output/badges directory:
    - d-flows_step-summary-total_usage.svg - Total usage count for step-summary workflow
    - d-flows_step-summary-daily_usage.svg - Daily usage count for step-summary workflow
    - d-flows_discord-notify-total_usage.svg - Total usage count for discord-notify workflow
    - d-flows_discord-notify-daily_usage.svg - Daily usage count for discord-notify workflow

.NOTES
    Requires:
    - GitHub Personal Access Token in environment variable: WORKFLOW_USAGE_TOKEN
    - Token permissions needed:
      - **`repo`** - Full control of private repositories (needed to access workflow run data)
      - **`actions:read`** - Read access to Actions workflows and runs
    
    API Rate Limits:
    - REST API: 5,000 requests per hour for authenticated requests
    
    The script implements retry logic and rate limit handling to ensure reliable
    operation even with API constraints.
    
    Usage Tracking Method:
    The script queries the workflow runs API with event=workflow_call filter, which
    returns the total count of times each reusable workflow has been invoked from
    any repository. This is more accurate and efficient than searching for workflow
    references across GitHub.

.EXAMPLE
    .\gen_workflow_usage.ps1
    
    Tracks workflow usage and updates the CSV file with current statistics.
#>
#------------------------------------------------------ Preparation -----------------------------------------------#

Import-Module "$PSScriptRoot/common.psm1" -Force

Write-Host "=== Workflow Usage Tracking Script ===" -ForegroundColor Cyan
Write-Host "TOOLS_DIR : $TOOLS_DIR"
Write-Host "ROOT_DIR  : $ROOT_DIR"
Write-Host "OUTPUT_DIR: $OUTPUT_DIR"
Write-Host "TMP_DIR   : $TMP_DIR"
Write-Host ""

# Initialize virtual environment for cookiecutter
Initialize-VirtualEnvironment

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

#------------------------------------------------------ Functions -------------------------------------------------#

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
            # Check if Response object exists
            if ($null -eq $_.Exception.Response) {
                # Treat as transient network error
                if ($retryCount -lt $MaxRetries) {
                    $retryCount++
                    Write-Warning "Network error (attempt $retryCount/$MaxRetries): $($_.Exception.Message). Retrying in $backoffSeconds seconds..."
                    Start-Sleep -Seconds $backoffSeconds
                    $backoffSeconds *= 2
                    continue
                }
                else {
                    throw "GitHub API request failed after $MaxRetries retries due to network error: $($_.Exception.Message)"
                }
            }
            
            $statusCode = $_.Exception.Response.StatusCode.value__
            
            # Handle rate limiting (403 with rate limit headers)
            if ($statusCode -eq 403) {
                $rateLimitRemaining = $null
                $rateLimitReset = $null
                $retryAfter = $null
                
                if ($null -ne $_.Exception.Response.Headers) {
                    $rateLimitRemaining = $_.Exception.Response.Headers["X-RateLimit-Remaining"]
                    $rateLimitReset = $_.Exception.Response.Headers["X-RateLimit-Reset"]
                    $retryAfter = $_.Exception.Response.Headers["Retry-After"]
                }
                
                # Primary rate limit (X-RateLimit-Remaining = 0)
                if ($rateLimitRemaining -eq "0" -and $rateLimitReset) {
                    $resetTime = [DateTimeOffset]::FromUnixTimeSeconds([int]$rateLimitReset).LocalDateTime
                    $waitSeconds = ($resetTime - (Get-Date)).TotalSeconds + 5
                    
                    if ($waitSeconds -gt 0) {
                        Write-Warning "Rate limit exceeded. Waiting until $resetTime ($([math]::Ceiling($waitSeconds)) seconds)..."
                        Start-Sleep -Seconds ([int][Math]::Ceiling($waitSeconds))
                        continue
                    }
                }
                # Secondary rate limit (Retry-After header present)
                elseif ($retryAfter) {
                    $retryAfterSeconds = [int]$retryAfter
                    Write-Warning "Secondary rate limit detected. Waiting $retryAfterSeconds seconds as requested by Retry-After header..."
                    Start-Sleep -Seconds $retryAfterSeconds
                    continue
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
        
        # Query the d-flows repository directly for workflow_call runs
        $uri = "https://api.github.com/repos/nntin/d-flows/actions/workflows/$($workflow.FileName)/runs?event=workflow_call&per_page=1"
        
        Write-Host "Querying workflow runs from nntin/d-flows..." -ForegroundColor Gray
        
        try {
            $response = Invoke-GitHubApi -Uri $uri
            
            if ($null -eq $response) {
                Write-Warning "No response for $($workflow.Name)"
                $statistics["$($workflow.Name)Total"] = 0
                continue
            }
            
            # The total_count field gives us the total number of workflow_call runs
            $totalRuns = $response.total_count
            $statistics["$($workflow.Name)Total"] = $totalRuns
            
            Write-Host "Total runs for $($workflow.Name): $totalRuns" -ForegroundColor Green
        }
        catch {
            Write-Warning "Error querying $($workflow.Name): $($_.Exception.Message)"
            $statistics["$($workflow.Name)Total"] = 0
        }
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
        $lastEntry = $csvData | Select-Object -Last 1
        
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
        
        # Return daily increments for reuse in badge generation
        return @{
            StepSummaryDaily = $stepSummaryDaily
            DiscordNotifyDaily = $discordNotifyDaily
        }
    }
    catch {
        throw "Failed to update CSV file: $($_.Exception.Message)"
    }
}

<#
.SYNOPSIS
    Generates SVG badges for workflow usage statistics.
#>
function New-WorkflowUsageBadges {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable]$CurrentStats,
        
        [Parameter(Mandatory)]
        [int]$StepSummaryDaily,
        
        [Parameter(Mandatory)]
        [int]$DiscordNotifyDaily
    )
    
    Write-Host "`nGenerating workflow usage badges..." -ForegroundColor Cyan
    
    $badgesGenerated = 0
    
    # Badge 1: step-summary total usage
    try {
        New-Badge -FileName "d-flows_step-summary-total_usage" `
                  -LeftText "d-flows/step-summary" `
                  -RightText "$($CurrentStats['step-summaryTotal'])" `
                  -RightColor "#007BFF"
        $badgesGenerated++
    }
    catch {
        Write-Warning "Failed to generate step-summary total badge: $($_.Exception.Message)"
    }
    
    # Badge 2: step-summary daily usage
    try {
        New-Badge -FileName "d-flows_step-summary-daily_usage" `
                  -LeftText "d-flows/step-summary daily" `
                  -RightText "+$StepSummaryDaily" `
                  -RightColor "#FF6B35"
        $badgesGenerated++
    }
    catch {
        Write-Warning "Failed to generate step-summary daily badge: $($_.Exception.Message)"
    }
    
    # Badge 3: discord-notify total usage
    try {
        New-Badge -FileName "d-flows_discord-notify-total_usage" `
                  -LeftText "d-flows/discord-notify" `
                  -RightText "$($CurrentStats['discord-notifyTotal'])" `
                  -RightColor "#9C27B0"
        $badgesGenerated++
    }
    catch {
        Write-Warning "Failed to generate discord-notify total badge: $($_.Exception.Message)"
    }
    
    # Badge 4: discord-notify daily usage
    try {
        New-Badge -FileName "d-flows_discord-notify-daily_usage" `
                  -LeftText "d-flows/discord-notify daily" `
                  -RightText "+$DiscordNotifyDaily" `
                  -RightColor "#4CAF50"
        $badgesGenerated++
    }
    catch {
        Write-Warning "Failed to generate discord-notify daily badge: $($_.Exception.Message)"
    }
    
    if ($badgesGenerated -eq 4) {
        Write-Host "Successfully generated 4 workflow usage badges" -ForegroundColor Green
    }
    else {
        Write-Warning "Generated $badgesGenerated out of 4 badges"
    }
}

#------------------------------------------------------ Script ----------------------------------------------------#

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
    
    # Get current usage statistics
    $currentStats = Get-WorkflowUsageStatistics
    
    # Read previous statistics
    $previousStats = Read-PreviousCsvData
    
    # Update CSV file and get daily increments
    $dailyStats = Update-WorkflowUsageCsv -CurrentStats $currentStats -PreviousStats $previousStats
    
    # Generate workflow usage badges
    New-WorkflowUsageBadges -CurrentStats $currentStats -StepSummaryDaily $dailyStats.StepSummaryDaily -DiscordNotifyDaily $dailyStats.DiscordNotifyDaily
    
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
