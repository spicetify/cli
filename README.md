<h3 align="center"><a href="https://spicetify.app/"><img src="https://i.imgur.com/iwcLITQ.png" width="600px"></a></h3>
<p align="center">
  <a href="https://goreportcard.com/report/github.com/Delusoire/bespoke-cli/v3"><img src="https://goreportcard.com/badge/github.com/Delusoire/bespoke-cli/v3"></a>
  <a href="https://github.com/Delusoire/bespoke-cli/releases"><img src="https://img.shields.io/github/downloads/spicetify/cli/total.svg?colorB=97CA00"></a>
  <a href="https://discord.gg/VnevqPp2Rr"><img src="https://img.shields.io/discord/842219447716151306?label=chat&logo=discord&logoColor=discord"></a>
  <a href="https://www.reddit.com/r/spicetify"><img src="https://img.shields.io/reddit/subreddit-subscribers/spicetify?logo=reddit"></a>
</p>

---

## Setup

Note: On **Windows**, only use `pwsh` as shell! (not `cmd`, not `powershell`)

### Part 1: Installation

#### For Users:

Either pick the latest installer for your platform from the [releases](https://github.com/Delusoire/bespoke-cli/releases) or run the [install.ps1](install.ps1) script

#### For Developers:

0. First and foremost install the build dependencies:
   [Git](https://git-scm.com/downloads) and [Go](https://go.dev/doc/install)
1. Clone this repo: `git clone github.com/Delusoire/bespoke-cli && cd cli`
2. Run `go build`, this will create a new `spicetify` executable in the working directory
3. This executable assumes a portable setup if the following structure is respected:
      ```
      <folder>/
      ├─ bin/
      │  ├─ spicetify[.exe]
      ├─ config/
      ```
   the name (and location) of the first folder doesn't matter
4. [optional] Add the `<path/to/folder>/bin` path to your PATH environment variable for ease of access.
   - On **Windows**, run the following in pwsh:
        ```pwsh
        $user = [EnvironmentVariableTarget]::User
        $path = [Environment]::GetEnvironmentVariable('PATH', $user)
        $path = "$path;$env:LOCALAPPDATA\Spicetify\bin"
        [Environment]::SetEnvironmentVariable('PATH', $path, $user)
        ```
   - On a default **macOS** installation, run the following:
        ```zsh
        echo "$HOME/Library/Application Support/Spicetify/bin" >> /etc/paths
        ```
   - On other platforms, you can perform a simple search on how to set the PATH environment variable
5. Run `<path/to/folder>/bin/spicetify init` to initialize the Spicetify setup,
   It should create the following entries:
      ```
      $XDG_CONFIG_HOME/
      ├─ (S|s)picetify/
      │  ├─ modules/
      │  │  ├─ vault.json
      │  ├─ config.yaml
      ```
   or if ran in a portable structure:
      ```
      <folder>/
      ├─ bin/
      │  ├─ spicetify[.exe]
      ├─ config/
      │  ├─ modules/
      │  │  ├─ vault.json
      │  ├─ config.yaml
      ```
   This only needs to be done once. If the command fails, try running it in an elevated shell (as Administrator)

// TODO: register uri scheme and daemon/task. 

### Part 2: Patching

1. Run `spicetify sync` to download and install the latest
   [hooks](https://github.com/spicetify/hooks)
2. Run `spicetify apply` to patch the Spotify desktop client, this needs only be
   done when using spicetify for the first time or when the Spotify client
   updates (and reverts all the patches).

You can always revert `spicetify apply` by running `spicetify fix`.

### Part 3: Managing modules

Moved to: https://github.com/Delusoire/bespoke-modules

## Caveats

If your Spotify installation is somewhat unusual, you must manually specify the
paths to the Spotify data and Spotify config folders. You can do that by
creating a `config.yaml` file and adding a
`spotify-data-path: path/to/spotify/data/` (and optionally a
`spotify-config-path: path/to/spotify/config/` for more advanced dev workflows)
Furthermore, if the Spotify folder is Frozen (like the Microsoft Store version
of Spotify), you must tell spicetify to use mirror mode.

For the Microsoft Store version of Spotify, this would be enough:

```
$configPath = "$env:LOCALAPPDATA\Spicetify\config.yaml"
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

## Other resources

https://github.com/spicetify/hooks

https://github.com/spicetify/modules
