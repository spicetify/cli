import { fnStr } from "../shared/string.js";

function isLocaleTranslator(module) {
  return (
    typeof module?.get === "function" &&
    typeof module.getTranslations === "function" &&
    typeof module.formatRelativeDate === "function" &&
    Boolean(module._localeForTranslation) &&
    Boolean(module._translations)
  );
}

function findLocaleTranslator({ cache, modules }) {
  return (
    cache.map((module) => module?.Ru).find(isLocaleTranslator) ??
    modules.find(isLocaleTranslator) ??
    modules.find((module) => typeof module?.get === "function" && typeof module.getTranslations === "function") ??
    modules.find((module) => typeof module?.get === "function" && module?._dictionary)
  );
}

export function exposeRuntimeResolvers({ cache, chunks, modules, functionModules, require }) {
  (function waitForSnackbar(attempt = 0) {
    if (!Object.keys(Spicetify.Snackbar).length) {
      setTimeout(() => waitForSnackbar(attempt + 1), Math.min(100 * 2 ** Math.min(attempt, 4), 1000));
      return;
    }
    // Snackbar notifications
    // https://github.com/iamhosseindhv/notistack
    Spicetify.Snackbar = {
      ...Spicetify.Snackbar,
      SnackbarProvider: functionModules.find((m) => fnStr(m).includes("enqueueSnackbar called with invalid argument")),
      useSnackbar: functionModules.find((m) => fnStr(m).match(/^function\(\)\{return\(0,[\w$]+\.useContext\)\([\w$]+\)\}$/)),
    };
  })();

  const localeModule = findLocaleTranslator({ cache, modules });
  if (localeModule) {
    const createUrlLocale = functionModules.find((m) => fnStr(m).includes("has") && fnStr(m).includes("baseName") && fnStr(m).includes("language"));
    Spicetify.Locale = {
      get _relativeTimeFormat() {
        return localeModule._relativeTimeFormat;
      },
      get _dateTimeFormats() {
        return localeModule._dateTimeFormats;
      },
      get _locale() {
        return localeModule._localeForTranslation.baseName;
      },
      get _urlLocale() {
        return localeModule._localeForURLPath;
      },
      get _dictionary() {
        return localeModule._translations;
      },
      formatDate: (date, options) => localeModule.formatDate(date, options),
      formatRelativeTime: (date, options) => localeModule.formatRelativeDate(date, options),
      formatNumber: (number, options) => localeModule.formatNumber(number, options),
      formatNumberCompact: (number, options) => localeModule.formatNumberCompact(number, options),
      get: (key, ...args) => localeModule.get(key, ...args),
      getDateTimeFormat: (options) => localeModule.getDateTimeFormat(options),
      getDictionary: () => localeModule.getTranslations(),
      getLocale: () => localeModule._localeForTranslation.baseName,
      getSmartlingLocale: () => localeModule.getLocaleForSmartling(),
      getUrlLocale: () => localeModule.getLocaleForURLPath(),
      getRelativeTimeFormat: () => localeModule.getRelativeTimeFormat(),
      getSeparator: () => localeModule.getSeparator(),
      setLocale: (locale) => {
        return localeModule.initialize({
          localeForTranslation: locale,
          localeForFormatting: localeModule._localeForFormatting.baseName,
          translations: localeModule._translations,
        });
      },
      setUrlLocale: (locale) => {
        if (createUrlLocale) localeModule._localeForURLPath = createUrlLocale(locale);
      },
      setDictionary: (dictionary) => {
        return localeModule.initialize({
          localeForTranslation: localeModule._localeForTranslation.baseName,
          localeForFormatting: localeModule._localeForFormatting.baseName,
          translations: dictionary,
        });
      },
      toLocaleLowerCase: (text) => localeModule.toLocaleLowerCase(text),
      toLocaleUpperCase: (text) => localeModule.toLocaleUpperCase(text),
    };
  }

  if (Spicetify.Locale) Spicetify.Locale._supportedLocales = cache.find((m) => typeof m?.ja === "string");

  Object.defineProperty(Spicetify, "Queue", {
    get() {
      return Spicetify.Player.origin?._queue?._state ?? Spicetify.Player.origin?._queue?._queue;
    },
  });

  const confirmDialogChunk = chunks.find(
    ([, value]) =>
      fnStr(value).includes("main-confirmDialog-container") ||
      (fnStr(value).includes("confirmDialog") && fnStr(value).includes("shouldCloseOnEsc") && fnStr(value).includes("isOpen")),
  );
  if (!Spicetify.ReactComponent?.ConfirmDialog && confirmDialogChunk) {
    Spicetify.ReactComponent.ConfirmDialog = Object.values(require(confirmDialogChunk[0])).find((m) => typeof m === "object");
  } else {
    Spicetify.ReactComponent.ConfirmDialog = functionModules.find(
      (m) => fnStr(m).includes("isOpen") && fnStr(m).includes("shouldCloseOnEsc") && fnStr(m).includes("onClose"),
    );
  }

  const contextMenuChunk = chunks.find(([, value]) => fnStr(value).includes("handleContextMenu"));
  if (contextMenuChunk) {
    Spicetify.ReactComponent.ContextMenu = Object.values(require(contextMenuChunk[0])).find((m) => typeof m === "function");
  }

  const playlistMenuChunk = chunks.find(
    ([, value]) => fnStr(value).includes('value:"playlist"') && fnStr(value).includes("canView") && fnStr(value).includes("permissions"),
  );
  if (playlistMenuChunk && !Spicetify.ReactComponent?.PlaylistMenu) {
    Spicetify.ReactComponent.PlaylistMenu = Object.values(require(playlistMenuChunk[0])).find(
      (m) => typeof m === "function" || typeof m === "object",
    );
  }

  const infiniteQueryChunk = chunks.find(([_, value]) => fnStr(value).includes("fetchPreviousPage") && fnStr(value).includes("getOptimisticResult"));
  if (infiniteQueryChunk) {
    Spicetify.ReactQuery.useInfiniteQuery = Object.values(require(infiniteQueryChunk[0])).find((m) => typeof m === "function");
  }

  if (Spicetify.Color) Spicetify.Color.CSSFormat = modules.find((m) => typeof m?.RGBA === "number");

  // Combine snackbar and notification
  (function bindShowNotification(attempt = 0) {
    if (!Spicetify.Snackbar?.enqueueSnackbar && !Spicetify.showNotification) {
      setTimeout(() => bindShowNotification(attempt + 1), Math.min(250 * 2 ** Math.min(attempt, 4), 1000));
      return;
    }

    if (Spicetify.Snackbar?.enqueueSnackbar) {
      Spicetify.showNotification = (message, isError, msTimeout) => {
        Spicetify.Snackbar.enqueueSnackbar(message, {
          variant: isError ? "error" : "default",
          autoHideDuration: msTimeout,
        });
      };

      return;
    }

    Spicetify.Snackbar.enqueueSnackbar = (message, { variant = "default", autoHideDuration } = {}) => {
      isError = variant === "error";
      Spicetify.showNotification(message, isError, autoHideDuration);
    };
  })();

  // Image color extractor
  void (async function bindColorExtractor(attempt = 0) {
    if (!Spicetify.GraphQL.Request) {
      setTimeout(() => bindColorExtractor(attempt + 1), Math.min(10 * 2 ** Math.min(attempt, 6), 1000));
      return;
    }
    const imageAnalysis = functionModules.find(
      (m) => fnStr(m).match(/![\w$]+\.isFallback|\{extractColor/g) || (fnStr(m).includes("extractedColors") && fnStr(m).includes("imageUris")),
    );
    const fallbackPreset = modules.find((m) => m?.colorDark);

    Spicetify.extractColorPreset = async (image) => {
      const analysis = await imageAnalysis(Spicetify.GraphQL.Request, image);
      for (const result of analysis) {
        if ("isFallback" in result === false) result.isFallback = fallbackPreset === result;
      }

      return analysis;
    };
  })();
}
