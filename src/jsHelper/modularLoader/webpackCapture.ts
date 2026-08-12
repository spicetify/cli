export interface WebpackCaptureOptions {
	maxWaitMs: number;
	now: () => number;
	wait: () => Promise<void>;
	getQueue: () => { push(chunk: unknown[]): unknown } | undefined;
	getCaptured: () => unknown;
	setCaptured: (require: unknown) => void;
}

export async function captureWebpackRequire(options: WebpackCaptureOptions): Promise<boolean> {
	const deadline = options.now() + options.maxWaitMs;
	let attempted = false;
	while (options.now() < deadline) {
		if (typeof options.getCaptured() === "function") return true;
		const queue = options.getQueue();
		if (queue && !attempted) {
			attempted = true;
			queue.push([
				[`spicetify.webpack.chunk.id.${options.now()}`],
				{},
				(require: unknown) => {
					options.setCaptured(require);
					return require;
				},
			]);
		}
		// Capture is an ordered poll: each wait must observe whether the runtime
		// callback fired before another attempt or the deadline check.
		// eslint-disable-next-line no-await-in-loop
		await options.wait();
	}
	return typeof options.getCaptured() === "function";
}
