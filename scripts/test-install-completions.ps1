$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Installer = Get-Content -LiteralPath "$RepoRoot\install.ps1" -Raw
$Functions = $Installer.Substring(0, $Installer.IndexOf('#region Main'))
. ([scriptblock]::Create($Functions))

$TempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "spicetify-completion-$([guid]::NewGuid())"
$ProfilePath = Join-Path $TempDirectory 'profile.ps1'

try {
  New-Item -ItemType Directory -Path $TempDirectory -Force | Out-Null
  [System.IO.File]::WriteAllText($ProfilePath, '# existing config')

  Add-SpicetifyCompletion -ProfilePath $ProfilePath
  Add-SpicetifyCompletion -ProfilePath $ProfilePath

  $completion = '$env:COMPLETE = "powershell"; spicetify | Out-String | Invoke-Expression; Remove-Item Env:\COMPLETE'
  $matches = @(Select-String -LiteralPath $ProfilePath -SimpleMatch $completion)
  if ($matches.Count -ne 1) {
    throw "Expected one completion line in $ProfilePath, found $($matches.Count)"
  }
  if ((Get-Content -LiteralPath $ProfilePath -First 1) -ne '# existing config') {
    throw "Completion was not separated from existing content in $ProfilePath"
  }
}
finally {
  Remove-Item -LiteralPath $TempDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
