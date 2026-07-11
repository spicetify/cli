[CmdletBinding()]
param (
  [Parameter(
    Mandatory = $true
  )]
  [string]$version,

  [Parameter(
    Mandatory = $true
  )]
  [ValidateSet('x86_64', 'aarch64')]
  [string]$platform
)

$ErrorActionPreference = 'Stop'

$target = switch ($platform) {
  'x86_64' {
    'x86_64-pc-windows-msvc'
  }
  'aarch64' {
    'aarch64-pc-windows-msvc'
  }
}

mkdir dist -Force

cargo build --release --target $target --manifest-path ..\..\Cargo.toml

New-Item -ItemType Directory -Path "bin" -Force

$exe = "..\..\target\$target\release\spicetify.exe"
$daemonExe = "..\..\target\$target\release\spicetify-daemon.exe"
Copy-Item $exe "bin\spicetify.exe"
Copy-Item $daemonExe "bin\spicetify-daemon.exe"

New-Item -ItemType Directory -Path "dist\portable" -Force
Copy-Item $exe "dist\portable\spicetify.exe"
Copy-Item $daemonExe "dist\portable\spicetify-daemon.exe"
$outputArch = switch ($platform) {
  'x86_64' { 'x64' }
  'aarch64' { 'arm64' }
}
Compress-Archive -Path "dist\portable\*" -DestinationPath "dist\spicetify-$version-windows-$outputArch.zip" -Force
Remove-Item -LiteralPath "dist\portable" -Recurse -Force

$arch = $outputArch

# Windows runner 2025 default has iscc in PATH
$innoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
& $innoSetupPath /DAppVersion=$version /DArch=$arch /DOutputArch=$outputArch .\installer.iss
