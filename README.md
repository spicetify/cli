# spicetify-cli

## Requirements 
- [Go](https://golang.org/dl/)

## Clone
```bash 
git clone https://github.com/khanhas/spicetify-cli
```

## Build
```bash
cd spicetify-cli
go build src/spicetify.go
```

## Usage
Run with no command one time to generate config file
```bash
spiceitfy
```

Then:
```bash
spicetify backup
```

Finally:
```bash
spicetify apply
```
After change theme color, css, run `apply` again

## Future
- SASS
- Watch theme files change and automatically apply
- Inject extensions and custom apps
