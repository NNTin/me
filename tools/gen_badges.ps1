<#
  .DESCRIPTION
    This script generates badges using Cookiecutter.

  .PARAMETER Name
    Name of the badge file to generate (without extension). Default is "badge".

  .OUTPUTS
    SVG files for each badge in the output directory.

  .NOTES
    Purpose/Change: Generate badges using Cookiecutter.

  .EXAMPLE
    .\tools\gen_badges.ps1
    
  .EXAMPLE
    .\tools\gen_badges.ps1 -Name "my-custom-badge"
#>

param(
    [string]$Name = "badge"
)
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
    $destinationFile = Join-Path -Path $outputDir -ChildPath "$FileName.svg"
    
    # Ensure output directory exists
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        Write-Host "Created output directory: $outputDir" -ForegroundColor Yellow
    }
    
    # Move and rename the file (overwrite if exists)
    Move-Item -Path $sourceFile -Destination $destinationFile -Force
    Write-Host "Badge moved to: $destinationFile" -ForegroundColor Green
}

#------------------------------------------------------ Script ----------------------------------------------------#

# Initialize the virtual environment
Initialize-VirtualEnvironment

# Create a test badge with mock data
New-Badge -FileName $Name -LeftText "test" -RightText "success"
