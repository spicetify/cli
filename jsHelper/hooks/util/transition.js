/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export class Transition {
    complete = true;
    promise = Promise.resolve();
    constructor() { }
    extend() {
        this.complete = false;
        const p = Promise.withResolvers();
        this.promise = this.promise.then(() => p.promise).finally(() => this.complete = true);
        return p.resolve;
    }
    isComplete() {
        return this.complete;
    }
    block() {
        return this.promise;
    }
    // If the task rejects, the transition will never complete
    async new(task) {
        await this.block();
        const resolve = this.extend();
        const r = await task();
        resolve();
        return r;
    }
}
