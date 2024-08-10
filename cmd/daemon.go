/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/http/httputil"
	"net/url"
	"spicetify/paths"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/net/publicsuffix"

	"github.com/gorilla/websocket"
)

var (
	DaemonAddr    = "localhost:7967"
	AllowedOrigin = "https://xpui.app.spotify.com"
	daemon        bool
)

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Run daemon",
	Run: func(cmd *cobra.Command, args []string) {
		if daemon {
			fmt.Println("Starting daemon")
			startDaemon()
		}
	},
}

var daemonStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start daemon",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Starting daemon")
		startDaemon()
	},
}

var daemonEnableCmd = &cobra.Command{
	Use:   "enable",
	Short: "Enable daemon",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Enabling daemon")
		daemon = true
		viper.Set("daemon", daemon)
		viper.WriteConfig()
	},
}

var daemonDisableCmd = &cobra.Command{
	Use:   "disable",
	Short: "Disable daemon",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Disabling daemon")
		daemon = false
		viper.Set("daemon", daemon)
		viper.WriteConfig()
	},
}

func init() {
	cobra.OnInitialize(func() {
		viper.SetDefault("daemon", true)
		daemon = viper.GetBool("daemon")
	})

	rootCmd.AddCommand(daemonCmd)

	daemonCmd.AddCommand(daemonStartCmd, daemonEnableCmd, daemonDisableCmd)

	viper.SetDefault("daemon", false)
}

func startDaemon() {
	c := make(chan struct{})

	viper.OnConfigChange(func(in fsnotify.Event) {
		daemon = viper.GetBool("daemon")
		if !daemon {
			close(c)
		}
	})
	go viper.WatchConfig()

	go func() {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			log.Panicln(err)
		}
		defer watcher.Close()

		log.Println("Watcher: watching:", paths.GetSpotifyAppsPath(spotifyDataPath))
		if err := watcher.Add(paths.GetSpotifyAppsPath(spotifyDataPath)); err != nil {
			log.Panicln(err)
		}

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					continue
				}
				log.Println("Watcher: event:", event)
				if event.Has(fsnotify.Create) {
					if strings.HasSuffix(event.Name, "xpui.spa") {
						if err := execApply(); err != nil {
							log.Println(err)
						}
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					continue
				}
				log.Println("Watcher: !:", err)
			}
		}
	}()

	go func() {
		setupProxy()
		setupWebSocket()
		err := http.ListenAndServe(DaemonAddr, nil)
		log.Panicln(err)
	}()

	<-c
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// TODO: improve security
		return true
	},
}

func setupWebSocket() {
	http.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("WebSocket: upgrade:", err)
			return
		}
		defer c.Close()

		for {
			_, p, err := c.ReadMessage()
			if err != nil {
				log.Println("WebSocket: !read:", err)
				break
			}

			incoming := string(p)
			log.Println("recv:", incoming)
			res, err := HandleProtocol(incoming)
			if err != nil {
				log.Println("WebSocket: !handle:", err)
			}
			if res != "" {
				c.WriteMessage(websocket.TextMessage, []byte(res))
			}
		}
	})
}

func setupProxy() {
	proxy := (&httputil.ReverseProxy{
		Transport: &CustomTransport{Transport: http.DefaultTransport},
		Rewrite: func(r *httputil.ProxyRequest) {
			p, ok := strings.CutPrefix(r.In.URL.Path, "/proxy/")
			if !ok {
				log.Panicln(errors.New("proxy received invalid path"))
			}
			u, err := url.Parse(p)
			if err != nil {
				log.Panicln(fmt.Errorf("proxy received invalid path: %w", err))
			}

			r.Out.URL = u
			r.Out.Host = ""

			xSetHeaders := r.In.Header.Get("X-Set-Headers")
			r.Out.Header.Del("X-Set-Headers")
			var headers map[string]string
			if err := json.Unmarshal([]byte(xSetHeaders), &headers); err == nil {
				for k, v := range headers {
					if v == "undefined" {
						r.Out.Header.Del(k)
					} else {
						r.Out.Header.Set(k, v)
					}
				}
			}
		},
	})

	http.HandleFunc("/proxy/{url}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", AllowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Set-Headers")
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		proxy.ServeHTTP(w, r)
	})
}

var jar, _ = cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})

type CustomTransport struct {
	Transport http.RoundTripper
}

func (t *CustomTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if jar != nil {
		for _, cookie := range jar.Cookies(req.URL) {
			req.AddCookie(cookie)
		}
	}

	resp, err := t.Transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	if jar != nil {
		if rc := resp.Cookies(); len(rc) > 0 {
			jar.SetCookies(req.URL, rc)
		}
	}

	resp.Header.Set("Access-Control-Allow-Origin", AllowedOrigin)
	resp.Header.Set("Access-Control-Allow-Credentials", "true")

	if loc, err := resp.Location(); err == nil {
		proxyUrl := "http://" + DaemonAddr + "/proxy/"
		resp.Header.Set("Location", proxyUrl+url.PathEscape(loc.String()))
	}

	return resp, nil
}
