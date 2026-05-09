[CmdletBinding(DefaultParameterSetName = 'Install')]
param (
	[Parameter(
		ParameterSetName = 'Install',
		HelpMessage = 'Specify the version of Spicetify to install (format: 1.2.3). If not specified, the latest released version will be installed.'
	)]
	[ValidatePattern('^\d+\.\d+\.\d+$')]
	[string]$v,

	[Parameter(
		HelpMessage = 'Specify the path to the Spicetify folder. default: "$env:LOCALAPPDATA\Spicetify\"'
	)]
	[string]$spicetifyFolderPath = "$env:LOCALAPPDATA\Spicetify",

	[Parameter(
		HelpMessage = 'Specify the path to the Spicetify executable. default: "$env:LOCALAPPDATA\Spicetify\bin\spicetify.exe"'
	)]
	[string]$spicetifyExecutablePath = "$env:LOCALAPPDATA\Spicetify\bin\spicetify.exe",

	[Parameter(
		ParameterSetName = 'Initialize',
		Mandatory = $true,
		HelpMessage = 'Skip installing the binary.'
	)]
	[switch]$skipBinary = $false,

	[Parameter(
		HelpMessage = 'Skip initializing the daemon.'
	)]
	[switch]$skipDaemon = $false,

	[Parameter(
		HelpMessage = 'Skip registering the URI scheme.'
	)]
	[switch]$skipURIScheme = $false,

	[Parameter(
		HelpMessage = 'Install Spicetify in portable mode. Storing the configuration within $spicetifyFolderPath\config\.'
	)]
	[switch]$portable = $false,

	[Parameter(
		HelpMessage = 'Install the Spicetify hooks.'
	)]
	[switch]$installHooks = $false,

	[Parameter(
		HelpMessage = 'Build the latest cli & hooks from source. (requires Rust and Bun)'
	)]
	[switch]$build = $false
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$cliOwnerRepo = "veryboringhwl/v3"
$hooksOwnerRepo = "veryboringhwl/v3"

$spicetifyPortableBinaryPath = "$spicetifyFolderPath\bin"
$spicetifyPortableConfigPath = "$spicetifyFolderPath\config"

if ($portable) {
	$spicetifyBinaryPath = $spicetifyPortableBinaryPath
	$spicetifyConfigPath = $spicetifyPortableConfigPath
}
else {
	$spicetifyBinaryPath = $spicetifyPortableBinaryPath
	$spicetifyConfigPath = $spicetifyFolderPath
}

$spicetifyHooksPath = "$spicetifyConfigPath\hooks"
#endregion Variables

#region Functions
#region Utilities
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
	process {
		$currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
		$currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
	}
}

function Test-PowerShellVersion {
	[CmdletBinding()]
	param ()
	begin {
		$PSMinVersion = [version]'7.0' # [version]'5.1'
	}
	process {
		Write-Host -Object 'Checking if your PowerShell version is compatible...' -NoNewline
		$PSVersionTable.PSVersion -ge $PSMinVersion
	}
}

function Add-Dir {
	[CmdletBinding()]
	param (
		[Parameter(Mandatory = $true)]
		[string]$path
	)
	begin {
		Write-Host -Object "Adding $path..." -NoNewline
	}
	process {
		if (-not (Test-Path -Path $path)) {
			New-Item -Path $path -ItemType 'Directory' -Force | Out-Null
		}
	}
	end {
		Write-Ok
	}
}

function Remove-Dir {
	[CmdletBinding()]
	param (
		[Parameter(Mandatory = $true)]
		[string]$path,
		[Parameter()]
		[switch]$rename
	)
	begin {
		Write-Host -Object "Removing $path..." -NoNewline
	}
	process {
		if (Test-Path -Path $path) {
			if ($rename) {
				$oldPath = "$path.old"
				if (Test-Path -Path $oldPath) {
					Remove-Item -Path $oldPath -Recurse -Force
				}
				Move-Item -Path $path -Destination $oldPath -Force
			}
			else {
				Remove-Item -Path $path -Recurse -Force
			}
		}
	}
	end {
		Write-Ok
	}
}

function Invoke-Command {
	[CmdletBinding()]
	param (
		[Parameter(Mandatory = $true)]
		[string]$command,
		[Parameter()]
		[string[]]$arguments
	)
	begin {
		Write-Host -Object "`n> $command $($arguments -join ' ')"
	}
	process {
		& $command @arguments
	}
	end {
		Write-Host
	}
}
#endregion Utilities

function Add-BinToPath {
	[CmdletBinding()]
	param ()
	begin {
		Write-Host -Object 'Making Spicetify available in the PATH...' -NoNewline
	}
	process {
		$user = [EnvironmentVariableTarget]::User
		$path = [Environment]::GetEnvironmentVariable('PATH', $user)
		$pathArray = $path -split ';'
		if ($pathArray -notcontains $spicetifyBinaryPath) {
			$path = "$path;$spicetifyBinaryPath"
			[Environment]::SetEnvironmentVariable('PATH', $path, $user)
			$env:PATH = $path
		}
	}
	end {
		Write-Ok
	}
}

function Initialize-Binary {
	[CmdletBinding()]
	param ()
	begin {
		if ($portable) {
			Write-Host -Object 'Creating Spicetify portable config folder...' -NoNewline
			New-Item -Path $spicetifyConfigPath -ItemType 'Directory' -Force
			Write-Ok
		}

		Write-Host -Object 'Initializing Spicetify binary...'
	}
	process {
		Invoke-Command -Command $spicetifyExecutablePath -Arguments 'init'
	}
}

function Install-Binary {
	[CmdletBinding()]
	param ()
	begin {
		Write-Host -Object 'Installing Spicetify...'

		Write-Host -Object 'Creating Spicetify folder...'
		Remove-Dir -Path $spicetifyFolderPath -rename
		Add-Dir -Path $spicetifyFolderPath
	}
	process {
		Add-Dir -Path $spicetifyBinaryPath
		if ($build) {
			Write-Host -Object 'Fetching the latest Spicetify commit...' -NoNewline
			$lastCommit = Invoke-RestMethod -Uri "https://api.github.com/repos/$cliOwnerRepo/commits/main"
			$lastCommitSha = $lastCommit.sha
			Write-Ok

			Write-Host -Object "Building Spicetify commit $lastCommitSha..."
			Invoke-Command -Command cargo -Arguments 'install', '--git', "https://github.com/$cliOwnerRepo", '--bin', 'spicetify', '--root', $spicetifyFolderPath

			$builtExe = "$spicetifyFolderPath\bin\spicetify.exe"
			if ($builtExe -ne $spicetifyExecutablePath) {
				New-Item -ItemType Directory -Path (Split-Path $spicetifyExecutablePath -Parent) -Force | Out-Null
				Move-Item -Path $builtExe -Destination $spicetifyExecutablePath -Force
			}
			Remove-Item -LiteralPath "$spicetifyFolderPath\.crates.toml" -Force -ErrorAction SilentlyContinue
			Remove-Item -LiteralPath "$spicetifyFolderPath\.crates2.json" -Force -ErrorAction SilentlyContinue
		}
		else {
			$architectureMap = @{
				'AMD64' = 'amd64'
				'ARM64' = 'arm64'
			}
			$architecture = $architectureMap[$env:PROCESSOR_ARCHITECTURE] ?? '386'
			if ($v) {
				$targetVersion = "v$v"
			}
			else {
				Write-Host -Object 'Fetching the latest Spicetify version...' -NoNewline
				$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$cliOwnerRepo/releases/latest"
				$targetVersion = $latestRelease.tag_name
				Write-Ok
			}
			Write-Host -Object "Downloading Spicetify $targetVersion..." -NoNewline
			Invoke-WebRequest -Uri "https://github.com/$cliOwnerRepo/releases/download/$targetVersion/spicetify-$v-windows-$architecture.exe" -UseBasicParsing -OutFile $spicetifyExecutablePath
			Write-Ok
		}
		New-Item -ItemType SymbolicLink -Path "$spicetifyBinaryPath\spotify.exe" -Target $spicetifyExecutablePath
	}
	end {
		Add-BinToPath
		Initialize-Binary
		Write-Host -Object 'Spicetify was successfully installed!' -ForegroundColor 'Green'
	}
}

function Initialize-Daemon {
	[CmdletBinding()]
	param ()
	begin {
		Write-Host -Object 'Creating Spicetify daemon task...'

		$CreateTask = {
			[CmdletBinding()]
			param(
				[Parameter(Mandatory = $true)]
				[string]$name,
				[Parameter(Mandatory = $true)]
				[string]$description,
				[Parameter(Mandatory = $true)]
				[string]$command,
				[Parameter(Mandatory = $true)]
				[string]$arguments,
				[Parameter(Mandatory = $true)]
				[string]$userId
			)

			$action = New-ScheduledTaskAction -Execute $command -Argument $arguments
			$trigger = New-ScheduledTaskTrigger -AtStartup
			$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
			$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Limited

			$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $description

			Register-ScheduledTask -TaskName $name -InputObject $task -Force
		}
	}
	process {
		$taskParameters = @{
			name        = "Spicetify daemon"
			description = "Launches Spicetify daemon at startup"
			command     = $spicetifyExecutablePath
			arguments   = "daemon"
			userId      = $env:USERNAME
		}

		if (Test-Admin) {
			& $CreateTask @taskParameters
		}
		else {
			$splattedTaskParameters = $taskParameters.GetEnumerator() | ForEach-Object { '-' + $_.Key; $_.Value } | Join-String -Separator ' ' -DoubleQuote

			Write-Host -Object 'Running the task as administrator...' -NoNewline
			$tempFile = [System.IO.Path]::GetTempFileName() + '.ps1'
			$CreateTask | Out-File -FilePath $tempFile -Encoding UTF8
			Start-Process pwsh -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tempFile, $splattedTaskParameters -PassThru -Verb RunAs -WindowStyle Hidden -Wait
			Write-Ok
		}

		Start-ScheduledTask -TaskName $taskParameters.name
	}
	end {
		Write-Host -Object 'Deamon task was successfully created!' -ForegroundColor 'Green'
	}
}

function Register-URIScheme {
	[CmdletBinding()]
	param ()
	begin {
		Write-Host -Object 'Registering Spicetify URI scheme...'
	}
	process {
		$scheme = "spicetify"
		$command = "`"$spicetifyExecutablePath`" protocol `"%1`""

		$K = New-Item -Path "HKCU:\Software\Classes\$scheme" -Force
		$K.SetValue("", "URL:$scheme", [Microsoft.Win32.RegistryValueKind]::String)
		$K.SetValue("URL Protocol", "", [Microsoft.Win32.RegistryValueKind]::String)
		$K = $K.CreateSubKey("shell\open\command")
		$K.SetValue("", "$command", [Microsoft.Win32.RegistryValueKind]::String)
	}
	end {
		Write-Host -Object 'URI scheme was successfully registered!' -ForegroundColor 'Green'
	}
}

function Install-Hooks {
	[CmdletBinding()]
	param ()
	begin {
		Write-Host -Object 'Installing Spicetify hooks...'
		Add-Dir -Path $spicetifyConfigPath
	}
	process {
		if ($build) {
			Write-Host -Object 'Downloading Spicetify hooks...' -NoNewline
			$spicetifyHooksZip = [System.IO.Path]::GetTempFileName()
			Invoke-WebRequest -Uri "https://github.com/$hooksOwnerRepo/archive/refs/heads/main.zip" -OutFile $spicetifyHooksZip
			Expand-Archive -Path $spicetifyHooksZip -DestinationPath $spicetifyConfigPath -Force
			Move-Item -Path "$spicetifyConfigPath\v3-main\hooks" -Destination $spicetifyHooksPath -Force
			Remove-Item -LiteralPath "$spicetifyConfigPath\v3-main" -Recurse -Force
			Write-Ok

			Write-Host -Object 'Building Spicetify hooks...'
			Invoke-Command -Command 'bunx' -Arguments 'tsgo', '--project', "$spicetifyHooksPath\tsconfig.json"
		}
		else {
			Invoke-Command -Command $spicetifyExecutablePath -Arguments 'sync'
		}
	}
	end {
		Write-Host -Object 'Spicetify hooks were successfully installed!' -ForegroundColor 'Green'
	}
}
#endregion Functions

#region Main
#region Checks
if (-not (Test-PowerShellVersion)) {
	Write-Error
	# Write-Warning -Message 'PowerShell 5.1 or higher is required to run this script'
	# Write-Warning -Message "You are running PowerShell $($PSVersionTable.PSVersion)"
	# Write-Host -Object 'PowerShell 5.1 install guide:'
	# Write-Host -Object 'https://learn.microsoft.com/skypeforbusiness/set-up-your-computer-for-windows-powershell/download-and-install-windows-powershell-5-1'
	Write-Warning -Message 'PowerShell 7 or higher is required to run this script'
	Write-Host -Object 'PowerShell 7 install guide:'
	Write-Host -Object 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows'
	Pause
	exit
}
else {
	Write-Ok
}
if (Test-Admin) {
	Write-Error
	Write-Warning -Message "The script was run as administrator. This can result in problems with the installation process or unexpected behavior. Do not continue if you do not know what you are doing."
	$Host.UI.RawUI.Flushinputbuffer()
	$choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Abort installation.'),
    (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Resume installation.')
	)
	$choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process?', $choices, 0)
	if ($choice -eq 0) {
		Write-Host -Object 'Spicetify installation aborted' -ForegroundColor 'Yellow'
		Pause
		exit
	}
}
else {
	Write-Ok
}
#endregion Checks

#region Spicetify
if (-not $skipBinary) {
	Write-Host
	Install-Binary
}
if (-not $skipDaemon) {
	Write-Host
	Initialize-Daemon
}
if (-not $skipURIScheme) {
	Write-Host
	Register-URIScheme
}
if ($installHooks) {
	Write-Host
	Install-Hooks
}

Write-Host -Object "`nRun" -NoNewline
Write-Host -Object ' spicetify -h ' -NoNewline -ForegroundColor 'Cyan'
Write-Host -Object 'to get started'
#endregion Spicetify
#endregion Main
