package preprocess

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// Flag enables/disables preprocesses to be applied
type Flag struct {
	// DisableSentry prevents Sentry to send console log/error/warning to Spotify developers.
	DisableSentry bool
	// DisableLogging stops various elements to log user interaction.
	DisableLogging bool
	// RemoveRTL removes all Right-To-Left CSS rules to simplify CSS files.
	RemoveRTL bool
	// ExposeAPIs leaks some Spotify's API, functions, objects to Spicetify global object.
	ExposeAPIs bool
}

// Start preprocessing apps assets in extractedAppPath
func Start(extractedAppsPath string, flags Flag, callback func(appName string, err error)) {
	appList, err := ioutil.ReadDir(extractedAppsPath)

	if err != nil {
		log.Fatal(err)
	}

	for _, app := range appList {
		appName := app.Name()
		appPath := filepath.Join(extractedAppsPath, appName)

		err = filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
			fileName := info.Name()
			extension := filepath.Ext(fileName)

			switch extension {
			case ".js":
				utils.ModifyFile(path, func(content string) string {
					if flags.DisableSentry {
						content = disableSentry(content)
					}

					if flags.DisableLogging {
						content = disableLogging(content, appName)
					}

					if appName == "zlink" && flags.ExposeAPIs {
						content = exposeAPIs(content)
					}
					return content
				})
			case ".css":
				if fileName == "glue.css" && appName != "zlink" && appName != "login" {
					os.Remove(path)
					return nil
				}

				if flags.RemoveRTL {
					utils.ModifyFile(path, removeRTL)
				}
			case ".html":
				utils.ModifyFile(path, func(content string) string {
					if appName != "zlink" && appName != "login" {
						utils.Replace(&content, `css/glue\.css`, "https://zlink.app.spotify.com/css/glue.css")
						utils.Replace(&content, `</head>`, `<link rel="stylesheet" class="userCSS" href="https://zlink.app.spotify.com/css/user.css"></head>`)
					} else {
						utils.Replace(&content, `</head>`, `<link rel="stylesheet" class="userCSS" href="css/user.css"></head>`)
					}

					if appName == "zlink" {
						var tags string
						if flags.ExposeAPIs {
							tags += `<script src="spicetifyWrapper.js"></script>`
						}
						tags += "\n<!--Extension-->"

						utils.Replace(&content, `<script src="init\.js"></script>`, "${0}\n"+tags)
					}

					return content
				})
			}
			return nil
		})

		if appName == "zlink" && flags.ExposeAPIs {
			err := utils.Copy(utils.GetJsHelperDir(), appPath, false, []string{"spicetifyWrapper.js"})
			if err != nil {
				utils.Fatal(err)
			}
		}

		if err != nil {
			callback("", err)
		} else {
			callback(appName, nil)
		}
	}
}

// StartCSS modifies all CSS files in extractedAppsPath to change
// all colors value with CSS variables.
func StartCSS(extractedAppsPath string, callback func(appName string, err error)) {
	appList, err := ioutil.ReadDir(extractedAppsPath)

	if err != nil {
		log.Fatal(err)
	}

	for _, app := range appList {
		appName := app.Name()
		appPath := filepath.Join(extractedAppsPath, appName)

		err = filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
			if filepath.Ext(info.Name()) == ".css" {
				utils.ModifyFile(path, func(content string) string {
					utils.Replace(&content, "#1ed660", "var(--modspotify_sidebar_indicator_and_hover_button_bg)")
					utils.Replace(&content, "#1ed760", "var(--modspotify_sidebar_indicator_and_hover_button_bg)")
					utils.Replace(&content, "#1db954", "var(--modspotify_indicator_fg_and_button_bg)")
					utils.Replace(&content, "#1df369", "var(--modspotify_indicator_fg_and_button_bg)")
					utils.Replace(&content, "#1df269", "var(--modspotify_indicator_fg_and_button_bg)")
					utils.Replace(&content, "#1cd85e", "var(--modspotify_indicator_fg_and_button_bg)")
					utils.Replace(&content, "#1bd85e", "var(--modspotify_indicator_fg_and_button_bg)")
					utils.Replace(&content, "#18ac4d", "var(--modspotify_selected_button)")
					utils.Replace(&content, "#18ab4d", "var(--modspotify_selected_button)")
					utils.Replace(&content, "#179443", "var(--modspotify_pressing_button_bg)")
					utils.Replace(&content, "#14833b", "var(--modspotify_pressing_button_bg)")
					utils.Replace(&content, "#282828", "var(--modspotify_main_bg)")
					utils.Replace(&content, "#121212", "var(--modspotify_main_bg)")
					utils.Replace(&content, "#999999", "var(--modspotify_main_bg)")
					utils.Replace(&content, "#606060", "var(--modspotify_main_bg)")
					utils.Replace(&content, `rgba\(18,\s?18,\s?18,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, "#181818", "var(--modspotify_sidebar_and_player_bg)")
					utils.Replace(&content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, "#000000", "var(--modspotify_sidebar_and_player_bg)")
					utils.Replace(&content, "#333333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					utils.Replace(&content, "#3f3f3f", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					utils.Replace(&content, "#535353", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					utils.Replace(&content, "#404040", "var(--modspotify_slider_bg)")
					utils.Replace(&content, `rgba\(80,\s?55,\s?80,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, "#000011", "var(--modspotify_sidebar_and_player_bg)")
					utils.Replace(&content, "#0a1a2d", "var(--modspotify_sidebar_and_player_bg)")
					utils.Replace(&content, "#ffffff", "var(--modspotify_main_fg)")
					utils.Replace(&content, "#f8f8f7", "var(--modspotify_pressing_fg)")
					utils.Replace(&content, "#fcfcfc", "var(--modspotify_pressing_fg)")
					utils.Replace(&content, "#d9d9d9", "var(--modspotify_pressing_fg)")
					utils.Replace(&content, "#cdcdcd", "var(--modspotify_pressing_fg)")
					utils.Replace(&content, "#e6e6e6", "var(--modspotify_pressing_fg)")
					utils.Replace(&content, "#e5e5e5", "var(--modspotify_pressing_fg)")
					utils.Replace(&content, "#adafb2", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, "#c8c8c8", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, "#a0a0a0", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, "#bec0bb", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, "#bababa", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, "#b3b3b3", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, "#c0c0c0", "var(--modspotify_secondary_fg)")
					utils.Replace(&content, `rgba\(179,\s?179,\s?179,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_secondary_fg),${1})")
					utils.Replace(&content, "#cccccc", "var(--modspotify_pressing_button_fg)")
					utils.Replace(&content, "#ededed", "var(--modspotify_pressing_button_fg)")
					utils.Replace(&content, "#4687d6", "var(--modspotify_miscellaneous_bg)")
					utils.Replace(&content, `rgba\(70,\s?135,\s?214,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_bg),${1})")
					utils.Replace(&content, "#2e77d0", "var(--modspotify_miscellaneous_hover_bg)")
					utils.Replace(&content, `rgba\(51,\s?153,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
					utils.Replace(&content, `rgba\(30,\s?50,\s?100,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
					utils.Replace(&content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, `rgba\(25,\s?20,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					utils.Replace(&content, `rgba\(160,\s?160,\s?160,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
					utils.Replace(&content, `rgba\(255,\s?255,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
					utils.Replace(&content, "#ddd", "var(--modspotify_pressing_button_fg)")
					utils.Replace(&content, "#000", "var(--modspotify_sidebar_and_player_bg)")
					utils.Replace(&content, "#333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					utils.Replace(&content, "#444", "var(--modspotify_slider_bg)")
					utils.Replace(&content, "#fff", "var(--modspotify_main_fg)")
					utils.Replace(&content, "black;", " var(--modspotify_sidebar_and_player_bg);")
					utils.Replace(&content, "gray;", " var(--modspotify_main_bg);")
					utils.Replace(&content, "lightgray;", " var(--modspotify_pressing_button_fg);")
					utils.Replace(&content, "white;", " var(--modspotify_main_fg);")
					utils.Replace(&content, `rgba\(0,\s?0,\s?0,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_cover_overlay_and_shadow),${1})")
					utils.Replace(&content, "#fff", "var(--modspotify_main_fg)")
					utils.Replace(&content, "#000", "var(--modspotify_sidebar_and_player_bg)")
					return content
				})
			}
			return nil
		})

		if err != nil {
			callback("", err)
		} else {
			callback(appName, nil)
		}
	}
}

func disableSentry(input string) string {
	utils.Replace(&input, `sentry\.install\(\)[,;]`, "")
	utils.Replace(&input, `"https://\w+@sentry.io/\d+"`, `"https://NO@TELEMETRY.IS/BAD"`)
	return input
}

func disableLogging(input, appName string) string {
	utils.Replace(&input, `data\-log\-click="[\w\-]+"`, "")
	utils.Replace(&input, `data\-log\-context="[\w\-]+"`, "")

	switch appName {
	case "browse", "collection", "genre", "hub":
		utils.Replace(&input, `logUIInteraction5\([\w_]+,\s?[\w_]+\)\s?\{`, "${0}return;")
		utils.Replace(&input, `logUIImpression5\([\w_]+,\s?[\w_]+\)\s?\{`, "${0}return;")
		utils.Replace(&input, `_logUIInteraction5\([\w_]+\)\s?\{`, "${0}return;")
		utils.Replace(&input, `_logUIImpression5\([\w_]+\)\s?\{`, "${0}return;")
		utils.Replace(&input, `this\._documentFragment\.query\(['"]\[data\-log\-click\]['"]\)`, "return;${0}")
		utils.Replace(&input, `_onClickDataLogClick\([\w_]+\)\s?\{`, "${0}return;")
		utils.Replace(&input, `_setUpStandardImpressionLogging\(\)\s?\{`, "${0}return;")
	case "zlink":
		utils.Replace(&input, `prototype\._logUIInteraction5=function\(.+?\)\{`, "${0}return;")
	case "lyrics":
		utils.Replace(&input, `\.prototype\.log.+?\{`, "${0}return;")
	case "playlist":
		utils.Replace(&input, `logPlaylistImpression=function\(.+?\)\s?\{`, "${0}return;")
		utils.Replace(&input, `logEndOfListImpression=function\(.+?\)\s?\{`, "${0}return;")
		utils.Replace(&input, `logListQuickJump=function\(.+?\)\s?\{`, "${0}return;")
		utils.Replace(&input, `logListItemSelected=function\(.+?\)\{`, "${0}return;")
		utils.Replace(&input, `logFeedbackInteraction=function\(.+?\)\s?\{`, "${0}return;")
		// For ver 1.80
		utils.Replace(&input, `(exports\.logPlaylistImpression =) \w+`, "${1}void")
		utils.Replace(&input, `(exports\.logEndOfListImpression =) \w+`, "${1}void")
		utils.Replace(&input, `(exports\.logListQuickJump =) \w+`, "${1}void")
		utils.Replace(&input, `(exports\.logListItemSelected =) \w+`, "${1}void")
		utils.Replace(&input, `(exports\.logFeedbackInteraction =) \w+`, "${1}void")
	}

	return input
}

func removeRTL(input string) string {
	utils.Replace(&input, `(?s)\[dir=ltr\]`, "")
	utils.Replace(&input, `(?s)\[dir\]`, "")
	utils.Replace(&input, `(?s),\s?\[dir=rtl\].+?(\{.+?\})`, "$1")
	utils.Replace(&input, `(?s),\s?\[lang=ar\].+?(\{.+?\})`, "$1")
	utils.Replace(&input, `(?s)html\[dir="?rtl"?\].+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)html\[lang=ar\].+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)html:lang\(ar\).+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)\[dir="?rtl"?\].+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)html:not\(\[lang=ar\]\)(.+?\{.+?\})`, "html${1}")
	utils.Replace(&input, `(?s)\[lang=ar\].+?\{.+?\}`, "")

	return input
}

func findSymbol(debugInfo, content string, clues []string) []string {
	for _, v := range clues {
		re := regexp.MustCompile(v)
		found := re.FindStringSubmatch(content)
		if found != nil {
			return found[1:]
		}
	}

	utils.PrintError("Cannot find symbol for " + debugInfo)
	return nil
}

func exposeAPIs(input string) string {
	playerUI := findSymbol("playerUI", input, []string{
		`([\w_]+)\.prototype\.updateProgressBarLabels`,
		`([\w_]+)\.prototype\._onConnectionStateChange`},
	)

	if playerUI != nil {
		utils.Replace(
			&input,
			playerUI[0]+`\.prototype\.setup=function\(\)\{`,
			"${0}"+spicetifyPlayerJS,
		)

		// Register progress change event
		utils.Replace(
			&input,
			playerUI[0]+`\.prototype\._onProgressBarProgress=function\(([\w_]+)\)\{`,
			`${0}
	const progressEvent = new Event("onprogress");
	progressEvent.data = ${1}.value;
	Spicetify.Player.dispatchEvent(progressEvent);
`,
		)
	}

	// Leak track meta data, player state, current playlist to Spicetify.Player.data
	utils.Replace(
		&input,
		`(const [\w_]+=([\w_]+)\.track\.metadata;)`,
		`${1}Spicetify.Player.data=${2};`,
	)

	// Find Event Dispatcher (eventSymbol[0]) and Event Creator (eventSymbol[1]) symbol
	eventSymbols := findSymbol("EventDispatcher and Event Creator", input, []string{
		`([\w_]+)\.default\.dispatchEvent\(new ([\w_]+)\.default\([\w_]+\.default\.NAVIGATION_OPEN_URI`,
		`([\w_]+)\.default\.dispatchEvent\(new ([\w_]+)\.default\("show\-notification\-bubble"`},
	)

	eventDispatcher := ""
	if eventSymbols != nil {
		eventDispatcher = fmt.Sprintf(
			`Spicetify.EventDispatcher=%s.default;Spicetify.Event=%s.default;`,
			eventSymbols[0],
			eventSymbols[1],
		)
	}

	// Leak localStorage and showNotification
	utils.Replace(
		&input,
		`(const [\w_]+=([\w_]+)\.default\.get\([\w_]+\);)`,
		`${1}Spicetify.LocalStorage=${2}.default;`+eventDispatcher,
	)

	// Find Player (playerCosmosSymbols[0]) and Cosmos API (playerCosmosSymbols[1]) symbols
	playerCosmosSymbols := findSymbol("player and cosmos in PlayerHelper", input, []string{
		`this\._player=new ([\w_]+)\(([\w_]+)\.resolver,"spotify:app:zlink"`,
		`return new ([\w_]+)\(([\w_]+)\.resolver,"spotify:app:zlink","zlink"`,
	})

	if playerCosmosSymbols != nil {
		// Subscribe to queue and set data to Spicetify.Queue
		utils.Replace(
			&input,
			`([\w_]+.prototype._player=null)`,
			fmt.Sprintf(
				`;new %s(%s.resolver,"spotify:internal:queue","queue","1.0.0").subscribeToQueue((e,r)=>{if(e){console.log(e);return;}Spicetify.Queue=r.getJSONBody();});${1}`,
				playerCosmosSymbols[0],
				playerCosmosSymbols[1],
			),
		)
	}

	// Leak addToQueue and removeFromQueue methods
	utils.Replace(
		&input,
		`(const [\w_]+=function\([\w_]+,[\w_]+\)\{)this\._bridge`,
		"${1}"+spicetifyQueueJS+"this._bridge",
	)

	// Register play/pause state change event
	utils.Replace(
		&input,
		`this\.playing\([\w_]+\.is_playing&&![\w_]+\.is_paused\).+?;`,
		`${0}(this.playing()!==this._isPlaying)&&(this._isPlaying=this.playing(),Spicetify.Player.dispatchEvent(new Event("onplaypause")));`,
	)

	// Register song change event
	utils.Replace(
		&input,
		`(updatePlayerState=function\(([\w_]+)\)\{if\(![\w_]+\)return;)(.*this\._uri=[\w_]+\.uri,this\._trackMetadata=[\w_]+\.metadata)`,
		`${1}Spicetify.Player.data=${2};${3},Spicetify.Player.dispatchEvent(new Event("songchange"))`,
	)

	// Register app change event
	utils.Replace(
		&input,
		`(_onStateUpdate\(([\w_]+)\)\{)`,
		`${1}
	const appEvent = new Event("appchange");
	appEvent.data = {
		id: this._pageId,
		uri: ${2}.getURI(),
		isEmbeddedApp: this.isEmbeddedApp(),
		container: this.getContainer(),
	};

	const eventCB = ({data: info}) => {
		if (info && info.type === "notify_loaded") {
			Spicetify.Player.dispatchEvent(appEvent);
			window.removeEventListener("message", eventCB)
		}
	};
	window.addEventListener("message", eventCB);
`,
	)

	// Leak playbackControl to Spicetify.PlaybackControl
	utils.Replace(
		&input,
		`,(([\w_]+)\.playFromPlaylistResolver=)`,
		`;Spicetify.PlaybackControl = ${2};${1}`,
	)

	// Disable expose function restriction
	utils.Replace(
		&input,
		`(expose=function.+?)[\w_]+\.__spotify&&[\w_]+\.__spotify\.developer_mode&&`,
		"${1}",
	)

	utils.Replace(
		&input,
		`\([\w_]+\|\|console\.warn\.bind\(console\)\)`,
		` void`,
	)

	// Leak keyboard shortcut register to Spicetify.Keyboard
	utils.Replace(
		&input,
		`(_registerKeyboardShortcuts=function\(\)\{)(([\w_]+)\.registerShortcut)`,
		"${1}Spicetify.Keyboard=${3};${2}",
	)

	return input
}

const spicetifyPlayerJS = `
this.seek&&this.duration&&(Spicetify.Player.seek=(p)=>{if(p<=1)p=Math.round(p*this.duration());this.seek(p)});
this.progressbar.getRealValue&&(Spicetify.Player.getProgress=()=>this.progressbar.getRealValue());
this.progressbar.getPercentage&&(Spicetify.Player.getProgressPercent=()=>this.progressbar.getPercentage());
this.duration&&(Spicetify.Player.getDuration=()=>this.duration());
this.changeVolume&&(Spicetify.Player.setVolume=(v)=>{this.changeVolume(v, false)});
this.increaseVolume&&(Spicetify.Player.increaseVolume=()=>{this.increaseVolume()});
this.decreaseVolume&&(Spicetify.Player.decreaseVolume=()=>{this.decreaseVolume()});
this.volume&&(Spicetify.Player.getVolume=()=>this.volume());
this._doSkipToNext&&(Spicetify.Player.next=()=>{this._doSkipToNext()});
this._doSkipToPrevious&&(Spicetify.Player.back=()=>{this._doSkipToPrevious()});
this._doTogglePlay&&(Spicetify.Player.togglePlay=()=>{this._doTogglePlay()});
this.playing&&(Spicetify.Player.isPlaying=()=>this.playing());
this.toggleShuffle&&(Spicetify.Player.toggleShuffle=()=>{this.toggleShuffle()});
this.shuffle&&(Spicetify.Player.getShuffle=()=>this.shuffle());
this.shuffle&&(Spicetify.Player.setShuffle=(b)=>{this.shuffle(b)});
this.toggleRepeat&&(Spicetify.Player.toggleRepeat=()=>{this.toggleRepeat()});
this.repeat&&(Spicetify.Player.getRepeat=()=>this.repeat());
this.repeat&&(Spicetify.Player.setRepeat=(r)=>{this.repeat(r)});
this.mute&&(Spicetify.Player.getMute=()=>this.mute());
this._doToggleMute&&(Spicetify.Player.toggleMute=()=>{this._doToggleMute()});
this.changeVolume&&(Spicetify.Player.setMute=(b)=>{this.changeVolume(this._unmutedVolume,b)});
this._formatTime&&(Spicetify.Player.formatTime=(ms)=>this._formatTime(ms));
Spicetify.Player.origin=this;
`

const spicetifyQueueJS = `
const getAlbumAsync = (inputUri) => new Promise((resolve, reject) => {
	this.getAlbumTracks(inputUri, (err, tracks) => err ? reject(err) : resolve(tracks))
});

this.getAlbumTracks && this.queueTracks && (Spicetify.addToQueue = async (uri) => {
	const trackUris = [];

	const add = async (inputUri) => {
		const uriObj = Spicetify.URI.from(inputUri);
		if (!uriObj) {
			console.error("Invalid URI. Skipped ", inputUri);
			return;
		}

		if (uriObj.type === Spicetify.URI.Type.ALBUM) {
			const tracks = await getAlbumAsync(inputUri);
			trackUris.push(...tracks);
		} else if (uriObj.type === Spicetify.URI.Type.TRACK || uriObj.type === Spicetify.URI.Type.EPISODE) {
			trackUris.push(inputUri);
		} else {
			console.error("Only Track, Album, Episode URIs are accepted. Skipped ", inputUri);
		}
	}

	if (uri instanceof Array) {
		for (const u of uri) await add(u)
	} else {
		await add(uri)
	}

	if (trackUris.length < 1) {
		throw "No track to add.";
	} else {
		this.queueTracks(trackUris, err2 => {if (err2) throw err2});
	}
});

this.getAlbumTracks && this.removeTracksFromQueue && (Spicetify.removeFromQueue = async (uri) => {
    if (!Spicetify.Queue) {
		throw "Spicetify.Queue is not available. Post an Issue on Github to inform me about it.";
	}

	const indices = new Set();
	const add = async (inputUri) => {
		const uriObj = Spicetify.URI.from(inputUri);
		if (!uriObj) {
			console.error("Invalid URI. Skipped ", inputUri);
			return;
		}

		if (uriObj.type === Spicetify.URI.Type.ALBUM) {
			const tracks = await getAlbumAsync(inputUri);
			tracks.forEach((trackUri) => {
				Spicetify.Queue.next_tracks.forEach((t, i) => t.uri == trackUri && indices.add(i))
			})
		} else if (uriObj.type === Spicetify.URI.Type.TRACK || uriObj.type === Spicetify.URI.Type.EPISODE) {
			Spicetify.Queue.next_tracks.forEach((t, i) => t.uri == inputUri && indices.add(i))
		} else {
			console.error("Only Album, Track and Episode URIs are accepted. Skipped ", inputUri);
		}
	}

	if (uri instanceof Array) {
		for (const u of uri) await add(u)
	} else {
		await add(uri)
	}

	if (indices.length < 1) {
		throw "No track found in queue to remove.";
	} else {
		this.removeTracksFromQueue([...indices], err2 => {if (err2) throw err2});
	}
});
`
