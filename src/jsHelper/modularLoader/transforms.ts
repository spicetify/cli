export interface RegisteredTransform {
	glob: RegExp;
	fn: (input: string, path: string) => string;
	promise: Promise<unknown>;
	resolve: (value: unknown) => void;
}

export interface TransformRegistry {
	factory: (register: (emit: (value: unknown) => void) => (input: string, path: string) => string, opts?: { glob?: RegExp; wait?: boolean }) => Promise<unknown>;
	registered: RegisteredTransform[];
}

// createTransformRegistry builds the transformer factory modules use to
// register source patches. Registrations are applied to the client bundle at
// boot (see applyTransforms); a factory promise resolves when its transform
// emits during application.
export function createTransformRegistry(): TransformRegistry {
	const registered: RegisteredTransform[] = [];
	return {
		registered,
		factory: (register, opts = {}) => {
			const { promise, resolve } = Promise.withResolvers<unknown>();
			const fn = register(resolve);
			registered.push({ glob: opts.glob ?? /(?:)/, fn, promise, resolve });
			return promise;
		},
	};
}

const BUNDLE_CANDIDATES = ["/xpui-modules.js", "/xpui.js", "/vendor~xpui.js"];

export function transformPath(glob: RegExp): string | null {
	for (const path of BUNDLE_CANDIDATES) {
		if (glob.test(path)) return path;
	}
	return null;
}

export interface ApplyResult {
	text: string;
	applied: number;
	resolutions: Promise<unknown>[];
}

// applyTransforms runs every registered transform whose glob matches the
// client bundle. Transforms that emit resolve their factory promise with the
// emitted value.
export function applyTransforms(bundleText: string, registered: RegisteredTransform[]): ApplyResult {
	let text = bundleText;
	let applied = 0;
	const resolutions: Promise<unknown>[] = [];
	for (const t of registered) {
		const path = transformPath(t.glob);
		if (!path) continue;
		try {
			text = t.fn(text, path);
			applied++;
			resolutions.push(t.promise);
		} catch {
			// a failed transform must not break the client bundle
		}
	}
	return { text, applied, resolutions };
}
