<#
.DESCRIPTION
    Contains shared functions and utilities for use across multiple scripts.

.NOTES
    a work in progress...

.EXAMPLE
    Import-Module -Name .\tools\common.psm1
    This command imports the common module, making its functions available for use.
#>
#------------------------------------------------------ Preparation -----------------------------------------------#

# Define the root directories based on the module location
$TOOLS_DIR = $PSScriptRoot
$ROOT_DIR = Split-Path -Path $TOOLS_DIR -Parent
$OUTPUT_DIR = Join-Path -Path $ROOT_DIR -ChildPath "output"
$TMP_DIR = Join-Path -Path $TOOLS_DIR -ChildPath "tmp"

# Make variables read-only to prevent accidental changes
Set-Variable -Name TOOLS_DIR -Value $TOOLS_DIR -Option ReadOnly -Scope Script
Set-Variable -Name ROOT_DIR -Value $ROOT_DIR -Option ReadOnly -Scope Script
Set-Variable -Name OUTPUT_DIR -Value $OUTPUT_DIR -Option ReadOnly -Scope Script
Set-Variable -Name TMP_DIR -Value $TMP_DIR -Option ReadOnly -Scope Script

# Script-level variable to store the venv Python executable path
$script:PYTHON_EXE = $null

#------------------------------------------------------ Functions -------------------------------------------------#

function Initialize-VirtualEnvironment {
    <#
    .DESCRIPTION
        Cross-platform virtual environment setup.
        Uses the venv Python executable directly instead of relying on activation scripts.
        Returns the path to the venv Python executable for use by other functions.
    #>
    # Determine platform
    $IsOnWindows = $IsWindows -or ($PSVersionTable.PSPlatform -eq 'Win32NT')

    $venvName = if ($IsOnWindows) { ".venv.win" } else { ".venv.linux" }
    $venvPath = Join-Path -Path $TOOLS_DIR -ChildPath $venvName
    $requirementsPath = Join-Path -Path $TOOLS_DIR -ChildPath "requirements.txt"
    
    # Determine Python executable path in venv
    $pythonExe = Join-Path -Path $venvPath -ChildPath ($IsOnWindows ? "Scripts/python.exe" : "bin/python")

    if (Test-Path $venvPath) {
        Write-Host "Using existing virtual environment at $venvPath" -ForegroundColor Green
    }
    else {
        Write-Host "Virtual environment not found. Creating new virtual environment..." -ForegroundColor Yellow
        python -m venv $venvPath
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create virtual environment"
        }

        Write-Host "New virtual environment created at $venvPath" -ForegroundColor Green
        
        # Install requirements for new venv
        if (Test-Path $requirementsPath) {
            Write-Host "Installing requirements from requirements.txt..." -ForegroundColor Yellow
            & $pythonExe -m pip install -r $requirementsPath
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install requirements"
            }
            Write-Host "Requirements installed successfully" -ForegroundColor Green
        }
        else {
            Write-Warning "requirements.txt not found at $requirementsPath"
        }
    }

    Write-Host "Environment is ready" -ForegroundColor Green
    
    # Store the Python executable path at script level for use by other functions
    $script:PYTHON_EXE = $pythonExe
    
    # Return the Python executable path for use by other functions
    return $pythonExe
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
    # The generated file is located at $TMP_DIR/output/output.svg
    $templatePath = Join-Path -Path $TOOLS_DIR -ChildPath "cookiecutter/cookiecutter-badges"
    $cookiecutterArgs = @(
        $templatePath
        "--output-dir", $TMP_DIR
        "--overwrite-if-exists"
        "--no-input"
        "filename=output"
        "left_text=$LeftText"
        "right_text=$RightText"
        "left_color=$LeftColor"
        "right_color=$RightColor"
        "text_color=$TextColor"
    )
    
    # Ensure tmp directory exists before cookiecutter writes to it
    if (-not (Test-Path -Path $TMP_DIR)) {
        New-Item -ItemType Directory -Path $TMP_DIR -Force | Out-Null
    }
    
    # Call cookiecutter via the venv Python executable to ensure it's found on all platforms
    if (-not $script:PYTHON_EXE) {
        throw "Virtual environment not initialized. Call Initialize-VirtualEnvironment first."
    }
    
    & $script:PYTHON_EXE -m cookiecutter @cookiecutterArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate badge: output.svg"
    }
    
    Write-Host "Badge generated successfully: output.svg" -ForegroundColor Green
    
    # Move and rename the generated file to the output directory
    $sourceFile = Join-Path -Path $TMP_DIR -ChildPath "output/output.svg"
    $badgesDir = Join-Path -Path $OUTPUT_DIR -ChildPath "badges"
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

#------------------------------------------------------ Script ----------------------------------------------------#

# Export functions to be accessible when module is imported
Export-ModuleMember -Function *

# Export variables to be accessible when module is imported
Export-ModuleMember -Variable TOOLS_DIR, ROOT_DIR, OUTPUT_DIR, TMP_DIR
