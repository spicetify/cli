export interface SemVer {
	major: number;
	minor: number;
	patch: number;
}

export function parse(version: string): SemVer {
	const m = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
	if (!m) throw new Error(`cannot parse version: ${version}`);
	return { major: +m[1], minor: +m[2], patch: +m[3] };
}

export function compare(a: SemVer, b: SemVer): number {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function satisfyComparator(v: SemVer, op: string, c: SemVer): boolean {
	const cmp = compare(v, c);
	switch (op) {
		case "":
		case "=":
			return cmp === 0;
		case ">":
			return cmp > 0;
		case ">=":
			return cmp >= 0;
		case "<":
			return cmp < 0;
		case "<=":
			return cmp <= 0;
		default:
			throw new Error(`unsupported operator: ${op}`);
	}
}

// satisfies covers the ranges used in v3 module metadata: "*", exact,
// ^x.y.z, ~x.y.z, and space-separated comparator sets (>=, <=, >, <, =).
export function satisfies(version: string, range: string): boolean {
	const v = parse(version);
	const trimmed = range.trim();
	if (trimmed === "" || trimmed === "*" || trimmed.toLowerCase() === "x") return true;

	return trimmed.split(/\s*\|\|\s*/).some((set) =>
		set.split(/\s+/).every((part) => {
			const m = part.match(/^(\^|~|>=|<=|>|<|=)?v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/);
			if (!m) return false;
			const [, op = "", maj, min, pat] = m;
			if (min === "x" || min === "*" || min === undefined) {
				return satisfyComparator(v, op || ">=", { major: +maj, minor: 0, patch: 0 }) &&
					(op ? true : v.major === +maj);
			}
			if (pat === "x" || pat === "*" || pat === undefined) {
				return v.major === +maj && v.minor === +min;
			}
			const c = { major: +maj, minor: +min, patch: +pat };
			if (op === "^") {
				const upper = c.major > 0
					? { major: c.major + 1, minor: 0, patch: 0 }
					: c.minor > 0
						? { major: 0, minor: c.minor + 1, patch: 0 }
						: { major: 0, minor: 0, patch: c.patch + 1 };
				return compare(v, c) >= 0 && compare(v, upper) < 0;
			}
			if (op === "~") {
				return compare(v, c) >= 0 && v.major === c.major && v.minor === c.minor;
			}
			return satisfyComparator(v, op, c);
		})
	);
}
