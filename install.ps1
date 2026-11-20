$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$spicetifyFolderPath = "$env:LOCALAPPDATA\spicetify"
$spicetifyOldFolderPath = "$HOME\spicetify-cli"
$autoApplyTaskName = "Spicetify Auto Apply $([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)"
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
    if ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') {
      $architecture = 'x64'
    }
    elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
      $architecture = 'arm64'
    }
    else {
      $architecture = 'x32'
    }
    if ($v) {
      if ($v -match '^\d+\.\d+\.\d+$') {
        $targetVersion = $v
      }
      else {
        Write-Warning -Message "You have specified an invalid spicetify version: $v `nThe version must be in the following format: 1.2.3"
        Pause
        exit
      }
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

function Get-SpicetifyAutoApplyCommand {
  [CmdletBinding()]
  param (
    [Parameter(Mandatory = $true)]
    [string]$SpicetifyPath
  )
  process {
    $script = @'
$mutex = New-Object Threading.Mutex($false, 'Local\SpicetifyAutoApply')
if (-not $mutex.WaitOne(0)) { exit }
$parentId = (Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $PID").ParentProcessId
$parent = Get-Process -Id $parentId -ErrorAction SilentlyContinue
if (-not $parent) { exit }
$parent.EnableRaisingEvents = $true
Register-ObjectEvent -InputObject $parent -EventName Exited -SourceIdentifier 'SpicetifyParent' | Out-Null
$spicetify = '__SPICETIFY_PATH__'
$configFolder = if ($env:SPICETIFY_CONFIG) { $env:SPICETIFY_CONFIG } else { Join-Path $env:APPDATA 'spicetify' }
$spotifyPath = Join-Path $env:APPDATA 'Spotify'
foreach ($line in (Get-Content -LiteralPath (Join-Path $configFolder 'config-xpui.ini') -Encoding UTF8 -ErrorAction SilentlyContinue)) {
  if ($line -match '^\s*spotify_path\s*=\s*(\S.*?)\s*$') {
    $raw = $Matches[1]
    $names = [string[]]@([Environment]::GetEnvironmentVariables().Keys)
    [Array]::Sort($names, [StringComparer]::OrdinalIgnoreCase)
    $builder = New-Object Text.StringBuilder
    $index = 0
    while ($index -lt $raw.Length) {
      $hit = $null
      if ($raw[$index] -eq '$') {
        foreach ($name in $names) {
          if ($raw.Length - $index - 1 -ge $name.Length -and [string]::CompareOrdinal($raw, $index + 1, $name, 0, $name.Length) -eq 0) { $hit = $name; break }
        }
      }
      if ($hit) {
        [void]$builder.Append([Environment]::GetEnvironmentVariable($hit))
        $index += $hit.Length + 1
      }
      else {
        [void]$builder.Append($raw[$index])
        $index++
      }
    }
    $spotifyPath = $builder.ToString()
    break
  }
}
if ($spotifyPath -like '*SpotifyAB.SpotifyMusic*') { exit }
$appsPath = Join-Path $spotifyPath 'Apps'
$archive = Join-Path $appsPath 'xpui.spa'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$flags = @()
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { $flags += '--bypass-admin' }
$watchers = @()
$failedStamp = $null
$failures = 0
$retryAt = [DateTime]::MinValue
function Reset-Watchers {
  foreach ($watcher in $script:watchers) { $watcher.Dispose() }
  Get-EventSubscriber | Where-Object { $_.SourceIdentifier -like 'SpicetifyWatch.*' } | Unregister-Event
  Get-Event | Remove-Event
  $script:watchers = @()
  foreach ($target in @(@($spotifyPath, 'Apps'), @($appsPath, 'xpui.spa'))) {
    if (-not (Test-Path -LiteralPath $target[0] -PathType Container)) { continue }
    $watcher = New-Object IO.FileSystemWatcher($target[0], $target[1])
    foreach ($eventName in 'Created', 'Changed', 'Renamed', 'Deleted', 'Error') {
      Register-ObjectEvent -InputObject $watcher -EventName $eventName -SourceIdentifier "SpicetifyWatch.$([guid]::NewGuid())" | Out-Null
    }
    $watcher.EnableRaisingEvents = $true
    $script:watchers += $watcher
  }
}
while (-not $parent.HasExited) {
  Reset-Watchers
  $item = Get-Item -LiteralPath $archive -ErrorAction SilentlyContinue
  if ($item -and ($item.LastWriteTimeUtc -ne $failedStamp -or [DateTime]::UtcNow -ge $retryAt)) {
    while ((Wait-Event -Timeout 5) -and -not $parent.HasExited) { Get-Event | Remove-Event }
    if ($parent.HasExited) { break }
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
      try { [IO.File]::Open($archive, 'Open', 'Read', 'None').Dispose(); $ready = $true; break } catch { Start-Sleep -Seconds 2 }
    }
    $item = Get-Item -LiteralPath $archive -ErrorAction SilentlyContinue
    if (-not $item) { continue }
    $stamp = $item.LastWriteTimeUtc
    if ($ready) { & $spicetify auto @flags | Out-Null }
    $after = Get-Item -LiteralPath $archive -ErrorAction SilentlyContinue
    if ($after -and $after.LastWriteTimeUtc -eq $stamp) {
      $failures++
      $failedStamp = $stamp
      $retryAt = [DateTime]::UtcNow.AddMinutes([Math]::Min(60, [Math]::Pow(2, $failures)))
    }
    else {
      $failures = 0
      $failedStamp = $null
    }
    continue
  }
  if ($watchers.Count -eq 0) { [void](Wait-Event -Timeout 60); continue }
  $timeout = 600
  if ($failedStamp) { $timeout = [int][Math]::Max(1, [Math]::Min(600, ($retryAt - [DateTime]::UtcNow).TotalSeconds)) }
  [void](Wait-Event -Timeout $timeout)
}
'@
    $script = $script.Replace('__SPICETIFY_PATH__', ($SpicetifyPath -replace "'", "''"))
    [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  }
}

function Register-SpicetifyAutoApply {
  [CmdletBinding()]
  param (
    [Parameter(Mandatory = $true)]
    [string]$SpicetifyPath
  )
  begin {
    Write-Host -Object 'Registering the spicetify auto apply task...' -NoNewline
    $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  }
  process {
    $encodedCommand = Get-SpicetifyAutoApplyCommand -SpicetifyPath $SpicetifyPath
    $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\conhost.exe" -Argument "--headless powershell.exe -NoProfile -NonInteractive -EncodedCommand $encodedCommand"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    $Parameters = @{
      TaskName    = $autoApplyTaskName
      Description = 'Applies spicetify again as soon as a Spotify update replaces the patched files.'
      Action      = $action
      Trigger     = $trigger
      Principal   = $principal
      Settings    = $settings
      Force       = $true
    }
    Register-ScheduledTask @Parameters | Out-Null
  }
  end {
    Write-Success
  }
}

function Request-SpicetifyAutoApply {
  [CmdletBinding()]
  param (
    [Parameter(Mandatory = $true)]
    [string]$SpicetifyPath
  )
  process {
    if (Get-ScheduledTask -TaskName $autoApplyTaskName -ErrorAction SilentlyContinue) {
      return $false
    }
    $Host.UI.RawUI.Flushinputbuffer()
    $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
      (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Apply spicetify again automatically after Spotify updates.'),
      (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Keep applying spicetify manually.')
    )
    $choice = $Host.UI.PromptForChoice('', "`nSpotify updates remove spicetify. Do you want spicetify to apply itself again automatically after an update?", $choices, 1)
    if ($choice -eq 1) {
      return $false
    }
    try {
      Register-SpicetifyAutoApply -SpicetifyPath $SpicetifyPath
      Write-Host -Object "To turn it off, run: Stop-ScheduledTask -TaskName '$autoApplyTaskName'; Unregister-ScheduledTask -TaskName '$autoApplyTaskName' -Confirm:`$false"
      return $true
    }
    catch {
      Write-Unsuccess
      Write-Warning -Message "Could not register the auto apply task: $($_.Exception.Message)"
      return $false
    }
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
$installedSpicetify = Join-Path -Path $spicetifyFolderPath -ChildPath 'spicetify.exe'
if (-not (Test-Path -LiteralPath $installedSpicetify -PathType Leaf)) {
  $installedCommand = Get-Command -Name 'spicetify' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($installedCommand) {
    $installedSpicetify = $installedCommand.Source
  }
  else {
    $installedSpicetify = $null
  }
}

if ($installedSpicetify) {
  $Host.UI.RawUI.Flushinputbuffer()
  $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Run spicetify update.'),
    (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Continue with installation.')
  )
  $choice = $Host.UI.PromptForChoice('', 'Spicetify is already installed. Do you want to fix your installation?', $choices, 0)
  if ($choice -eq 0) {
    & $installedSpicetify update
    if ($LASTEXITCODE -ne 0) {
      throw "Spicetify update failed with exit code $LASTEXITCODE."
    }
    if (Request-SpicetifyAutoApply -SpicetifyPath $installedSpicetify) {
      Start-ScheduledTask -TaskName $autoApplyTaskName
    }
    return
  }
}

Move-OldSpicetifyFolder
Install-Spicetify
Write-Host -Object "`nRun" -NoNewline
Write-Host -Object ' spicetify -h ' -NoNewline -ForegroundColor 'Cyan'
Write-Host -Object 'to get started'
$autoApplyRegistered = Request-SpicetifyAutoApply -SpicetifyPath (Join-Path -Path $spicetifyFolderPath -ChildPath 'spicetify.exe')
#endregion Spicetify

#region Marketplace
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

if ($autoApplyRegistered) {
  Start-ScheduledTask -TaskName $autoApplyTaskName
}
#endregion Main
