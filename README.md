<h3 align="center"><a href="https://spicetify.app/"><img src="https://i.imgur.com/iwcLITQ.png" width="600px"></a></h3>
<p align="center">
  <a href="https://goreportcard.com/report/github.com/spicetify/spicetify-cli"><img src="https://goreportcard.com/badge/github.com/spicetify/spicetify-cli"></a>
  <a href="https://github.com/spicetify/spicetify-cli/releases/latest"><img src="https://img.shields.io/github/release/spicetify/spicetify-cli/all.svg?colorB=97CA00?label=version"></a>
  <a href="https://github.com/spicetify/spicetify-cli/releases"><img src="https://img.shields.io/github/downloads/spicetify/spicetify-cli/total.svg?colorB=97CA00"></a>
  <a href="https://discord.gg/VnevqPp2Rr"><img src="https://img.shields.io/discord/842219447716151306?label=chat&logo=discord&logoColor=discord"></a>
  <a href="https://www.reddit.com/r/spicetify"><img src="https://img.shields.io/reddit/subreddit-subscribers/spicetify?logo=reddit"></a>
</p>

---

## Setup

Note: On **Windows**, only use `pwsh` as shell! (not `cmd`, not `powershell`)

### Part 1: Installation

0. First and foremost install the build dependencies:
   [Git](https://git-scm.com/downloads) and [Go](https://go.dev/doc/install)
1. Clone this repo: `git clone github.com/spicetify/cli -b next && cd cli`
2. Run `go build`, this will create a new `spicetify` executable in the working
   directory
3. Run `./spicetify init` to initialize the spicetify setup, this only needs to
   be done once. If the command fails, try running it in an elevated shell (as
   Administrator)
4. [optional] Add the `spicetify` executable to your PATH variable for ease of
   access.
   - On **Windows**, run the following in pwsh:
     ```pwsh
     $user = [EnvironmentVariableTarget]::User
     $path = [Environment]::GetEnvironmentVariable('PATH', $user)
     $path = "$path;$env:LOCALAPPDATA\spicetify\bin"
     [Environment]::SetEnvironmentVariable('PATH', $path, $user)
     ```
   - On a default **macOS** installation, run the following:
     ```zsh
     echo "$HOME/Library/Application Support/spicetify/bin" >> /etc/paths
     ```
   - On other platforms, you can perform a simple search on how to set the PATH
     environment variable

### Part 2: Patching

5. Run `spicetify sync` to download and install the latest
   [hooks](https://github.com/spicetify/hooks)
6. Run `spicetify apply` to patch the Spotify desktop client, this needs only be
   done when using spicetify for the first time or when the Spotify client
   updates (and reverts all the patches).

You can always revert this by running `spicetify fix`.

### Part 3: Managing modules

You can further improve your experience by installing modules:

```sh
spicetify pkg install stdlib@0.2.2 https://github.com/spicetify/modules/releases/download/2024-07-18/stdlib@0.2.2+sp-1.2.40-cm-1906ea8d2e9.zip
spicetify pkg install palette-manager@0.2.1 https://github.com/spicetify/modules/releases/download/2024-07-18/palette-manager@0.2.1+sp-1.2.40-cm-1906ea8d2e9.zip
spicetify pkg install Delusoire.marketplace@0.1.3 https://github.com/Delusoire/bespoke-modules/releases/download/2024-07-18/Delusoire.marketplace@0.1.3+sp-1.2.40-cm-1906ea8d2e9.zip
```

And enabling them:

```sh
spicetify pkg enable stdlib@0.2.2
spicetify pkg enable palette-manager@0.2.1
spicetify pkg enable Delusoire.marketplace@0.1.3
```

## Caveats

If your Spotify installation is somewhat unusual, you must manually specify the
paths to the Spotify data and Spotify config folders. You can do that by
creating a `config.yaml` file and adding a
`spotify-data-path: path/to/spotify/data/` (and optionally a
`spotify-config-path: path/to/spotify/config/` for more advanced dev workflows)
Furthermore, if the Spotify folder is Frozen (like the Microsoft Store version
of Spotify), you must tell spicetify to use mirror mode. For the Microsoft Store
version of Spotify, this would be enough:

```
$configPath = "$env:LOCALAPPDATA\spicetify\config.yaml"
$spotifyPackage = Get-AppxPackage | Where-Object -Property Name -Eq "SpotifyAB.SpotifyMusic"
"mirror: true" >> $configPath
"spotify-data-path: $($spotifyPackage.InstallLocation)" >> $configPath
"spotify-exec-path: $env:LOCALAPPDATA\Microsoft\WindowsApps\Spotify.exe" >> $configPath
"spotify-config-path: $env:LOCALAPPDATA\Packages\$($spotifyPackage.PackageFamilyName)\LocalState\Spotify\" >> $configPath
```

## License

GPLv3. See [COPYING](COPYING).

## Advanced Usage

`spicetify daemon [action]`

`spicetify pkg action`

`spicetify update on|off`

// TODO
