<h3 align="center"><img src="https://i.imgur.com/iwcLITQ.png" width="600px"></h3>
<p align="center">
  <a href="https://goreportcard.com/report/github.com/khanhas/spicetify-cli"><img src="https://goreportcard.com/badge/github.com/khanhas/spicetify-cli"></a>
  <a href="https://github.com/khanhas/spicetify-cli/releases/latest"><img src="https://img.shields.io/github/release/khanhas/spicetify-cli/all.svg?colorB=97CA00?label=version"></a>
  <a href="https://github.com/khanhas/spicetify-cli/releases"><img src="https://img.shields.io/github/downloads/khanhas/spicetify-cli/total.svg?colorB=97CA00"></a>
  <a href="https://spectrum.chat/spicetify"><img src="https://withspectrum.github.io/badge/badge.svg"></a>
</p>

Command-line tool to customize new Spotify client (v1.1.58 or later).
Supports Windows, MacOS and Linux.

<img src="https://user-images.githubusercontent.com/26436809/118751529-d0abcf00-b8a4-11eb-9876-8b15f930a691.png" alt="img" align="right" width="500px">  

### Features
- Change colors whole UI
- Inject CSS for advanced customization
- Inject Extensions (Javascript script) to extend functionalities, manipulate UI and control player.
- Inject Custom apps
- Remove bloated components to improve performance

#### [Installation](https://github.com/khanhas/spicetify-cli/wiki/Installation)
#### [Basic Usage](https://github.com/khanhas/spicetify-cli/wiki/Basic-Usage)
#### [Customization](https://github.com/khanhas/spicetify-cli/wiki/Customization)
#### [Extensions](https://github.com/khanhas/spicetify-cli/wiki/Extensions)
#### [Custom Apps](https://github.com/khanhas/spicetify-cli/wiki/Custom-Apps)
#### [Wiki](https://github.com/khanhas/spicetify-cli/wiki)

# Legacy Spotify
If you wish to use old Spotify client v1.1.56 or older, you have to install spicetify v1.2.1. To install older release, please use install script to download pre-built package and specify version:

**Windows**: In powershell
```powershell
$v="1.2.1"; Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/khanhas/spicetify-cli/master/install.ps1" | Invoke-Expression
```

**Linux/MacOS:** In bash
```bash
curl -fsSL https://raw.githubusercontent.com/khanhas/spicetify-cli/master/install.sh -o /tmp/install.sh
sh /tmp/install.sh 1.2.1
```

spicetify v1 code is available in branch [`legacy`](https://github.com/khanhas/spicetify-cli/tree/legacy) if you want to build from source.
