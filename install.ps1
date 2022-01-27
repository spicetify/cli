# Copyright 2022 khanhas. GPL license.
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

if ($PSVersionTable.PSVersion.Major -gt $PSMinVersion) {
  $ErrorActionPreference = "Stop"

  # Enable TLS 1.2 since it is required for connections to GitHub.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  if (-not $version) {
    # Determine latest Spicetify release via GitHub API.
    $latest_release_uri =
    "https://api.github.com/repos/khanhas/spicetify-cli/releases/latest"
    Write-Part "DOWNLOADING    "; Write-Emphasized $latest_release_uri
    $latest_release_json = Invoke-WebRequest -Uri $latest_release_uri -UseBasicParsing
    Write-Done

    $version = ($latest_release_json | ConvertFrom-Json).tag_name -replace "v", ""
  }

  # Create ~\spicetify-cli directory if it doesn't already exist
  $sp_dir = "${HOME}\spicetify-cli"
  if (-not (Test-Path $sp_dir)) {
    Write-Part "MAKING FOLDER  "; Write-Emphasized $sp_dir
    New-Item -Path $sp_dir -ItemType Directory | Out-Null
    Write-Done
  }

  # Download release.
  $zip_file = "${sp_dir}\spicetify-${version}-windows-x64.zip"
  $download_uri = "https://github.com/khanhas/spicetify-cli/releases/download/" +
  "v${version}/spicetify-${version}-windows-x64.zip"
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

  Write-Done "`n spicetify-cli was installed successfully."
  Write-Part "Run "; Write-Emphasized "spicetify --help"; Write-Host " to get started.`n"
}
else {
  Write-Part "`nYour Powershell version is lesser than "; Write-Emphasized "$PSMinVersion";
  Write-Part "`nPlease, update your Powershell downloading the "; Write-Emphasized "'Windows Management Framework'"; Write-Part " greater than "; Write-Emphasized "$PSMinVersion"
}


