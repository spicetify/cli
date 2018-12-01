if ($IsLinux) {
    if (Test-Path "./bin/psm") {
        Remove-Item "./bin/psm"
    }

    go build -o "./bin/psm" "./src/psm.go"
} elseif ($IsWindows) {
    if (Test-Path "./bin/psm.exe") {
        Remove-Item "./bin/psm.exe"
    }

    go build -o "./bin/psm.exe" "./src/psm.go"
} elseif ($IsMac) {
    # Ehhhhh
}