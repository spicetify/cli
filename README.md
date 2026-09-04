<h3 align="center"><a href="https://spicetify.app/"><img src="https://i.imgur.com/iwcLITQ.png" width="600px"></a></h3>
<p align="center">
  <a href="https://goreportcard.com/report/github.com/spicetify/cli"><img src="https://goreportcard.com/badge/github.com/spicetify/cli"></a>
  <a href="https://github.com/spicetify/cli/releases/latest"><img src="https://img.shields.io/github/release/spicetify/cli/all.svg?colorB=97CA00&label=latest%20version"></a>
  <a href="https://github.com/spicetify/cli/releases"><img src="https://img.shields.io/github/downloads/spicetify/cli/total.svg?colorB=97CA00&label=total%20downloads"></a>
  <a href="https://discord.gg/VnevqPp2Rr"><img src="https://img.shields.io/discord/842219447716151306?label=chat&logo=discord&logoColor=discord"></a>
</p>

---

Command-line tool to customize the official Spotify client.
Supports Windows, MacOS and Linux.

<img src=".github/assets/logo.png" alt="img" align="right" width="560px" height="400px">

### Features

- Change colors across the User Interface
- Inject CSS for advanced customization
- Inject Extensions to extend functionalities, manipulate UI and control player
- Inject Custom Apps
- Make yourself in control of the Spotify client

### Links

- [Installation](https://spicetify.app/docs/getting-started)
- [Basic Usage](https://spicetify.app/docs/getting-started#basic-usage)

---

### v3: the Rust CLI (in progress, `rust/`)

The v3 CLI is being rebuilt in Rust. v3 is a different model rather than a
faster v2, so upgrading is a reinstall. What it changes:

- **Customise Spotify without leaving Spotify.** Extensions, custom apps and
  themes all become one thing (modules), browsable and installable from a store
  inside the client. Most take effect immediately; the few that need a restart
  say so. The CLI is still there (`spicetify pkg`) if you prefer it.
- **A Spotify update no longer means a broken client.** v3 repairs itself after
  Spotify updates in the background, and a new Spotify build no longer waits on
  a new Spicetify release to be supported. When something genuinely is not
  supported yet, the client says which part is degraded instead of silently
  looking wrong.
- **An update that goes wrong is recoverable.** Installed versions are kept
  side by side, so going back is `spicetify pkg enable <module>@<old version>`
  rather than hunting down an old download.

#### Shell completions

The v3 CLI can complete commands and options in Bash, Zsh, Fish, PowerShell,
and Elvish.

<!-- prettier-ignore -->
> [!NOTE]
> Shell completion is experimental. Generate the registration code when your
> shell starts so it stays compatible after Spicetify updates.

Add the command for your shell to its startup file:

- Bash (`~/.bashrc`): `source <(COMPLETE=bash spicetify)`
- Zsh (`~/.zshrc`): `source <(COMPLETE=zsh spicetify)`
- Fish (`~/.config/fish/completions/spicetify.fish`):
  `COMPLETE=fish spicetify | source`
- PowerShell (`$PROFILE`):

  ```powershell
  $env:COMPLETE = "powershell"; spicetify | Out-String | Invoke-Expression; Remove-Item Env:\COMPLETE
  ```

- Elvish (`~/.elvish/rc.elv`):
  `eval (E:COMPLETE=elvish spicetify | slurp)`

---

### Code Signing Policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org/).
