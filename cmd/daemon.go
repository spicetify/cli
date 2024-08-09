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
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httputil"
	"net/url"
	"spicetify/paths"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gorilla/websocket"
)

var (
	DaemonAddr string = "localhost:7967"
	daemon     bool
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

		log.Println("Watching:", paths.GetSpotifyAppsPath(spotifyDataPath))
		if err := watcher.Add(paths.GetSpotifyAppsPath(spotifyDataPath)); err != nil {
			log.Panicln(err)
		}

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					continue
				}
				log.Println("event:", event)
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
				log.Println("error:", err)
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
			log.Println("upgrade:", err)
			return
		}
		defer c.Close()

		for {
			_, p, err := c.ReadMessage()
			if err != nil {
				log.Println("!read:", err)
				break
			}

			incoming := string(p)
			log.Println("recv:", incoming)
			res, err := HandleProtocol(incoming)
			if err != nil {
				log.Println("!handle:", err)
			}
			if res != "" {
				c.WriteMessage(websocket.TextMessage, []byte(res))
			}
		}
	})
}

func setupProxy() {
	jar, err := cookiejar.New(nil)
	if err != nil {
		log.Fatalf("Failed to create cookiejar: %v", err)
	}

	client := &http.Client{
		Jar: jar,
	}

	proxy := (&httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			p, ok := strings.CutPrefix(r.In.URL.Opaque, "/proxy/")
			if !ok {
				log.Panicln(errors.New("proxy received invalid path"))
			}
			u, err := url.Parse(p)
			if err != nil {
				log.Panicln(err)
			}
			r.Out.URL.Scheme = u.Scheme
			r.Out.URL.Host = u.Host
			r.Out.URL.Path = u.Path
			r.Out.URL.RawPath = u.RawPath
			xSetHeaders := r.In.Header.Get("X-Set-Headers")
			var headers map[string]string
			if err := json.Unmarshal([]byte(xSetHeaders), &headers); err == nil {
				for k, v := range headers {
					r.Out.Header.Set(k, v)
				}
			}
		},
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			// Use the custom http.Client for cookie management
			ResponseHeaderTimeout: client.Timeout,
		},
	})

	http.HandleFunc("/proxy", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
}
