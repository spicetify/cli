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
    Write-Host -Object 'Success' -ForegroundColor 'Green'
  }
}

function Test-Admin {
  [CmdletBinding()]
  param ()
  begin {
    Write-Verbose -Message 'Checking if the script was ran as Administrator...' -Verbose
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
    Write-Verbose -Message 'Checking your PowerShell version...' -Verbose
    $PSVersionTable.PSVersion -lt $PSMinVersion
  }
}

function Move-OldSpicetifyFolder {
  [CmdletBinding()]
  param ()
  process {
    if (Test-Path -Path $spicetifyOldFolderPath) {
      Write-Verbose -Message 'Moving your old Spicetify folder...' -Verbose
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
        Write-Warning -Message "You have spicefied an invalid Spicetify version: $v"
        Write-Host -Object 'The version must be in the following format: 1.2.3'
        Pause
        exit
      }
    }
    else {
      Write-Verbose -Message 'Fetching the latest Spicetify version...' -Verbose
      $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/spicetify-cli/releases/latest'
      $targetVersion = $latestRelease.tag_name -replace 'v', ''
      Write-Success
    }
    $archivePath = "$env:TEMP\spicetify.zip"
  }
  process {
    Write-Verbose -Message "Downloading Spicetify v$targetVersion..." -Verbose
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
    Write-Verbose -Message 'Adding Spicetify to your PATH variable if needed...' -Verbose
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
    Write-Verbose -Message 'Installing Spicetify...' -Verbose
  }
  process {
    $archivePath = Get-Spicetify
    Write-Verbose -Message 'Extracting Spicetify...' -Verbose
    Expand-Archive -Path $archivePath -DestinationPath $spicetifyFolderPath -Force
    Write-Success
    Add-SpicetifyToPath
  }
  end {
    Remove-Item -Path $archivePath -Force
    Write-Host -Object 'Spicetify was successfully installed' -ForegroundColor 'Green'
  }
}
#endregion Functions

#region Main
#region Checks
if (-not (Test-PowerShellVersion)) {
  Write-Warning -Message 'PowerShell 5.1 or higher is required to run this script'
  Write-Warning -Message "You are running PowerShell $($PSVersionTable.PSVersion)"
  Write-Host -Object 'PowerShell 5.1 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/skypeforbusiness/set-up-your-computer-for-windows-powershell/download-and-install-windows-powershell-5-1'
  Write-Host -Object 'PowerShell 7 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows'
  Pause
  exit
}
if (Test-Admin) {
  Write-Warning -Message "The script was ran as Administrator which isn't recommended"
  $Host.UI.RawUI.Flushinputbuffer()
  $choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process to avoid any issues?', ('&Yes', '&No'), 0)
  if ($choice -eq 0) {
    Write-Host -Object 'Spicetify installation aborted'
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
  Write-Host -Object 'Spicetify Marketplace installation aborted'
  exit
}
Write-Verbose -Message 'Starting the Spicetify Marketplace installation script..' -Verbose
$Parameters = @{
  Uri             = 'https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/install.ps1'
  UseBasicParsing = $true
}
Invoke-WebRequest @Parameters | Invoke-Expression
#endregion Marketplace
#endregion Main
