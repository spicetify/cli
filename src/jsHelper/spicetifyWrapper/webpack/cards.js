import { fnStr } from "../shared/string.js";

export const cardTypes = ["album", "artist", "audiobook", "episode", "playlist", "profile", "show", "track"];
const wrappedComponentTypes = new Set([Symbol.for("react.memo"), Symbol.for("react.forward_ref")]);

export function cardName(type) {
  return type[0].toUpperCase() + type.slice(1);
}

function getComponentSource(component) {
  try {
    const visited = new Set();
    let current = component;

    while (current && !visited.has(current)) {
      visited.add(current);
      if (typeof current === "function") return fnStr(current);
      current = current.type ?? current.render;
    }

    return "";
  } catch {
    return "";
  }
}

function getComponents({ modules, functionModules }) {
  const wrappedComponents = modules.filter((component) => wrappedComponentTypes.has(component?.$$typeof));
  return [...new Set([...functionModules, ...wrappedComponents])];
}

function getComponentCandidates(inventory) {
  return getComponents(inventory).map((component) => ({
    component,
    source: getComponentSource(component),
  }));
}

function getBaseCardName(source) {
  if (["?highlight", "headerText", "imageContainer"].every((marker) => source.includes(marker))) return "FeatureCard";
  if (source.includes('"herocard-click-handler"')) return "Hero";
  if (["isHero", "imageWrapper"].every((marker) => source.includes(marker)) && ["withWaves", "isCircular"].some((marker) => source.includes(marker)))
    return "CardImage";
}

export function findBaseCards(inventory) {
  const cards = {};

  for (const { component, source } of getComponentCandidates(inventory)) {
    const name = getBaseCardName(source);
    if (name && cards[name] === undefined) cards[name] = component;
  }

  return cards;
}

export function findCards(inventory, requestedTypes = cardTypes) {
  const candidates = getComponentCandidates(inventory);

  return requestedTypes.flatMap((type) => {
    const match = candidates.find(({ source }) => source.includes(`featureIdentifier:"${type}"`));
    return match ? [[cardName(type), match.component]] : [];
  });
}
