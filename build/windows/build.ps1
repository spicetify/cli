[CmdletBinding()]
param (
	[Parameter(
		Mandatory = $true
	)]
	[string]$version,

	[Parameter(
		Mandatory = $true
	)]
	[ValidateSet('amd64', 'arm64', '386')]
	[string]$platform
)

$ErrorActionPreference = 'Stop'

mkdir dist

$env:GOARCH = $platform
go build -C ..\..\ -o .\build\windows\dist\cli-$version-windows-$architecture.exe -ldflags "-X main.version=$version"

Copy-Item .\dist\cli-$version-windows-$architecture.exe .\bin\spicetify.exe

$arch = $platform -replace 'amd64', 'x64' -replace '386', 'x86'
wix build -arch $arch -d ProductVersion=$version -d Platform=$arch -ext WixToolset.Util.wixext -ext WixToolset.UI.wixext .\installer.wxs -o .\dist\installer-$version-windows-$platform.msi
