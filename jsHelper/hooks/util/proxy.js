/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
// @deno-types="../protocol.ts"
import { isOpen } from "../protocol.js";
// @deno-types="../static.ts"
import { LOCAL_PROXY_HOST } from "../static.js";
export const proxy = (init, options = {}) => {
    const proxy = isOpen() ? localProxy : remoteProxy;
    return proxy(init, options);
};
const localProxyUrl = new URL(`http://${LOCAL_PROXY_HOST}/proxy/`);
export const localProxy = (input, init = {}) => {
    let url;
    if (typeof input === "string") {
        url = new URL(input);
    }
    else if (input instanceof Request) {
        url = new URL(input.url);
    }
    else if (input instanceof URL) {
        url = input;
    }
    else {
        throw "Unsupported input type";
    }
    url = new URL(localProxyUrl + encodeURIComponent(url.toString()));
    let headers;
    if (init.headers) {
        headers = new Headers(init.headers);
    }
    else if (input instanceof Request) {
        headers = input.headers;
    }
    else {
        headers = new Headers();
    }
    const _headers = new Headers();
    _headers.set("X-Set-Headers", JSON.stringify(Object.fromEntries(headers)));
    init.headers = _headers;
    if (input instanceof Request) {
        // @ts-ignore
        input.duplex = "half";
    }
    const request = new Request(url, input instanceof Request ? input : undefined);
    return [request, init];
};
export const remoteProxyA = (input, init = {}) => {
    let url;
    if (typeof input === "string") {
        url = new URL(input);
    }
    else if (input instanceof Request) {
        url = new URL(input.url);
    }
    else if (input instanceof URL) {
        url = input;
    }
    else {
        throw "Unsupported input type";
    }
    url.host = `${url.host.replaceAll(".", "-20")}.delusoire.top`;
    let headers;
    if (init.headers) {
        headers = new Headers(init.headers);
    }
    else if (input instanceof Request) {
        headers = input.headers;
    }
    else {
        headers = new Headers();
    }
    const _headers = new Headers();
    _headers.set("X-Set-Headers", JSON.stringify(Object.fromEntries(headers)));
    init.headers = _headers;
    if (input instanceof Request) {
        // @ts-ignore
        input.duplex = "half";
    }
    const request = new Request(url, input instanceof Request ? input : undefined);
    return [request, init];
};
export const remoteProxyB = (input, init = {}) => {
    let url;
    if (typeof input === "string") {
        url = new URL(input);
    }
    else if (input instanceof Request) {
        url = new URL(input.url);
    }
    else if (input instanceof URL) {
        url = input;
    }
    else {
        throw "Unsupported input type";
    }
    url = `https://cors-proxy.spicetify.app/${url}`;
    let headers;
    if (init.headers) {
        headers = new Headers(init.headers);
    }
    else if (input instanceof Request) {
        headers = input.headers;
    }
    else {
        headers = new Headers();
    }
    const _headers = new Headers();
    for (const [kp, k] of [
        ["X-Cookie", "Cookie"],
        ["X-Referer", "Referer"],
        ["X-Origin", "Origin"],
        ["X-User-Agent", "User-Agent"],
        ["X-X-Real-Ip", "X-Real-Ip"],
    ]) {
        const v = headers.get(k);
        if (v) {
            _headers.set(kp, v);
        }
    }
    init.headers = _headers;
    if (input instanceof Request) {
        // @ts-ignore
        input.duplex = "half";
    }
    const request = new Request(url, input instanceof Request ? input : undefined);
    return [request, init];
};
export const remoteProxy = remoteProxyA;
