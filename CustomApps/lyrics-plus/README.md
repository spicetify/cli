# Spicetify Custom App
### Lyrics
Show current track lyrics. Current lyrics providers:
- Netease: From Chinese developers and users. Provides karaoke and synced lyrics.
- Musixmatch: A company from Italy. Provided synced lyrics.
- Internal Spotify lyrics service: Only available in for some countries.
- Genius: Provide unsynced lyrics but with description/insight from artists themselve.

![kara](./kara.png)

![genius](./genius.png)

Different lyrics modes: Karaoke, Synced, Unsynced and Genius. At the moment, only Netease provides karaoke-able lyrics. Mode is automatically falled back, from Karaoke, Synced, Unsynced to Genius when lyrics are not available in that mode.

Right click or Double click at any mode tab to "lock in", so lyric mode won't auto switch. It should show a dot next to mode name when mode is locked. Right click or double click again to unlock

![lockin](./lockin.png)

Lyrics in Unsynced and Genius modes can be search and jump to. Hit Ctrl + Shift + F to open search box at bottom left of screen. Hit Enter/Shift+Enter to loop over results.

![search](./search.png)

