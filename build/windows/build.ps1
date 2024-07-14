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

$env:GOARCH = $platform
go build -C ..\..\ -o build\windows\bin\spicetify.exe -ldflags "-X main.version=$version"

$wixPlatform = $platform -replace 'amd64', 'x64' -replace 'arm64', 'arm' -replace '386', 'x86'
wix build -d ProductVersion=$version -d Platform=$wixPlatform -ext WixToolset.Util.wixext -ext WixToolset.UI.wixext .\installer.wxs -o .\spicetify.msi
