<#
  .DESCRIPTION
  .OUTPUTS
  .NOTES
  .EXAMPLE
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

# source directory is ROOT_DIR/_site/pandoc
# destination directory is OUTPUT_DIR/pdf
$sourceDir = Join-Path $ROOT_DIR "_site/pandoc"
$destDir = Join-Path $OUTPUT_DIR "pdf"
$cssDir = Join-Path $ROOT_DIR "assets/css"
$imagesDir = Join-Path $ROOT_DIR "assets/images"

#------------------------------------------------------ Functions -------------------------------------------------#

<#
.SYNOPSIS
    Converts all files in a source directory to PDF using WeasyPrint
.DESCRIPTION
    This function processes all files in the specified source directory and converts them to PDF format
    using the Python WeasyPrint module. Each source file is converted to a PDF with the same name
    but with a .pdf extension in the destination directory.
.PARAMETER SourceDirectory
    The directory containing source files to convert
.PARAMETER DestinationDirectory
    The directory where PDF files will be saved
.PARAMETER CssDirectory
    The directory containing CSS files for styling the PDFs
.PARAMETER ImagesDirectory
    The directory containing images for the documents (optional)
.EXAMPLE
    Convert-DirectoryToPdf -SourceDirectory "C:\docs\html" -DestinationDirectory "C:\docs\pdf" -CssDirectory "C:\docs\css"
.EXAMPLE
    Convert-DirectoryToPdf -SourceDirectory "C:\docs\html" -DestinationDirectory "C:\docs\pdf" -CssDirectory "C:\docs\css" -ImagesDirectory "C:\docs\images"
#>
function Convert-DirectoryToPdf {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory,
        
    [Parameter(Mandatory = $true)]
    [string]$DestinationDirectory,
        
    [Parameter(Mandatory = $true)]
    [string]$CssDirectory,
        
    [Parameter(Mandatory = $false)]
    [string]$ImagesDirectory
  )
    
  # Validate input directories
  if (!(Test-Path $SourceDirectory)) {
    Write-Error "Source directory does not exist: $SourceDirectory"
    return
  }
    
  if (!(Test-Path $CssDirectory)) {
    Write-Error "CSS directory does not exist: $CssDirectory"
    return
  }
    
  # Validate images directory if provided
  if ($ImagesDirectory -and !(Test-Path $ImagesDirectory)) {
    Write-Warning "Images directory does not exist: $ImagesDirectory"
    Write-Host "Continuing without images directory..." -ForegroundColor Yellow
    $ImagesDirectory = $null
  }
    
  # Create destination directory if it doesn't exist
  if (!(Test-Path $DestinationDirectory)) {
    Write-Host "Creating destination directory: $DestinationDirectory" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
  }
    
  # Get the Python module path
  $pythonModule = Join-Path $TOOLS_DIR "gen_docs\convert_to_pdf.py"
    
  if (!(Test-Path $pythonModule)) {
    Write-Error "Python module not found: $pythonModule"
    return
  }
    
  # Get all files in source directory recursively (including subdirectories)
  $sourceFiles = Get-ChildItem -Path $SourceDirectory -File -Recurse
    
  if ($sourceFiles.Count -eq 0) {
    Write-Warning "No files found in source directory: $SourceDirectory"
    return
  }
    
  Write-Host "Found $($sourceFiles.Count) files to convert" -ForegroundColor Green
    
  $successCount = 0
  $failureCount = 0
    
  foreach ($file in $sourceFiles) {
    # Calculate relative path from source directory
    $relativePath = $file.FullName.Substring($SourceDirectory.Length).TrimStart('\', '/')
    
    # Generate destination PDF filename based on the structure
    if ($file.Name -eq "index.html") {
      # For index.html files, use the parent directory name as the PDF filename
      # e.g., cv/index.html -> cv.pdf
      $parentDirName = Split-Path $relativePath -Parent
      if ([string]::IsNullOrEmpty($parentDirName)) {
        # If index.html is in root, use "index" as filename
        $pdfFileName = "index.pdf"
      }
      else {
        # Use the directory name as the PDF filename
        $pdfFileName = $parentDirName.Replace('\', '_').Replace('/', '_') + ".pdf"
      }
    }
    else {
      # For regular files, use the filename without extension
      # e.g., helloworld.html -> helloworld.pdf
      $pdfFileName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".pdf"
    }
    
    $destinationFile = Join-Path $DestinationDirectory $pdfFileName
        
    Write-Host "Converting: $relativePath -> $pdfFileName" -ForegroundColor Cyan
        
    try {
      # Run the Python module
      $pythonArgs = @(
        $pythonModule,
        $file.FullName,
        $destinationFile,
        $CssDirectory
      )
      
      # Add images directory if provided
      if ($ImagesDirectory) {
        $pythonArgs += $ImagesDirectory
      }
            
      $result = & python @pythonArgs
            
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Success: $pdfFileName" -ForegroundColor Green
        $successCount++
      }
      else {
        Write-Host "  ✗ Failed: $relativePath" -ForegroundColor Red
        Write-Host "    Error output: $result" -ForegroundColor Red
        $failureCount++
      }
    }
    catch {
      Write-Host "  ✗ Exception: $relativePath" -ForegroundColor Red
      Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
      $failureCount++
    }
  }
    
  # Summary
  Write-Host "`nConversion Summary:" -ForegroundColor Yellow
  Write-Host "  Successful: $successCount" -ForegroundColor Green
  Write-Host "  Failed: $failureCount" -ForegroundColor Red
  Write-Host "  Total: $($sourceFiles.Count)" -ForegroundColor Blue
    
  if ($failureCount -eq 0) {
    Write-Host "All files converted successfully!" -ForegroundColor Green
  }
  else {
    Write-Warning "Some files failed to convert. Check the error messages above."
  }
}

<#
.SYNOPSIS
    Builds the Jekyll site by running bundle install and bundle exec jekyll build
.DESCRIPTION
    This function navigates to the root directory, runs bundle install to ensure dependencies
    are up to date, then runs bundle exec jekyll build to generate the site, and finally
    returns to the original directory.
.EXAMPLE
    Build-JekyllSite
#>
function Build-JekyllSite {
  # Store the current directory
  $originalLocation = Get-Location
  
  try {
    Write-Host "Building Jekyll site..." -ForegroundColor Yellow
    
    # Navigate to the root directory
    Set-Location $ROOT_DIR
    Write-Host "  Changed to directory: $ROOT_DIR" -ForegroundColor Cyan
    
    # Run bundle install
    Write-Host "  Running bundle install..." -ForegroundColor Cyan
    $bundleInstallResult = & bundle install
    
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Bundle install failed with exit code $LASTEXITCODE"
      Write-Host "  Error output: $bundleInstallResult" -ForegroundColor Red
      return $false
    }
    
    Write-Host "  ✓ Bundle install completed successfully" -ForegroundColor Green
    
    # Run jekyll build
    Write-Host "  Running bundle exec jekyll build..." -ForegroundColor Cyan
    $jekyllBuildResult = & bundle exec jekyll build
    
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Jekyll build failed with exit code $LASTEXITCODE"
      Write-Host "  Error output: $jekyllBuildResult" -ForegroundColor Red
      return $false
    }
    
    Write-Host "  ✓ Jekyll build completed successfully" -ForegroundColor Green
    Write-Host "Jekyll site built successfully!" -ForegroundColor Green
    
    return $true
  }
  catch {
    Write-Error "Error building Jekyll site: $($_.Exception.Message)"
    return $false
  }
  finally {
    # Always return to the original directory
    Set-Location $originalLocation
    Write-Host "  Returned to directory: $originalLocation" -ForegroundColor Cyan
  }
}

#------------------------------------------------------ Script ----------------------------------------------------#

# Initialize the virtual environment
Initialize-VirtualEnvironment

# TODO: differentiate between CI and locally
# Build the Jekyll site first
# Write-Host "Step 1: Building Jekyll site..." -ForegroundColor Yellow
# $buildSuccess = Build-JekyllSite
# if (-not $buildSuccess) {
#   Write-Error "Jekyll build failed. Cannot proceed with PDF conversion."
#   exit 1
# }

# Convert HTML files to PDF
Write-Host "Converting HTML files to PDF..." -ForegroundColor Yellow
Convert-DirectoryToPdf -SourceDirectory $sourceDir -DestinationDirectory $destDir -CssDirectory $cssDir -ImagesDirectory $imagesDir