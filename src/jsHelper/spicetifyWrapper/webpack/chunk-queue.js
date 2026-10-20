/** The global chunk queue of Spotify's bundle, whichever bundler name the client was built with. */
export function getChunkQueue() {
  return window?.rspackChunk || window?.rspackChunkclient_web || window?.webpackChunkclient_web;
}

/**
 * Resolve React synchronously from the bundle that is already loaded.
 *
 * On Spotify 1.3.x the global nav (which calls `Spicetify._renderNavLinks`) can render before
 * `hotloadWebpackModules` has finished its asynchronous capture, so `Spicetify.React` is still
 * undefined when the first hook runs and the whole client falls into the "Something went wrong"
 * error boundary. By the time the nav renders the bundle is in memory, so React can be found
 * from the webpack require cache right away.
 */
export function captureReactEarly() {
  if (Spicetify.React?.useReducer) return Spicetify.React;

  const chunkQueue = getChunkQueue();
  if (!chunkQueue) return undefined;

  try {
    const require = chunkQueue.push([[Symbol()], {}, (re) => re]);
    if (!require?.m) return undefined;

    for (const id of Object.keys(require.m)) {
      try {
        const exported = require(id);
        if (exported?.useMemo && exported?.useReducer) {
          Spicetify.React = exported;
          return exported;
        }
      } catch {
        // Some factories throw when forced this early; keep looking.
      }
    }
  } catch {
    // Not a webpack/rspack runtime we understand; the async capture will take care of it.
  }

  return undefined;
}
