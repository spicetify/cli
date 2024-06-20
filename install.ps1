$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$spicetifyFolderPath = "$env:LOCALAPPDATA\spicetify"
#endregion Variables

#region Functions
function Write-Ok {
   [CmdletBinding()]
   param ()
   process {
      Write-Host -Object ' > OK' -ForegroundColor 'Green'
   }
}

function Write-Error {
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

function Add-Folder {
   [CmdletBinding()]
   param ()
   begin {
      Write-Host -Object 'Creating spicetify folder...' -NoNewline
   }
   process {
      if (Test-Path -Path $spicetifyFolderPath) {
         Move-Item -Path $spicetifyFolderPath -Destination "$spicetifyFolderPath.old" -Force
      }
      New-Item -Path $spicetifyFolderPath -ItemType 'Directory' -Force
   }
   end {
      Write-Ok
   }
}

function Get-Binary {
   [CmdletBinding()]
   param ()
   begin {
      if ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') {
         $architecture = 'amd64'
      }
      elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
         $architecture = 'arm64'
      }
      else {
         $architecture = '386'
      }
      if ($v) {
         if ($v -match '^\d+\.\d+\.\d+$') {
            $targetVersion = "v$v"
         }
         else {
            Write-Warning -Message "You have spicefied an invalid spicetify version: $v `nThe version must be in the following format: 1.2.3"
            Pause
            exit
         }
      }
      else {
         Write-Host -Object 'Fetching the latest spicetify version...' -NoNewline
         $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/cli/releases/latest'
         $targetVersion = $latestRelease.tag_name
         Write-Ok
      }
      $binaryPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "spicetify.exe")
   }
   process {
      Write-Host -Object "Downloading spicetify $targetVersion..." -NoNewline
      $Parameters = @{
         Uri            = "https://github.com/spicetify/cli/releases/download/$targetVersion/spicetify-windows-$architecture.exe"
         UseBasicParsin = $true
         OutFile        = $binaryPath
      }
      Invoke-WebRequest @Parameters
      Write-Ok
   }
   end {
      $binaryPath
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
      if ($path -notlike "*$spicetifyFolderPath*") {
         $path = "$path;$spicetifyFolderPath"
      }
   }
   end {
      [Environment]::SetEnvironmentVariable('PATH', $path, $user)
      $env:PATH = $path
      Write-Ok
   }
}

function Install-Binary {
   [CmdletBinding()]
   param ()
   begin {
      Write-Host -Object 'Installing spicetify...'
   }
   process {
      $spicetifyBinaryPath = Get-Binary
      Write-Host -Object 'Extracting spicetify...' -NoNewline
      New-Item -Path "$spicetifyFolderPath\bin" -ItemType 'Directory' -Force
      Move-Item -Path $spicetifyBinaryPath -DestinationPath "$spicetifyFolderPath\bin" -Force
      Write-Ok
      Add-SpicetifyToPath
   }
   end {
      Write-Host -Object 'spicetify was successfully installed!' -ForegroundColor 'Green'
   }
}
#endregion Functions

#region Main
#region Checks
if (-not (Test-PowerShellVersion)) {
   Write-Error
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
   Write-Ok
}
if (-not (Test-Admin)) {
   Write-Error
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
   Write-Ok
}
#endregion Checks

#region Spicetify
Add-Folder
Install-Binary
Write-Host -Object "`nRun" -NoNewline
Write-Host -Object ' spicetify -h ' -NoNewline -ForegroundColor 'Cyan'
Write-Host -Object 'to get started'
#endregion Spicetify
#endregion Main
