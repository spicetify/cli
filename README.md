# spicetify-cli
[![Go Report Card](https://goreportcard.com/badge/github.com/khanhas/spicetify-cli)](https://goreportcard.com/report/github.com/khanhas/spicetify-cli) 

Commandline tool to customize Spotify client.
Supports Windows, MacOS and Linux.

**Features:**
- Change colors whole UI
- Inject CSS for advanced customization
- Inject Extensions (Javascript script) to extend functionalities, manipulate UI and control player.
- Enable some additional, hidden features
- Remove bloated components to improve performance

![mac_demo1](https://i.imgur.com/8njve9b.png)

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

## Basic usage
Run with no command once to generate config file
```bash
spicetify
```

Make sure config file is created successfully and there is no error, then run:
```bash
spicetify backup apply enable-devtool
```

From now, after changing colors in `color.ini` or CSS in `user.css`, you just need to run:
```bash
spicetify update
```
to update your theme.

In Spotify, hit <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>R</kbd>/<kbd>Command</kbd> <kbd>Shift</kbd> <kbd>R</kbd> to reload and receive visual update of your theme.

## Customization
#### Config file
Is located at:
**Windows:** `%userprofile%\.spicetify\config.ini`  
**Linux:** `~/.spicetify/config.ini`  
**MacOS:** `~/spicetify_data/config.ini`  

#### Themes
There are 2 places you can put your themes:  
1. `Themes` folder in Home directory  

**Windows:** `%userprofile%\.spicetify\Themes\`  
**Linux:** `~/.spicetify/Themes/`  
**MacOS:** `~/spicetify_data/Themes`  

2. `Themes` folder in Spicetify executable directory

If there are 2 themes having same name, theme in Home directory is prioritized.

#### Extensions
Add your desired extension names in config, separated them by `|` character.  
Example:
```ini
[AdditionalOptions]
...
extensions                   = autoSkipExplicit.js|queueAll.js|djMode.js|shuffle+.js|trashbin.js
```

Extension files can be store in:
- `Extensions`  folder in Home directory:  
**Windows:** `%userprofile%\.spicetify\Extensions\`  
**Linux:** `~/.spicetify/Extensions/`  
**MacOS:** `~/spicetify_data/Extensions`  
- `Extensions`  folder in Spicetify executable directory.

If there are 2 extensions having same name, extension in Home directory is prioritized.

Some Spotify API are leaked and put in global object `Spicetify`. Check out `global.d.ts` for API documentation. 
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
[ ] SASS  
[ ] Inject custom apps  
