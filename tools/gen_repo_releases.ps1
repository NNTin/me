<#
  .DESCRIPTION
    Generates release metadata JSON for a GitHub repository.

  .OUTPUTS
    JSON file containing release version + published timestamp, intended for projects V2 timeline markers.

  .EXAMPLE
    pwsh ./tools/gen_repo_releases.ps1
    pwsh ./tools/gen_repo_releases.ps1 -Owner NNTin -Repo gSnake -OutputPath ./output/gsnake_releases.json
#>

param(
    [string]$Owner = "NNTin",
    [string]$Repo = "gSnake",
    [string]$OutputPath = ""
)

#------------------------------------------------------ Preparation -----------------------------------------------#

Import-Module "$PSScriptRoot/common.psm1" -Force

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path -Path $OUTPUT_DIR -ChildPath "gsnake_releases.json"
}

#------------------------------------------------------ Functions -------------------------------------------------#

function Get-GitHubApiToken {
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

function Get-GitHubReleases {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Owner,
        [Parameter(Mandatory = $true)]
        [string]$Repo,
        [string]$Token
    )

    $headers = @{
        "Accept" = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
        "User-Agent" = "me-releases-generator"
    }

    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $allReleases = [System.Collections.Generic.List[object]]::new()
    $perPage = 100
    $page = 1

    while ($true) {
        $uri = "https://api.github.com/repos/$Owner/$Repo/releases?per_page=$perPage&page=$page"
        $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
        $batch = @($response)

        if ($batch.Count -eq 0) {
            break
        }

        foreach ($release in $batch) {
            $allReleases.Add($release)
        }

        if ($batch.Count -lt $perPage) {
            break
        }

        $page++
    }

    return $allReleases.ToArray()
}

#------------------------------------------------------ Script ----------------------------------------------------#

Write-Host "Generating release data for $Owner/$Repo ..." -ForegroundColor Cyan
Write-Host "OutputPath: $OutputPath" -ForegroundColor Gray

$tokenInfo = Get-GitHubApiToken
$token = $null
if ($tokenInfo) {
    $token = $tokenInfo.Value
    Write-Host "Using GitHub API token from $($tokenInfo.Name)." -ForegroundColor Cyan
}
else {
    Write-Warning "No GitHub API token found. Falling back to unauthenticated API requests."
}

$rawReleases = Get-GitHubReleases -Owner $Owner -Repo $Repo -Token $token

$normalizedReleases = @($rawReleases |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_.published_at) -and -not [string]::IsNullOrWhiteSpace($_.tag_name) } |
    ForEach-Object {
        $publishedAt = [DateTime]::Parse($_.published_at).ToUniversalTime()
        $version = $_.tag_name
        [PSCustomObject]@{
            version      = $version
            published_at = $publishedAt.ToString("yyyy-MM-ddTHH:mm:ssZ")
            date         = $publishedAt.ToString("yyyy-MM-dd")
            url          = "https://nntin.xyz/gSnake/$version/"
        }
    } |
    Sort-Object -Property published_at
)

$outputObject = [PSCustomObject]@{
    generated_at  = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    owner         = $Owner
    repo          = $Repo
    release_count = $normalizedReleases.Count
    releases      = $normalizedReleases
}

$outputDirectory = Split-Path -Path $OutputPath -Parent
if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$outputObject | ConvertTo-Json -Depth 8 -Compress:$false | Out-File -FilePath $OutputPath -Encoding UTF8

Write-Host "Release data written to: $OutputPath" -ForegroundColor Green
Write-Host "Processed releases: $($normalizedReleases.Count)" -ForegroundColor Green
