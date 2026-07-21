import type { RegisteredTransform } from "./transforms.ts";

const WORKER_SRC = `
onmessage = (e) => {
	const { text, fns } = e.data;
	let out = text;
	let applied = 0;
	for (const src of fns) {
		try {
			const fn = eval("(" + src + ")");
			out = fn(out, "/xpui-modules.js");
			applied++;
		} catch (err) {
			// skip broken transform
		}
	}
	postMessage({ text: out, applied });
};
`;

// applyTransformsOffthread applies registered transforms in a worker so a
// pathological regex cannot freeze the client. Returns null on timeout,
// signaling the caller to boot the stock bundle.
export function applyTransformsOffthread(
	bundleText: string,
	registered: RegisteredTransform[],
	timeoutMs: number,
): Promise<{ text: string; applied: number } | null> {
	return new Promise((resolve) => {
		const worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
		const timer = setTimeout(() => {
			worker.terminate();
			resolve(null);
		}, timeoutMs);
		worker.onmessage = (e) => {
			clearTimeout(timer);
			worker.terminate();
			resolve(e.data);
		};
		worker.onerror = () => {
			clearTimeout(timer);
			worker.terminate();
			resolve(null);
		};
		worker.postMessage({ text: bundleText, fns: registered.map((t) => t.fn.toString()) });
	});
}
