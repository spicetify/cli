(() => {
  const LOGGING = true;
  const importScript = (url) => {
    let script = document.createElement("script");
    script.src = url;
    script.setAttribute("crossOrigin", "");
    document.body.appendChild(script);
  };
  // get protobuf to encode requests
  importScript(
    "//cdn.rawgit.com/dcodeIO/protobuf.js/v6.10.2/dist/light/protobuf.min.js"
  );
  const onLoad = async () => {
    const log = LOGGING ? console.log : () => {};

    // load protobuf format for request
    class Protobuf {
      static root = protobuf.Root.fromJSON({
        nested: {
          com: {
            nested: {
              spotify: {
                nested: {
                  canvazcache: {
                    options: {
                      optimize_for: "CODE_SIZE",
                      java_package: "com.spotify.canvaz",
                    },
                    nested: {
                      Artist: {
                        fields: {
                          uri: { type: "string", id: 1 },
                          name: { type: "string", id: 2 },
                          avatar: { type: "string", id: 3 },
                        },
                      },
                      EntityCanvazResponse: {
                        fields: {
                          canvases: { rule: "repeated", type: "Canvaz", id: 1 },
                          ttlInSeconds: { type: "int64", id: 2 },
                        },
                        nested: {
                          Canvaz: {
                            fields: {
                              id: { type: "string", id: 1 },
                              url: { type: "string", id: 2 },
                              fileId: { type: "string", id: 3 },
                              type: { type: "canvaz.Type", id: 4 },
                              entityUri: { type: "string", id: 5 },
                              artist: { type: "Artist", id: 6 },
                              explicit: { type: "bool", id: 7 },
                              uploadedBy: { type: "string", id: 8 },
                              etag: { type: "string", id: 9 },
                              canvasUri: { type: "string", id: 11 },
                            },
                          },
                        },
                      },
                      EntityCanvazRequest: {
                        fields: {
                          entities: { rule: "repeated", type: "Entity", id: 1 },
                        },
                        nested: {
                          Entity: {
                            fields: {
                              entityUri: { type: "string", id: 1 },
                              etag: { type: "string", id: 2 },
                            },
                          },
                        },
                      },
                    },
                  },
                  canvaz: {
                    options: {
                      optimize_for: "CODE_SIZE",
                      java_package: "com.spotify.canvaz",
                    },
                    nested: {
                      Type: {
                        values: {
                          IMAGE: 0,
                          VIDEO: 1,
                          VIDEO_LOOPING: 2,
                          VIDEO_LOOPING_RANDOM: 3,
                          GIF: 4,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      static EntityCanvazRequest = this.root.lookupType(
        "com.spotify.canvazcache.EntityCanvazRequest"
      );

      static EntityCanvazResponse = this.root.lookupType(
        "com.spotify.canvazcache.EntityCanvazResponse"
      );

      static encodeRequest(track) {
        log("[Canvas/Protobuf] Encoding request for track:", track);
        return this.EntityCanvazRequest.encode(
          this.EntityCanvazRequest.create({
            entities: [{ entityUri: track }],
          })
        ).finish();
      }

      static decodeResponse(buffer) {
        let res;
        try {
          res = this.EntityCanvazResponse.decode(buffer);
          log("[Canvas/Protobuf] Decoded canvas request:");
          log(res);
        } catch (error) {
          log("[Canvas/Protobuf] Error decoding canvas request response body!");
          log(error);
          try {
            let json = JSON.parse(new TextDecoder().decode(buffer));
            log("[Canvas/Protobuf] Got JSON response:");
            log(json);
          } catch (error2) {}
        }
        return res;
      }
    }

    const randArray = (array) => {
      return array[Math.floor(Math.random() * array.length)];
    };

    class CanvasHandler {
      static canvasExists = false;
      static canvasURL = "";

      static inFullscreen() {
        let fsDiv = document.querySelectorAll("#main > div > div:nth-child(5)");
        return (
          document.documentElement.classList.contains("fullscreen") &&
          fsDiv.length > 0 &&
          fsDiv[0].hasChildNodes()
        );
      }

      static hideCanvas() {
        document.body.classList.remove("canvas-show");
      }

      static showCanvas() {
        document.body.classList.add("canvas-show");
      }

      static clearCanvas() {
        log("[Canvas/CanvasHandler] Canvas cleared.");
        this.canvasExists = false;
        this.canvasURL = "";
        // no canvas, remove CSS
        this.hideCanvas();
      }

      static createWrapper() {
        log("[Canvas/CanvasHandler] Canvas video element appended to DOM.");
        let canvasWrapper = document.createElement("div");
        canvasWrapper.id = "CanvasWrapper";
        let video = document.createElement("video");
        video.id = "CanvasDisplay";
        video.setAttribute("autoplay", "");
        video.setAttribute("loop", "");
        video.setAttribute("muted", "");
        video.setAttribute("crossorigin", "anonymous");
        video.setAttribute("playsinline", "");
        video.setAttribute("preload", "none");
        video.setAttribute("type", "video/mp4");
        canvasWrapper.appendChild(video);

        // add wrapper to DOM
        let fullscreenElem = document.querySelectorAll(
          "#main > div > div:nth-child(5) > div" // selects the fullscreen div
        );
        if (fullscreenElem.length > 0) {
          fullscreenElem[0].appendChild(canvasWrapper);
        }
        return canvasWrapper;
      }

      static getWrapper() {
        let wrapper = document.getElementById("CanvasWrapper");
        if (!wrapper) {
          wrapper = this.createWrapper();
        }
        return wrapper;
      }

      static getVideo() {
        let video = document.getElementById("CanvasDisplay");
        if (!video) {
          video = this.getWrapper().children.namedItem("CanvasDisplay");
        }
        return video;
      }

      static updateVideo() {
        if (this.inFullscreen()) {
          let video = this.getVideo();
          if (this.canvasExists) {
            if (video.src !== this.canvasURL) {
              this.setVideo(this.canvasURL);
            }
            if (video.paused) {
              video.play();
            }
          }
        }
      }

      static setCanvas(canvas) {
        if (!canvas) {
          this.clearCanvas();
          return;
        }
        this.canvasExists = true;
        log("[Canvas/Set] Setting Canvas URL:", canvas);
        this.canvasURL = canvas;
        this.setVideo(canvas);
      }

      static setVideo(canvas) {
        if (this.inFullscreen()) {
          let video = this.getVideo();
          // set src and update CSS classes to style properly
          video.src = canvas;
          this.showCanvas();

          // Go!
          video.load();
          video.play();
        }
      }
    }

    class SPClient {
      constructor() {
        this.spLocations = fetch("https://apresolve.spotify.com/?type=spclient")
          .then((res) => res.json())
          .then((res) => res.spclient)
          .catch((err) => {
            log("[Canvas/SPClient] Error while fetching spotify client!");
            log(err);
          });
      }

      /*
       * Helper that auto-initializes
       */
      static async create() {
        return await new SPClient().init();
      }

      /*
       * Must be called before any fetch requests! Resolves the server URLs
       */
      async init() {
        this.spLocationsResolved = await this.spLocations;
        return this;
      }

      /*
       * Retrieve a server URL from the list
       */
      getSpLocation() {
        return randArray(this.spLocationsResolved);
      }

      getToken() {
        return Spicetify.Platform.AuthorizationAPI._tokenProvider({
          preferCached: true,
        }).then((res) => res.accessToken);
      }

      /*
       * Send the request as raw binary data so protobuf works properly
       */
      fetchProtobufAuthRaw(urlExt, method, body) {
        return this.getToken()
          .then((token) =>
            fetch("https://" + this.getSpLocation() + urlExt, {
              method: method,
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/x-protobuf",
              },
              body: body,
            })
          )
          .then((res) => res.arrayBuffer())
          .catch((err) => {
            log(
              `[Canvas/SPClient] Error making protobuf request to hm:/${urlExt}!`
            );
            log(err);
          });
      }

      /*
       * Pretty protobuf wrapper
       */
      postCanvasRequest(track) {
        return this.fetchProtobufAuthRaw(
          "/canvaz-cache/v0/canvases",
          "POST",
          Protobuf.encodeRequest(track)
        )
          .then((res) => {
            log("[Canvas/SPClient] Request response (raw):");
            log(res);
            return Protobuf.decodeResponse(new Uint8Array(res));
          })
          .then((res) => {
            if (
              res === undefined ||
              !res.canvases ||
              res.canvases.length === undefined
            ) {
              return { canvases: [] };
            }
            return res;
          });
      }
    }

    const client = await SPClient.create();

    const onSongChange = async () => {
      // Do nothing if not initialized
      if (!Spicetify.Player.data) {
        return;
      }

      // track change, update canvas
      CanvasHandler.clearCanvas();
      let res = await client.postCanvasRequest(Spicetify.Player.data.track.uri);
      if (res.canvases.length > 0) {
        // pick a random canvas if there is multiple
        CanvasHandler.setCanvas(randArray(res.canvases).url);
      }
    };
    Spicetify.Player.addEventListener("songchange", onSongChange);

    setTimeout(() => {
      // Ensure the Canvas is playing and present every 0.1s
      setInterval(() => CanvasHandler.updateVideo(), 100);
      // Do an initial setup
      onSongChange();
    }, 1000);
  };
  window.addEventListener("load", onLoad, false);
})();
