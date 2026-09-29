$ErrorActionPreference = 'Stop'
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.ARM64 -property installationPath
if (-not $installation) { throw 'Visual Studio ARM64 C++ tools are required.' }
$compiler = Join-Path $installation 'VC\Tools\Llvm\ARM64\bin\clang-cl.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Install the Visual Studio C++ Clang compiler for ARM64.' }
$developerShell = Join-Path $installation 'Common7\Tools\VsDevCmd.bat'
$buildEnvironment = & cmd.exe /d /s /c "call `"$developerShell`" -arch=arm64 -host_arch=arm64 >nul && set"
if ($LASTEXITCODE -ne 0) { throw 'Failed to configure the ARM64 C++ environment.' }
$buildEnvironment | Where-Object { $_ -match '^(INCLUDE|LIB|LIBPATH|PATH)=' } |
    Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
# AWS-LC needs clang-cl for ARM assembly; the window-control helper uses MSVC C++.
"CC=$compiler" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
& rustup set default-host aarch64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) { throw 'Failed to select the native Rust host.' }
