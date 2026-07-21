/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const visited = new WeakMap();
const type = (obj, access) => {
    const constructor = obj?.constructor?.name;
    switch (constructor) {
        case "Map":
            return "Map<any,any>";
        case "Set":
            return "Set<any>";
        case "Uint8Array":
            return "Uint8Array";
        case "Promise":
            return "Promise<any>";
    }
    if (obj instanceof Element)
        return "Element";
    if (obj instanceof HTMLElement)
        return "HTMLElement";
    const wrapVisited = (obj) => {
        const typeRef = visited.get(obj);
        if (typeRef)
            return typeRef;
        visited.set(obj, access);
    };
    switch (typeof obj) {
        case "function": {
            const cached = wrapVisited(obj);
            if (cached)
                return cached;
            if (obj.length === 0) {
                let ret = "any";
                try {
                    ret = type(obj(), `ReturnType<${access}>`);
                }
                catch (_) { }
                return `()=>${ret}`;
            }
            const identifiers = "abcdefghijklmnopqrstuvwzyz_$".split("").map((i) => `${i}:any`);
            return `(${identifiers.slice(0, obj.length).join(",")})=>any`;
        }
        case "object": {
            if (obj === null)
                return "null";
            // const p = Object.getPrototypeOf(obj);
            let cached;
            // if (p !== Object.prototype && p.constructor) {
            // 	cached = wrapVisited(p);
            // } else {
            cached = wrapVisited(obj);
            // }
            if (cached)
                return cached;
            if (Array.isArray(obj)) {
                const types = obj.map((e, i) => type(e, `${access}[${i}]`));
                // @ts-ignore: Property 'groupBy' does not exist on type 'ObjectConstructor'.
                const uniqueTypes = Array.from(new Set(types));
                return `Array<${uniqueTypes.join("|")}>`;
            }
            const prototypes = [obj];
            while (true) {
                const p = Object.getPrototypeOf(prototypes.at(-1));
                if (p === Object.prototype)
                    break;
                prototypes.push(p);
            }
            const blacklist = ["constructor"];
            return prototypes.reduce((acc, p) => {
                return `${acc}&{${Object.getOwnPropertyNames(p)
                    .filter((k) => !blacklist.includes(k))
                    .sort()
                    .map((k) => `"${k}":${type(obj[k], `${access}["${k}"]`)}`)
                    .join(";")}}`;
            }, "");
        }
        default:
            return typeof obj;
    }
};
export {};
