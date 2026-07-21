/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export function findBy(...tests) {
    const testFns = tests.map((test) => {
        switch (typeof test) {
            case "string":
                return (x) => x.toString().includes(test);
            case "function":
                return (x) => test(x);
            default: // assume regex
                return (x) => test.test(x.toString());
        }
    });
    const testFn = (x) => testFns.map((t) => t(x)).every(Boolean);
    return (xs) => xs.find(testFn);
}
// assumption: str[start] === pair[0]
export const findMatchingPos = (str, start, direction, pair, scopes) => {
    let l = scopes;
    let i = start + direction;
    while (l > 0 && i >= 0 && i < str.length) {
        const c = str[i];
        i += direction;
        if (c === pair[0])
            l++;
        else if (c === pair[1])
            l--;
    }
    return i;
};
export const matchLast = (str, pattern) => {
    const matches = str.matchAll(pattern);
    return Array.from(matches).at(-1);
};
export function stringifyUrlSearchParams(params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            for (const v of value) {
                searchParams.append(key, v);
            }
        }
        else {
            searchParams.append(key, value);
        }
    }
    return searchParams.toString();
}
export function registerReactDevtoolsHook() {
    globalThis["__REACT_DEVTOOLS_GLOBAL_HOOK__"] = {
        isDisabled: false,
        supportsFiber: true,
        inject($) {
            globalThis["findHostInstanceByFiber"] = $.findHostInstanceByFiber;
            globalThis["findFiberByHostInstance"] = $.findFiberByHostInstance;
        },
    };
}
