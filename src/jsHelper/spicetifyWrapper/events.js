Spicetify.Events = (() => {
  class Event {
    callbacks = [];
    on(callback) {
      if (!this.callbacks) return void callback();
      this.callbacks.push(callback);
    }
    fire() {
      const callbacks = this.callbacks;
      // @ts-expect-error each event fires once; on() treats the cleared list as fired
      this.callbacks = undefined;
      for (const callback of callbacks) {
        try {
          callback();
        } catch (err) {
          console.error("[spicetifyWrapper] Event listener threw an error", err);
        }
      }
    }
  }

  return { webpackLoaded: new Event(), platformLoaded: new Event() };
})();
