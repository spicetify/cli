package preprocess

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sync"

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
	// DisableUpgrade stops Spotify to display new version upgrade notification
	DisableUpgrade bool
}

// Start preprocessing apps assets in extractedAppPath
func Start(extractedAppsPath string, flags Flag, callback func(appName string)) {
	appList, err := ioutil.ReadDir(extractedAppsPath)

	if err != nil {
		log.Fatal(err)
	}

	var wg sync.WaitGroup

	for _, app := range appList {
		wg.Add(1)

		go func(appName string) {
			defer wg.Done()

			appPath := filepath.Join(extractedAppsPath, appName)
			filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
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

						if flags.DisableUpgrade {
							content = disableUpgradeCheck(content, appName)
						}

						if appName == "zlink" && flags.ExposeAPIs {
							content = exposeAPIs(content)
						}
						return content
					})
				case ".css":
					if flags.RemoveRTL {
						utils.ModifyFile(path, removeRTL)
					}
				case ".html":
					utils.ModifyFile(path, func(content string) string {
						if appName != "zlink" && appName != "login" {
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

			callback(appName)
		}(app.Name())
	}

	fakeXPUI(filepath.Join(extractedAppsPath, "xpui"))

	wg.Wait()

	if flags.ExposeAPIs {
		zlinkPath := filepath.Join(extractedAppsPath, "zlink")
		err := utils.Copy(utils.GetJsHelperDir(), zlinkPath, false, []string{"spicetifyWrapper.js"})
		if err != nil {
			utils.Fatal(err)
		}
	}
}

// StartCSS modifies all CSS files in extractedAppsPath to change
// all colors value with CSS variables.
func StartCSS(extractedAppsPath string, callback func(appName string)) {
	appList, err := ioutil.ReadDir(extractedAppsPath)

	if err != nil {
		log.Fatal(err)
	}

	var wg sync.WaitGroup

	for _, app := range appList {
		wg.Add(1)
		appName := app.Name()
		appPath := filepath.Join(extractedAppsPath, appName)

		go func() {
			defer wg.Done()

			filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
				if filepath.Ext(info.Name()) == ".css" {
					utils.ModifyFile(path, colorVariableReplace)
				}
				return nil
			})

			callback(appName)
		}()
	}

	wg.Wait()
}

func colorVariableReplace(content string) string {
	utils.Replace(&content, "#999999", "var(--modspotify_main_bg)")
	utils.Replace(&content, "#606060", "var(--modspotify_main_bg)")
	utils.Replace(&content, "#181818", "var(--modspotify_main_bg)")

	utils.Replace(&content, "#282828", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#121212", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#000000", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#000011", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#0a1a2d", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#000", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "black;", " var(--modspotify_sidebar_and_player_bg);")

	utils.Replace(&content, "gray;", " var(--modspotify_main_bg);")
	utils.Replace(&content, "#ffffff", "var(--modspotify_main_fg)")
	utils.Replace(&content, "#fff", "var(--modspotify_main_fg)")
	utils.Replace(&content, "white;", " var(--modspotify_main_fg);")

	utils.Replace(&content, "#adafb2", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#c8c8c8", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#a0a0a0", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#bec0bb", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#bababa", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#b3b3b3", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#c0c0c0", "var(--modspotify_secondary_fg)")

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

	utils.Replace(&content, "#ededed", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "#cccccc", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "#8f8f8f;", " var(--modspotify_pressing_button_fg);")
	utils.Replace(&content, "#ccc", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "#ddd", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "lightgray;", " var(--modspotify_pressing_button_fg);")

	utils.Replace(&content, "#333333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
	utils.Replace(&content, "#3f3f3f", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
	utils.Replace(&content, "#535353", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
	utils.Replace(&content, "#333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")

	utils.Replace(&content, "#404040", "var(--modspotify_slider_bg)")
	utils.Replace(&content, "#444", "var(--modspotify_slider_bg)")

	utils.Replace(&content, "#f8f8f7", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#fcfcfc", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#d9d9d9", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#cdcdcd", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#e6e6e6", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#e5e5e5", "var(--modspotify_pressing_fg)")

	utils.Replace(&content, "#4687d6", "var(--modspotify_miscellaneous_bg)")
	utils.Replace(&content, "#cd1a2b", "var(--modspotify_miscellaneous_bg)")

	utils.Replace(&content, "#2e77d0", "var(--modspotify_miscellaneous_hover_bg)")
	utils.Replace(&content, "#4591ee", "var(--modspotify_miscellaneous_hover_bg)")
	utils.Replace(&content, "#386cab", "var(--modspotify_miscellaneous_hover_bg)")
	utils.Replace(&content, "#e22134", "var(--modspotify_miscellaneous_hover_bg)")

	utils.Replace(&content, `rgba\(18,\s?18,\s?18,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(80,\s?55,\s?80,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(70,\s?135,\s?214,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_bg),${1})")
	utils.Replace(&content, `rgba\(51,\s?153,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
	utils.Replace(&content, `rgba\(30,\s?50,\s?100,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
	utils.Replace(&content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(25,\s?20,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(160,\s?160,\s?160,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
	utils.Replace(&content, `rgba\(255,\s?255,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
	utils.Replace(&content, `rgba\(0,\s?0,\s?0,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_cover_overlay_and_shadow),${1})")
	utils.Replace(&content, `rgba\(179,\s?179,\s?179,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_secondary_fg),${1})")

	return content
}

func disableSentry(input string) string {
	utils.Replace(&input, `sentry\.install\(\)[,;]`, "")
	utils.Replace(&input, `"https://\w+@sentry.io/\d+"`, `"https://null@127.0.0.1/0"`)
	utils.Replace(&input, `loadQualarooScript=function\(\)\{`, "${0}return;")
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
		utils.Replace(&input, `(\.prototype\.logApplied.+?\{)return;`, "${1}")
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
	case "artist":
		utils.Replace(&input, `([\w_]+)\.logImpressions=function\(.+?\)\s?\{`, "${1}.logImpressions=${1}.attach=${1}.detach=()=>{};return;${0}")
	}

	return input
}

func removeRTL(input string) string {
	utils.Replace(&input, `(?s)\[dir=ltr\]\s?`, "")
	utils.Replace(&input, `(?s)\[dir\]\s?`, "")
	utils.Replace(&input, `(?s),\s?\[dir=rtl\].+?(\{.+?\})`, "$1")
	utils.Replace(&input, `(?s),\s?\[lang=ar\].+?(\{.+?\})`, "$1")
	utils.Replace(&input, `(?s)html:not\(\[lang=ar\]\)\s?`, "html ")

	utils.Replace(&input, `(?s)\}\[lang=ar\].+?\{.+?\}`, "}")
	utils.Replace(&input, `(?s)\}html\[dir="?rtl"?\].+?\{.+?\}`, "}")
	utils.Replace(&input, `(?s)\}html\[lang=ar\].+?\{.+?\}`, "}")
	utils.Replace(&input, `(?s)\}html:lang\(ar\).+?\{.+?\}`, "}")
	utils.Replace(&input, `(?s)\}\[dir="?rtl"?\].+?\{.+?\}`, "}")

	utils.Replace(&input, `(?s)\[lang=ar\].+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)html\[dir="?rtl"?\].+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)html\[lang=ar\].+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)html:lang\(ar\).+?\{.+?\}`, "")
	utils.Replace(&input, `(?s)\[dir="?rtl"?\].+?\{.+?\}`, "")

	return input
}

func exposeAPIs(input string) string {
	playerUI := utils.FindSymbol("playerUI", input, []string{
		`([\w_]+)\.prototype\.updateProgressBarLabels`,
		`([\w_]+)\.prototype\._onConnectionStateChange`},
	)

	if playerUI != nil {
		utils.Replace(
			&input,
			playerUI[0]+`\.prototype\.setup=function\(\)\{`,
			`${0}
Spicetify.Player.origin=this;
this.progressbar.addListener("progress", () => {
	const progressEvent = new Event("onprogress");
	progressEvent.data = this.progressbar.value;
	Spicetify.Player.dispatchEvent(progressEvent);
});
`,
		)
	}

	// Find Event Dispatcher (eventSymbol[0]) and Event Creator (eventSymbol[1]) symbol
	eventSymbols := utils.FindSymbol("EventDispatcher and Event Creator", input, []string{
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

	// Leak LocalStorage and EventDispatcher
	newVer := utils.FindSymbol("", input, []string{
		`const [\w_]+=[\w_]+\.default\.get\(("saf:hpto:ad")\);`,
	})

	if newVer != nil {
		utils.Replace(
			&input,
			`(const [\w_]+=([\w_]+)\.default\.get\("saf:hpto:ad"\);)`,
			`${1}Spicetify.LocalStorage=${2}.default;`+eventDispatcher,
		)
	} else {
		// Supports 1.1.10
		utils.Replace(
			&input,
			`(const [\w_]+=([\w_]+)\.default\.get\([\w_]+\);)`,
			`${1}Spicetify.LocalStorage=${2}.default;`+eventDispatcher,
		)
	}

	// Find Player (playerCosmosSymbols[0]) and Cosmos API (playerCosmosSymbols[1]) symbols
	playerCosmosSymbols := utils.FindSymbol("player and cosmos in PlayerHelper", input, []string{
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

	utils.Replace(
		&input,
		`(_populate=async function\([\w_]+,([\w_]+)\)\{)`,
		"${1}Spicetify.ContextMenu._addItems(this._contextmenu, ${2}.uris);this._contextmenu.addItem({});",
	)

	menuReact := utils.FindSymbol("Profile Menu and Item React", input, []string{
		`([\w_]+\.default).createElement\(([\w_]+\.default),\{name:"private-session"`,
	})

	submenuReact := utils.FindSymbol("Profile Sub Menu React", input, []string{
		`([\w_]+\.default),\{name:"userlist",isSubmenu`,
	})

	// Inject custom menu time to Profile menu
	if menuReact != nil && submenuReact != nil {
		utils.Replace(
			&input,
			`(name:"profile-menu".+?,)([\w_]+\.default\.createElement)`,
			"${1}Spicetify.Menu._hook("+menuReact[0]+","+menuReact[1]+","+submenuReact[0]+"),${2}",
		)
	}

	utils.Replace(
		&input,
		`case"private-session"`,
		`case"spicetify-hook":this.hideMenu();break;${0}`,
	)

	// Leak Popup Modal
	utils.Replace(
		&input,
		`[\w_]+\.prototype\._popoverId="modal",[\w_]+\.prototype\.setup=function\(\)\{`,
		`${0}Spicetify.PopupModal=this;`,
	)

	return input
}

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

		if (uriObj.type === Spicetify.URI.Type.ALBUM || uriObj.type === Spicetify.URI.Type.LOCAL_ALBUM) {
			const tracks = await getAlbumAsync(inputUri);
			trackUris.push(...tracks);
		} else if (uriObj.type === Spicetify.URI.Type.TRACK || uriObj.type === Spicetify.URI.Type.EPISODE || uriObj.type === Spicetify.URI.Type.LOCAL) {
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

		if (uriObj.type === Spicetify.URI.Type.ALBUM || uriObj.type === Spicetify.URI.Type.LOCAL_ALBUM) {
			const tracks = await getAlbumAsync(inputUri);
			tracks.forEach((trackUri) => {
				Spicetify.Queue.next_tracks.forEach((t, i) => t.uri == trackUri && indices.add(i))
			})
		} else if (uriObj.type === Spicetify.URI.Type.TRACK || uriObj.type === Spicetify.URI.Type.EPISODE || uriObj.type === Spicetify.URI.Type.LOCAL) {
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

// Disable WebUI by redirect to zlink app
// so when Spotify forces user to use xpui, it loads zlink instead.
func fakeXPUI(dest string) {
	os.MkdirAll(dest, 0700)
	entryFile := filepath.Join(dest, "index.html")
	html := `
<html><script>
	window.location.assign("spotify:app:zlink")
</script></html>
`
	manifestFile := filepath.Join(dest, "manifest.json")
	manifest := `
{
  "BundleIdentifier": "xpui",
  "BundleType": "Application"
}
`
	ioutil.WriteFile(entryFile, []byte(html), 0700)
	ioutil.WriteFile(manifestFile, []byte(manifest), 0700)
}

func disableUpgradeCheck(input, appName string) string {
	if appName == "zlink" || appName == "about" {
		utils.Replace(&input, `"sp://desktop/v1/upgrade/status"\},\(.+?\)=>\{`, "${0}return;")
	}

	return input
}
