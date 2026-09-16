import { fnStr } from "../shared/string.js";
import { createGraphQLDefinitions } from "./graphql-definitions.js";
import { createReactComponents } from "./react-components.js";
import { findReactQuery } from "./react-query.js";

export function createSpicetifyBindings({
  cache,
  chunks,
  modules,
  functionModules,
  require,
  exportedMemos,
  exportedMemoFRefs,
  reactComponentsUI,
  scrollableContainer,
}) {
  return {
    React: cache.find((m) => m?.useMemo),
    ReactJSX: cache.find((m) => m?.jsx),
    ReactDOM: cache.find((m) => m?.createPortal),
    ReactDOMServer: cache.find((m) => m?.renderToString),
    classnames: chunks
      .filter(([, value]) => fnStr(value).includes("[native code]"))
      .map(([id]) => require(id))
      .find((module) => typeof module === "function"),
    Color: functionModules.find((m) => fnStr(m).includes("static fromHex") || fnStr(m).includes("this.rgb")),
    Player: {
      ...Spicetify.Player,
      get origin() {
        return Spicetify.Platform?.PlayerAPI;
      },
    },
    GraphQL: {
      ...Spicetify.GraphQL,
      Definitions: globalThis.__SPICETIFY_CLIENT_BUNDLE_MODE__ ? createGraphQLDefinitions(() => require.m) : Spicetify.GraphQL.Definitions,
      get Request() {
        return Spicetify.Platform?.GraphQLLoader || Spicetify.GraphQL.Handler?.(Spicetify.GraphQL.Context);
      },
      Context: functionModules.find((m) => fnStr(m).includes("subscription") && fnStr(m).includes("mutation")),
      Handler: functionModules.find((m) => fnStr(m).includes("GraphQL subscriptions are not supported")),
    },
    ReactComponent: createReactComponents({
      modules,
      functionModules,
      chunks,
      require,
      exportedMemos,
      exportedMemoFRefs,
      reactComponentsUI,
      scrollableContainer,
    }),
    ReactHook: {
      DragHandler: functionModules.find((m) => fnStr(m).includes("dataTransfer") && fnStr(m).includes("data-dragging")),
      useExtractedColor: functionModules.find(
        (m) => fnStr(m).includes("extracted-color") || (fnStr(m).includes("colorRaw") && fnStr(m).includes("useEffect")),
      ),
    },
    ReactQuery: findReactQuery({ cache, modules, functionModules }),
    ReactFlipToolkit: {
      ...Spicetify.ReactFlipToolkit,
      Flipper: functionModules.find((m) => m?.prototype?.getSnapshotBeforeUpdate),
      Flipped: functionModules.find((m) => m.displayName === "Flipped"),
    },
    _reservedPanelIds: modules.find((m) => m?.BuddyFeed),
    Mousetrap: cache.find((m) => m?.addKeycodes),
    Locale: modules.find((m) => m?._dictionary),
  };
}
