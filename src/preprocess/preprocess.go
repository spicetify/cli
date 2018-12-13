package preprocess

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"

	"../utils"
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
						content = utils.Replace(content, `css/glue\.css`, "https://zlink.app.spotify.com/css/glue.css")
						content = utils.Replace(content, `</head>`, `<link rel="stylesheet" class="userCSS" href="https://zlink.app.spotify.com/css/user.css"></head>`)
					} else {
						content = utils.Replace(content, `</head>`, `<link rel="stylesheet" class="userCSS" href="css/user.css"></head>`)
					}

					if appName == "zlink" && flags.ExposeAPIs {
						content = utils.Replace(content, `(<script src="init\.js"></script>)`, `${1}<script type="text/javascript" src="/spicetifyWrapper.js"></script>`)
					}

					return content
				})
			}
			return nil
		})

		if appName == "zlink" && flags.ExposeAPIs {
			utils.Copy(utils.GetJsHelperDir(), appPath, false, []string{"spicetifyWrapper.js"})
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
					content = utils.Replace(content, "#1ed660", "var(--modspotify_sidebar_indicator_and_hover_button_bg)")
					content = utils.Replace(content, "#1ed760", "var(--modspotify_sidebar_indicator_and_hover_button_bg)")
					content = utils.Replace(content, "#1db954", "var(--modspotify_indicator_fg_and_button_bg)")
					content = utils.Replace(content, "#1df369", "var(--modspotify_indicator_fg_and_button_bg)")
					content = utils.Replace(content, "#1df269", "var(--modspotify_indicator_fg_and_button_bg)")
					content = utils.Replace(content, "#1cd85e", "var(--modspotify_indicator_fg_and_button_bg)")
					content = utils.Replace(content, "#1bd85e", "var(--modspotify_indicator_fg_and_button_bg)")
					content = utils.Replace(content, "#18ac4d", "var(--modspotify_selected_button)")
					content = utils.Replace(content, "#18ab4d", "var(--modspotify_selected_button)")
					content = utils.Replace(content, "#179443", "var(--modspotify_pressing_button_bg)")
					content = utils.Replace(content, "#14833b", "var(--modspotify_pressing_button_bg)")
					content = utils.Replace(content, "#282828", "var(--modspotify_main_bg)")
					content = utils.Replace(content, "#121212", "var(--modspotify_main_bg)")
					content = utils.Replace(content, "#999999", "var(--modspotify_main_bg)")
					content = utils.Replace(content, "#606060", "var(--modspotify_main_bg)")
					content = utils.Replace(content, `rgba\(18,\s?18,\s?18,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, "#181818", "var(--modspotify_sidebar_and_player_bg)")
					content = utils.Replace(content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, "#000000", "var(--modspotify_sidebar_and_player_bg)")
					content = utils.Replace(content, "#333333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					content = utils.Replace(content, "#3f3f3f", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					content = utils.Replace(content, "#535353", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					content = utils.Replace(content, "#404040", "var(--modspotify_slider_bg)")
					content = utils.Replace(content, `rgba\(80,\s?55,\s?80,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, "#000011", "var(--modspotify_sidebar_and_player_bg)")
					content = utils.Replace(content, "#0a1a2d", "var(--modspotify_sidebar_and_player_bg)")
					content = utils.Replace(content, "#ffffff", "var(--modspotify_main_fg)")
					content = utils.Replace(content, "#f8f8f7", "var(--modspotify_pressing_fg)")
					content = utils.Replace(content, "#fcfcfc", "var(--modspotify_pressing_fg)")
					content = utils.Replace(content, "#d9d9d9", "var(--modspotify_pressing_fg)")
					content = utils.Replace(content, "#cdcdcd", "var(--modspotify_pressing_fg)")
					content = utils.Replace(content, "#e6e6e6", "var(--modspotify_pressing_fg)")
					content = utils.Replace(content, "#e5e5e5", "var(--modspotify_pressing_fg)")
					content = utils.Replace(content, "#adafb2", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, "#c8c8c8", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, "#a0a0a0", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, "#bec0bb", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, "#bababa", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, "#b3b3b3", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, "#c0c0c0", "var(--modspotify_secondary_fg)")
					content = utils.Replace(content, `rgba\(179,\s?179,\s?179,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_secondary_fg),${1})")
					content = utils.Replace(content, "#cccccc", "var(--modspotify_pressing_button_fg)")
					content = utils.Replace(content, "#ededed", "var(--modspotify_pressing_button_fg)")
					content = utils.Replace(content, "#4687d6", "var(--modspotify_miscellaneous_bg)")
					content = utils.Replace(content, `rgba\(70,\s?135,\s?214,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_bg),${1})")
					content = utils.Replace(content, "#2e77d0", "var(--modspotify_miscellaneous_hover_bg)")
					content = utils.Replace(content, `rgba\(51,\s?153,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
					content = utils.Replace(content, `rgba\(30,\s?50,\s?100,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
					content = utils.Replace(content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, `rgba\(25,\s?20,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
					content = utils.Replace(content, `rgba\(160,\s?160,\s?160,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
					content = utils.Replace(content, `rgba\(255,\s?255,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
					content = utils.Replace(content, "#ddd", "var(--modspotify_pressing_button_fg)")
					content = utils.Replace(content, "#000", "var(--modspotify_sidebar_and_player_bg)")
					content = utils.Replace(content, "#333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
					content = utils.Replace(content, "#444", "var(--modspotify_slider_bg)")
					content = utils.Replace(content, "#fff", "var(--modspotify_main_fg)")
					content = utils.Replace(content, "black;", " var(--modspotify_sidebar_and_player_bg);")
					content = utils.Replace(content, "gray;", " var(--modspotify_main_bg);")
					content = utils.Replace(content, "lightgray;", " var(--modspotify_pressing_button_fg);")
					content = utils.Replace(content, "white;", " var(--modspotify_main_fg);")
					content = utils.Replace(content, `rgba\(0,\s?0,\s?0,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_cover_overlay_and_shadow),${1})")
					content = utils.Replace(content, "#fff", "var(--modspotify_main_fg)")
					content = utils.Replace(content, "#000", "var(--modspotify_sidebar_and_player_bg)")
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
	input = utils.Replace(input, `sentry\.install\(\)[,;]`, "")
	input = utils.Replace(input, `"https://\w+@sentry.io/\d+"`, `"https://NO@TELEMETRY.IS/BAD"`)
	return input
}

func disableLogging(input, appName string) string {
	input = utils.Replace(input, `data\-log\-click="[\w\-]+"`, "")
	input = utils.Replace(input, `data\-log\-context="[\w\-]+"`, "")

	switch appName {
	case "browse", "collection", "genre", "hub":
		input = utils.Replace(input, `logUIInteraction5\([\w_]+,\s?[\w_]+\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `logUIImpression5\([\w_]+,\s?[\w_]+\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `_logUIInteraction5\([\w_]+\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `_logUIImpression5\([\w_]+\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `this\._documentFragment\.query\(['"]\[data\-log\-click\]['"]\)`, "return;${0}")
		input = utils.Replace(input, `_onClickDataLogClick\([\w_]+\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `_setUpStandardImpressionLogging\(\)\s?\{`, "${0}return;")
	case "zlink":
		input = utils.Replace(input, `prototype\._logUIInteraction5=function\(.+?\)\{`, "${0}return;")
	case "lyrics":
		input = utils.Replace(input, `\.prototype\.log.+?\{`, "${0}return;")
	case "playlist":
		input = utils.Replace(input, `logPlaylistImpression=function\(.+?\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `logEndOfListImpression=function\(.+?\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `logListQuickJump=function\(.+?\)\s?\{`, "${0}return;")
		input = utils.Replace(input, `logListItemSelected=function\(.+?\)\{`, "${0}return;")
		input = utils.Replace(input, `logFeedbackInteraction=function\(.+?\)\s?\{`, "${0}return;")
		// For ver 1.80
		input = utils.Replace(input, `(exports\.logPlaylistImpression =) \w+`, "${1}void")
		input = utils.Replace(input, `(exports\.logEndOfListImpression =) \w+`, "${1}void")
		input = utils.Replace(input, `(exports\.logListQuickJump =) \w+`, "${1}void")
		input = utils.Replace(input, `(exports\.logListItemSelected =) \w+`, "${1}void")
		input = utils.Replace(input, `(exports\.logFeedbackInteraction =) \w+`, "${1}void")
	}

	return input
}

func removeRTL(input string) string {
	input = utils.Replace(input, `(?s)\[dir=ltr\]`, "")
	input = utils.Replace(input, `(?s)\[dir\]`, "")
	input = utils.Replace(input, `(?s),\s?\[dir=rtl\].+?(\{.+?\})`, "$1")
	input = utils.Replace(input, `(?s),\s?\[lang=ar\].+?(\{.+?\})`, "$1")
	input = utils.Replace(input, `(?s)html\[dir="?rtl"?\].+?\{.+?\}`, "")
	input = utils.Replace(input, `(?s)html\[lang=ar\].+?\{.+?\}`, "")
	input = utils.Replace(input, `(?s)html:lang\(ar\).+?\{.+?\}`, "")
	input = utils.Replace(input, `(?s)\[dir="?rtl"?\].+?\{.+?\}`, "")
	input = utils.Replace(input, `(?s)html:not\(\[lang=ar\]\)(.+?\{.+?\})`, "html${1}")
	input = utils.Replace(input, `(?s)\[lang=ar\].+?\{.+?\}`, "")

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
		input = utils.Replace(
			input,
			playerUI[0]+`\.prototype\.setup=function\(\)\{`,
			"${0}"+spicetifyPlayerJS,
		)

		// Register progress change event
		input = utils.Replace(
			input,
			playerUI[0]+`\.prototype\._onProgressBarProgress=function.+?\{`,
			`${0}Spicetify.Player.dispatchEvent&&Spicetify.Player.dispatchEvent(new Event("onprogress"));`,
		)
	}

	// Leak track meta data, player state, current playlist to Spicetify.Player.data
	input = utils.Replace(
		input,
		`(const [\w_]+=([\w_]+)\.track\.metadata;)`,
		`${1}Spicetify.Player.data=${2};`,
	)

	// Find Event Dispatcher (eventSymbol[0]) and Event Creator (eventSymbol[1]) symbol
	eventSymbols := findSymbol("EventDispatcher and Event Creatir", input, []string{
		`([\w_]+)\.default\.dispatchEvent\(new ([\w_]+)\.default\([\w_]+\.default\.NAVIGATION_OPEN_URI`,
		`([\w_]+)\.default\.dispatchEvent\(new ([\w_]+)\.default\("show\-notification\-bubble"`},
	)

	showNotification := ""
	if eventSymbols != nil {
		showNotification = fmt.Sprintf(
			`Spicetify.showNotification = (text) => {%s.default.dispatchEvent(new %s.default("show-notification-bubble", {i18n: text}))};`,
			eventSymbols[0],
			eventSymbols[1],
		)
	}

	// Leak localStorage and showNotification
	input = utils.Replace(
		input,
		`(const [\w_]+=([\w_]+)\.default\.get\([\w_]+\);)`,
		`${1}Spicetify.LocalStorage=${2}.default;`+showNotification,
	)

	// Find Player (playerCosmosSymbols[0]) and Cosmos API (playerCosmosSymbols[1]) symbols
	playerCosmosSymbols := findSymbol("player and cosmos in PlayerHelper", input, []string{
		`this\._player=new ([\w_]+)\(([\w_]+)\.resolver,"spotify:app:zlink"`,
		`return new ([\w_]+)\(([\w_]+)\.resolver,"spotify:app:zlink","zlink"`,
	})

	if playerCosmosSymbols != nil {
		// Subscribe to queue and set data to Spicetify.Queue
		input = utils.Replace(
			input,
			`([\w_]+.prototype._player=null)`,
			fmt.Sprintf(
				`;new %s(%s.resolver,"spotify:internal:queue","queue","1.0.0").subscribeToQueue((e,r)=>{if(e){console.log(e);return;}Spicetify.Queue=r.getJSONBody();});${1}`,
				playerCosmosSymbols[0],
				playerCosmosSymbols[1],
			),
		)
	}

	// Leak addToQueue and removeFromQueue methods
	input = utils.Replace(
		input,
		`(const [\w_]+=function\([\w_]+,[\w_]+\)\{)this\._bridge`,
		"${1}"+spicetifyQueueJS+"this._bridge",
	)

	// Register play/pause state change event
	input = utils.Replace(
		input,
		`this\.playing\([\w_]+\.is_playing&&![\w_]+\.is_paused\).+?;`,
		`${0}(this.playing()!==this._isPlaying)&&(this._isPlaying=this.playing(),Spicetify.Player.dispatchEvent&&Spicetify.Player.dispatchEvent(new Event("onplaypause")));`,
	)

	// Register song change event
	input = utils.Replace(
		input,
		`this\._uri=[\w_]+\.uri,this\._trackMetadata=[\w_]+\.metadata`,
		`${0},Spicetify.Player.dispatchEvent&&Spicetify.Player.dispatchEvent(new Event("songchange"))`,
	)

	// Register app change event
	input = utils.Replace(
		input,
		`(_onActivate\(\)\{)([\w_]+\.default\.dispatch\([\w_]+\.default\.activatePage)`,
		`${1}const appChangeEvent=new Event("appchange");appChangeEvent.data=this._state._uri;Spicetify.Player.dispatchEvent(appChangeEvent);${2}`,
	)

	// Leak playbackControl to Spicetify.PlaybackControl
	input = utils.Replace(
		input,
		`,(([\w_]+)\.playFromPlaylistResolver=)`,
		`;Spicetify.PlaybackControl = ${2};${1}`,
	)

	// Disable expose function restriction
	input = utils.Replace(
		input,
		`(expose=function.+?)[\w_]+\.__spotify&&[\w_]+\.__spotify\.developer_mode&&`,
		"${1}",
	)

	return input
}

const spicetifyPlayerJS = `
Spicetify.Player.seek=(p)=>{if(p<=1)p=Math.round(p*(Spicetify.Player.data?Spicetify.Player.data.track.metadata.duration:0));this.seek(p)};
Spicetify.Player.getProgressMs=()=>this.progressbar.getRealValue();
Spicetify.Player.getProgressPercent=()=>this.progressbar.getPercentage();
Spicetify.Player.getDuration=()=>this.progressbar.getMaxValue();
Spicetify.Player.skipForward=(a=15e3)=>Spicetify.Player.seek(Spicetify.Player.getProgressMs()+a);
Spicetify.Player.skipBack=(a=15e3)=>Spicetify.Player.seek(Spicetify.Player.getProgressMs()-a);
Spicetify.Player.setVolume=(v)=>this.changeVolume(v, false);
Spicetify.Player.increaseVolume=()=>this.increaseVolume();
Spicetify.Player.decreaseVolume=()=>this.decreaseVolume();
Spicetify.Player.getVolume=()=>this.volumebar.getValue();
Spicetify.Player.next=()=>this._doSkipToNext();
Spicetify.Player.back=()=>this._doSkipToPrevious();
Spicetify.Player.togglePlay=()=>this._doTogglePlay();
Spicetify.Player.play=()=>{!this.playing() && this._doTogglePlay();};
Spicetify.Player.pause=()=>{this.playing() && this._doTogglePlay();};
Spicetify.Player.isPlaying=()=>this.progressbar.isPlaying();
Spicetify.Player.toggleShuffle=()=>this.toggleShuffle();
Spicetify.Player.getShuffle=()=>this.shuffle();
Spicetify.Player.setShuffle=(b)=>{this.shuffle(b)};
Spicetify.Player.toggleRepeat=()=>this.toggleRepeat();
Spicetify.Player.getRepeat=()=>this.repeat();
Spicetify.Player.setRepeat=(r)=>{this.repeat(r)};
Spicetify.Player.getMute=()=>this.mute();
Spicetify.Player.toggleMute=()=>this._doToggleMute();
Spicetify.Player.setMute=(b)=>{this.volumeEnabled()&&this.changeVolume(this._unmutedVolume,b)};
Spicetify.Player.thumbUp=()=>this.thumbUp();
Spicetify.Player.getThumbUp=()=>this.trackThumbedUp();
Spicetify.Player.thumbDown=()=>this.thumbDown();
Spicetify.Player.getThumbDown=()=>this.trackThumbedDown();
Spicetify.Player.formatTime=(ms)=>this._formatTime(ms);
Spicetify.Player.eventListeners={};
Spicetify.Player.addEventListener= (type, callback) => {
	if (!(type in Spicetify.Player.eventListeners)) {
		Spicetify.Player.eventListeners[type] = [];
	}
	Spicetify.Player.eventListeners[type].push(callback)
};
Spicetify.Player.removeEventListener = (type, callback) => {
    if (!(type in Spicetify.Player.eventListeners)) {
        return;
    }
    var stack = Spicetify.Player.eventListeners[type];
    for (let i = 0; i < stack.length; i++) {
        if (stack[i] === callback) {
            stack.splice(i, 1);
            return;
        }
    }
};
Spicetify.Player.dispatchEvent = (event) => {
    if (!(event.type in Spicetify.Player.eventListeners)) {
        return true;
    }
    var stack = Spicetify.Player.eventListeners[event.type];
    for (let i = 0; i < stack.length; i++) {
		if (typeof stack[i] === "function") {
			stack[i](event);
		}
    }
    return !event.defaultPrevented;
};
`

const spicetifyQueueJS = `
Spicetify.addToQueue = (uri,callback) => {
	uri = Spicetify.LibURI.from(uri);
	if (uri.type === Spicetify.LibURI.Type.ALBUM) {
		this.getAlbumTracks(uri, (err,tracks) => {
			if (err) {
				console.log("Spicetify.addToQueue", err);
				return;
			}

			this.queueTracks(tracks, callback)
		})
	} else if (uri.type === Spicetify.LibURI.Type.TRACK || uri.type === Spicetify.LibURI.Type.EPISODE) {
		this.queueTracks([uri], callback);
	} else {
		console.log("Spicetify.addToQueue: Only Track, Album, Episode URIs are accepted");
		return;
	}
};

Spicetify.removeFromQueue = (uri, callback) => {
    if (Spicetify.Queue) {
        let indices = [];
        const uriObj = Spicetify.LibURI.from(uri);
        if (uriObj.type === Spicetify.LibURI.Type.ALBUM) {
            this.getAlbumTracks(uriObj, (err, tracks) => {
                if (err) {
                    console.log(err);
                    return;
                }
                tracks.forEach((trackUri) => {
					Spicetify.Queue.next_tracks.forEach((nt, index) => {
						trackUri == nt.uri && indices.push(index);
					})
				})
            })
        } else if (uriObj.type === Spicetify.LibURI.Type.TRACK || uriObj.type === Spicetify.LibURI.Type.EPISODE) {
            Spicetify.Queue.next_tracks.forEach((track, index) => {
				track.uri == uri && indices.push(index)
			})
        } else {
			console.log("Spicetify.removeFromQueue: Only Album, Track and Episode URIs are accepted")
			return;
		}

        indices = indices.reduce((a, b) => {
            if (a.indexOf(b) < 0) {
                a.push(b)
            }
            return a
        }, []);
        this.removeTracksFromQueue(indices, callback)
    }
};
`
