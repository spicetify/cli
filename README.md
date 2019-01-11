# spicetify-cli
[![Go Report Card](https://goreportcard.com/badge/github.com/khanhas/spicetify-cli)](https://goreportcard.com/report/github.com/khanhas/spicetify-cli) [![GitHub release](https://img.shields.io/github/release/khanhas/spicetify-cli/all.svg?colorB=97CA00?label=version)](https://github.com/khanhas/spicetify-cli/releases/latest) [![Github All Releases](https://img.shields.io/github/downloads/khanhas/spicetify-cli/total.svg?colorB=97CA00)](https://github.com/khanhas/spicetify-cli/releases) [![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/spicetify)

Commandline tool to customize Spotify client.
Supports Windows, MacOS and Linux.

## Features
- Change colors whole UI
- Inject CSS for advanced customization
- Inject Extensions (Javascript script) to extend functionalities, manipulate UI and control player.
- Enable some additional, hidden features
- Remove bloated components to improve performance

![mac_demo1](https://i.imgur.com/JyWVzeC.png)

![majaro_demo1](https://i.imgur.com/e4CWeRC.png)

## Install
### Homebrew/LinuxBrew
```bash
brew install khanhas/tap/spicetify-cli
```

### AUR
```bash
yay spicetify-cli
```

### Windows (pre-built)
1. Download `windows` package from: https://github.com/khanhas/spicetify-cli/releases
2. Open Powershell and run following command:
```powershell
Expand-Archive "$HOME\Downloads\spicetify-x.x.x-windows-x64.zip" "$HOME\spicetify"
```
with `$HOME\Downloads\picetify-x.x.x-windows-x64.zip"` is direct path to just downloaded package.
  
Optionally, run:
```powershell
Add-Content $PROFILE "Set-Alias spicetify `"$HOME\spicetify\spicetify.exe`""
```
Restart Powershell. Now you can run `spicetify` everywhere.
  
### Linux or MacOS (prebuilt)
1. Download `linux` or `darwin` package from: https://github.com/khanhas/spicetify-cli/releases
2. In terminal, run following commands:
```bash
mkdir ~/spicetify
tar xzf ~/Downloads/spicetify-x.x.x-linux-amd64.tar.gz -C ~/spicetify
```
with `~/Downloads/spicetify-xxx.tar.gz` is direct path to just downloaded package.
  
Optionally, run:
```bash
sudo ln -s ~/spicetify/spicetify /usr/bin/spicetify
```
Now you can run `spicetify` everywhere.

#### Note for Linux users
##### Spotify installed from AUR
Before applying Spicetify, you need to gain write permission on Spotify files, by running command:
```bash
sudo chmod 777 /usr/share/spotify -R
```

##### Spotify installed from Snap 
Apps installed from Snap cannot be modified so you need to follow these steps to get Spicetify working:
1. Uninstall Spotify in Snap or run command `snap remove spotify`
2. Remove .spicetify folder: `rm -r ~/.spicetify`
3. Open http://repository.spotify.com/pool/non-free/s/spotify-client/  
You can see there are 2 deb files, for i386 and amd64. You should pick amd64 if your Ubuntu is 64bit version because seems like they stopped upgrading the client for i386.
4. Install deb file you just downloaded with Ubuntu Software. Might take a bit.
5. After Spotify's installed successfully, you need to gain write permission on Spotify files, by running command:
```bash
sudo chmod 777 /usr/share/spotify -R
```

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

For other commands and additional flags information, please run:
```bash
spicetify --help
```

## Customization
#### Config file
Located at:  
**Windows:** `%userprofile%\.spicetify\config.ini`  
**Linux:** `~/.spicetify/config.ini`  
**MacOS:** `~/spicetify_data/config.ini`  

For detail information of each config field, please run:
```bash
spicetify --help config
```

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

Clone repo and download dependencies:
```bash
go get github.com/khanhas/spicetify-cli
```

### Build
#### Windows
```powershell
cd $HOME\go\src\github.com\khanhas\spicetify-cli
go build -o spicetify.exe
```

#### Linux and MacOS
```bash
cd ~/go/src/github.com/khanhas/spicetify-cli
go build -o spicetify
```

### Future
- [ ] SASS  
- [ ] Inject custom apps  
