// NAME: Trashbin
// AUTHOR: A2R14N
// DESCRIPTION: Throw songs to trashbin and never hear it again.

(async function TrashBin() {
    if (!Spicetify.React || !Spicetify.ReactDOM || !Spicetify.LocalStorage || !Spicetify.ReactComponent) {
        setTimeout(TrashBin, 1000);
        return;
    }

    const { React, LocalStorage } = Spicetify;
    const { useState, useEffect, useCallback } = React;

    const CONFIG = {
        KEYS: {
            SONGS: "TrashSongList",
            ARTISTS: "TrashArtistList",
            ENABLED: "trashbin-enabled",
            WIDGET: "TrashbinWidgetIcon"
        },
        TEXT: {
            THROW: "Place in Trashbin",
            UNTHROW: "Remove from Trashbin",
        },
        ICON: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>`,
        WIDGET_ICON: `<span style="display: flex; justify-content: center; align-items: center; height: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg></span>`
    };

    class TrashStore {
        constructor() {
            this.state = {
                songs: this._load(CONFIG.KEYS.SONGS, {}),
                artists: this._load(CONFIG.KEYS.ARTISTS, {}),
                enabled: this._load(CONFIG.KEYS.ENABLED, true),
                widgetEnabled: this._load(CONFIG.KEYS.WIDGET, true),
            };
            this.listeners = new Set();
        }

        _load(key, fallback) {
            try {
                const item = LocalStorage.get(key);
                return item ? JSON.parse(item) : fallback;
            } catch {
                return fallback;
            }
        }

        _save() {
            LocalStorage.set(CONFIG.KEYS.SONGS, JSON.stringify(this.state.songs));
            LocalStorage.set(CONFIG.KEYS.ARTISTS, JSON.stringify(this.state.artists));
            LocalStorage.set(CONFIG.KEYS.ENABLED, JSON.stringify(this.state.enabled));
            LocalStorage.set(CONFIG.KEYS.WIDGET, JSON.stringify(this.state.widgetEnabled));
        }

        subscribe(listener) {
            this.listeners.add(listener);
            return () => this.listeners.delete(listener);
        }

        setState(updates) {
            this.state = { ...this.state, ...updates };
            this._save();
            this.listeners.forEach(cb => cb());
        }

        toggleURI(uri, type) {
            const listKey = type === Spicetify.URI.Type.ARTIST ? "artists" : "songs";
            const currentList = this.state[listKey];
            const isTrashed = !!currentList[uri];

            const newList = { ...currentList };
            if (isTrashed) {
                delete newList[uri];
                Spicetify.showNotification(`Removed from Trashbin`);
            } else {
                newList[uri] = true;
                Spicetify.showNotification(`Added to Trashbin`);
            }

            this.setState({ [listKey]: newList });
            this.checkSkip();
        }

        clearAll() {
            this.setState({ songs: {}, artists: {} });
            Spicetify.showNotification("Trashbin cleared!");
        }

        importData(data) {
            this.setState({
                songs: { ...(data.songs || {}) },
                artists: { ...(data.artists || {}) }
            });
        }

        checkSkip() {
            if (!this.state.enabled) return;
            const meta = Spicetify.Player.data?.item;
            if (!meta) return;

            if (this.shouldSkip(meta.uri, meta.metadata)) {
                Spicetify.Player.next();
            }
        }

        shouldSkip(uri, metadata) {
            if (!this.state.enabled) return false;
            if (this.state.songs[uri]) return true;
            if (metadata) {
                let i = 0;
                let artistUri = metadata.artist_uri;
                while (artistUri) {
                    if (this.state.artists[artistUri]) return true;
                    i++;
                    artistUri = metadata[`artist_uri:${i + 1}`];
                }
            }
            return false;
        }

        isTrashed(uri) {
            return !!this.state.songs[uri] || !!this.state.artists[uri];
        }
    }

    const store = new TrashStore();

    const useTrashState = () => {
        const [state, set] = useState(store.state);
        useEffect(() => store.subscribe(() => set(store.state)), []);
        return state;
    };

    const SettingRow = ({ label, children }) => {
        return React.createElement("div", {
            style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid var(--spice-button-disabled)"
            }
        },
            React.createElement("span", { style: { color: "var(--spice-text)", fontSize: "16px" } }, label),
            children
        );
    };

    const SettingsModal = () => {
        const state = useTrashState();

        const handleCopy = useCallback(() => {
            Spicetify.Platform.ClipboardAPI.copy(JSON.stringify({ songs: state.songs, artists: state.artists }));
            Spicetify.showNotification("Copied to clipboard");
        }, [state.songs, state.artists]);

        const handleExport = useCallback(async () => {
            try {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: "trashbin.json",
                    types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(JSON.stringify({ songs: state.songs, artists: state.artists }));
                await writable.close();
                Spicetify.showNotification("Saved!");
            } catch (e) {
                console.error(e);
            }
        }, [state.songs, state.artists]);

        const handleImport = useCallback(() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        store.importData(data);
                        Spicetify.showNotification("Imported!");
                    } catch {
                        Spicetify.showNotification("Import failed", true);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }, []);

        return React.createElement("div", { style: { padding: "10px 20px" } },
            React.createElement(SettingRow, { label: "Enable Extension" },
                React.createElement(Spicetify.ReactComponent.Toggle, {
                    value: state.enabled,
                    onSelected: (val) => store.setState({ enabled: val })
                })
            ),

            React.createElement(SettingRow, { label: "Show Player Widget" },
                React.createElement(Spicetify.ReactComponent.Toggle, {
                    value: state.widgetEnabled,
                    onSelected: (val) => store.setState({ widgetEnabled: val })
                })
            ),

            React.createElement("div", { style: { marginTop: "30px", display: "flex", gap: "10px", justifyContent: "flex-start", flexWrap: "wrap" } },
                React.createElement(Spicetify.ReactComponent.ButtonSecondary, { onClick: handleCopy }, "Copy"),
                React.createElement(Spicetify.ReactComponent.ButtonSecondary, { onClick: handleExport }, "Export"),
                React.createElement(Spicetify.ReactComponent.ButtonSecondary, { onClick: handleImport }, "Import"),
                React.createElement(Spicetify.ReactComponent.ButtonSecondary, {
                    onClick: () => store.clearAll(),
                    style: { color: "#ff5555", borderColor: "#ff5555" }
                }, "Clear")
            )
        );
    };

    let widget = null;
    let userHitBack = false;

    const initSkipProtection = () => {
        const addListener = (btn) => {
            btn.addEventListener("click", () => { userHitBack = true; });
        };
        const skipBtn = document.querySelector(".main-skipBackButton-button");
        if (skipBtn) addListener(skipBtn);
    };

    const onSongChange = () => {
        const data = Spicetify.Player.data;
        if (!data) return;

        if (widget) {
            const uri = data.item.uri;
            const type = Spicetify.URI.fromString(uri).type;
            const shouldShow = store.state.widgetEnabled && type === Spicetify.URI.Type.TRACK;

            if (shouldShow) {
                const isTrashed = store.isTrashed(uri);
                widget.label = isTrashed ? CONFIG.TEXT.UNTHROW : CONFIG.TEXT.THROW;
                widget.active = isTrashed;
                widget.register();
            } else {
                widget.deregister();
            }
        }

        if (userHitBack) {
            userHitBack = false;
            return;
        }

        store.checkSkip();
    };

    new Spicetify.ContextMenu.Item(
        CONFIG.TEXT.THROW,
        (uris) => {
            const uri = uris[0];
            store.toggleURI(uri, Spicetify.URI.fromString(uri).type);
        },
        (uris) => {
            if (uris.length !== 1) return false;
            const type = Spicetify.URI.fromString(uris[0]).type;
            return type === Spicetify.URI.Type.TRACK || type === Spicetify.URI.Type.ARTIST;
        },
        CONFIG.ICON
    ).register();

    new Spicetify.Menu.Item(
        "Trashbin",
        false,
        () => {
            Spicetify.PopupModal.display({
                title: "Trashbin Settings",
                content: React.createElement(SettingsModal),
                isLarge: true
            });
        },
        CONFIG.ICON
    ).register();

    widget = new Spicetify.Playbar.Widget(
        CONFIG.TEXT.THROW,
        CONFIG.WIDGET_ICON,
        () => {
            const uri = Spicetify.Player.data?.item?.uri;
            if (uri) store.toggleURI(uri, Spicetify.URI.Type.TRACK);
        },
        false, false, false
    );

    Spicetify.Player.addEventListener("songchange", onSongChange);
    store.subscribe(onSongChange);
    initSkipProtection();
    onSongChange();
})();
