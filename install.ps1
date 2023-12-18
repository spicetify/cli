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

function Write-Action {
  [CmdletBinding()]
  param (
    [Parameter(Mandatory)]
    [string]$Message,

    [switch]$NoNewLine
  )
  process {
    Write-Host -Object $Message -ForegroundColor 'Cyan' -NoNewline:$NoNewLine
  }
}

function Test-Admin {
  [CmdletBinding()]
  param ()
  begin {
    Write-Action -Message "Checking if the script wasn't ran as Administrator..." -NoNewLine
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
    Write-Action -Message 'Checking if your PowerShell version is compatible...' -NoNewLine
    $PSVersionTable.PSVersion -ge $PSMinVersion
  }
}

function Move-OldSpicetifyFolder {
  [CmdletBinding()]
  param ()
  process {
    if (Test-Path -Path $spicetifyOldFolderPath) {
      Write-Action -Message 'Moving your old Spicetify folder...' -NoNewLine
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
        Write-Warning -Message "You have spicefied an invalid Spicetify version: $v `nThe version must be in the following format: 1.2.3"
        Pause
        exit
      }
    }
    else {
      Write-Action -Message 'Fetching the latest Spicetify version...' -NoNewLine
      $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/spicetify-cli/releases/latest'
      $targetVersion = $latestRelease.tag_name -replace 'v', ''
      Write-Success
    }
    $archivePath = "$env:TEMP\spicetify.zip"
  }
  process {
    Write-Action -Message "Downloading Spicetify v$targetVersion..." -NoNewLine
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
    Write-Action -Message 'Adding Spicetify to your PATH if needed...' -NoNewLine
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
    $env:PATH = $path
    Write-Success
  }
}

function Install-Spicetify {
  [CmdletBinding()]
  param ()
  begin {
    Write-Action -Message 'Installing Spicetify...'
  }
  process {
    $archivePath = Get-Spicetify
    Write-Action -Message 'Extracting Spicetify...' -NoNewLine
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
  Write-Warning -Message "The script was ran as Administrator which isn't recommended"
  $Host.UI.RawUI.Flushinputbuffer()
  $choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process to avoid any issues?', ('&Yes', '&No'), 0)
  if ($choice -eq 0) {
    Write-Host -Object 'Spicetify installation aborted'
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
Write-Host -Object 'Run spicetify -h to get started'
#endregion Spicetify

#region Marketplace
$Host.UI.RawUI.Flushinputbuffer()
$choice = $Host.UI.PromptForChoice('', 'Do you want to install Spicetify Marketplace?', ('&Yes', '&No'), 0)
if ($choice -eq 1) {
  Write-Host -Object 'Spicetify Marketplace installation aborted' -ForegroundColor 'Yellow'
}
else {
  Write-Action -Message 'Starting the Spicetify Marketplace installation script..'
  $Parameters = @{
    Uri             = 'https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/install.ps1'
    UseBasicParsing = $true
  }
  Invoke-WebRequest @Parameters | Invoke-Expression
}
#endregion Marketplace
#endregion Main
