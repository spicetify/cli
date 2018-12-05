# spicetify-cli

## Install
1. Download correct package for your OS: https://github.com/khanhas/spicetify-cli/releases
2. Unpack  
#### Windows
Extract zip package. 
  
To use Spicetify, you can run `spicetify.exe` directly with its path,  
Or optionally add its directory to enviroment path so you can run `spicetify` everywhere.  
  
#### Linux and MacOS
In terminal, run following commands:
```bash
cd ~/
mkdir spicetify
cd spicetify
tar xzf ~/Downloads/spicetify-xxx.tar.gz
```
With `~/Downloads/spicetify-xxx.tar.gz` is path to just downloaded package.
  
Optionally, run:
```bash
echo 'spicetify=~/spicetify/spicetify' >> .bashrc
```
so you can run `spicetify` everywhere.

## Usage
Run with no command one time to generate config file
```bash
spicetify
```

Then:
```bash
spicetify backup
```

Finally:
```bash
spicetify apply
```
After changing theme colors and css, run `apply` again

## Customization
#### Config file 
Is located at:
**Windows:** `%userprofile%\.spicetify\config.ini`
**Linux and MacOS:** `~/.spicetify/config.ini`

#### Themes
There are 2 places you can put your themes:
1. `Themes` folder in Home directory
**Windows:** `%userprofile%\.spicetify\Themes\`
**Linux and MacOS:** `~/.spicetify/Themes/`
2. `Themes` folder in Spicetify executable directory

If there are 2 themes having same name, theme in Home directory is prioritized.

## Development
### Requirements 
- [Go](https://golang.org/dl/)

```bash 
git clone https://github.com/khanhas/spicetify-cli
```

### Build
```bash
cd spicetify-cli
go build src/spicetify.go
```

### Future
[ ] Implement additional features
[ ] SASS
[ ] Watch theme files change and automatically apply
[ ] Inject extensions and custom apps
