import { fnStr } from "../shared/string.js";
import { getObjectValues } from "./module-inventory.js";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function exposeReactComponentsUI({ modules, functionModules, exportedForwardRefs, exportedMemoFRefs }) {
  const componentNames = Object.keys(modules.filter(Boolean).find((e) => typeof e.BrowserDefaultFocusStyleProvider === "string"));
  const componentRegex = new RegExp(`"data-encore-id":(?:[a-zA-Z_$][\\w$]*\\.){2}(${componentNames.map(escapeRegExp).join("|")})\\b`);
  const componentPairs = [
    functionModules.map((f) => [f, f]),
    exportedForwardRefs.map((f) => [f.render, f]),
    exportedMemoFRefs.map((f) => [f.type.render, f]),
  ]
    .flat()
    .map(([s, f]) => [fnStr(s)?.match(componentRegex)?.[1], f]);

  return Object.fromEntries(componentPairs);
}

function isForwardRef(module) {
  return module?.$$typeof === Symbol.for("react.forward_ref");
}

function hasNativeDropdownSignature(source) {
  return (
    source.includes('"select"') &&
    source.includes("preventMenu") &&
    source.includes("onPointerDown") &&
    source.includes("onKeyDown") &&
    source.includes("onSelect") &&
    source.includes("value:")
  );
}

function hasLegacyDropdownSignature(source) {
  return source.includes("dropdown-list") && source.includes('"listbox"');
}

export function findDropdownComponent({ modules, chunks, require }) {
  const loadedDropdown = modules.find((m) => {
    if (!isForwardRef(m)) return false;
    const source = fnStr(m.render);
    return hasNativeDropdownSignature(source) || source.includes("dropdown-list");
  });
  if (loadedDropdown) return loadedDropdown;

  const legacyDropdownChunk = chunks.find(([, value]) => hasLegacyDropdownSignature(fnStr(value)));
  if (!legacyDropdownChunk) return undefined;

  const moduleExports = getObjectValues(require(legacyDropdownChunk[0]));
  return (
    moduleExports.find((m) => isForwardRef(m) && hasLegacyDropdownSignature(fnStr(m.render))) ??
    moduleExports[0]?.render ??
    moduleExports.find((m) => typeof m === "function")
  );
}

// From 1.3.3 the menu item and submenu item are exports that only switch
// between the v2 and legacy rows; the legacy row is no longer exported.
// Earlier builds export the legacy row, matched by its own props so that
// other components with mouse handlers (the waveform scrubber) are skipped.
export function findMenuItem({ functionModules }) {
  return (
    functionModules.find((f) => /forceV2LeadingIcon:\s*\w+\.forceV2LeadingIcon/.test(fnStr(f))) ??
    functionModules.find((f) => {
      const source = fnStr(f);
      return source.includes("leadingIcon") && source.includes("onClick") && (source.includes("handleMouseEnter") || source.includes("autoClose"));
    })
  );
}

export function findSubMenuItem({ functionModules, chunks, require }) {
  const legacy = functionModules.find((f) => fnStr(f).includes("subMenuIcon"));
  if (legacy) return legacy;

  const chunk = chunks.find(([, value]) => fnStr(value).includes("data-context-menu-submenu-header"));
  if (!chunk) return undefined;
  const exports = getObjectValues(require(chunk[0])).filter((m) => typeof m === "function");
  return exports.length === 1 ? exports[0] : undefined;
}

export function wrapProvider(component) {
  if (!component) return null;
  return (props) =>
    Spicetify.React.createElement(
      Spicetify.ReactComponent.RemoteConfigProvider,
      { configuration: Spicetify.Platform.RemoteConfiguration },
      Spicetify.React.createElement(component, props),
    );
}
