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

#------------------------------------------------------ Functions -------------------------------------------------#

function Initialize-VirtualEnvironment {
    <#
    .DESCRIPTION
        Cross-platform virtual environment setup.
        - On Windows: uses Scripts\Activate.ps1
        - On Linux/macOS: uses bin/activate (bash)
    #>
    # Determine platform
    $isWindows = $IsWindows -or ($PSVersionTable.PSPlatform -eq 'Win32NT')

    $venvName = if ($IsWindows) { ".venv.win" } else { ".venv.linux" }
    $venvPath = Join-Path -Path $TOOLS_DIR -ChildPath $venvName
    $requirementsPath = Join-Path -Path $TOOLS_DIR -ChildPath "requirements.txt"
    $needsRequirements = $false


    if ($isWindows) {
        $activateScript = Join-Path -Path $venvPath -ChildPath "Scripts\Activate.ps1"
    }
    else {
        $activateScript = Join-Path -Path $venvPath -ChildPath "bin/Activate.ps1"
    }

    if (Test-Path $venvPath) {
        Write-Host "Activating existing virtual environment..." -ForegroundColor Green

        # Works for both Windows and Linux
        & $activateScript

        if ($env:VIRTUAL_ENV) {
            Write-Host "Virtual environment activated successfully" -ForegroundColor Green
        }
        else {
            throw "Failed to activate existing virtual environment"
        }
    }
    else {
        Write-Host "Virtual environment not found. Creating new virtual environment..." -ForegroundColor Yellow
        python -m venv $venvPath
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create virtual environment"
        }

        Write-Host "Activating new virtual environment..." -ForegroundColor Green

        # Works for both Windows and Linux
        & $activateScript

        if (-not $env:VIRTUAL_ENV) {
            throw "Failed to activate new virtual environment"
        }

        Write-Host "New virtual environment created and activated" -ForegroundColor Green
        $needsRequirements = $true
    }

    # Install requirements if needed
    if ($needsRequirements) {
        if (Test-Path $requirementsPath) {
            Write-Host "Installing requirements from requirements.txt..." -ForegroundColor Yellow
            pip install -r $requirementsPath
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
}

#------------------------------------------------------ Script ----------------------------------------------------#

# Export functions to be accessible when module is imported
Export-ModuleMember -Function *

# Export variables to be accessible when module is imported
Export-ModuleMember -Variable TOOLS_DIR, ROOT_DIR, OUTPUT_DIR, TMP_DIR
