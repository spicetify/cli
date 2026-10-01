/** `T` with its read-only members writable, for wrapper code that populates members `globals.d.ts` exposes as `const`. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };
/** `T` with each member, and each member's members, optional: the bootstrap object the rest of the wrapper fills in. */
type Bootstrap<T> = { [K in keyof T]?: Partial<T[K]> };

declare namespace Spicetify {
  /** Platform object the preprocessor captures from the client; its getters are copied onto `Spicetify.Platform`. */
  let _platform: Record<string, any> | undefined;
  /** Called from the patched client navigation to render custom app nav links. */
  let _renderNavLinks: (list: any, isTouchScreenUi: boolean) => any;
  /** Called from patched client components to build Encore class names. */
  /** Console diagnostic that reports missing wrapper members. */
  let test: () => void;
  let _getStyledClassName: (args: any, component: any) => string | undefined;

  namespace Events {
    interface Event {
      /** Run and clear the listeners; only the wrapper fires these events. */
      fire(): void;
    }
  }
}
