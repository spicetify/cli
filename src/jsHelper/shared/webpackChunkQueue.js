// Spotify has changed both its bundler and queue name across supported builds.
// A queue is usable only after the runtime replaces Array.prototype.push.
export function getWebpackChunkQueue(globals) {
  for (const queue of [globals.rspackChunk, globals.rspackChunkclient_web, globals.webpackChunkclient_web]) {
    if (Array.isArray(queue) && queue.push !== Array.prototype.push) return queue;
  }
  return undefined;
}
