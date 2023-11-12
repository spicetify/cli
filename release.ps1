#Requires -Version 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

#region Functions
function Format-Code {
    [CmdletBinding()]
    param()
    begin {
        Write-Verbose -Message 'Formatting the code...' -Verbose
    }
    process {
        prettier --write 'Extensions\*.js' 'jsHelper\*.js' 'CustomApps\*\*{.js,.css}'
        gofmt -w -s -l .
    }
    end {
        Write-Host -Object 'Success ✔' -ForegroundColor 'Green'
    }
}

function New-ReleaseArchive {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [version]$Version,

        [Parameter(Mandatory)]
        [ValidateSet('amd64', '386', 'arm64')]
        [string]$Architecture,

        [Parameter(Mandatory)]
        [ValidateSet('darwin', 'linux', 'windows')]
        [string]$OS
    )
    process {
        $env:GOARCH = $Architecture
        $env:GOOS = $OS

        if ($OS -eq 'windows') {
            $binaryFormat = '.exe'
            $archiveFormat = '.zip'
            $archiveCompresson = '-mx9'
            if ($Architecture -eq '386') {
                $visualArchitecture = 'x32'
            }
            else {
                $visualArchitecture = 'x64'
            }
        }
        else {
            $archiveFormat = '.tar'
            $finalArchiveFormat = '.tar.gz'
            $finalArchiveCompresson = '-mx9'
            $visualArchitecture = $Architecture
        }

        $targetVariant = "$OS-$visualArchitecture"
        $compiledBinaryPath = "bin\$targetVariant\spicetify$binaryFormat"
        $fileList = @(".\bin\$targetVariant\*", 'CustomApps', 'Extensions', 'Themes', 'jsHelper', 'globals.d.ts', 'css-map.json')
        $archivePath = "bin\spicetify-$targetVariant$archiveFormat"
        $finalArchivePath = "bin\spicetify-$targetVariant$finalArchiveFormat"

        Write-Verbose -Message "Building a binary for $targetVariant..." -Verbose
        go build -ldflags "-X main.version=$Version" -o $compiledBinaryPath

        Write-Verbose -Message "Creating an archive for $targetVariant..." -Verbose
        7z a -bb0 $archiveCompresson $archivePath $fileList >$null 2>&1
        if ($OS -ne 'windows') {
            7z a -bb0 -sdel $finalArchiveCompresson $finalArchivePath $archivePath >$null 2>&1
        }
    }
    end {
        Write-Host -Object 'Success ✔' -ForegroundColor 'Green'
    }
}

function New-ReleaseArchives {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory)]
        [ValidateScript({ $PSItem -ge 0 })]
        [int]$Major,

        [Parameter(Mandatory)]
        [ValidateScript({ $PSItem -ge 0 })]
        [int]$Minor,

        [Parameter(Mandatory)]
        [ValidateScript({ $PSItem -ge 0 })]
        [int]$Patch
    )
    begin {
        $variants = @(
            @{
                os            = 'linux'
                architectures = @('amd64')
            },
            @{
                os            = 'darwin'
                architectures = @('amd64', 'arm64')
            },
            @{
                os            = 'windows'
                architectures = @('amd64', '386')
            }
        )

        $version = "$Major.$Minor.$Patch"

        if (Test-Path -Path 'bin') {
            Remove-Item -Path 'bin' -Recurse -Force
        }

        Write-Verbose -Message 'Creating release archives...' -Verbose
    }
    process {
        foreach ($variant in $variants) {
            foreach ($architecture in $variant.architectures) {
                New-ReleaseArchive -Version $version -Architecture $architecture -OS $variant.os
            }
        }
    }
    end {
        Write-Host -Object 'Release archives has been created ✔' -ForegroundColor 'Green'
    }
}

function Remove-TempFolders {
    [CmdletBinding()]
    param()
    begin {
        Write-Verbose -Message 'Cleaning Up...' -Verbose
    }
    process {
        Get-ChildItem -Path 'bin' -Directory | Remove-Item -Recurse -Force
    }
    end {
        Write-Host -Object 'Success ✔' -ForegroundColor 'Green'
    }
}
#endregion Functions

#region Main
$curentVersion = (Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/spicetify-cli/releases/latest').tag_name
Write-Host -Object "Current version: $curentVersion" -ForegroundColor 'White'
Write-Host -Object 'Unless the CSS Map has had major changes, please bump patch.' -ForegroundColor 'Yellow'

Format-Code
New-ReleaseArchives

Remove-TempFolders
#endregion Main
