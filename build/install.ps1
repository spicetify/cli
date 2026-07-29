$ErrorActionPreference = 'Stop'

$ProcessorArch = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment').PROCESSOR_ARCHITECTURE
if ($ProcessorArch -ne 'AMD64' -and $ProcessorArch -ne 'ARM64') {
	Write-Error "Spicetify is only available for x64 and ARM64 Windows"
	exit 1
}
$Arch = if ($ProcessorArch -eq 'ARM64') { 'aarch64' } else { 'x64' }

$BinDir = "$env:LOCALAPPDATA\Spicetify\bin"

if (-not (Test-Path $BinDir)) {
	New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

try {
	$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/veryboringhwl/app/releases/latest"
	$Version = $releases.tag_name -replace '^v', ''
} catch {
	Write-Error "Could not determine latest version"
	exit 1
}

Write-Output "Downloading Spicetify ${Version}..."

$Archive = "spicetify-${Version}-windows-${Arch}.zip"
$Uri = "https://github.com/veryboringhwl/app/releases/download/v${Version}/${Archive}"
$ZipPath = "${BinDir}\spicetify.zip"

curl.exe --ssl-revoke-best-effort -L --progress-bar -o $ZipPath $Uri
if ($LASTEXITCODE -ne 0) {
	try {
		Invoke-WebRequest -Uri $Uri -OutFile $ZipPath
	} catch {
		Write-Error "Failed to download ${Uri}"
		exit 1
	}
}

$prev = $ProgressPreference
$ProgressPreference = 'SilentlyContinue'
Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
$ProgressPreference = $prev
Remove-Item $ZipPath

$User = [System.EnvironmentVariableTarget]::User
$Path = [System.Environment]::GetEnvironmentVariable('Path', $User)
if (-not (";${Path};".ToLower() -like "*;${BinDir};*".ToLower())) {
	[System.Environment]::SetEnvironmentVariable('Path', "${Path};${BinDir}", $User)
}
$env:Path = "${BinDir};" + $env:Path

Write-Output "Spicetify ${Version} installed to ${BinDir}"

$Spicetify = "${BinDir}\spicetify.exe"

Write-Output ""
Write-Output "Initializing Spicetify..."
& $Spicetify init
& $Spicetify apply

Write-Output ""
Write-Output "Creating Start Menu shortcut..."

$Programs = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
if (-not (Test-Path $Programs)) {
	New-Item -ItemType Directory -Path $Programs -Force | Out-Null
}
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut("$Programs\Spicetify.lnk")
$Shortcut.TargetPath = "$BinDir\spicetify.exe"
$Shortcut.WorkingDirectory = "$BinDir"
$Shortcut.IconLocation = "$BinDir\spicetify.exe"
$Shortcut.Save()

Write-Output ""
Write-Output "Done. Run 'spicetify' to get started"
