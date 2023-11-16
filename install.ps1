$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$spicetifyFolderPath = "$env:LOCALAPPDATA\spicetify"
$spicetifyOldFolderPath = "$HOME\spicetify-cli"
$logFilePath = "$spicetifyFolderPath\install.log"
#endregion Variables

#region Functions
function Write-Log {
  [CmdletBinding()]
  param (
    [Parameter(Mandatory)]
    [string]$Message,

    [ValidateSet('Error', 'Warning', 'Information', 'Verbose')]
    [string]$Stream = 'Information',

    [System.ConsoleColor]$ForegroundColor = $Host.UI.RawUI.ForegroundColor,

    [System.ConsoleColor]$BackgroundColor = $Host.UI.RawUI.BackgroundColor
  )
  begin {
    if (-not (Test-Path -Path $logFilePath)) {
      New-Item -Path $logFilePath -ItemType 'File' -Force
    }
  }
  process {
    Add-Content -Path $logFilePath -Value "[$(Get-Date -Format 'HH:mm:ss yyyy-MM-dd')] $($Stream): $Message"
    switch -exact ($Stream) {
      'Error' {
        Write-Error -Message $Message
      }
      'Warning' {
        Write-Warning -Message $Message
      }
      'Information' {
        Write-Host -Object $Message -ForegroundColor $ForegroundColor -BackgroundColor $BackgroundColor
      }
      'Verbose' {
        Write-Verbose -Message $Message -Verbose
      }
    }
  }
}

function Write-Success {
  [CmdletBinding()]
  param ()
  process {
    Write-Log -Message 'Success' -ForegroundColor 'Green'
  }
}

function Test-Admin {
  [CmdletBinding()]
  param ()
  begin {
    Write-Log -Message 'Checking if the script was ran as Administrator...' -Stream 'Verbose'
  }
  process {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  }
}

function Test-PowerShellVersion {
  [CmdletBinding()]
  param ()
  begin {
    $PSMinVersion = [version]'5.1'
  }
  process {
    Write-Log -Message 'Checking your PowerShell version...' -Stream 'Verbose'
    $PSVersionTable.PSVersion -lt $PSMinVersion
  }
}

function Move-OldSpicetifyFolder {
  [CmdletBinding()]
  param ()
  process {
    if (Test-Path -Path $spicetifyOldFolderPath) {
      Write-Log -Message 'Moving your old Spicetify folder...' -Stream 'Verbose'
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
    else {
      $architecture = 'x32'
    }
    if ($v) {
      if ($v -match '^\d+\.\d+\.\d+$') {
        $targetVersion = $v
      }
      else {
        Write-Log -Message "You have spicefied an invalid Spicetify version: $v" -Stream 'Warning'
        Write-Host -Object 'The version must be in the following format: 1.2.3'
        Pause
        exit
      }
    }
    else {
      Write-Log -Message 'Fetching the latest Spicetify version...' -Stream 'Verbose'
      $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/spicetify-cli/releases/latest'
      $targetVersion = $latestRelease.tag_name -replace 'v', ''
      Write-Success
    }
    $archivePath = "$env:TEMP\spicetify.zip"
  }
  process {
    Write-Log -Message "Downloading Spicetify v$targetVersion..." -Stream 'Verbose'
    $Parameters = @{
      Uri            = "https://github.com/spicetify/spicetify-cli/releases/download/v$targetVersion/spicetify-$targetVersion-windows-$architecture.zip"
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
    Write-Log -Message 'Adding Spicetify to your PATH variable if needed...' -Stream 'Verbose'
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
    Write-Success
  }
}

function Install-Spicetify {
  [CmdletBinding()]
  param ()
  begin {
    Write-Log -Message 'Installing Spicetify...' -Stream 'Verbose'
  }
  process {
    $archivePath = Get-Spicetify
    Write-Log -Message 'Extracting Spicetify...' -Stream 'Verbose'
    Expand-Archive -Path $archivePath -DestinationPath $spicetifyFolderPath -Force
    Write-Success
    Add-SpicetifyToPath
  }
  end {
    Remove-Item -Path $archivePath -Force
    Write-Log -Message 'Spicetify was successfully installed' -ForegroundColor 'Green'
  }
}
#endregion Functions

#region Main
Remove-Item -Path $logFilePath -Force

#region Checks
if (-not (Test-PowerShellVersion)) {
  Write-Log -Message 'PowerShell 5.1 or higher is required to run this script' -Stream 'Warning'
  Write-Log -Message "You are running PowerShell $($PSVersionTable.PSVersion)" -Stream 'Warning'
  Write-Host -Object 'PowerShell 5.1 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/skypeforbusiness/set-up-your-computer-for-windows-powershell/download-and-install-windows-powershell-5-1'
  Write-Host -Object 'PowerShell 7 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows'
  Pause
  exit
}
if (Test-Admin) {
  Write-Log -Message "The script was ran as Administrator which isn't recommended" -Stream 'Warning'
  $Host.UI.RawUI.Flushinputbuffer()
  $choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process to avoid any issues?', ('&Yes', '&No'), 0)
  if ($choice -eq 0) {
    Write-Log -Message 'Spicetify installation aborted'
    exit
  }
}
#endregion Checks

#region Spicetify
Move-OldSpicetifyFolder
Install-Spicetify
Write-Host -Object 'Run spicetify -h to get started'
#endregion Spicetify

#region Marketplace
$Host.UI.RawUI.Flushinputbuffer()
$choice = $Host.UI.PromptForChoice('', 'Do you want to install Spicetify Marketplace?', ('&Yes', '&No'), 0)
if ($choice -eq 1) {
  Write-Log -Message 'Spicetify Marketplace installation aborted'
  exit
}
Write-Log -Message 'Starting the Spicetify Marketplace installation script..' -Stream 'Verbose'
$Parameters = @{
  Uri             = 'https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/install.ps1'
  UseBasicParsing = $true
}
Invoke-WebRequest @Parameters | Invoke-Expression
#endregion Marketplace
#endregion Main
