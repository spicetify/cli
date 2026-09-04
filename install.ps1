$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$spicetifyFolderPath = "$env:LOCALAPPDATA\spicetify"
$spicetifyOldFolderPath = "$HOME\spicetify-cli"
#endregion Variables

#region Functions
function Write-Success {
  [CmdletBinding()]
  param ()
  process {
    Write-Host -Object ' > OK' -ForegroundColor 'Green'
  }
}

function Write-Unsuccess {
  [CmdletBinding()]
  param ()
  process {
    Write-Host -Object ' > ERROR' -ForegroundColor 'Red'
  }
}

function Test-Admin {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object "Checking if the script is not being run as administrator..." -NoNewline
  }
  process {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    -not $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  }
}

function Test-PowerShellVersion {
  [CmdletBinding()]
  param ()
  begin {
    $PSMinVersion = [version]'5.1'
  }
  process {
    Write-Host -Object 'Checking if your PowerShell version is compatible...' -NoNewline
    $PSVersionTable.PSVersion -ge $PSMinVersion
  }
}

function Move-OldSpicetifyFolder {
  [CmdletBinding()]
  param ()
  process {
    if (Test-Path -Path $spicetifyOldFolderPath) {
      Write-Host -Object 'Moving the old spicetify folder...' -NoNewline
      Copy-Item -Path "$spicetifyOldFolderPath\*" -Destination $spicetifyFolderPath -Recurse -Force
      Remove-Item -Path $spicetifyOldFolderPath -Recurse -Force
      Write-Success
    }
  }
}

function Get-Spicetify {
  [CmdletBinding()]
  param ()
  begin {
    if ($v3) {
      # v3 asset names come from the Rust CLI's own target triple, so that
      # `spicetify self-update` resolves the same file this script installs.
      # Only x86_64 is built today.
      if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
        Write-Warning -Message "v3 has no build for $env:PROCESSOR_ARCHITECTURE yet. Windows x86_64 is available."
        Pause
        exit
      }
      $architecture = 'x86_64'
    }
    elseif ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') {
      $architecture = 'x64'
    }
    elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
      $architecture = 'arm64'
    }
    else {
      $architecture = 'x32'
    }
    if ($v) {
      if ($v -match '^\d+\.\d+\.\d+') {
        $targetVersion = $v
      }
      else {
        Write-Warning -Message "You have specified an invalid spicetify version: $v `nThe version must start in the following format: 1.2.3"
        Pause
        exit
      }
    }
    elseif ($v3) {
      # v3 ships as prereleases, which /releases/latest never returns, so the
      # newest v3 tag is picked out of the full list (newest first).
      Write-Host -Object 'Fetching the latest spicetify v3 version...' -NoNewline
      $releases = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/cli/releases'
      $targetVersion = $releases.tag_name | Where-Object { $_ -like 'v3*' } | Select-Object -First 1
      if (-not $targetVersion) {
        Write-Unsuccess
        Write-Warning -Message 'No v3 release published yet. Remove $v3 to install the current stable release.'
        Pause
        exit
      }
      $targetVersion = $targetVersion -replace '^v', ''
      Write-Success
    }
    else {
      Write-Host -Object 'Fetching the latest spicetify version...' -NoNewline
      $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/cli/releases/latest'
      $targetVersion = $latestRelease.tag_name -replace 'v', ''
      Write-Success
    }
    $archivePath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "spicetify.zip")
  }
  process {
    Write-Host -Object "Downloading spicetify v$targetVersion..." -NoNewline
    $Parameters = @{
      Uri            = "https://github.com/spicetify/cli/releases/download/v$targetVersion/spicetify-$targetVersion-windows-$architecture.zip"
      UseBasicParsin = $true
      OutFile        = $archivePath
    }
    Invoke-WebRequest @Parameters
    Write-Success
  }
  end {
    $archivePath
  }
}

function Add-SpicetifyToPath {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object 'Making spicetify available in the PATH...' -NoNewline
    $user = [EnvironmentVariableTarget]::User
    $path = [Environment]::GetEnvironmentVariable('PATH', $user)
  }
  process {
    $path = $path -replace "$([regex]::Escape($spicetifyOldFolderPath))\\*;*", ''
    if ($path -notlike "*$spicetifyFolderPath*") {
      $path = "$path;$spicetifyFolderPath"
    }
  }
  end {
    [Environment]::SetEnvironmentVariable('PATH', $path, $user)
    if (($env:PATH -split ';') -notcontains $spicetifyFolderPath) {
      $env:PATH = "$env:PATH;$spicetifyFolderPath"
    }
    Write-Success
  }
}

function Add-SpicetifyCompletion {
  [CmdletBinding()]
  param (
    [string] $ProfilePath = $PROFILE
  )
  begin {
    Write-Host -Object 'Adding spicetify shell completion...' -NoNewline
    $completion = '$env:COMPLETE = "powershell"; spicetify | Out-String | Invoke-Expression; Remove-Item Env:\COMPLETE'
  }
  process {
    $profileDirectory = Split-Path -Parent $ProfilePath
    if (-not (Test-Path -LiteralPath $profileDirectory)) {
      New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $ProfilePath)) {
      New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
    }

    $alreadyInstalled = Select-String -LiteralPath $ProfilePath -SimpleMatch $completion -Quiet
    if (-not $alreadyInstalled) {
      $profileContent = Get-Content -LiteralPath $ProfilePath -Raw
      if ($profileContent.Length -gt 0 -and -not $profileContent.EndsWith("`n")) {
        Add-Content -LiteralPath $ProfilePath -Value ([Environment]::NewLine) -NoNewline
      }
      Add-Content -LiteralPath $ProfilePath -Value $completion
    }
  }
  end {
    Write-Success
  }
}

function Install-Spicetify {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object 'Installing spicetify...'
  }
  process {
    $archivePath = Get-Spicetify
    Write-Host -Object 'Extracting spicetify...' -NoNewline
    Expand-Archive -Path $archivePath -DestinationPath $spicetifyFolderPath -Force
    Write-Success
    Add-SpicetifyToPath
  }
  end {
    Remove-Item -Path $archivePath -Force -ErrorAction 'SilentlyContinue'
    Write-Host -Object 'spicetify was successfully installed!' -ForegroundColor 'Green'
  }
}
#endregion Functions

#region Main
#region Checks
if (-not (Test-PowerShellVersion)) {
  Write-Unsuccess
  Write-Warning -Message 'PowerShell 5.1 or higher is required to run this script'
  Write-Warning -Message "You are running PowerShell $($PSVersionTable.PSVersion)"
  Write-Host -Object 'PowerShell 5.1 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/skypeforbusiness/set-up-your-computer-for-windows-powershell/download-and-install-windows-powershell-5-1'
  Write-Host -Object 'PowerShell 7 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows'
  Pause
  exit
}
else {
  Write-Success
}
if (-not (Test-Admin)) {
  Write-Unsuccess
  Write-Warning -Message "The script was run as administrator. This can result in problems with the installation process or unexpected behavior. Do not continue if you do not know what you are doing."
  $Host.UI.RawUI.Flushinputbuffer()
  $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Abort installation.'),
    (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Resume installation.')
  )
  $choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process?', $choices, 0)
  if ($choice -eq 0) {
    Write-Host -Object 'spicetify installation aborted' -ForegroundColor 'Yellow'
    Pause
    exit
  }
}
else {
  Write-Success
}
#endregion Checks

#region Spicetify
Move-OldSpicetifyFolder
Install-Spicetify
if ($v3) {
  Add-SpicetifyCompletion
}
Write-Host -Object "`nRun" -NoNewline
Write-Host -Object ' spicetify -h ' -NoNewline -ForegroundColor 'Cyan'
Write-Host -Object 'to get started'
#endregion Spicetify

#region Marketplace
# v3 ships its own store inside the client, so the Marketplace (a v2 custom
# app) is neither needed nor compatible.
if ($v3) {
  # Apply now as a convenience. This patches Spotify, restarts it, and seeds
  # the store into the sidebar. Soft on purpose: Spotify may not be installed
  # or logged in yet, so a failure leaves the CLI installed and tells the user
  # to apply once that is sorted. No 'init', which is a destructive reset.
  $spicetifyExe = Join-Path $spicetifyFolderPath 'spicetify.exe'
  Write-Host -Object "`nPatching Spotify (this restarts it)..."
  & $spicetifyExe apply
  if ($LASTEXITCODE -eq 0) {
    Write-Host -Object 'Done. Open Spotify and click' -NoNewline
    Write-Host -Object ' Module Store ' -NoNewline -ForegroundColor 'Cyan'
    Write-Host -Object 'in the sidebar.'
  }
  else {
    Write-Host -Object "Install finished, but 'spicetify apply' did not complete. Fix the reported cause, then run: spicetify apply" -ForegroundColor 'Yellow'
    Write-Host -Object "If it cannot find Spotify, 'spicetify config' shows the paths it resolved."
  }
  return
}
$Host.UI.RawUI.Flushinputbuffer()
$choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Install Spicetify Marketplace."),
    (New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Do not install Spicetify Marketplace.")
)
$choice = $Host.UI.PromptForChoice('', "`nDo you also want to install Spicetify Marketplace? It will become available within the Spotify client, where you can easily install themes and extensions.", $choices, 0)
if ($choice -eq 1) {
  Write-Host -Object 'spicetify Marketplace installation aborted' -ForegroundColor 'Yellow'
}
else {
  Write-Host -Object 'Starting the spicetify Marketplace installation script..'
  $Parameters = @{
    Uri             = 'https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/install.ps1'
    UseBasicParsing = $true
  }
  Invoke-WebRequest @Parameters | Invoke-Expression
}
#endregion Marketplace
#endregion Main
