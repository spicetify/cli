[CmdletBinding()]
param (
  [Parameter(
    Mandatory = $true
  )]
  [string]$version,

  [Parameter(
    Mandatory = $true
  )]
  [ValidateSet('amd64', 'arm64')]
  [string]$platform
)

$ErrorActionPreference = 'Stop'

$target = switch ($platform) {
	'amd64' { 'x86_64-pc-windows-msvc' }
	'arm64' { 'aarch64-pc-windows-msvc' }
}

mkdir dist -Force

cargo build --release --target $target --manifest-path ..\..\Cargo.toml

$exe = "..\..\target\$target\release\spicetify.exe"
Copy-Item $exe "dist\spicetify-$version-windows-$platform.exe"
Copy-Item $exe "bin\spicetify.exe"

$arch = $platform -replace 'amd64', 'x64'

# Windows runner 2025 default has iscc in PATH
$innoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
& $innoSetupPath /DAppVersion=$version /DArch=$arch /DOutputArch=$platform .\installer.iss
