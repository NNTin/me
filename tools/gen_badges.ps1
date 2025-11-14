<#
  .DESCRIPTION
    This script generates badges for GitHub repositories using Cookiecutter. It clones 
    repositories, analyzes their git history, and creates SVG badges for each repository.

  .OUTPUTS
    SVG badge files in the output/badges directory:
    - First commit badges: {reponame}_first.svg  
    - Last commit badges: {reponame}_last.svg
    - Commit count badges: {reponame}_commits.svg
    - Active days badges: {reponame}_days.svg
    - Lines added badges: {reponame}_added.svg
    - Lines removed badges: {reponame}_removed.svg

  .NOTES
    Purpose/Change: Generate SVG badges for all configured repositories.
    
    Workflow:
    1. Initialize virtual environment
    2. Clone/update repositories from configuration
    3. Analyze commit history for each repository
    4. Generate commit date badges for all repositories

    TODOs:
    - export languages used per repository
    - serve as additional badges (or maybe even as a graph)

  .EXAMPLE
    .\tools\gen_badges.ps1
#>

param(
)
#------------------------------------------------------ Preparation -----------------------------------------------#

# ----- Import common module ----- 
Import-Module "$PSScriptRoot/common.psm1" -Force

# Absolute paths (from common module)
Write-Host "ToolsDir = $TOOLS_DIR"
Write-Host "RootDir = $ROOT_DIR"
Write-Host "OUTPUT_DIR = $OUTPUT_DIR"
Write-Host "TMP_DIR = $TMP_DIR"

# Initialize-VirtualEnvironment from common module is imported

# ----- Import common module end -----

# Repository configuration paths
$reposJsonPath = Join-Path -Path $ROOT_DIR -ChildPath "_data/repos.json"
$reposTestJsonPath = Join-Path -Path $TOOLS_DIR -ChildPath "data/repos_test.json"

# Determine which config to use (CI uses repos.json, local development uses repos_test.json)
$configPath = $reposJsonPath
if ($env:CI) {
    Write-Host "Running in CI - using $configPath"
}
else {
    $configPath = $reposTestJsonPath
    Write-Host "Running locally - using $configPath"
}

# Our working directory is the tools directory (it contains the cookiecutter template)
Push-Location -Path $TOOLS_DIR
$cookiecutterTemplate = "cookiecutter/cookiecutter-badges"

#------------------------------------------------------ Functions -------------------------------------------------#

function Clone-Repositories {
    <#
    .DESCRIPTION
        Clones git repositories from the configuration file to the temporary git directory.
        Performs full clones to preserve git history.
    #>
    
    # Ensure the git directory exists
    $gitDir = Join-Path -Path $TMP_DIR -ChildPath "git"
    if (-not (Test-Path $gitDir)) {
        New-Item -ItemType Directory -Path $gitDir -Force | Out-Null
        Write-Host "Created git directory: $gitDir" -ForegroundColor Yellow
    }
    
    # Load repository configuration
    if (-not (Test-Path $configPath)) {
        throw "Configuration file not found: $configPath"
    }
    
    Write-Host "Loading repository configuration from: $configPath" -ForegroundColor Cyan
    $repos = Get-Content -Path $configPath | ConvertFrom-Json
    
    Write-Host "Found $($repos.Count) repositories to clone" -ForegroundColor Cyan
    
    # Clone each repository sequentially
    foreach ($repo in $repos) {
        $owner = $repo.owner
        $repoName = $repo.repo
        $cloneUrl = "https://github.com/$owner/$repoName.git"
        $repoPath = Join-Path -Path $gitDir -ChildPath $repoName
        
        Write-Host "Cloning repository: $owner/$repoName" -ForegroundColor Yellow
        
        # Check if repository already exists
        if (Test-Path $repoPath) {
            Write-Host "Repository already exists. Fetching latest changes: $repoPath" -ForegroundColor Yellow
            Push-Location -Path $repoPath
            git fetch --all
            Pop-Location
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to fetch updates for repository: $owner/$repoName"
                throw "Git fetch failed for $owner/$repoName"
            }
            
            Write-Host "Successfully updated: $owner/$repoName" -ForegroundColor Green
        }
        else {
            # Perform git clone
            git clone $cloneUrl $repoPath
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to clone repository: $owner/$repoName"
                throw "Git clone failed for $owner/$repoName"
            }
            
            Write-Host "Successfully cloned: $owner/$repoName" -ForegroundColor Green
        }
    }
    
    Write-Host "All repositories cloned successfully" -ForegroundColor Green
}

function Get-RepositoryCommitHistory {
    <#
    .DESCRIPTION
        Analyzes git history of each repository and returns commit date information.
        
    .OUTPUTS
        Array of objects containing GitHub URL, first commit date, and last commit date for each repository.
    #>
    
    $gitDir = Join-Path -Path $TMP_DIR -ChildPath "git"
    
    if (-not (Test-Path $gitDir)) {
        throw "Git directory not found: $gitDir. Please run Clone-Repositories first."
    }
    
    # Load repository configuration to get owner information
    if (-not (Test-Path $configPath)) {
        throw "Configuration file not found: $configPath"
    }
    
    $repos = Get-Content -Path $configPath | ConvertFrom-Json
    $commitHistory = @()
    
    Write-Host "Analyzing commit history for repositories..." -ForegroundColor Cyan
    
    foreach ($repo in $repos) {
        $owner = $repo.owner
        $repoName = $repo.repo
        $repoPath = Join-Path -Path $gitDir -ChildPath $repoName
        $githubUrl = "https://github.com/$owner/$repoName"
        
        if (-not (Test-Path $repoPath)) {
            Write-Warning "Repository directory not found: $repoPath. Skipping $owner/$repoName"
            continue
        }
        
        Write-Host "Analyzing: $owner/$repoName" -ForegroundColor Yellow
        
        Push-Location -Path $repoPath
        
        try {
            # Check if this is a valid git repository
            $gitStatus = git status 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Not a valid git repository: $repoPath"
                continue
            }
            
            # Check if repository has any commits
            $commitCount = git rev-list --count HEAD 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Repository has no commits: $owner/$repoName"
                continue
            }
            
            # Get first commit date (oldest)
            $firstCommitDate = git log --reverse --format="%ci" | Select-Object -First 1
            
            if ([string]::IsNullOrWhiteSpace($firstCommitDate)) {
                Write-Warning "Failed to get first commit date for $owner/$repoName (repository may be empty)"
                continue
            }
            
            # Get last commit date (most recent)
            $lastCommitDate = git log --format="%ci" | Select-Object -First 1
            
            if ([string]::IsNullOrWhiteSpace($lastCommitDate)) {
                Write-Warning "Failed to get last commit date for $owner/$repoName"
                continue
            }
            
            # Parse dates to DateTime objects for better handling
            $firstCommitDateTime = [DateTime]::Parse($firstCommitDate)
            $lastCommitDateTime = [DateTime]::Parse($lastCommitDate)
            
            # Calculate additional repository metrics
            # Commit count (already checked above)
            try {
                $commitCountRaw = git rev-list --count HEAD 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $commitCount = [int]($commitCountRaw.ToString().Trim())
                }
                else {
                    $commitCount = 0
                }
            }
            catch {
                $commitCount = 0
            }

            # Active days: unique commit dates (YYYY-MM-DD)
            $activeDays = 0
            try {
                $commitDatesRaw = git log --date=short --format='%ad' 2>&1
                if ($LASTEXITCODE -eq 0 -and $commitDatesRaw) {
                    $uniqueDates = @($commitDatesRaw) | Sort-Object -Unique
                    $activeDays = $uniqueDates.Count
                }
            }
            catch {
                $activeDays = 0
            }

            # Lines added / removed: sum from git log --numstat
            $linesAdded = 0
            $linesRemoved = 0
            try {
                $numstatLines = git log --pretty=tformat: --numstat 2>&1
                if ($LASTEXITCODE -eq 0 -and $numstatLines) {
                    foreach ($ln in @($numstatLines)) {
                        # numstat lines are: <added>\t<removed>\t<filename>
                        if ($ln -and $ln -match '^\d+') {
                            $parts = $ln -split "\t"
                            if ($parts.Length -ge 2) {
                                $added = 0
                                $removed = 0
                                [int]::TryParse($parts[0], [ref]$added) | Out-Null
                                [int]::TryParse($parts[1], [ref]$removed) | Out-Null
                                $linesAdded += $added
                                $linesRemoved += $removed
                            }
                        }
                    }
                }
            }
            catch {
                # leave totals at 0 on error
            }

            # Create repository info object with extended metrics
            $repoInfo = [PSCustomObject]@{
                GitHubUrl            = $githubUrl
                Owner                = $owner
                Repository           = $repoName
                FirstCommitDate      = $firstCommitDateTime
                LastCommitDate       = $lastCommitDateTime
                FirstCommitDateLong  = $firstCommitDateTime.ToString("yyyy-MM-dd HH:mm:ss")
                LastCommitDateLong   = $lastCommitDateTime.ToString("yyyy-MM-dd HH:mm:ss")
                FirstCommitDateShort = $firstCommitDateTime.ToString("yyyy-MM-dd")
                LastCommitDateShort  = $lastCommitDateTime.ToString("yyyy-MM-dd")
                CommitCount          = $commitCount
                ActiveDays           = $activeDays
                LinesAdded           = $linesAdded
                LinesRemoved         = $linesRemoved
            }

            $commitHistory += $repoInfo

            Write-Host "  First commit: $($repoInfo.FirstCommitDateShort)" -ForegroundColor Gray
            Write-Host "  Last commit:  $($repoInfo.LastCommitDateShort)" -ForegroundColor Gray
            Write-Host "  Commits:      $($repoInfo.CommitCount)" -ForegroundColor Gray
            Write-Host "  Active days:  $($repoInfo.ActiveDays)" -ForegroundColor Gray
            Write-Host "  +Lines:       $($repoInfo.LinesAdded)  -Lines: $($repoInfo.LinesRemoved)" -ForegroundColor Gray
            
        }
        catch {
            Write-Warning "Error analyzing $owner/$repoName - $($_.Exception.Message)"
        }
        finally {
            Pop-Location
        }
    }
    
    Write-Host "Commit history analysis complete. Processed $($commitHistory.Count) repositories." -ForegroundColor Green
    
    return $commitHistory
}

function New-CommitBadges {
    <#
    .DESCRIPTION
        Generates badges for first and last commit dates for each repository.
        
    .PARAMETER RepoInfo
        Repository information object containing commit dates and repository details.
    #>
    
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject]$RepoInfo
    )
    
    $repoNameLower = $RepoInfo.Repository.ToLower()
    
    Write-Host "Generating commit badges for repository: $($RepoInfo.Repository)" -ForegroundColor Cyan
    
    # In future we will do color gradient based on age of commit red (-> orange) -> yellow (-> blue) -> green?
    # Generate first commit badge
    $firstCommitFileName = "${repoNameLower}_first"
    New-Badge -LeftText "First Commit" -RightText $RepoInfo.FirstCommitDateShort -FileName $firstCommitFileName -RightColor "#007BFF"
    
    # Generate last commit badge
    $lastCommitFileName = "${repoNameLower}_last"
    New-Badge -LeftText "Last Commit" -RightText $RepoInfo.LastCommitDateShort -FileName $lastCommitFileName -RightColor "#4CAF50"

    # Generate commit count badge
    $commitCountFileName = "${repoNameLower}_commits"
    New-Badge -LeftText "Commits" -RightText $RepoInfo.CommitCount.ToString() -FileName $commitCountFileName -RightColor "#FF6B35"

    # Generate active days badge
    $activeDaysFileName = "${repoNameLower}_days"
    New-Badge -LeftText "Active Days" -RightText $RepoInfo.ActiveDays.ToString() -FileName $activeDaysFileName -RightColor "#9C27B0"

    # Generate lines added badge
    $linesAddedFileName = "${repoNameLower}_added"
    New-Badge -LeftText "Lines Added" -RightText "+$($RepoInfo.LinesAdded)" -FileName $linesAddedFileName -RightColor "#4CAF50"

    # Generate lines removed badge
    $linesRemovedFileName = "${repoNameLower}_removed"
    New-Badge -LeftText "Lines Removed" -RightText "-$($RepoInfo.LinesRemoved)" -FileName $linesRemovedFileName -RightColor "#F44336"

    Write-Host "Generated badges for $($RepoInfo.Repository): $firstCommitFileName.svg, $lastCommitFileName.svg, $commitCountFileName.svg, $activeDaysFileName.svg, $linesAddedFileName.svg, $linesRemovedFileName.svg" -ForegroundColor Green
}

function Export-RepoInfosToJson {
    <#
    .DESCRIPTION
        Converts repository information array to JSON and saves it to the output directory.
        
    .PARAMETER RepoInfos
        Array of repository information objects to convert to JSON.
    #>
    
    param(
        [Parameter(Mandatory = $true)]
        [array]$RepoInfos
    )
    
    Write-Host "Exporting repository information to JSON..." -ForegroundColor Cyan
    
    # Ensure output directory exists
    if (-not (Test-Path $OUTPUT_DIR)) {
        New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
        Write-Host "Created output directory: $OUTPUT_DIR" -ForegroundColor Yellow
    }
    
    # Define the JSON file path
    $jsonFilePath = Join-Path -Path $OUTPUT_DIR -ChildPath "repoInfos.json"
    
    try {
        # Sort repositories by FirstCommitDate (oldest first, newest last)
        $sortedRepoInfos = $RepoInfos | Sort-Object FirstCommitDate
        
        # Convert to JSON with proper formatting
        $jsonContent = $sortedRepoInfos | ConvertTo-Json -Depth 3 -Compress:$false
        
        # Save to file
        $jsonContent | Out-File -FilePath $jsonFilePath -Encoding UTF8
        
        Write-Host "Repository information exported to: $jsonFilePath" -ForegroundColor Green
        Write-Host "Exported $($RepoInfos.Count) repositories" -ForegroundColor Gray
        
    }
    catch {
        Write-Error "Failed to export repository information to JSON: $($_.Exception.Message)"
        throw "JSON export failed"
    }
}

#------------------------------------------------------ Script ----------------------------------------------------#

# Initialize the virtual environment
$script:PYTHON_EXE = Initialize-VirtualEnvironment

# Clone repositories from configuration
Clone-Repositories

# Gets an array of repository info objects with commit dates
$repoInfos = Get-RepositoryCommitHistory

# Generate commit badges for each repository
Write-Host "Generating commit badges for all repositories..." -ForegroundColor Cyan
foreach ($repoInfo in $repoInfos) {
    New-CommitBadges -RepoInfo $repoInfo
}
Write-Host "All commit badges generated successfully!" -ForegroundColor Green

# Write to output directory
Export-RepoInfosToJson -RepoInfos $repoInfos