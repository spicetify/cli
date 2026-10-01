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

function Get-SpicetifyNativeMachine {
  if (-not ('Spicetify.NativeArchitecture' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace Spicetify {
  public static class NativeArchitecture {
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWow64Process2(IntPtr process, out ushort processMachine, out ushort nativeMachine);
  }
}
'@
  }
  [System.UInt16]$processMachine = 0
  [System.UInt16]$nativeMachine = 0
  # -1 is the current-process pseudo-handle: always valid, never closed.
  if (-not [Spicetify.NativeArchitecture]::IsWow64Process2(
      [IntPtr]::new(-1),
      [ref]$processMachine, [ref]$nativeMachine)) {
    throw 'Cannot determine the native Windows architecture.'
  }
  $nativeMachine
}

function Get-SpicetifyArchitecture {
  switch (Get-SpicetifyNativeMachine) {
    0xAA64 { return 'aarch64' }
    0x8664 { return 'x86_64' }
    default { throw 'Spicetify v3 requires Windows x64 or ARM64.' }
  }
}

function Get-Spicetify {
  [CmdletBinding()]
  param (
    [ValidateSet('', 'aarch64', 'x86_64')][string]$RequestedArchitecture = '',
    [string]$RequestedVersion = ''
  )
  begin {
    if ($v3) {
      $architecture = if ($RequestedArchitecture) { $RequestedArchitecture } else { Get-SpicetifyArchitecture }
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
    if ($RequestedVersion) {
      $targetVersion = $RequestedVersion
    }
    elseif ($v) {
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
    if ($v3) {
      $checksum = (Invoke-RestMethod -Uri "$($Parameters.Uri).sha256").Trim().Split()[0]
      if ($checksum -notmatch '^[0-9a-fA-F]{64}$' -or
          (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $checksum) {
        throw 'The downloaded Spicetify archive failed checksum verification.'
      }
    }
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

function Expand-SpicetifyPackage {
  param([string]$Archive, [string]$Destination)
  foreach ($name in @('spicetify.exe', 'spicetify-daemon.exe')) {
    Remove-Item -LiteralPath (Join-Path $Destination $name) -Force -ErrorAction SilentlyContinue
  }
  Expand-Archive -Path $Archive -DestinationPath $Destination -Force
  foreach ($name in @('spicetify.exe', 'spicetify-daemon.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $Destination $name) -PathType Leaf)) {
      throw "The release archive is missing $name."
    }
  }
}

function Install-SpicetifyBinaries {
  param([string]$Source, [string]$Destination)
  $names = @('spicetify.exe', 'spicetify-daemon.exe')
  $backup = Join-Path $Destination ".install-backup-$([guid]::NewGuid())"
  $saved = @()
  $installed = @()
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  try {
    foreach ($name in $names) {
      $target = Join-Path $Destination $name
      if (Test-Path -LiteralPath $target) {
        Move-Item -LiteralPath $target -Destination (Join-Path $backup $name)
        $saved += $name
      }
      # Record the target before copying, so rollback also removes a partial copy.
      $installed += $name
      Copy-Item -LiteralPath (Join-Path $Source $name) -Destination $target
    }
  }
  catch {
    foreach ($name in $installed) {
      Remove-Item -LiteralPath (Join-Path $Destination $name) -Force -ErrorAction SilentlyContinue
    }
    foreach ($name in $saved) {
      Move-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $Destination $name) -Force
    }
    throw
  }
  finally {
    # Preserve originals if any rollback operation could not restore them.
    if (-not (Get-ChildItem -LiteralPath $backup -ErrorAction SilentlyContinue)) {
      Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
    }
  }
  Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
}

# v2's archive unpacked these beside spicetify.exe, and this folder is also
# v3's config root, where v2's css-map.json would shadow v3's own map. Themes,
# Extensions and CustomApps stay: v2 read user content from them too, and v3
# never does. jsHelper goes last because it marks the folder as v2's.
function Remove-SpicetifyV2Leftovers {
  param([string]$Folder)
  if (-not (Test-Path -LiteralPath (Join-Path $Folder 'jsHelper') -PathType Container)) {
    return
  }
  $names = @('css-map.json', 'globals.d.ts', 'jsHelper')
  foreach ($name in $names) {
    $path = Join-Path $Folder $name
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  $left = @($names | Where-Object { Test-Path -LiteralPath (Join-Path $Folder $_) })
  if ($left.Count) {
    Write-Host -Object "Could not remove Spicetify v2's $($left -join ', ') from $Folder" -ForegroundColor 'Yellow'
  }
  else {
    Write-Host -Object "Removed the files Spicetify v2 left in $Folder"
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
    if ($v3) {
      $staging = Join-Path ([System.IO.Path]::GetTempPath()) "spicetify-install-$([guid]::NewGuid())"
      try {
        Expand-SpicetifyPackage -Archive $archivePath -Destination $staging
        if ((Get-SpicetifyArchitecture) -eq 'aarch64') {
          # Let the staged CLI resolve configured, desktop, and Store Spotify paths.
          $stagedCli = Join-Path $staging 'spicetify.exe'
          $wanted = (& $stagedCli --print-install-architecture | Out-String).Trim()
          if ($LASTEXITCODE -ne 0 -or $wanted -notin @('aarch64', 'x86_64')) {
            throw 'Cannot determine the Spicetify build required by Spotify.'
          }
          if ($wanted -eq 'x86_64') {
            $versionOutput = (& $stagedCli --version | Out-String).Trim()
            if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch '^spicetify (\S+)$') {
              throw 'Cannot determine the staged Spicetify version.'
            }
            $archivePath = Get-Spicetify -RequestedArchitecture $wanted -RequestedVersion $Matches[1]
            Expand-SpicetifyPackage -Archive $archivePath -Destination $staging
          }
        }
        $daemonPath = Join-Path $spicetifyFolderPath 'spicetify-daemon.exe'
        # 32-bit PowerShell cannot read Get-Process.Path for a 64-bit daemon.
        $running = @(Get-CimInstance Win32_Process -Filter "Name='spicetify-daemon.exe'" |
          Where-Object { $_.ExecutablePath -eq $daemonPath } |
          ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue })
        if ($running.Count) {
          $token = (Get-Content -LiteralPath (Join-Path $spicetifyFolderPath 'daemon-token') -Raw).Trim()
          Invoke-RestMethod -Uri 'http://127.0.0.1:7967/shutdown' -Method Post -TimeoutSec 5 -Headers @{
            'x-spicetify-token' = $token
          } | Out-Null
          $running | Wait-Process -Timeout 10
        }
        New-Item -ItemType Directory -Path $spicetifyFolderPath -Force | Out-Null
        try {
          Install-SpicetifyBinaries -Source $staging -Destination $spicetifyFolderPath
        }
        catch {
          if ($running.Count) { Start-Process -FilePath $daemonPath }
          throw
        }
        if ($running.Count) {
          Start-Process -FilePath $daemonPath
        }
        Remove-SpicetifyV2Leftovers -Folder $spicetifyFolderPath
      }
      finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
      }
    }
    else {
      Expand-Archive -Path $archivePath -DestinationPath $spicetifyFolderPath -Force
    }
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
    Write-Host -Object "Spicetify is installed, but 'spicetify apply' failed, so Spotify is not running v3. Fix the reported cause, then run: spicetify apply" -ForegroundColor 'Red'
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
