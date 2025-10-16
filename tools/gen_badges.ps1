<#
  .DESCRIPTION
    This script generates badges using Cookiecutter.

  .OUTPUTS
    SVG files for each badge in the output directory.

  .NOTES
    Purpose/Change: Generate badges using Cookiecutter.

  .EXAMPLE
    .\tools\gen_badges.ps1
#>
#------------------------------------------------------ Preparation -----------------------------------------------#

# Absolute paths
$toolsDir = $PSScriptRoot
$rootDir = Split-Path -Path $toolsDir -Parent
$outputDir = Join-Path -Path $rootDir -ChildPath "output/badges"
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
    
    Write-Host "Generating badge: $FileName" -ForegroundColor Cyan
    
    # Execute cookiecutter with parameters
    $cookiecutterArgs = @(
        "./cookiecutter/cookiecutter-badges"
        "--output-dir", $tmpDir
        "--overwrite-if-exists"
        "--no-input"
        "filename=$FileName"
        "left_text=$LeftText"
        "right_text=$RightText"
        "left_color=$LeftColor"
        "right_color=$RightColor"
        "text_color=$TextColor"
    )
    
    cookiecutter @cookiecutterArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate badge: $FileName"
    }
    
    Write-Host "Badge generated successfully: $FileName.svg" -ForegroundColor Green
}

#------------------------------------------------------ Script ----------------------------------------------------#

# Initialize the virtual environment
Initialize-VirtualEnvironment

# Create a test badge with mock data
New-Badge -FileName "test-badge" -LeftText "test" -RightText "success"
