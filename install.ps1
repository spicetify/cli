# Copyright 2022 Spicetify. GPL license.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)
param (
  [string] $version
)

$PSMinVersion = 3

if ($v) {
    $version = $v
}

# Helper functions for pretty terminal output.
function Write-Part ([string] $Text) {
  Write-Host $Text -NoNewline
}

function Write-Emphasized ([string] $Text) {
  Write-Host $Text -NoNewLine -ForegroundColor "Cyan"
}

function Write-Done {
  Write-Host " > " -NoNewline
  Write-Host "OK" -ForegroundColor "Green"
}

function RemoveOldPath {
  $oldsp_dir = "${HOME}\spicetify-cli"
  $isinpath = $paths -contains $oldsp_dir -or $paths -contains "${oldsp_dir}\"
  if ($isinpath) {
    Write-Part "REMOVING       "; Write-Emphasized $oldsp_dir; Write-Part " from Path"

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
    Write-Part "MIGRATING      "; Write-Emphasized $oldsp_dir; Write-Part " into ";  Write-Emphasized $sp_dir
    Copy-item -Force -Recurse $oldsp_dircontent -Destination $sp_dir
    Write-Done
    Write-Part "REMOVING       "; Write-Emphasized $oldsp_dir
    Remove-Item -LiteralPath $oldsp_dir -Force -Recurse
    Write-Done
  }
}

if ($PSVersionTable.PSVersion.Major -gt $PSMinVersion) {
  $ErrorActionPreference = "Stop"

  # Enable TLS 1.2 since it is required for connections to GitHub.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  if (-not $version) {
    # Determine latest Spicetify release via GitHub API.
    $latest_release_uri =
    "https://api.github.com/repos/spicetify/spicetify-cli/releases/latest"
    Write-Part "DOWNLOADING    "; Write-Emphasized $latest_release_uri
    $latest_release_json = Invoke-WebRequest -Uri $latest_release_uri -UseBasicParsing
    Write-Done

    $version = ($latest_release_json | ConvertFrom-Json).tag_name -replace "v", ""
  }

  # Create %localappdata%\spicetify directory if it doesn't already exist
  $sp_dir = "$env:LOCALAPPDATA\spicetify"
  if (-not (Test-Path $sp_dir)) {
    Write-Part "MAKING FOLDER  "; Write-Emphasized $sp_dir
    New-Item -Path $sp_dir -ItemType Directory | Out-Null
    Write-Done
  }

  # Migrate old spicetify folder to new location.
  MigrateCfgFolder

  # Download release.
  $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "AMD64") { "x64" } else { "x32" }
  $zip_file = "${sp_dir}\spicetify-${version}-windows-${architecture}.zip"
  $download_uri = "https://github.com/spicetify/spicetify-cli/releases/download/" +
  "v${version}/spicetify-${version}-windows-${architecture}.zip"
  Write-Part "DOWNLOADING    "; Write-Emphasized $download_uri
  Invoke-WebRequest -Uri $download_uri -UseBasicParsing -OutFile $zip_file
  Write-Done

  # Extract spicetify.exe and assets from .zip file.
  Write-Part "EXTRACTING     "; Write-Emphasized $zip_file
  Write-Part " into "; Write-Emphasized ${sp_dir};
  # Using -Force to overwrite spicetify.exe and assets if it already exists
  Expand-Archive -Path $zip_file -DestinationPath $sp_dir -Force
  Write-Done

  # Remove .zip file.
  Write-Part "REMOVING       "; Write-Emphasized $zip_file
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
    Write-Part "ADDING         "; Write-Emphasized $sp_dir; Write-Part " to the "
    Write-Emphasized "PATH"; Write-Part " environment variable..."
    [Environment]::SetEnvironmentVariable("PATH", "${path};${sp_dir}", $user)
    # Add Spicetify to the PATH variable of the current terminal session
    # so `spicetify` can be used immediately without restarting the terminal.
    $env:PATH += ";${sp_dir}"
    Write-Done
  }

  Write-Part "spicetify-cli was installed successfully."; Write-Done
  Write-Part "Run "; Write-Emphasized "spicetify --help"; Write-Host " to get started.`n"
} else {
  Write-Part "`nYour Powershell version is lesser than "; Write-Emphasized "$PSMinVersion";
  Write-Part "`nPlease, update your Powershell downloading the "; Write-Emphasized "'Windows Management Framework'"; Write-Part " greater than "; Write-Emphasized "$PSMinVersion"
}