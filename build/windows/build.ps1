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
wix eula accept wix7
wix build -arch $arch -d ProductVersion=$version -d Platform=$arch -ext WixToolset.Util.wixext -ext WixToolset.UI.wixext .\installer.wxs -o "dist\installer-$version-windows-$platform.msi"
