# Copyright 2022 Spicetify. GPL license.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)
param (
  [string] $version
)

$PSMinVersion = 3

if ($v) {
    $version = $v
}

# Function to log output to file.
Function Log {
  Param([String] $ActionText, [String[]] $Texts, [Boolean[]] $Emphasized, [Boolean] $NewLine)
  if (-not (Test-Path $log_file_dir)) {
    New-Item -Path $log_file_dir -ItemType File -Force | Out-Null
  }
  if (-not ([String]::IsNullOrEmpty($ActionText))) {
    $FormattedActionText = "{0, -15}" -f $ActionText
    Write-Part $FormattedActionText
  }
  $LogText = $FormattedActionText
  for ($i=0; $i -lt $Texts.Length -AND $Texts.Length -eq $Emphasized.Length; $i++) {
    if ($Emphasized.Get($i)) {
      Write-Emphasized $Texts.Get($i)
    } else {
      Write-Part $Texts.Get($i)
    }
    $LogText = $LogText + $Texts.Get($i)
  }
  $LogText = "[{0}] {1}" -f (Get-Date -f "HH:mm:ss yyyy-MM-dd"), $LogText
  Add-content $log_file_dir -value $LogText -NoNewline
}

# Helper functions for pretty terminal output.
function Write-Part ([String] $Text) {
  Write-Host $Text -Nonewline
}

function Write-Emphasized ([string] $Text) {
  Write-Host $Text -NoNewLine -ForegroundColor "Cyan"
}

function Write-Done {
  Write-Host " > " -NoNewline
  Write-Host "OK" -ForegroundColor "Green"
  Add-Content $log_file_dir -value " > OK"
}

function RemoveOldPath {
  $oldsp_dir = "${HOME}\spicetify-cli"
  $isinpath = $paths -contains $oldsp_dir -or $paths -contains "${oldsp_dir}\"
  if ($isinpath) {
    Log "REMOVING" -Texts $oldsp_dir, " from Path" -Emphasized $true, $false

    $replacedpath = $path.replace(";$oldsp_dir", "")
    [Environment]::SetEnvironmentVariable("PATH", $replacedpath, $user)
    $env:PATH = $env:PATH.replace(";$oldsp_dir","")
    Write-Done
  }
}

function MigrateCfgFolder {
  $oldsp_dircontent = "${HOME}\spicetify-cli\*"
  $oldsp_dir = "${HOME}\spicetify-cli"
  if (Test-Path -Path $oldsp_dir) {
    Log "MIGRATING" -Texts $oldsp_dir, " into", $sp_dir -Emphasized $true, $false, $true
    Copy-item -Force -Recurse $oldsp_dircontent -Destination $sp_dir
    Write-Done
    Log "REMOVING" -Texts $oldsp_dir -Emphasized $true
    Remove-Item -LiteralPath $oldsp_dir -Force -Recurse
    Write-Done
  }
}

if ($PSVersionTable.PSVersion.Major -gt $PSMinVersion) {
  $ErrorActionPreference = "Stop"

  # Enable TLS 1.2 since it is required for connections to GitHub.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  # Create %localappdata%\spicetify directory if it doesn't already exist
  $sp_dir = "$env:LOCALAPPDATA\spicetify"
  $log_file_dir = "$sp_dir\install.log"

  if (-not (Test-Path $sp_dir)) {
    Log "MAKING FOLDER" -Texts $sp_dir -Emphasized $true
    Write-Done
  }

  if (-not $version) {
    # Determine latest Spicetify release via GitHub API.
    $latest_release_uri =
    "https://api.github.com/repos/spicetify/spicetify-cli/releases/latest"
    Log "DOWNLOADING" -Texts $latest_release_uri -Emphasized $true
    $latest_release_json = Invoke-WebRequest -Uri $latest_release_uri -UseBasicParsing
    Write-Done

    $version = ($latest_release_json | ConvertFrom-Json).tag_name -replace "v", ""
  }

  # Migrate old spicetify folder to new location.
  MigrateCfgFolder

  # Download release.
  $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "AMD64") { "x64" } else { "x32" }
  $zip_file = "${sp_dir}\spicetify-${version}-windows-${architecture}.zip"
  $download_uri = "https://github.com/spicetify/spicetify-cli/releases/download/" +
  "v${version}/spicetify-${version}-windows-${architecture}.zip"
  Log "DOWNLOADING" -Texts $download_uri -Emphasized $true
  Invoke-WebRequest -Uri $download_uri -UseBasicParsing -OutFile $zip_file
  Write-Done

  # Extract spicetify.exe and assets from .zip file.
  Log "EXTRACTING" -Texts $zip_file, " into ", ${sp_dir} -Emphasized $true, $false, $true
  # Using -Force to overwrite spicetify.exe and assets if it already exists
  Expand-Archive -Path $zip_file -DestinationPath $sp_dir -Force
  Write-Done

  # Remove .zip file.
  Log "REMOVING" -Texts $zip_file -Emphasized $true
  Remove-Item -Path $zip_file
  Write-Done

  # Get Path environment variable for the current user.
  $user = [EnvironmentVariableTarget]::User
  $path = [Environment]::GetEnvironmentVariable("PATH", $user)

  # Check whether spicetify dir is in the Path.
  $paths = $path -split ";"

  # Remove old spicetify folder from Path.
  RemoveOldPath
  $is_in_path = $paths -contains $sp_dir -or $paths -contains "${sp_dir}\"

  # Add Spicetify dir to PATH if it hasn't been added already.
  if (-not $is_in_path) {
    Log "ADDING" -Texts $sp_dir, " to the ", "PATH", " environment variable..." -Emphasized $true, $false, $true, $false
    [Environment]::SetEnvironmentVariable("PATH", "${path};${sp_dir}", $user)
    # Add Spicetify to the PATH variable of the current terminal session
    # so `spicetify` can be used immediately without restarting the terminal.
    $env:PATH += ";${sp_dir}"
    Write-Done
  }

  Log -Texts "spicetify-cli was installed successfully." -Emphasized $false; Write-Done
  Log -Texts "Run ", "spicetify --help", " to get started.`n" -Emphasized $false, $true, $false
} else {
  Log -Texts "`nYour Powershell version is lesser than ", "$PSMinVersion" -Emphasized $false, $true
  Log -Texts "`nPlease, update your Powershell downloading the ", "'Windows Management Framework'", " greater than ", "$PSMinVersion" -Emphasized $false, $true, $false, $true
}