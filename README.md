# App

Spicetify App — the main entrypoint for Spicetify v3.

## Build

```sh
cargo build --release
```

Output: `target/release/spicetify.exe`

## Commands

| Command    | Description                                                 |
| ---------- | ----------------------------------------------------------- |
| `init`     | Initialize Spicetify configuration and directories          |
| `apply`    | Apply patches to the Spotify desktop client                 |
| `fix`      | Revert all applied patches                                  |
| `config`   | Read or write configuration values                          |
| `dev`      | Enable DevTools integration for development                 |
| `sync`     | Synchronize hooks to `%LOCALAPPDATA%\Spicetify\hooks`       |
| `daemon`   | Manage the background daemon (`start`, `enable`, `disable`) |
| `update`   | Enable or disable automatic Spotify updates (`on`/`off`)    |
| `pkg`      | Install, delete, or enable modules by ID                    |
| `protocol` | Handle `spicetify://` URI protocol links                    |

Run `spicetify` with no arguments to launch the TUI.

## Windows-Specific Details

- Uses `%LOCALAPPDATA%\Spicetify\` as the base directory
- Binaries go in `%LOCALAPPDATA%\Spicetify\bin\`
- Hooks go in `%LOCALAPPDATA%\Spicetify\hooks\`
- Config at `%LOCALAPPDATA%\Spicetify\config.yaml`

## Uninstall

For windows Uninstall via the windows settings page
For macOS first run spicetify fix and then uninstall like normal
