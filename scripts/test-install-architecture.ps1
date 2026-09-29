$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Installer = Get-Content -LiteralPath "$RepoRoot\install.ps1" -Raw
. ([scriptblock]::Create($Installer.Substring(0, $Installer.IndexOf('#region Main'))))

# Check the actual Windows API before replacing it with deterministic fixtures.
$native = Get-SpicetifyNativeMachine
if ($native -notin @(0x8664, 0xAA64)) { throw "Unexpected native machine: $native" }
if ($env:RUNNER_ARCH -eq 'ARM64' -and $native -ne 0xAA64) { throw 'Emulation hid the ARM64 host' }
Write-Host "Native release architecture: $(Get-SpicetifyArchitecture)"

function Get-SpicetifyNativeMachine { 0xAA64 }
if ((Get-SpicetifyArchitecture) -ne 'aarch64') { throw 'ARM64 must select the native release' }
function Get-SpicetifyNativeMachine { 0x8664 }
if ((Get-SpicetifyArchitecture) -ne 'x86_64') { throw 'x64 must keep the x64 release' }
function Get-SpicetifyNativeMachine { 0x014c }
$rejected = $false
try { Get-SpicetifyArchitecture } catch { $rejected = $true }
if (-not $rejected) { throw 'Unsupported native architectures must fail explicitly' }
Write-Host 'Native Windows installer architecture selection passed.'

# Exercise the real download selection and checksum check without network access.
function Get-SpicetifyNativeMachine { 0xAA64 }
function Invoke-WebRequest {
  param($Uri, $OutFile, [switch]$UseBasicParsin)
  if ($Uri -notlike '*-windows-aarch64.zip') { throw "Wrong architecture URL: $Uri" }
  [IO.File]::WriteAllText($OutFile, 'archive fixture')
}
function Invoke-RestMethod {
  param($Uri)
  if ($Uri -notlike '*-windows-aarch64.zip.sha256') { throw "Wrong checksum URL: $Uri" }
  (Get-FileHash -LiteralPath ([IO.Path]::Combine([IO.Path]::GetTempPath(), 'spicetify.zip')) -Algorithm SHA256).Hash
}
$v3 = $true
$v = '3.0.0-beta.20'
$download = $null
try {
  $download = Get-Spicetify
  if (-not (Test-Path -LiteralPath $download)) { throw 'Verified archive was not returned' }
  function Invoke-RestMethod { param($Uri) '0' * 64 }
  $rejected = $false
  try { Get-Spicetify | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'A mismatched archive checksum must fail before installation' }
}
finally {
  if ($download) { Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue }
}
Write-Host 'ARM64 release download and checksum rejection passed.'

$fixture = Join-Path ([IO.Path]::GetTempPath()) "spicetify-replace-$([guid]::NewGuid())"
$source = Join-Path $fixture 'source'
$destination = Join-Path $fixture 'installed'
try {
  New-Item -ItemType Directory -Path $source -Force | Out-Null
  foreach ($name in @('spicetify.exe', 'spicetify-daemon.exe')) {
    [IO.File]::WriteAllText((Join-Path $source $name), 'first')
  }
  Install-SpicetifyBinaries -Source $source -Destination $destination
  foreach ($name in @('spicetify.exe', 'spicetify-daemon.exe')) {
    if ((Get-Content -LiteralPath (Join-Path $destination $name) -Raw) -ne 'first') {
      throw 'Fresh installation did not install both binaries.'
    }
    [IO.File]::WriteAllText((Join-Path $source $name), 'second')
  }
  Install-SpicetifyBinaries -Source $source -Destination $destination
  Remove-Item -LiteralPath (Join-Path $source 'spicetify-daemon.exe')
  [IO.File]::WriteAllText((Join-Path $source 'spicetify.exe'), 'third')
  $rejected = $false
  try { Install-SpicetifyBinaries -Source $source -Destination $destination } catch { $rejected = $true }
  if (-not $rejected) { throw 'Incomplete replacement must fail.' }
  foreach ($name in @('spicetify.exe', 'spicetify-daemon.exe')) {
    if ((Get-Content -LiteralPath (Join-Path $destination $name) -Raw) -ne 'second') {
      throw 'Failed replacement did not restore the original binary pair.'
    }
  }
  [IO.File]::WriteAllText((Join-Path $source 'spicetify-daemon.exe'), 'third')
  $locked = [IO.File]::Open((Join-Path $destination 'spicetify.exe'), 'Open', 'Read', 'Read')
  try {
    $rejected = $false
    try { Install-SpicetifyBinaries -Source $source -Destination $destination } catch { $rejected = $true }
    if (-not $rejected) { throw 'A locked installation must fail without replacing the daemon.' }
  }
  finally { $locked.Dispose() }
  foreach ($name in @('spicetify.exe', 'spicetify-daemon.exe')) {
    if ((Get-Content -LiteralPath (Join-Path $destination $name) -Raw) -ne 'second') {
      throw 'Locked-file failure changed an installed binary.'
    }
  }
}
finally { Remove-Item -LiteralPath $fixture -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host 'Fresh installation, pair replacement, rollback, and locked-file recovery passed.'
