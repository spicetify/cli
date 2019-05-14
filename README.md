# spicetify-cli
[![Go Report Card](https://goreportcard.com/badge/github.com/khanhas/spicetify-cli)](https://goreportcard.com/report/github.com/khanhas/spicetify-cli) [![GitHub release](https://img.shields.io/github/release/khanhas/spicetify-cli/all.svg?colorB=97CA00?label=version)](https://github.com/khanhas/spicetify-cli/releases/latest) [![Github All Releases](https://img.shields.io/github/downloads/khanhas/spicetify-cli/total.svg?colorB=97CA00)](https://github.com/khanhas/spicetify-cli/releases) [![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/spicetify)

Command-line tool to customize Spotify client.
Supports Windows, MacOS and Linux.

- [Features](#features)
- [Install](#install)
  - [Homebrew/LinuxBrew](#homebrewlinuxbrew)
  - [AUR](#aur)
  - [Windows (pre-built)](#windows-pre-built)
  - [Linux or MacOS (pre-built)](#linux-or-macos-prebuilt)
- [Basic Usage](#basic-usage)
- [Customization](#customization)
  - [Config](#configs)
  - [Theme](#themes)
  - [Extensions](#extensions)  
- Default Extensions:
  - [Auto Skip Videos](#auto-skip-videos)
  - [Christian Spotify](#christian-spotify)
  - [DJ Mode](#dj-mode)
  - [Keyboard Shortcut](#keyboard-shortcut)
  - [Queue All](#queue-all)
  - [Shuffle+](#shuffle)
  - [Trash Bin](#trash-bin)
- Default Custom apps:
  - [Reddit](#reddit)
- [Development](#development)
  
## Features
- Change colors whole UI
- Inject CSS for advanced customization
- Inject Extensions (Javascript script) to extend functionalities, manipulate UI and control player.
- Inject Custom apps
- Enable additional, hidden features
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
Open Powershell, run:
```powershell
iwr https://raw.githubusercontent.com/khanhas/spicetify-cli/master/install.ps1 | iex
```

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

Or, if spotify isn't there:
```
sudo chmod 777 /opt/spotify -R
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

Or, if spotify isn't there:
```
sudo chmod 777 /opt/spotify -R
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

In Spotify, hit <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>R</kbd> / <kbd>Command</kbd> <kbd>Shift</kbd> <kbd>R</kbd> to reload and receive visual update of your theme.

For other commands and additional flags information, please run:
```bash
spicetify --help
```

## Customization
### Configs
Config file is located at:  
**Windows:** `%userprofile%\.spicetify\config.ini`  
**Linux:** `~/.spicetify/config.ini`  
**MacOS:** `~/spicetify_data/config.ini`  

For detail information of each config field, please run:
```bash
spicetify --help config
```

### Themes
There are 2 places you can put your themes:  
1. `Themes` folder in Home directory  

**Windows:** `%userprofile%\.spicetify\Themes\`  
**Linux:** `~/.spicetify/Themes/`  
**MacOS:** `~/spicetify_data/Themes`  

2. `Themes` folder in Spicetify executable directory

If there are 2 themes having same name, theme in Home directory is prioritized.

Every theme should contain:
 - `color.ini`: store colors value that later will be converted to CSS variables
 - `user.css`: set of custom CSS rules to manipulate, hide, move UI elements.

### Extensions
Basically are Javascript files that will be evaluated along with Spotify main javascript.
Add your desired extension filenames in config, separated them by `|` character.  
Example:
```ini
[AdditionalOptions]
...
extensions = autoSkipExplicit.js|queueAll.js|djMode.js|shuffle+.js|trashbin.js
```

Extension files can be store in:
- `Extensions`  folder in Home directory:  
**Windows:** `%userprofile%\.spicetify\Extensions\`  
**Linux:** `~/.spicetify/Extensions/`  
**MacOS:** `~/spicetify_data/Extensions`  
- `Extensions`  folder in Spicetify executable directory.

If there are 2 extensions having same name, extension in Home directory is prioritized.

Some Spotify API are leaked and put in global object `Spicetify`. Check out `global.d.ts` for API documentation.  

Below are list of default extensions that comes with package:

#### Auto Skip Videos 
**Filename:** `autoSkipVideo.js`  
Videos are unable to play in some regions because of Spotify's policy. Instead of jumping to next song in playlist, it just stops playing. And it's kinda annoying to open up the client to manually click next every times it happens. Use this extension to skip them automatically.

#### Christian Spotify
**Filename:** `autoSkipExplicit.js`  
Auto skip explicit tracks

![Ext_ChristianDemo](https://i.imgur.com/yTUeWWn.png)

#### DJ Mode
**Filename:** `djMode.js`  
Easily setting up the client for your friends or audiences to choose, add song to queue but prevent them to control player. Plays button in album track list/playlist are re-purposed to add track to queue, instead of play track directly. Hide Controls option also allow you to hide all control button in player bar, Play/More/Follow buttons in cards.

![Ext_DJDemo](https://i.imgur.com/pOFEqtM.png)

#### Keyboard Shortcut
**Filename:** `keyboardShortcut.js`

Register some useful keybinds to support keyboard-driven navigation in Spotify client. Less time touching the mouse.
- <kbd>Ctrl</kbd> <kbd>Tab</kbd> / <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Tab</kbd>: Navigate items in left sidebar menu.
- <kbd>Backspace</kbd>/<kbd>Shift</kbd> <kbd>Backspace</kbd>: Navigate history backward/forward.
- <kbd>PageUp</kbd>/<kbd>PageDown</kbd>: Force scroll up/down app page only (because mouse focus is sometimes in sidebar region and they scroll sidebar instead of app page).
- <kbd>J</kbd>/<kbd>K</kbd>: Scroll app page up/down. \*Tips hat to Vim users\*
- <kbd>Ctrl</kbd> <kbd>Q</kbd>: Open Queue page.
- <kbd>`</kbd>: Open up keyboard-driven navigation. Hit correct key sequences to open up place you want to go:

![KeyboardDemo](https://i.imgur.com/YX09Lc1.png)

#### Queue All
**Filename:** `queueAll.js`  
You like using Discover, New Releases page to find new music but adding each one of them to queue takes a lot of effort? If so, activate this  extensions and apply. At top of every carousel now has a "Queue All"  button to help you add all of them to queue. Note: Not available for playlist carousels. Just songs, albums ones.

![QueueAllDemo](https://i.imgur.com/D9ytt7K.png)

#### Shuffle+
**Filename:** `shuffle+.js`  
Detect current context (playlist, album, user collection or show), gather all its items and shuffle them with Fisher–Yates algorithm.
After injecting this extension, go to Queue and you can find 2 new buttons at page header:
    - Shuffle Context: detect current context and shuffle all its item.
    - Shuffle Queue: shuffle only 80 items or less that are visible in Queue page. It's only useful for mixed context queue.
For most of the time, just use Shuffle Context.

![Shuffle_1](https://i.imgur.com/Vy8fwMy.png)
![Shuffle_2](https://i.imgur.com/3CWieYj.png)

#### Trash Bin
**Filename:** `trashbin.js`  
Throw songs/artists to trash bin and never hear them again (automatically skip). This extension will append a trash bin button in player bar and one in every artist page header. Button in player bar will immediately skip and add that song to trash list. Button in artist page will add that artist in trash list and skip whenever his/her songs play.

![Ext_Trash1](https://i.imgur.com/k7A7oBI.png) | ![Ext_Trash2](https://i.imgur.com/dVZclSJ.png)
---|---

### Custom apps
Inject custom apps to Spotify and access them in left sidebar.  
Add your desired custom app folder names in config, separated them by `|` character.  
Example:
```ini
[AdditionalOptions]
...
custom_apps = reddit|yourownapp
```

App folders can be store in:
- `CustomApps`  folder in Home directory:  
**Windows:** `%userprofile%\.spicetify\CustomApps\`  
**Linux:** `~/.spicetify/CustomApps/`  
**MacOS:** `~/spicetify_data/CustomApps`  
- `CustomApps`  folder in Spicetify executable directory.

If there are 2 apps having same name, app in Home directory is prioritized.

I included my own app to demonstrate how to make and inject an app:

#### Reddit
Fetching top 100 Spotify posts in any subreddit. This app has native feels and behavior just like other Spotify apps: you can follow, save, play, open playlist/track/album directly. Moreover, it also can fetch Youtube posts and play them inside Spotify.  

![RedditDemo](https://i.imgur.com/OTrW2e8.png)

## Development
### Requirements
- [Go](https://golang.org/dl/)

Clone repo and download dependencies:
```bash
cd $HOME
git clone https://github.com/khanhas/spicetify-cli
```

### Build
#### Windows
```powershell
cd $HOME\spicetify-cli
go build -o spicetify.exe
```

#### Linux and MacOS
```bash
cd ~/spicetify-cli
go build -o spicetify
```

### Future
- [ ] SASS 
