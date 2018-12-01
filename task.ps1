function Build {
    # Windows
    go build -o "./bin/spicetify.exe" "./src/spicetify.go"
}

function BuildAll {
    go build -o "./bin/spicetify.exe" "./src/spicetify.go"
}