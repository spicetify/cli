# Copyright 2023 Spicetify. GPL license.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)
param (
  [string] $version
)

$PSMinVersion = 3

if ($v) {
  $version = $v
}

#region Functions
function Write-Emphasized {
  param (
    [Parameter(Mandatory)]
    [string] $Text
  )
    
  Write-Host -Object $Text -NoNewline -ForegroundColor "Cyan"
}

function Write-Log {
  param (
    [string] $ActionText,
    [string[]] $Texts,
    [boolean[]] $Emphasized
  )

  if (-not (Test-Path -Path $logFileDir)) {
    New-Item -Path $logFileDir -ItemType File -Force | Out-Null
  }

  if (-not ($ActionText)) {
    $FormattedActionText = "{0, -15}" -f $ActionText
    Write-Host -Object $FormattedActionText -NoNewline
  }
    
  $logText = $FormattedActionText
    
  for ($i = 0; $i -lt $Texts.Length -and $Texts.Length -eq $Emphasized.Length; $i++) {
    if ($Emphasized.Get($i)) {
      Write-Host -Object $Texts.Get($i) -NoNewline
    }
    else {
      Write-Host -Object $Texts.Get($i) -NoNewline
    }
    $logText = $LogText + $Texts.Get($i)
  }
  $logText = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss yyyy-MM-dd"), $LogText
  Add-Content -Path $logFileDir -Value $LogText -NoNewline
}

function Write-Done {
  Write-Host -Object " > " -NoNewline
  Write-Host -Object "OK" -ForegroundColor "Green"
  Add-Content -Path $logFileDir -Value " > OK"
}

function Remove-OldPath {
  $spicetifyOldDir = "${HOME}\spicetify-cli"
  $_isInPath = $paths -contains $spicetifyOldDir -or $paths -contains "${spicetifyOldDir}\"
    
  if ($_isInPath) {
    Write-Log -ActionText "REMOVING" -Texts $spicetifyOldDir, " from Path" -Emphasized $true, $false
    $replacedPath = $path.replace(";$spicetifyOldDir", "")
    [Environment]::SetEnvironmentVariable("PATH", $replacedPath, $user)
    $env:PATH = $env:PATH.replace(";$spicetifyOldDir", "")
    Write-Done
  }
}

function Move-ConfigFolder {
  $spicetifyOldDirContent = "${HOME}\spicetify-cli\*"
  $spicetifyOldDir = "${HOME}\spicetify-cli"
  if (Test-Path -Path $spicetifyOldDir) {
    Write-Log -ActionText "MIGRATING" -Texts $spicetifyOldDir, " into", $spicetifyDir -Emphasized $true, $false, $true
    Copy-Item -Path $spicetifyOldDirContent -Destination $spicetifyDir -Force -Recurse
    Write-Done
    Write-Log -ActionText "REMOVING" -Texts $spicetifyOldDir -Emphasized $true
    Remove-Item -LiteralPath $spicetifyOldDir -Force -Recurse
    Write-Done
  }
}
#endregion Functions

#region Main
if ($PSVersionTable.PSVersion.Major -ge $PSMinVersion) {
  $ErrorActionPreference = "Stop"
    
  # Enable TLS 1.2 since it is required for connections to GitHub.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
  # Create %localappdata%\spicetify directory if it doesn't already exist
  $spicetifyDir = "$env:LOCALAPPDATA\spicetify"
  $logFileDir = "$spicetifyDir\install.log"

  $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  $isAdmin = $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

  if ($isAdmin) {
    Write-Log -ActionText "WARNING" -Texts "The script was ran as Administrator which isn't recommended`n" -Emphasized $false
    $Host.UI.RawUI.Flushinputbuffer()
    $choice = $Host.UI.PromptForChoice("", "Do you want to abort the installation process to avoid any issues?", ("&Yes", "&No"), 0)
    if ($choice -eq 0) {
      Write-Log -ActionText "WARNING" -Texts "Exiting the script..." -Emphasized $false
      exit
    }
  }
    
  if (-not (Test-Path -Path $spicetifyDir)) {
    Write-Log -ActionText "MAKING FOLDER" -Texts $spicetifyDir -Emphasized $true
    Write-Done
  }
    
  if (-not $version) {
    # Determine latest Spicetify release via GitHub API.
    $latestReleaseUri = "https://api.github.com/repos/spicetify/spicetify-cli/releases/latest"
    Write-Log -ActionText "DOWNLOADING" -Texts $latestReleaseUri -Emphasized $true
    $latestReleaseJson = Invoke-WebRequest -Uri $latestReleaseUri -UseBasicParsing
    Write-Done
    $version = ($latestReleaseJson | ConvertFrom-Json).tag_name -replace "v", ""
  }
    
  # Migrate old spicetify folder to new location.
  Move-ConfigFolder
    
  # Download release.
  $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "AMD64") { "x64" } else { "x32" }
  $zipFile = "${spicetifyDir}\spicetify-${version}-windows-${architecture}.zip"
  $downloadUri = "https://github.com/spicetify/spicetify-cli/releases/download/" +
  "v${version}/spicetify-${version}-windows-${architecture}.zip"
  Write-Log -ActionText "DOWNLOADING" -Texts $downloadUri -Emphasized $true
  Invoke-WebRequest -Uri $downloadUri -UseBasicParsing -OutFile $zipFile
  Write-Done
    
  # Extract spicetify.exe and assets from .zip file.
  Write-Log -ActionText "EXTRACTING" -Texts $zipFile, " into ", ${spicetifyDir} -Emphasized $true, $false, $true
  # Using -Force to overwrite spicetify.exe and assets if it already exists
  Expand-Archive -Path $zipFile -DestinationPath $spicetifyDir -Force
  Write-Done
    
  # Remove .zip file.
  Write-Log -ActionText "REMOVING" -Texts $zipFile -Emphasized $true
  Remove-Item -Path $zipFile
  Write-Done
    
  # Get Path environment variable for the current user.
  $user = [EnvironmentVariableTarget]::User
  $path = [Environment]::GetEnvironmentVariable("PATH", $user)
    
  # Check whether spicetify dir is in the Path.
  $paths = $path -split ";"
    
  # Remove old spicetify folder from Path.
  Remove-OldPath
  $isInPath = $paths -contains $spicetifyDir -or $paths -contains "${spicetifyDir}\"
    
  # Add Spicetify dir to PATH if it hasn't been added already.
  if (-not $isInPath) {
    Write-Log -ActionText "ADDING" -Texts $spicetifyDir, " to the ", "PATH", " environment variable..." -Emphasized $true, $false, $true, $false
    [Environment]::SetEnvironmentVariable("PATH", "${path};${spicetifyDir}", $user)
    # Add Spicetify to the PATH variable of the current terminal session
    # so `spicetify` can be used immediately without restarting the terminal.
    $env:PATH += ";${spicetifyDir}"
    Write-Done
  }
    
  Write-Log -Texts "spicetify-cli was installed successfully." -Emphasized $false
  Write-Done
  Write-Log -Texts "Run ", "spicetify --help", " to get started.`n" -Emphasized $false, $true, $false
}
else {
  Write-Log -Texts "`nYour Powershell version is lesser than ", "$PSMinVersion" -Emphasized $false, $true
  Write-Log -Texts "`nPlease, update your Powershell downloading the ", "'Windows Management Framework'", " greater than ", "$PSMinVersion" -Emphasized $false, $true, $false, $true
}
#endregion Main
