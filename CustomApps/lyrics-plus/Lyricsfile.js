const Lyricsfile = (() => {
	function validateTiming(item) {
		if (!item || typeof item.text !== "string" || !Number.isSafeInteger(item.start_ms) || item.start_ms < 0)
			throw new Error("Invalid Lyricsfile text or start time");
		if (item.end_ms !== undefined && (!Number.isSafeInteger(item.end_ms) || item.end_ms < item.start_ms))
			throw new Error("Invalid Lyricsfile end time");
	}

	function parse(data, duration) {
		if (!data || data.version !== "1.0") throw new Error("Unsupported Lyricsfile version");
		const metadata = data.metadata;
		if (!metadata || typeof metadata.title !== "string" || typeof metadata.artist !== "string") throw new Error("Invalid Lyricsfile metadata");
		if (metadata.duration_ms !== undefined && (!Number.isSafeInteger(metadata.duration_ms) || metadata.duration_ms < 0))
			throw new Error("Invalid Lyricsfile duration");
		if (metadata.instrumental !== undefined && typeof metadata.instrumental !== "boolean")
			throw new Error("Invalid Lyricsfile instrumental flag");
		if (data.lines !== undefined && !Array.isArray(data.lines)) throw new Error("Invalid Lyricsfile lines");
		if (data.plain !== undefined && typeof data.plain !== "string") throw new Error("Invalid Lyricsfile plain lyrics");
		if (metadata.instrumental) {
			if (data.lines?.length || data.plain) throw new Error("Instrumental Lyricsfile contains lyrics");
			const lyrics = [{ text: "♪ Instrumental ♪", startTime: 0 }];
			return { karaoke: null, synced: lyrics, unsynced: lyrics, instrumental: true };
		}
		let wordCount = 0;
		const lines = (data.lines || [])
			.map((line) => {
				validateTiming(line);
				if (line.words !== undefined && !Array.isArray(line.words)) throw new Error("Invalid Lyricsfile words");
				wordCount += line.words?.length || 0;
				if (wordCount > 50000) throw new Error("Lyricsfile has too many words");
				const words = (line.words || [])
					.map((word) => {
						validateTiming(word);
						return word;
					})
					.sort((a, b) => a.start_ms - b.start_ms);
				return { ...line, words: words.map((word) => word.text).join("") === line.text ? words : [] };
			})
			.sort((a, b) => a.start_ms - b.start_ms);
		const synced = lines.length
			? lines.map((line) => ({
					text: line.text || "♪",
					startTime: line.start_ms,
					...(line.end_ms !== undefined ? { endTime: line.end_ms } : {}),
				}))
			: null;
		const plain = data.plain
			? data.plain
					.replace(/\r\n/g, "\n")
					.replace(/\n$/, "")
					.split("\n")
					.map((text) => ({ text }))
			: null;
		const karaoke = lines.some((line) => line.words.length)
			? lines.map((line) => {
					const words = line.words.length ? line.words : [{ text: line.text, start_ms: line.start_ms, end_ms: line.end_ms }];
					const lastWord = words[words.length - 1];
					const latestWordEnd = words.reduce((end, word) => Math.max(end, word.end_ms ?? word.start_ms), line.start_ms);
					const endTime =
						line.end_ms ??
						Math.max(latestWordEnd, lastWord.end_ms ?? Math.max(lastWord.start_ms + 1000, metadata.duration_ms || duration || 0));
					return {
						startTime: line.start_ms,
						endTime,
						text: words.map((word, index) => {
							const wordEnd = word.end_ms ?? Math.max(word.start_ms, words[index + 1]?.start_ms ?? endTime);
							return { word: word.text, startTime: word.start_ms, endTime: wordEnd, time: wordEnd - word.start_ms };
						}),
					};
				})
			: null;
		return { karaoke, synced, unsynced: plain || synced };
	}

	async function parseYaml(text, duration) {
		if (typeof text !== "string" || text.length > 1048576) throw new Error("Invalid Lyricsfile size");
		const yaml = await import("https://cdn.jsdelivr.net/npm/js-yaml@4.1.1/dist/js-yaml.mjs");
		let depth = 0;
		const data = yaml.load(text, {
			schema: yaml.JSON_SCHEMA,
			listener: (event) => {
				depth += event === "open" ? 1 : -1;
				if (depth > 32) throw new Error("Lyricsfile is nested too deeply");
			},
		});
		return parse(data, duration);
	}

	return { parseYaml };
})();
