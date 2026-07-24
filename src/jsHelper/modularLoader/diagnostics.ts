// Diagnostics ring buffer: loader and module warnings land here so
// management UIs (the manager module) can show drift and boot problems
// without pointing users at the devtools console. The loader owns the
// buffer; modules only append when it exists.

export interface DiagnosticsEntry {
	ts: number;
	level: "info" | "error" | "warn";
	message: string;
}

const CAP = 200;

export function pushDiagnostic(level: DiagnosticsEntry["level"], ...args: unknown[]): void {
	const g = globalThis as never as { __SPICETIFY_DIAGNOSTICS__?: DiagnosticsEntry[] };
	const buffer = (g.__SPICETIFY_DIAGNOSTICS__ ??= []);
	buffer.push({ ts: Date.now(), level, message: args.map(String).join(" ") });
	if (buffer.length > CAP) buffer.splice(0, buffer.length - CAP);
}
