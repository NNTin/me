<#
  .DESCRIPTION
    This script generates commit date badges for GitHub repositories using Cookiecutter.
    It clones repositories, analyzes their git history, and creates SVG badges showing 
    the first and last commit dates for each repository.

  .OUTPUTS
    SVG badge files in the output/badges directory:
    - First commit badges: {reponame}_first.svg  
    - Last commit badges: {reponame}_last.svg

  .NOTES
    Purpose/Change: Generate first and last commit date badges for all configured repositories.
    
    Workflow:
    1. Initialize virtual environment
    2. Clone/update repositories from configuration
    3. Analyze commit history for each repository
    4. Generate commit date badges for all repositories

  .EXAMPLE
    .\tools\gen_badges.ps1
#>

param(
)
#------------------------------------------------------ Preparation -----------------------------------------------#

# Absolute paths
$toolsDir = $PSScriptRoot
$rootDir = Split-Path -Path $toolsDir -Parent
$outputDir = Join-Path -Path $rootDir -ChildPath "output"
$tmpDir = Join-Path -Path $toolsDir -ChildPath "tmp"

# Repository configuration paths
$reposJsonPath = Join-Path -Path $toolsDir -ChildPath "data/repos.json"
$reposTestJsonPath = Join-Path -Path $toolsDir -ChildPath "data/repos_test.json"

# Determine which config to use (CI uses repos.json, local development uses repos_test.json)
$configPath = $reposJsonPath
if ($env:CI) {
    Write-Host "Running in CI - using $configPath"
} else {
    $configPath = $reposTestJsonPath
    Write-Host "Running locally - using $configPath"
}

# Our working directory is the tools directory (it contains the cookiecutter template)
Push-Location -Path $toolsDir
$cookiecutterTemplate = "cookiecutter/cookiecutter-badges"

#------------------------------------------------------ Functions -------------------------------------------------#

function Initialize-VirtualEnvironment {
    <#
    .DESCRIPTION
        Activates the virtual environment or creates it if it doesn't exist.
        Installs requirements from requirements.txt if creating a new environment.
    #>
    
    $venvPath = Join-Path -Path $toolsDir -ChildPath ".venv"
    $activateScript = Join-Path -Path $venvPath -ChildPath "Scripts\Activate.ps1"
    $requirementsPath = Join-Path -Path $toolsDir -ChildPath "requirements.txt"

    Write-Host $activateScript
    
    if (Test-Path $venvPath) {
        Write-Host "Activating existing virtual environment..." -ForegroundColor Green
        & $activateScript
        # Check if virtual env was actually activated
        if (-not $env:VIRTUAL_ENV) {
            throw "Failed to activate virtual environment"
        }
    } else {
        Write-Host "Virtual environment not found. Creating new virtual environment..." -ForegroundColor Yellow
        python -m venv $venvPath
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create virtual environment"
        }
        
        Write-Host "Activating new virtual environment..." -ForegroundColor Green
        & $activateScript
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to activate virtual environment"
        }
        
        if (Test-Path $requirementsPath) {
            Write-Host "Installing requirements from requirements.txt..." -ForegroundColor Yellow
            pip install -r $requirementsPath
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install requirements"
            }
            Write-Host "Requirements installed successfully." -ForegroundColor Green
        } else {
            Write-Warning "requirements.txt not found at $requirementsPath"
        }
    }
    
    Write-Host "Virtual environment is ready." -ForegroundColor Green
}

function New-Badge {
    <#
    .DESCRIPTION
        Generates a badge SVG file using cookiecutter template.
        
    .PARAMETER FileName
        Name of the output SVG file (without extension)
        
    .PARAMETER LeftText
        Text to display on the left side of the badge
        
    .PARAMETER RightText
        Text to display on the right side of the badge
        
    .PARAMETER LeftColor
        Background color for the left side (hex code)
        
    .PARAMETER RightColor
        Background color for the right side (hex code)
        
    .PARAMETER TextColor
        Color of the text (hex code)
    #>
    
    param(       
        [Parameter(Mandatory = $true)] [string]$LeftText,
        [Parameter(Mandatory = $true)] [string]$RightText,
        [string]$FileName = "badge",
        [string]$LeftColor = "#555555",
        [string]$RightColor = "#4c1",
        [string]$TextColor = "#ffffff"
    )
    
    Write-Host "Generating badge: output.svg" -ForegroundColor Cyan
    
    # Execute cookiecutter with parameters
    # There is a caveat here: cookiecutter always creates the output in a template subdirectory
    # Therefore we will move the generated file to the desired output directory afterwards
    # The generated file is located at $tmpDir/output/output.svg
    $cookiecutterArgs = @(
        "./cookiecutter/cookiecutter-badges"
        "--output-dir", $tmpDir
        "--overwrite-if-exists"
        "--no-input"
        "filename=output"
        "left_text=$LeftText"
        "right_text=$RightText"
        "left_color=$LeftColor"
        "right_color=$RightColor"
        "text_color=$TextColor"
    )
    
    cookiecutter @cookiecutterArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate badge: output.svg"
    }
    
    Write-Host "Badge generated successfully: output.svg" -ForegroundColor Green
    
    # Move and rename the generated file to the output directory
    $sourceFile = Join-Path -Path $tmpDir -ChildPath "output/output.svg"
    $badgesDir = Join-Path -Path $outputDir -ChildPath "badges"
    $destinationFile = Join-Path -Path $badgesDir -ChildPath "$FileName.svg"

    # Ensure output directory exists
    if (-not (Test-Path $badgesDir)) {
        New-Item -ItemType Directory -Path $badgesDir -Force | Out-Null
        Write-Host "Created output directory: $badgesDir" -ForegroundColor Yellow
    }
    
    # Move and rename the file (overwrite if exists)
    Move-Item -Path $sourceFile -Destination $destinationFile -Force
    Write-Host "Badge moved to: $destinationFile" -ForegroundColor Green
}

function Clone-Repositories {
    <#
    .DESCRIPTION
        Clones git repositories from the configuration file to the temporary git directory.
        Performs full clones to preserve git history.
    #>
    
    # Ensure the git directory exists
    $gitDir = Join-Path -Path $tmpDir -ChildPath "git"
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
        } else {
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
    
    $gitDir = Join-Path -Path $tmpDir -ChildPath "git"
    
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
            
            # Create repository info object
            $repoInfo = [PSCustomObject]@{
                GitHubUrl = $githubUrl
                Owner = $owner
                Repository = $repoName
                FirstCommitDate = $firstCommitDateTime
                LastCommitDate = $lastCommitDateTime
                FirstCommitDateLong = $firstCommitDateTime.ToString("yyyy-MM-dd HH:mm:ss")
                LastCommitDateLong = $lastCommitDateTime.ToString("yyyy-MM-dd HH:mm:ss")
                FirstCommitDateShort = $firstCommitDateTime.ToString("yyyy-MM-dd")
                LastCommitDateShort = $lastCommitDateTime.ToString("yyyy-MM-dd")
            }
            
            $commitHistory += $repoInfo
            
            Write-Host "  First commit: $($repoInfo.FirstCommitDateShort)" -ForegroundColor Gray
            Write-Host "  Last commit:  $($repoInfo.LastCommitDateShort)" -ForegroundColor Gray
            
        } catch {
            Write-Warning "Error analyzing $owner/$repoName - $($_.Exception.Message)"
        } finally {
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

    Write-Host "Generated badges for $($RepoInfo.Repository): $firstCommitFileName.svg, $lastCommitFileName.svg" -ForegroundColor Green
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
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        Write-Host "Created output directory: $outputDir" -ForegroundColor Yellow
    }
    
    # Define the JSON file path
    $jsonFilePath = Join-Path -Path $outputDir -ChildPath "repoInfos.json"
    
    try {
        # Convert to JSON with proper formatting
        $jsonContent = $RepoInfos | ConvertTo-Json -Depth 3 -Compress:$false
        
        # Save to file
        $jsonContent | Out-File -FilePath $jsonFilePath -Encoding UTF8
        
        Write-Host "Repository information exported to: $jsonFilePath" -ForegroundColor Green
        Write-Host "Exported $($RepoInfos.Count) repositories" -ForegroundColor Gray
        
    } catch {
        Write-Error "Failed to export repository information to JSON: $($_.Exception.Message)"
        throw "JSON export failed"
    }
}

#------------------------------------------------------ Script ----------------------------------------------------#

# Initialize the virtual environment
Initialize-VirtualEnvironment

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