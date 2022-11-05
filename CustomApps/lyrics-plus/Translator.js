!(function (f) {
	"object" == typeof exports && "undefined" != typeof module
		? (module.exports = f())
		: "function" == typeof define && define.amd
		? define([], f)
		: (("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).Kuroshiro = f());
})(function () {
	return (function f(n, z, v) {
		function j(O, P) {
			if (!z[O]) {
				if (!n[O]) {
					var h = "function" == typeof require && require;
					if (!P && h) return h(O, !0);
					if (x) return x(O, !0);
					var c = new Error("Cannot find module '" + O + "'");
					throw ((c.code = "MODULE_NOT_FOUND"), c);
				}
				var l = (z[O] = { exports: {} });
				n[O][0].call(
					l.exports,
					function (f) {
						return j(n[O][1][f] || f);
					},
					l,
					l.exports,
					f,
					n,
					z,
					v
				);
			}
			return z[O].exports;
		}
		for (var x = "function" == typeof require && require, O = 0; O < v.length; O++) j(v[O]);
		return j;
	})(
		{
			1: [
				function (f, n, z) {
					n.exports = f("regenerator-runtime");
				},
				{ "regenerator-runtime": 2 }
			],
			2: [
				function (f, n, z) {
					var v = (function (f) {
						"use strict";
						var n,
							z = Object.prototype,
							v = z.hasOwnProperty,
							j = "function" == typeof Symbol ? Symbol : {},
							x = j.iterator || "@@iterator",
							O = j.asyncIterator || "@@asyncIterator",
							P = j.toStringTag || "@@toStringTag";
						function h(f, n, z) {
							return (
								Object.defineProperty(f, n, {
									value: z,
									enumerable: !0,
									configurable: !0,
									writable: !0
								}),
								f[n]
							);
						}
						try {
							h({}, "");
						} catch (f) {
							h = function (f, n, z) {
								return (f[n] = z);
							};
						}
						function c(f, n, z, v) {
							var j = n && n.prototype instanceof r ? n : r,
								x = Object.create(j.prototype),
								O = new T(v || []);
							return (
								(x._invoke = (function (f, n, z) {
									var v = e;
									return function (j, x) {
										if (v === M) throw new Error("Generator is already running");
										if (v === y) {
											if ("throw" === j) throw x;
											return Q();
										}
										for (z.method = j, z.arg = x; ; ) {
											var O = z.delegate;
											if (O) {
												var P = u(O, z);
												if (P) {
													if (P === E) continue;
													return P;
												}
											}
											if ("next" === z.method) z.sent = z._sent = z.arg;
											else if ("throw" === z.method) {
												if (v === e) throw ((v = y), z.arg);
												z.dispatchException(z.arg);
											} else "return" === z.method && z.abrupt("return", z.arg);
											v = M;
											var h = l(f, n, z);
											if ("normal" === h.type) {
												if (((v = z.done ? y : I), h.arg === E)) continue;
												return { value: h.arg, done: z.done };
											}
											"throw" === h.type && ((v = y), (z.method = "throw"), (z.arg = h.arg));
										}
									};
								})(f, z, O)),
								x
							);
						}
						function l(f, n, z) {
							try {
								return { type: "normal", arg: f.call(n, z) };
							} catch (f) {
								return { type: "throw", arg: f };
							}
						}
						f.wrap = c;
						var e = "suspendedStart",
							I = "suspendedYield",
							M = "executing",
							y = "completed",
							E = {};
						function r() {}
						function K() {}
						function A() {}
						var i = {};
						i[x] = function () {
							return this;
						};
						var t = Object.getPrototypeOf,
							X = t && t(t(W([])));
						X && X !== z && v.call(X, x) && (i = X);
						var Z = (A.prototype = r.prototype = Object.create(i));
						function p(f) {
							["next", "throw", "return"].forEach(function (n) {
								h(f, n, function (f) {
									return this._invoke(n, f);
								});
							});
						}
						function H(f, n) {
							function z(j, x, O, P) {
								var h = l(f[j], f, x);
								if ("throw" !== h.type) {
									var c = h.arg,
										e = c.value;
									return e && "object" == typeof e && v.call(e, "__await")
										? n.resolve(e.__await).then(
												function (f) {
													z("next", f, O, P);
												},
												function (f) {
													z("throw", f, O, P);
												}
										  )
										: n.resolve(e).then(
												function (f) {
													(c.value = f), O(c);
												},
												function (f) {
													return z("throw", f, O, P);
												}
										  );
								}
								P(h.arg);
							}
							var j;
							this._invoke = function (f, v) {
								function x() {
									return new n(function (n, j) {
										z(f, v, n, j);
									});
								}
								return (j = j ? j.then(x, x) : x());
							};
						}
						function u(f, z) {
							var v = f.iterator[z.method];
							if (v === n) {
								if (((z.delegate = null), "throw" === z.method)) {
									if (f.iterator.return && ((z.method = "return"), (z.arg = n), u(f, z), "throw" === z.method)) return E;
									(z.method = "throw"), (z.arg = new TypeError("The iterator does not provide a 'throw' method"));
								}
								return E;
							}
							var j = l(v, f.iterator, z.arg);
							if ("throw" === j.type) return (z.method = "throw"), (z.arg = j.arg), (z.delegate = null), E;
							var x = j.arg;
							return x
								? x.done
									? ((z[f.resultName] = x.value),
									  (z.next = f.nextLoc),
									  "return" !== z.method && ((z.method = "next"), (z.arg = n)),
									  (z.delegate = null),
									  E)
									: x
								: ((z.method = "throw"), (z.arg = new TypeError("iterator result is not an object")), (z.delegate = null), E);
						}
						function S(f) {
							var n = { tryLoc: f[0] };
							1 in f && (n.catchLoc = f[1]), 2 in f && ((n.finallyLoc = f[2]), (n.afterLoc = f[3])), this.tryEntries.push(n);
						}
						function G(f) {
							var n = f.completion || {};
							(n.type = "normal"), delete n.arg, (f.completion = n);
						}
						function T(f) {
							(this.tryEntries = [{ tryLoc: "root" }]), f.forEach(S, this), this.reset(!0);
						}
						function W(f) {
							if (f) {
								var z = f[x];
								if (z) return z.call(f);
								if ("function" == typeof f.next) return f;
								if (!isNaN(f.length)) {
									var j = -1,
										O = function z() {
											for (; ++j < f.length; ) if (v.call(f, j)) return (z.value = f[j]), (z.done = !1), z;
											return (z.value = n), (z.done = !0), z;
										};
									return (O.next = O);
								}
							}
							return { next: Q };
						}
						function Q() {
							return { value: n, done: !0 };
						}
						return (
							(K.prototype = Z.constructor = A),
							(A.constructor = K),
							(K.displayName = h(A, P, "GeneratorFunction")),
							(f.isGeneratorFunction = function (f) {
								var n = "function" == typeof f && f.constructor;
								return !!n && (n === K || "GeneratorFunction" === (n.displayName || n.name));
							}),
							(f.mark = function (f) {
								return (
									Object.setPrototypeOf ? Object.setPrototypeOf(f, A) : ((f.__proto__ = A), h(f, P, "GeneratorFunction")),
									(f.prototype = Object.create(Z)),
									f
								);
							}),
							(f.awrap = function (f) {
								return { __await: f };
							}),
							p(H.prototype),
							(H.prototype[O] = function () {
								return this;
							}),
							(f.AsyncIterator = H),
							(f.async = function (n, z, v, j, x) {
								void 0 === x && (x = Promise);
								var O = new H(c(n, z, v, j), x);
								return f.isGeneratorFunction(z)
									? O
									: O.next().then(function (f) {
											return f.done ? f.value : O.next();
									  });
							}),
							p(Z),
							h(Z, P, "Generator"),
							(Z[x] = function () {
								return this;
							}),
							(Z.toString = function () {
								return "[object Generator]";
							}),
							(f.keys = function (f) {
								var n = [];
								for (var z in f) n.push(z);
								return (
									n.reverse(),
									function z() {
										for (; n.length; ) {
											var v = n.pop();
											if (v in f) return (z.value = v), (z.done = !1), z;
										}
										return (z.done = !0), z;
									}
								);
							}),
							(f.values = W),
							(T.prototype = {
								constructor: T,
								reset: function (f) {
									if (
										((this.prev = 0),
										(this.next = 0),
										(this.sent = this._sent = n),
										(this.done = !1),
										(this.delegate = null),
										(this.method = "next"),
										(this.arg = n),
										this.tryEntries.forEach(G),
										!f)
									)
										for (var z in this) "t" === z.charAt(0) && v.call(this, z) && !isNaN(+z.slice(1)) && (this[z] = n);
								},
								stop: function () {
									this.done = !0;
									var f = this.tryEntries[0].completion;
									if ("throw" === f.type) throw f.arg;
									return this.rval;
								},
								dispatchException: function (f) {
									if (this.done) throw f;
									var z = this;
									function j(v, j) {
										return (P.type = "throw"), (P.arg = f), (z.next = v), j && ((z.method = "next"), (z.arg = n)), !!j;
									}
									for (var x = this.tryEntries.length - 1; x >= 0; --x) {
										var O = this.tryEntries[x],
											P = O.completion;
										if ("root" === O.tryLoc) return j("end");
										if (O.tryLoc <= this.prev) {
											var h = v.call(O, "catchLoc"),
												c = v.call(O, "finallyLoc");
											if (h && c) {
												if (this.prev < O.catchLoc) return j(O.catchLoc, !0);
												if (this.prev < O.finallyLoc) return j(O.finallyLoc);
											} else if (h) {
												if (this.prev < O.catchLoc) return j(O.catchLoc, !0);
											} else {
												if (!c) throw new Error("try statement without catch or finally");
												if (this.prev < O.finallyLoc) return j(O.finallyLoc);
											}
										}
									}
								},
								abrupt: function (f, n) {
									for (var z = this.tryEntries.length - 1; z >= 0; --z) {
										var j = this.tryEntries[z];
										if (j.tryLoc <= this.prev && v.call(j, "finallyLoc") && this.prev < j.finallyLoc) {
											var x = j;
											break;
										}
									}
									x && ("break" === f || "continue" === f) && x.tryLoc <= n && n <= x.finallyLoc && (x = null);
									var O = x ? x.completion : {};
									return (O.type = f), (O.arg = n), x ? ((this.method = "next"), (this.next = x.finallyLoc), E) : this.complete(O);
								},
								complete: function (f, n) {
									if ("throw" === f.type) throw f.arg;
									return (
										"break" === f.type || "continue" === f.type
											? (this.next = f.arg)
											: "return" === f.type
											? ((this.rval = this.arg = f.arg), (this.method = "return"), (this.next = "end"))
											: "normal" === f.type && n && (this.next = n),
										E
									);
								},
								finish: function (f) {
									for (var n = this.tryEntries.length - 1; n >= 0; --n) {
										var z = this.tryEntries[n];
										if (z.finallyLoc === f) return this.complete(z.completion, z.afterLoc), G(z), E;
									}
								},
								catch: function (f) {
									for (var n = this.tryEntries.length - 1; n >= 0; --n) {
										var z = this.tryEntries[n];
										if (z.tryLoc === f) {
											var v = z.completion;
											if ("throw" === v.type) {
												var j = v.arg;
												G(z);
											}
											return j;
										}
									}
									throw new Error("illegal catch attempt");
								},
								delegateYield: function (f, z, v) {
									return (
										(this.delegate = {
											iterator: W(f),
											resultName: z,
											nextLoc: v
										}),
										"next" === this.method && (this.arg = n),
										E
									);
								}
							}),
							f
						);
					})("object" == typeof n ? n.exports : {});
					try {
						regeneratorRuntime = v;
					} catch (f) {
						Function("r", "regeneratorRuntime = r")(v);
					}
				},
				{}
			],
			3: [
				function (f, n, z) {
					"use strict";
					Object.defineProperty(z, "__esModule", { value: !0 }), (z.default = void 0);
					var v,
						j = (v = f("@babel/runtime/regenerator")) && v.__esModule ? v : { default: v },
						x = f("./util");
					function O(f) {
						return (
							(O =
								"function" == typeof Symbol && "symbol" == typeof Symbol.iterator
									? function (f) {
											return typeof f;
									  }
									: function (f) {
											return f && "function" == typeof Symbol && f.constructor === Symbol && f !== Symbol.prototype ? "symbol" : typeof f;
									  }),
							O(f)
						);
					}
					function P(f, n, z, v, j, x, O) {
						try {
							var P = f[x](O),
								h = P.value;
						} catch (f) {
							return void z(f);
						}
						P.done ? n(h) : Promise.resolve(h).then(v, j);
					}
					function h(f) {
						return function () {
							var n = this,
								z = arguments;
							return new Promise(function (v, j) {
								var x = f.apply(n, z);
								function O(f) {
									P(x, v, j, O, h, "next", f);
								}
								function h(f) {
									P(x, v, j, O, h, "throw", f);
								}
								O(void 0);
							});
						};
					}
					function c(f, n) {
						for (var z = 0; z < n.length; z++) {
							var v = n[z];
							(v.enumerable = v.enumerable || !1), (v.configurable = !0), "value" in v && (v.writable = !0), Object.defineProperty(f, v.key, v);
						}
					}
					var l = (function () {
							function f() {
								!(function (f, n) {
									if (!(f instanceof n)) throw new TypeError("Cannot call a class as a function");
								})(this, f),
									(this._analyzer = null);
							}
							var n, z, v, P;
							return (
								(n = f),
								(z = [
									{
										key: "init",
										value:
											((P = h(
												j.default.mark(function f(n) {
													return j.default.wrap(
														function (f) {
															for (;;)
																switch ((f.prev = f.next)) {
																	case 0:
																		if (n && "object" === O(n) && "function" == typeof n.init && "function" == typeof n.parse) {
																			f.next = 4;
																			break;
																		}
																		throw new Error("Invalid initialization parameter.");
																	case 4:
																		if (null != this._analyzer) {
																			f.next = 10;
																			break;
																		}
																		return (f.next = 7), n.init();
																	case 7:
																		(this._analyzer = n), (f.next = 11);
																		break;
																	case 10:
																		throw new Error("Kuroshiro has already been initialized.");
																	case 11:
																	case "end":
																		return f.stop();
																}
														},
														f,
														this
													);
												})
											)),
											function (f) {
												return P.apply(this, arguments);
											})
									},
									{
										key: "convert",
										value:
											((v = h(
												j.default.mark(function f(n, z) {
													var v, O, P, h, c, l, e, I, M, y, E, r, K, A, i, t, X, Z, p, H, u, S, G, T, W, Q, a, J, U, Y, o;
													return j.default.wrap(
														function (f) {
															for (;;)
																switch ((f.prev = f.next)) {
																	case 0:
																		if (
																			(((z = z || {}).to = z.to || "hiragana"),
																			(z.mode = z.mode || "normal"),
																			(z.romajiSystem = z.romajiSystem || x.ROMANIZATION_SYSTEM.HEPBURN),
																			(z.delimiter_start = z.delimiter_start || "("),
																			(z.delimiter_end = z.delimiter_end || ")"),
																			(n = n || ""),
																			-1 !== ["hiragana", "katakana", "romaji"].indexOf(z.to))
																		) {
																			f.next = 9;
																			break;
																		}
																		throw new Error("Invalid Target Syllabary.");
																	case 9:
																		if (-1 !== ["normal", "spaced", "okurigana", "furigana"].indexOf(z.mode)) {
																			f.next = 11;
																			break;
																		}
																		throw new Error("Invalid Conversion Mode.");
																	case 11:
																		if (
																			-1 !==
																			Object.keys(x.ROMANIZATION_SYSTEM)
																				.map(function (f) {
																					return x.ROMANIZATION_SYSTEM[f];
																				})
																				.indexOf(z.romajiSystem)
																		) {
																			f.next = 14;
																			break;
																		}
																		throw new Error("Invalid Romanization System.");
																	case 14:
																		return (f.next = 16), this._analyzer.parse(n);
																	case 16:
																		if (((v = f.sent), (O = (0, x.patchTokens)(v)), "normal" !== z.mode && "spaced" !== z.mode)) {
																			f.next = 36;
																			break;
																		}
																		(f.t0 = z.to), (f.next = "katakana" === f.t0 ? 22 : "romaji" === f.t0 ? 25 : "hiragana" === f.t0 ? 29 : 33);
																		break;
																	case 22:
																		if ("normal" !== z.mode) {
																			f.next = 24;
																			break;
																		}
																		return f.abrupt(
																			"return",
																			O.map(function (f) {
																				return f.reading;
																			}).join("")
																		);
																	case 24:
																		return f.abrupt(
																			"return",
																			O.map(function (f) {
																				return f.reading;
																			}).join(" ")
																		);
																	case 25:
																		if (
																			((P = function (f) {
																				var n;
																				return (
																					(n = (0, x.hasJapanese)(f.surface_form) ? f.pronunciation || f.reading : f.surface_form),
																					(0, x.toRawRomaji)(n, z.romajiSystem)
																				);
																			}),
																			"normal" !== z.mode)
																		) {
																			f.next = 28;
																			break;
																		}
																		return f.abrupt("return", O.map(P).join(""));
																	case 28:
																		return f.abrupt("return", O.map(P).join(" "));
																	case 29:
																		for (h = 0; h < O.length; h++)
																			if ((0, x.hasKanji)(O[h].surface_form))
																				if ((0, x.hasKatakana)(O[h].surface_form)) {
																					for (
																						O[h].reading = (0, x.toRawHiragana)(O[h].reading), c = "", l = "", e = 0;
																						e < O[h].surface_form.length;
																						e++
																					)
																						(0, x.isKanji)(O[h].surface_form[e])
																							? (l += "(.*)")
																							: (l += (0, x.isKatakana)(O[h].surface_form[e])
																									? (0, x.toRawHiragana)(O[h].surface_form[e])
																									: O[h].surface_form[e]);
																					if (((I = new RegExp(l)), (M = I.exec(O[h].reading)))) {
																						for (y = 0, E = 0; E < O[h].surface_form.length; E++)
																							(0, x.isKanji)(O[h].surface_form[E]) ? ((c += M[y + 1]), y++) : (c += O[h].surface_form[E]);
																						O[h].reading = c;
																					}
																				} else O[h].reading = (0, x.toRawHiragana)(O[h].reading);
																			else O[h].reading = O[h].surface_form;
																		if ("normal" !== z.mode) {
																			f.next = 32;
																			break;
																		}
																		return f.abrupt(
																			"return",
																			O.map(function (f) {
																				return f.reading;
																			}).join("")
																		);
																	case 32:
																		return f.abrupt(
																			"return",
																			O.map(function (f) {
																				return f.reading;
																			}).join(" ")
																		);
																	case 33:
																		throw new Error("Unknown option.to param");
																	case 34:
																		f.next = 73;
																		break;
																	case 36:
																		if ("okurigana" !== z.mode && "furigana" !== z.mode) {
																			f.next = 73;
																			break;
																		}
																		(r = []), (K = 0);
																	case 39:
																		if (!(K < O.length)) {
																			f.next = 62;
																			break;
																		}
																		(A = (0, x.getStrType)(O[K].surface_form)),
																			(f.t1 = A),
																			(f.next = 0 === f.t1 ? 44 : 1 === f.t1 ? 46 : 2 === f.t1 ? 54 : 3 === f.t1 ? 56 : 58);
																		break;
																	case 44:
																		return (
																			r.push([O[K].surface_form, 1, (0, x.toRawHiragana)(O[K].reading), O[K].pronunciation || O[K].reading]),
																			f.abrupt("break", 59)
																		);
																	case 46:
																		for (i = "", t = !1, X = [], Z = 0; Z < O[K].surface_form.length; Z++)
																			(0, x.isKanji)(O[K].surface_form[Z])
																				? t
																					? (X[X.length - 1] += O[K].surface_form[Z])
																					: ((t = !0), (i += "(.+)"), X.push(O[K].surface_form[Z]))
																				: ((t = !1),
																				  X.push(O[K].surface_form[Z]),
																				  (i += (0, x.isKatakana)(O[K].surface_form[Z])
																						? (0, x.toRawHiragana)(O[K].surface_form[Z])
																						: O[K].surface_form[Z]));
																		if (((p = new RegExp("^".concat(i, "$"))), (H = p.exec((0, x.toRawHiragana)(O[K].reading)))))
																			for (u = 1, S = 0; S < X.length; S++)
																				(0, x.isKanji)(X[S][0])
																					? (r.push([X[S], 1, H[u], (0, x.toRawKatakana)(H[u])]), (u += 1))
																					: r.push([X[S], 2, (0, x.toRawHiragana)(X[S]), (0, x.toRawKatakana)(X[S])]);
																		else r.push([O[K].surface_form, 1, (0, x.toRawHiragana)(O[K].reading), O[K].pronunciation || O[K].reading]);
																		return f.abrupt("break", 59);
																	case 54:
																		for (G = 0; G < O[K].surface_form.length; G++)
																			r.push([
																				O[K].surface_form[G],
																				2,
																				(0, x.toRawHiragana)(O[K].reading[G]),
																				(O[K].pronunciation && O[K].pronunciation[G]) || O[K].reading[G]
																			]);
																		return f.abrupt("break", 59);
																	case 56:
																		for (T = 0; T < O[K].surface_form.length; T++)
																			r.push([O[K].surface_form[T], 3, O[K].surface_form[T], O[K].surface_form[T]]);
																		return f.abrupt("break", 59);
																	case 58:
																		throw new Error("Unknown strType");
																	case 59:
																		K++, (f.next = 39);
																		break;
																	case 62:
																		(W = ""),
																			(f.t2 = z.to),
																			(f.next = "katakana" === f.t2 ? 66 : "romaji" === f.t2 ? 68 : "hiragana" === f.t2 ? 70 : 72);
																		break;
																	case 66:
																		if ("okurigana" === z.mode)
																			for (Q = 0; Q < r.length; Q++)
																				1 !== r[Q][1]
																					? (W += r[Q][0])
																					: (W += r[Q][0] + z.delimiter_start + (0, x.toRawKatakana)(r[Q][2]) + z.delimiter_end);
																		else
																			for (a = 0; a < r.length; a++)
																				1 !== r[a][1]
																					? (W += r[a][0])
																					: (W += "<ruby>"
																							.concat(r[a][0], "<rp>")
																							.concat(z.delimiter_start, "</rp><rt>")
																							.concat((0, x.toRawKatakana)(r[a][2]), "</rt><rp>")
																							.concat(z.delimiter_end, "</rp></ruby>"));
																		return f.abrupt("return", W);
																	case 68:
																		if ("okurigana" === z.mode)
																			for (J = 0; J < r.length; J++)
																				1 !== r[J][1]
																					? (W += r[J][0])
																					: (W += r[J][0] + z.delimiter_start + (0, x.toRawRomaji)(r[J][3], z.romajiSystem) + z.delimiter_end);
																		else {
																			for (W += "<ruby>", U = 0; U < r.length; U++)
																				W += ""
																					.concat(r[U][0], "<rp>")
																					.concat(z.delimiter_start, "</rp><rt>")
																					.concat((0, x.toRawRomaji)(r[U][3], z.romajiSystem), "</rt><rp>")
																					.concat(z.delimiter_end, "</rp>");
																			W += "</ruby>";
																		}
																		return f.abrupt("return", W);
																	case 70:
																		if ("okurigana" === z.mode)
																			for (Y = 0; Y < r.length; Y++)
																				1 !== r[Y][1] ? (W += r[Y][0]) : (W += r[Y][0] + z.delimiter_start + r[Y][2] + z.delimiter_end);
																		else
																			for (o = 0; o < r.length; o++)
																				1 !== r[o][1]
																					? (W += r[o][0])
																					: (W += "<ruby>"
																							.concat(r[o][0], "<rp>")
																							.concat(z.delimiter_start, "</rp><rt>")
																							.concat(r[o][2], "</rt><rp>")
																							.concat(z.delimiter_end, "</rp></ruby>"));
																		return f.abrupt("return", W);
																	case 72:
																		throw new Error("Invalid Target Syllabary.");
																	case 73:
																	case "end":
																		return f.stop();
																}
														},
														f,
														this
													);
												})
											)),
											function (f, n) {
												return v.apply(this, arguments);
											})
									}
								]),
								z && c(n.prototype, z),
								f
							);
						})(),
						e = {
							isHiragana: x.isHiragana,
							isKatakana: x.isKatakana,
							isKana: x.isKana,
							isKanji: x.isKanji,
							isJapanese: x.isJapanese,
							hasHiragana: x.hasHiragana,
							hasKatakana: x.hasKatakana,
							hasKana: x.hasKana,
							hasKanji: x.hasKanji,
							hasJapanese: x.hasJapanese,
							kanaToHiragna: x.kanaToHiragna,
							kanaToKatakana: x.kanaToKatakana,
							kanaToRomaji: x.kanaToRomaji
						};
					l.Util = e;
					var I = l;
					z.default = I;
				},
				{ "./util": 5, "@babel/runtime/regenerator": 1 }
			],
			4: [
				function (f, n, z) {
					"use strict";
					var v;
					Object.defineProperty(z, "__esModule", { value: !0 }), (z.default = void 0);
					var j = ((v = f("./core")) && v.__esModule ? v : { default: v }).default;
					z.default = j;
				},
				{ "./core": 3 }
			],
			5: [
				function (f, n, z) {
					"use strict";
					function v(f) {
						return (
							(function (f) {
								if (Array.isArray(f)) return j(f);
							})(f) ||
							(function (f) {
								if (("undefined" != typeof Symbol && null != f[Symbol.iterator]) || null != f["@@iterator"]) return Array.from(f);
							})(f) ||
							(function (f, n) {
								if (f) {
									if ("string" == typeof f) return j(f, n);
									var z = Object.prototype.toString.call(f).slice(8, -1);
									return (
										"Object" === z && f.constructor && (z = f.constructor.name),
										"Map" === z || "Set" === z
											? Array.from(f)
											: "Arguments" === z || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(z)
											? j(f, n)
											: void 0
									);
								}
							})(f) ||
							(function () {
								throw new TypeError(
									"Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
								);
							})()
						);
					}
					function j(f, n) {
						(null == n || n > f.length) && (n = f.length);
						for (var z = 0, v = new Array(n); z < n; z++) v[z] = f[z];
						return v;
					}
					Object.defineProperty(z, "__esModule", { value: !0 }),
						(z.kanaToRomaji =
							z.kanaToKatakana =
							z.kanaToHiragna =
							z.toRawRomaji =
							z.toRawKatakana =
							z.toRawHiragana =
							z.hasJapanese =
							z.hasKanji =
							z.hasKana =
							z.hasKatakana =
							z.hasHiragana =
							z.isJapanese =
							z.isKanji =
							z.isKana =
							z.isKatakana =
							z.isHiragana =
							z.patchTokens =
							z.getStrType =
							z.ROMANIZATION_SYSTEM =
								void 0);
					var x = "ぁ".charCodeAt(0) - "ァ".charCodeAt(0),
						O = "ァ".charCodeAt(0) - "ぁ".charCodeAt(0),
						P = { NIPPON: "nippon", PASSPORT: "passport", HEPBURN: "hepburn" };
					z.ROMANIZATION_SYSTEM = P;
					var h = function (f) {
						return (f = f[0]) >= "぀" && f <= "ゟ";
					};
					z.isHiragana = h;
					var c = function (f) {
						return (f = f[0]) >= "゠" && f <= "ヿ";
					};
					z.isKatakana = c;
					var l = function (f) {
						return h(f) || c(f);
					};
					z.isKana = l;
					var e = function (f) {
						return ((f = f[0]) >= "一" && f <= "鿏") || (f >= "豈" && f <= "﫿") || (f >= "㐀" && f <= "䶿");
					};
					z.isKanji = e;
					var I = function (f) {
						return l(f) || e(f);
					};
					z.isJapanese = I;
					var M = function (f) {
						for (var n = 0; n < f.length; n++) if (h(f[n])) return !0;
						return !1;
					};
					(z.hasHiragana = M),
						(z.hasKatakana = function (f) {
							for (var n = 0; n < f.length; n++) if (c(f[n])) return !0;
							return !1;
						}),
						(z.hasKana = function (f) {
							for (var n = 0; n < f.length; n++) if (l(f[n])) return !0;
							return !1;
						}),
						(z.hasKanji = function (f) {
							for (var n = 0; n < f.length; n++) if (e(f[n])) return !0;
							return !1;
						});
					var y = function (f) {
						for (var n = 0; n < f.length; n++) if (I(f[n])) return !0;
						return !1;
					};
					z.hasJapanese = y;
					var E = function (f) {
						return v(f)
							.map(function (f) {
								return f > "゠" && f < "ヷ" ? String.fromCharCode(f.charCodeAt(0) + x) : f;
							})
							.join("");
					};
					z.toRawHiragana = E;
					var r = function (f) {
						return v(f)
							.map(function (f) {
								return f > "぀" && f < "゗" ? String.fromCharCode(f.charCodeAt(0) + O) : f;
							})
							.join("");
					};
					z.toRawKatakana = r;
					var K = function (f, n) {
						var z,
							v,
							j = {
								nippon: {
									"１": "1",
									"２": "2",
									"３": "3",
									"４": "4",
									"５": "5",
									"６": "6",
									"７": "7",
									"８": "8",
									"９": "9",
									"０": "0",
									"！": "!",
									"“": '"',
									"”": '"',
									"＃": "#",
									"＄": "$",
									"％": "%",
									"＆": "&",
									"’": "'",
									"（": "(",
									"）": ")",
									"＝": "=",
									"～": "~",
									"｜": "|",
									"＠": "@",
									"‘": "`",
									"＋": "+",
									"＊": "*",
									"；": ";",
									"：": ":",
									"＜": "<",
									"＞": ">",
									"、": ",",
									"。": ".",
									"／": "/",
									"？": "?",
									"＿": "_",
									"・": "･",
									"「": '"',
									"」": '"',
									"｛": "{",
									"｝": "}",
									"￥": "\\",
									"＾": "^",
									あ: "a",
									い: "i",
									う: "u",
									え: "e",
									お: "o",
									ア: "a",
									イ: "i",
									ウ: "u",
									エ: "e",
									オ: "o",
									か: "ka",
									き: "ki",
									く: "ku",
									け: "ke",
									こ: "ko",
									カ: "ka",
									キ: "ki",
									ク: "ku",
									ケ: "ke",
									コ: "ko",
									さ: "sa",
									し: "si",
									す: "su",
									せ: "se",
									そ: "so",
									サ: "sa",
									シ: "si",
									ス: "su",
									セ: "se",
									ソ: "so",
									た: "ta",
									ち: "ti",
									つ: "tu",
									て: "te",
									と: "to",
									タ: "ta",
									チ: "ti",
									ツ: "tu",
									テ: "te",
									ト: "to",
									な: "na",
									に: "ni",
									ぬ: "nu",
									ね: "ne",
									の: "no",
									ナ: "na",
									ニ: "ni",
									ヌ: "nu",
									ネ: "ne",
									ノ: "no",
									は: "ha",
									ひ: "hi",
									ふ: "hu",
									へ: "he",
									ほ: "ho",
									ハ: "ha",
									ヒ: "hi",
									フ: "hu",
									ヘ: "he",
									ホ: "ho",
									ま: "ma",
									み: "mi",
									む: "mu",
									め: "me",
									も: "mo",
									マ: "ma",
									ミ: "mi",
									ム: "mu",
									メ: "me",
									モ: "mo",
									や: "ya",
									ゆ: "yu",
									よ: "yo",
									ヤ: "ya",
									ユ: "yu",
									ヨ: "yo",
									ら: "ra",
									り: "ri",
									る: "ru",
									れ: "re",
									ろ: "ro",
									ラ: "ra",
									リ: "ri",
									ル: "ru",
									レ: "re",
									ロ: "ro",
									わ: "wa",
									ゐ: "wi",
									ゑ: "we",
									を: "wo",
									ワ: "wa",
									ヰ: "wi",
									ヱ: "we",
									ヲ: "wo",
									が: "ga",
									ぎ: "gi",
									ぐ: "gu",
									げ: "ge",
									ご: "go",
									ガ: "ga",
									ギ: "gi",
									グ: "gu",
									ゲ: "ge",
									ゴ: "go",
									ざ: "za",
									じ: "zi",
									ず: "zu",
									ぜ: "ze",
									ぞ: "zo",
									ザ: "za",
									ジ: "zi",
									ズ: "zu",
									ゼ: "ze",
									ゾ: "zo",
									だ: "da",
									ぢ: "di",
									づ: "du",
									で: "de",
									ど: "do",
									ダ: "da",
									ヂ: "di",
									ヅ: "du",
									デ: "de",
									ド: "do",
									ば: "ba",
									び: "bi",
									ぶ: "bu",
									べ: "be",
									ぼ: "bo",
									バ: "ba",
									ビ: "bi",
									ブ: "bu",
									ベ: "be",
									ボ: "bo",
									ぱ: "pa",
									ぴ: "pi",
									ぷ: "pu",
									ぺ: "pe",
									ぽ: "po",
									パ: "pa",
									ピ: "pi",
									プ: "pu",
									ペ: "pe",
									ポ: "po",
									きゃ: "kya",
									きゅ: "kyu",
									きょ: "kyo",
									しゃ: "sya",
									しゅ: "syu",
									しょ: "syo",
									ちゃ: "tya",
									ちゅ: "tyu",
									ちょ: "tyo",
									にゃ: "nya",
									にゅ: "nyu",
									にょ: "nyo",
									ひゃ: "hya",
									ひゅ: "hyu",
									ひょ: "hyo",
									みゃ: "mya",
									みゅ: "myu",
									みょ: "myo",
									りゃ: "rya",
									りゅ: "ryu",
									りょ: "ryo",
									キャ: "kya",
									キュ: "kyu",
									キョ: "kyo",
									シャ: "sya",
									シュ: "syu",
									ショ: "syo",
									チャ: "tya",
									チュ: "tyu",
									チョ: "tyo",
									ニャ: "nya",
									ニュ: "nyu",
									ニョ: "nyo",
									ヒャ: "hya",
									ヒュ: "hyu",
									ヒョ: "hyo",
									ミャ: "mya",
									ミュ: "myu",
									ミョ: "myo",
									リャ: "rya",
									リュ: "ryu",
									リョ: "ryo",
									ぎゃ: "gya",
									ぎゅ: "gyu",
									ぎょ: "gyo",
									じゃ: "zya",
									じゅ: "zyu",
									じょ: "zyo",
									ぢゃ: "dya",
									ぢゅ: "dyu",
									ぢょ: "dyo",
									びゃ: "bya",
									びゅ: "byu",
									びょ: "byo",
									ぴゃ: "pya",
									ぴゅ: "pyu",
									ぴょ: "pyo",
									くゎ: "kwa",
									ぐゎ: "gwa",
									ギャ: "gya",
									ギュ: "gyu",
									ギョ: "gyo",
									ジャ: "zya",
									ジュ: "zyu",
									ジョ: "zyo",
									ヂャ: "dya",
									ヂュ: "dyu",
									ヂョ: "dyo",
									ビャ: "bya",
									ビュ: "byu",
									ビョ: "byo",
									ピャ: "pya",
									ピュ: "pyu",
									ピョ: "pyo",
									クヮ: "kwa",
									グヮ: "gwa",
									ぁ: "a",
									ぃ: "i",
									ぅ: "u",
									ぇ: "e",
									ぉ: "o",
									ゃ: "ya",
									ゅ: "yu",
									ょ: "yo",
									ゎ: "wa",
									ァ: "a",
									ィ: "i",
									ゥ: "u",
									ェ: "e",
									ォ: "o",
									ャ: "ya",
									ュ: "yu",
									ョ: "yo",
									ヮ: "wa",
									ヵ: "ka",
									ヶ: "ke",
									ん: "n",
									ン: "n",
									"　": " ",
									いぇ: "ye",
									きぇ: "kye",
									くぃ: "kwi",
									くぇ: "kwe",
									くぉ: "kwo",
									ぐぃ: "gwi",
									ぐぇ: "gwe",
									ぐぉ: "gwo",
									イェ: "ye",
									キェ: "kya",
									クィ: "kwi",
									クェ: "kwe",
									クォ: "kwo",
									グィ: "gwi",
									グェ: "gwe",
									グォ: "gwo",
									しぇ: "sye",
									じぇ: "zye",
									すぃ: "swi",
									ずぃ: "zwi",
									ちぇ: "tye",
									つぁ: "twa",
									つぃ: "twi",
									つぇ: "twe",
									つぉ: "two",
									にぇ: "nye",
									ひぇ: "hye",
									ふぁ: "hwa",
									ふぃ: "hwi",
									ふぇ: "hwe",
									ふぉ: "hwo",
									ふゅ: "hwyu",
									ふょ: "hwyo",
									シェ: "sye",
									ジェ: "zye",
									スィ: "swi",
									ズィ: "zwi",
									チェ: "tye",
									ツァ: "twa",
									ツィ: "twi",
									ツェ: "twe",
									ツォ: "two",
									ニェ: "nye",
									ヒェ: "hye",
									ファ: "hwa",
									フィ: "hwi",
									フェ: "hwe",
									フォ: "hwo",
									フュ: "hwyu",
									フョ: "hwyo"
								},
								passport: {
									"１": "1",
									"２": "2",
									"３": "3",
									"４": "4",
									"５": "5",
									"６": "6",
									"７": "7",
									"８": "8",
									"９": "9",
									"０": "0",
									"！": "!",
									"“": '"',
									"”": '"',
									"＃": "#",
									"＄": "$",
									"％": "%",
									"＆": "&",
									"’": "'",
									"（": "(",
									"）": ")",
									"＝": "=",
									"～": "~",
									"｜": "|",
									"＠": "@",
									"‘": "`",
									"＋": "+",
									"＊": "*",
									"；": ";",
									"：": ":",
									"＜": "<",
									"＞": ">",
									"、": ",",
									"。": ".",
									"／": "/",
									"？": "?",
									"＿": "_",
									"・": "･",
									"「": '"',
									"」": '"',
									"｛": "{",
									"｝": "}",
									"￥": "\\",
									"＾": "^",
									あ: "a",
									い: "i",
									う: "u",
									え: "e",
									お: "o",
									ア: "a",
									イ: "i",
									ウ: "u",
									エ: "e",
									オ: "o",
									か: "ka",
									き: "ki",
									く: "ku",
									け: "ke",
									こ: "ko",
									カ: "ka",
									キ: "ki",
									ク: "ku",
									ケ: "ke",
									コ: "ko",
									さ: "sa",
									し: "shi",
									す: "su",
									せ: "se",
									そ: "so",
									サ: "sa",
									シ: "shi",
									ス: "su",
									セ: "se",
									ソ: "so",
									た: "ta",
									ち: "chi",
									つ: "tsu",
									て: "te",
									と: "to",
									タ: "ta",
									チ: "chi",
									ツ: "tsu",
									テ: "te",
									ト: "to",
									な: "na",
									に: "ni",
									ぬ: "nu",
									ね: "ne",
									の: "no",
									ナ: "na",
									ニ: "ni",
									ヌ: "nu",
									ネ: "ne",
									ノ: "no",
									は: "ha",
									ひ: "hi",
									ふ: "fu",
									へ: "he",
									ほ: "ho",
									ハ: "ha",
									ヒ: "hi",
									フ: "fu",
									ヘ: "he",
									ホ: "ho",
									ま: "ma",
									み: "mi",
									む: "mu",
									め: "me",
									も: "mo",
									マ: "ma",
									ミ: "mi",
									ム: "mu",
									メ: "me",
									モ: "mo",
									や: "ya",
									ゆ: "yu",
									よ: "yo",
									ヤ: "ya",
									ユ: "yu",
									ヨ: "yo",
									ら: "ra",
									り: "ri",
									る: "ru",
									れ: "re",
									ろ: "ro",
									ラ: "ra",
									リ: "ri",
									ル: "ru",
									レ: "re",
									ロ: "ro",
									わ: "wa",
									ゐ: "i",
									ゑ: "e",
									を: "o",
									ワ: "wa",
									ヰ: "i",
									ヱ: "e",
									ヲ: "o",
									が: "ga",
									ぎ: "gi",
									ぐ: "gu",
									げ: "ge",
									ご: "go",
									ガ: "ga",
									ギ: "gi",
									グ: "gu",
									ゲ: "ge",
									ゴ: "go",
									ざ: "za",
									じ: "ji",
									ず: "zu",
									ぜ: "ze",
									ぞ: "zo",
									ザ: "za",
									ジ: "ji",
									ズ: "zu",
									ゼ: "ze",
									ゾ: "zo",
									だ: "da",
									ぢ: "ji",
									づ: "zu",
									で: "de",
									ど: "do",
									ダ: "da",
									ヂ: "ji",
									ヅ: "zu",
									デ: "de",
									ド: "do",
									ば: "ba",
									び: "bi",
									ぶ: "bu",
									べ: "be",
									ぼ: "bo",
									バ: "ba",
									ビ: "bi",
									ブ: "bu",
									ベ: "be",
									ボ: "bo",
									ぱ: "pa",
									ぴ: "pi",
									ぷ: "pu",
									ぺ: "pe",
									ぽ: "po",
									パ: "pa",
									ピ: "pi",
									プ: "pu",
									ペ: "pe",
									ポ: "po",
									きゃ: "kya",
									きゅ: "kyu",
									きょ: "kyo",
									しゃ: "sha",
									しゅ: "shu",
									しょ: "sho",
									ちゃ: "cha",
									ちゅ: "chu",
									ちょ: "cho",
									にゃ: "nya",
									にゅ: "nyu",
									にょ: "nyo",
									ひゃ: "hya",
									ひゅ: "hyu",
									ひょ: "hyo",
									みゃ: "mya",
									みゅ: "myu",
									みょ: "myo",
									りゃ: "rya",
									りゅ: "ryu",
									りょ: "ryo",
									キャ: "kya",
									キュ: "kyu",
									キョ: "kyo",
									シャ: "sha",
									シュ: "shu",
									ショ: "sho",
									チャ: "cha",
									チュ: "chu",
									チョ: "cho",
									ニャ: "nya",
									ニュ: "nyu",
									ニョ: "nyo",
									ヒャ: "hya",
									ヒュ: "hyu",
									ヒョ: "hyo",
									ミャ: "mya",
									ミュ: "myu",
									ミョ: "myo",
									リャ: "rya",
									リュ: "ryu",
									リョ: "ryo",
									ぎゃ: "gya",
									ぎゅ: "gyu",
									ぎょ: "gyo",
									じゃ: "ja",
									じゅ: "ju",
									じょ: "jo",
									ぢゃ: "ja",
									ぢゅ: "ju",
									ぢょ: "jo",
									びゃ: "bya",
									びゅ: "byu",
									びょ: "byo",
									ぴゃ: "pya",
									ぴゅ: "pyu",
									ぴょ: "pyo",
									ギャ: "gya",
									ギュ: "gyu",
									ギョ: "gyo",
									ジャ: "ja",
									ジュ: "ju",
									ジョ: "jo",
									ヂャ: "ja",
									ヂュ: "ju",
									ヂョ: "jo",
									ビャ: "bya",
									ビュ: "byu",
									ビョ: "byo",
									ピャ: "pya",
									ピュ: "pyu",
									ピョ: "pyo",
									ぁ: "a",
									ぃ: "i",
									ぅ: "u",
									ぇ: "e",
									ぉ: "o",
									ゃ: "ya",
									ゅ: "yu",
									ょ: "yo",
									ゎ: "wa",
									ァ: "a",
									ィ: "i",
									ゥ: "u",
									ェ: "e",
									ォ: "o",
									ャ: "ya",
									ュ: "yu",
									ョ: "yo",
									ヮ: "wa",
									ヵ: "ka",
									ヶ: "ke",
									ん: "n",
									ン: "n",
									"　": " ",
									ヴ: "b"
								},
								hepburn: {
									"１": "1",
									"２": "2",
									"３": "3",
									"４": "4",
									"５": "5",
									"６": "6",
									"７": "7",
									"８": "8",
									"９": "9",
									"０": "0",
									"！": "!",
									"“": '"',
									"”": '"',
									"＃": "#",
									"＄": "$",
									"％": "%",
									"＆": "&",
									"’": "'",
									"（": "(",
									"）": ")",
									"＝": "=",
									"～": "~",
									"｜": "|",
									"＠": "@",
									"‘": "`",
									"＋": "+",
									"＊": "*",
									"；": ";",
									"：": ":",
									"＜": "<",
									"＞": ">",
									"、": ",",
									"。": ".",
									"／": "/",
									"？": "?",
									"＿": "_",
									"・": "･",
									"「": '"',
									"」": '"',
									"｛": "{",
									"｝": "}",
									"￥": "\\",
									"＾": "^",
									あ: "a",
									い: "i",
									う: "u",
									え: "e",
									お: "o",
									ア: "a",
									イ: "i",
									ウ: "u",
									エ: "e",
									オ: "o",
									か: "ka",
									き: "ki",
									く: "ku",
									け: "ke",
									こ: "ko",
									カ: "ka",
									キ: "ki",
									ク: "ku",
									ケ: "ke",
									コ: "ko",
									さ: "sa",
									し: "shi",
									す: "su",
									せ: "se",
									そ: "so",
									サ: "sa",
									シ: "shi",
									ス: "su",
									セ: "se",
									ソ: "so",
									た: "ta",
									ち: "chi",
									つ: "tsu",
									て: "te",
									と: "to",
									タ: "ta",
									チ: "chi",
									ツ: "tsu",
									テ: "te",
									ト: "to",
									な: "na",
									に: "ni",
									ぬ: "nu",
									ね: "ne",
									の: "no",
									ナ: "na",
									ニ: "ni",
									ヌ: "nu",
									ネ: "ne",
									ノ: "no",
									は: "ha",
									ひ: "hi",
									ふ: "fu",
									へ: "he",
									ほ: "ho",
									ハ: "ha",
									ヒ: "hi",
									フ: "fu",
									ヘ: "he",
									ホ: "ho",
									ま: "ma",
									み: "mi",
									む: "mu",
									め: "me",
									も: "mo",
									マ: "ma",
									ミ: "mi",
									ム: "mu",
									メ: "me",
									モ: "mo",
									や: "ya",
									ゆ: "yu",
									よ: "yo",
									ヤ: "ya",
									ユ: "yu",
									ヨ: "yo",
									ら: "ra",
									り: "ri",
									る: "ru",
									れ: "re",
									ろ: "ro",
									ラ: "ra",
									リ: "ri",
									ル: "ru",
									レ: "re",
									ロ: "ro",
									わ: "wa",
									ゐ: "i",
									ゑ: "e",
									を: "o",
									ワ: "wa",
									ヰ: "i",
									ヱ: "e",
									ヲ: "o",
									が: "ga",
									ぎ: "gi",
									ぐ: "gu",
									げ: "ge",
									ご: "go",
									ガ: "ga",
									ギ: "gi",
									グ: "gu",
									ゲ: "ge",
									ゴ: "go",
									ざ: "za",
									じ: "ji",
									ず: "zu",
									ぜ: "ze",
									ぞ: "zo",
									ザ: "za",
									ジ: "ji",
									ズ: "zu",
									ゼ: "ze",
									ゾ: "zo",
									だ: "da",
									ぢ: "ji",
									づ: "zu",
									で: "de",
									ど: "do",
									ダ: "da",
									ヂ: "ji",
									ヅ: "zu",
									デ: "de",
									ド: "do",
									ば: "ba",
									び: "bi",
									ぶ: "bu",
									べ: "be",
									ぼ: "bo",
									バ: "ba",
									ビ: "bi",
									ブ: "bu",
									ベ: "be",
									ボ: "bo",
									ぱ: "pa",
									ぴ: "pi",
									ぷ: "pu",
									ぺ: "pe",
									ぽ: "po",
									パ: "pa",
									ピ: "pi",
									プ: "pu",
									ペ: "pe",
									ポ: "po",
									きゃ: "kya",
									きゅ: "kyu",
									きょ: "kyo",
									しゃ: "sha",
									しゅ: "shu",
									しょ: "sho",
									ちゃ: "cha",
									ちゅ: "chu",
									ちょ: "cho",
									にゃ: "nya",
									にゅ: "nyu",
									にょ: "nyo",
									ひゃ: "hya",
									ひゅ: "hyu",
									ひょ: "hyo",
									みゃ: "mya",
									みゅ: "myu",
									みょ: "myo",
									りゃ: "rya",
									りゅ: "ryu",
									りょ: "ryo",
									キャ: "kya",
									キュ: "kyu",
									キョ: "kyo",
									シャ: "sha",
									シュ: "shu",
									ショ: "sho",
									チャ: "cha",
									チュ: "chu",
									チョ: "cho",
									ニャ: "nya",
									ニュ: "nyu",
									ニョ: "nyo",
									ヒャ: "hya",
									ヒュ: "hyu",
									ヒョ: "hyo",
									ミャ: "mya",
									ミュ: "myu",
									ミョ: "myo",
									リャ: "rya",
									リュ: "ryu",
									リョ: "ryo",
									ぎゃ: "gya",
									ぎゅ: "gyu",
									ぎょ: "gyo",
									じゃ: "ja",
									じゅ: "ju",
									じょ: "jo",
									ぢゃ: "ja",
									ぢゅ: "ju",
									ぢょ: "jo",
									びゃ: "bya",
									びゅ: "byu",
									びょ: "byo",
									ぴゃ: "pya",
									ぴゅ: "pyu",
									ぴょ: "pyo",
									ギャ: "gya",
									ギュ: "gyu",
									ギョ: "gyo",
									ジャ: "ja",
									ジュ: "ju",
									ジョ: "jo",
									ヂャ: "ja",
									ヂュ: "ju",
									ヂョ: "jo",
									ビャ: "bya",
									ビュ: "byu",
									ビョ: "byo",
									ピャ: "pya",
									ピュ: "pyu",
									ピョ: "pyo",
									ぁ: "a",
									ぃ: "i",
									ぅ: "u",
									ぇ: "e",
									ぉ: "o",
									ゃ: "ya",
									ゅ: "yu",
									ょ: "yo",
									ゎ: "wa",
									ァ: "a",
									ィ: "i",
									ゥ: "u",
									ェ: "e",
									ォ: "o",
									ャ: "ya",
									ュ: "yu",
									ョ: "yo",
									ヮ: "wa",
									ヵ: "ka",
									ヶ: "ke",
									ん: "n",
									ン: "n",
									"　": " ",
									いぇ: "ye",
									うぃ: "wi",
									うぇ: "we",
									うぉ: "wo",
									きぇ: "kye",
									くぁ: "kwa",
									くぃ: "kwi",
									くぇ: "kwe",
									くぉ: "kwo",
									ぐぁ: "gwa",
									ぐぃ: "gwi",
									ぐぇ: "gwe",
									ぐぉ: "gwo",
									イェ: "ye",
									ウィ: "wi",
									ウェ: "we",
									ウォ: "wo",
									ヴ: "vu",
									ヴァ: "va",
									ヴィ: "vi",
									ヴェ: "ve",
									ヴォ: "vo",
									ヴュ: "vyu",
									ヴョ: "vyo",
									キェ: "kya",
									クァ: "kwa",
									クィ: "kwi",
									クェ: "kwe",
									クォ: "kwo",
									グァ: "gwa",
									グィ: "gwi",
									グェ: "gwe",
									グォ: "gwo",
									しぇ: "she",
									じぇ: "je",
									ちぇ: "che",
									つぁ: "tsa",
									つぃ: "tsi",
									つぇ: "tse",
									つぉ: "tso",
									てぃ: "ti",
									てゅ: "tyu",
									でぃ: "di",
									でゅ: "dyu",
									とぅ: "tu",
									どぅ: "du",
									にぇ: "nye",
									ひぇ: "hye",
									ふぁ: "fa",
									ふぃ: "fi",
									ふぇ: "fe",
									ふぉ: "fo",
									ふゅ: "fyu",
									ふょ: "fyo",
									シェ: "she",
									ジェ: "je",
									チェ: "che",
									ツァ: "tsa",
									ツィ: "tsi",
									ツェ: "tse",
									ツォ: "tso",
									ティ: "ti",
									テュ: "tyu",
									ディ: "di",
									デュ: "dyu",
									トゥ: "tu",
									ドゥ: "du",
									ニェ: "nye",
									ヒェ: "hye",
									ファ: "fa",
									フィ: "fi",
									フェ: "fe",
									フォ: "fo",
									フュ: "fyu",
									フョ: "fyo"
								}
							},
							x = 0,
							O = "";
						if (((n = n || P.HEPBURN) === P.PASSPORT && (f = f.replace(/ー/gm, "")), n === P.NIPPON || n === P.HEPBURN)) {
							for (
								var h,
									c = new RegExp(/(ん|ン)(?=あ|い|う|え|お|ア|イ|ウ|エ|オ|ぁ|ぃ|ぅ|ぇ|ぉ|ァ|ィ|ゥ|ェ|ォ|や|ゆ|よ|ヤ|ユ|ヨ|ゃ|ゅ|ょ|ャ|ュ|ョ)/g),
									l = [];
								null !== (h = c.exec(f));

							)
								l.push(h.index + 1);
							if (0 !== l.length) {
								for (var e = "", I = 0; I < l.length; I++) e += "".concat(0 === I ? f.slice(0, l[I]) : f.slice(l[I - 1], l[I]), "'");
								(e += f.slice(l[l.length - 1])), (f = e);
							}
						}
						for (var M = f.length; x <= M; )
							(v = j[n][f.substring(x, x + 2)]) ? ((O += v), (x += 2)) : ((O += (v = j[n][(z = f.substring(x, x + 1))]) ? v : z), (x += 1));
						return (
							(O = O.replace(/(っ|ッ)([bcdfghijklmnopqrstuvwyz])/gm, "$2$2")),
							(n !== P.PASSPORT && n !== P.HEPBURN) || (O = O.replace(/cc/gm, "tc")),
							(O = O.replace(/っ|ッ/gm, "tsu")),
							(n !== P.PASSPORT && n !== P.HEPBURN) || (O = (O = (O = O.replace(/nm/gm, "mm")).replace(/nb/gm, "mb")).replace(/np/gm, "mp")),
							n === P.NIPPON &&
								(O = (O = (O = (O = (O = O.replace(/aー/gm, "â")).replace(/iー/gm, "î")).replace(/uー/gm, "û")).replace(/eー/gm, "ê")).replace(
									/oー/gm,
									"ô"
								)),
							n === P.HEPBURN &&
								(O = (O = (O = (O = (O = O.replace(/aー/gm, "ā")).replace(/iー/gm, "ī")).replace(/uー/gm, "ū")).replace(/eー/gm, "ē")).replace(
									/oー/gm,
									"ō"
								)),
							O
						);
					};
					(z.toRawRomaji = K),
						(z.getStrType = function (f) {
							for (var n = !1, z = !1, v = 0; v < f.length; v++) e(f[v]) ? (n = !0) : (h(f[v]) || c(f[v])) && (z = !0);
							return n && z ? 1 : n ? 0 : z ? 2 : 3;
						}),
						(z.patchTokens = function (f) {
							for (var n = 0; n < f.length; n++)
								y(f[n].surface_form)
									? f[n].reading
										? M(f[n].reading) && (f[n].reading = r(f[n].reading))
										: f[n].surface_form.split("").every(l)
										? (f[n].reading = r(f[n].surface_form))
										: (f[n].reading = f[n].surface_form)
									: (f[n].reading = f[n].surface_form);
							for (var z = 0; z < f.length; z++)
								!f[z].pos ||
									"助動詞" !== f[z].pos ||
									("う" !== f[z].surface_form && "ウ" !== f[z].surface_form) ||
									(z - 1 >= 0 &&
										f[z - 1].pos &&
										"動詞" === f[z - 1].pos &&
										((f[z - 1].surface_form += "う"),
										f[z - 1].pronunciation ? (f[z - 1].pronunciation += "ー") : (f[z - 1].pronunciation = "".concat(f[z - 1].reading, "ー")),
										(f[z - 1].reading += "ウ"),
										f.splice(z, 1),
										z--));
							for (var v = 0; v < f.length; v++)
								f[v].pos &&
									("動詞" === f[v].pos || "形容詞" === f[v].pos) &&
									f[v].surface_form.length > 1 &&
									("っ" === f[v].surface_form[f[v].surface_form.length - 1] || "ッ" === f[v].surface_form[f[v].surface_form.length - 1]) &&
									v + 1 < f.length &&
									((f[v].surface_form += f[v + 1].surface_form),
									f[v].pronunciation
										? (f[v].pronunciation += f[v + 1].pronunciation)
										: (f[v].pronunciation = "".concat(f[v].reading).concat(f[v + 1].reading)),
									(f[v].reading += f[v + 1].reading),
									f.splice(v + 1, 1),
									v--);
							return f;
						}),
						(z.kanaToHiragna = function (f) {
							return E(f);
						}),
						(z.kanaToKatakana = function (f) {
							return r(f);
						}),
						(z.kanaToRomaji = function (f, n) {
							return K(f, n);
						});
				},
				{}
			]
		},
		{},
		[4]
	)(4);
}),
	(function (f) {
		"object" == typeof exports && "undefined" != typeof module
			? (module.exports = f())
			: "function" == typeof define && define.amd
			? define([], f)
			: (("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).KuromojiAnalyzer =
					f());
	})(function () {
		return (function f(n, z, v) {
			function j(O, P) {
				if (!z[O]) {
					if (!n[O]) {
						var h = "function" == typeof require && require;
						if (!P && h) return h(O, !0);
						if (x) return x(O, !0);
						var c = new Error("Cannot find module '" + O + "'");
						throw ((c.code = "MODULE_NOT_FOUND"), c);
					}
					var l = (z[O] = { exports: {} });
					n[O][0].call(
						l.exports,
						function (f) {
							return j(n[O][1][f] || f);
						},
						l,
						l.exports,
						f,
						n,
						z,
						v
					);
				}
				return z[O].exports;
			}
			for (var x = "function" == typeof require && require, O = 0; O < v.length; O++) j(v[O]);
			return j;
		})(
			{
				1: [
					function (f, n, z) {
						(function (f, v, j) {
							!(function (f, v) {
								v("object" == typeof z && void 0 !== n ? z : (f.async = f.async || {}));
							})(this, function (z) {
								"use strict";
								function x(f, n) {
									n |= 0;
									for (var z = Math.max(f.length - n, 0), v = Array(z), j = 0; j < z; j++) v[j] = f[n + j];
									return v;
								}
								var O = function (f) {
										var n = x(arguments, 1);
										return function () {
											var z = x(arguments);
											return f.apply(null, n.concat(z));
										};
									},
									P = function (f) {
										return function () {
											var n = x(arguments),
												z = n.pop();
											f.call(this, n, z);
										};
									};
								function h(f) {
									var n = typeof f;
									return null != f && ("object" == n || "function" == n);
								}
								var c = "function" == typeof j && j,
									l = "object" == typeof f && "function" == typeof f.nextTick;
								function e(f) {
									setTimeout(f, 0);
								}
								function I(f) {
									return function (n) {
										var z = x(arguments, 1);
										f(function () {
											n.apply(null, z);
										});
									};
								}
								var M = I(c ? j : l ? f.nextTick : e);
								function y(f) {
									return P(function (n, z) {
										var v;
										try {
											v = f.apply(this, n);
										} catch (f) {
											return z(f);
										}
										h(v) && "function" == typeof v.then
											? v.then(
													function (f) {
														E(z, null, f);
													},
													function (f) {
														E(z, f.message ? f : new Error(f));
													}
											  )
											: z(null, v);
									});
								}
								function E(f, n, z) {
									try {
										f(n, z);
									} catch (f) {
										M(r, f);
									}
								}
								function r(f) {
									throw f;
								}
								var K = "function" == typeof Symbol;
								function A(f) {
									return K && "AsyncFunction" === f[Symbol.toStringTag];
								}
								function i(f) {
									return A(f) ? y(f) : f;
								}
								function t(f) {
									return function (n) {
										var z = x(arguments, 1),
											v = P(function (z, v) {
												var j = this;
												return f(
													n,
													function (f, n) {
														i(f).apply(j, z.concat(n));
													},
													v
												);
											});
										return z.length ? v.apply(this, z) : v;
									};
								}
								var X = "object" == typeof v && v && v.Object === Object && v,
									Z = "object" == typeof self && self && self.Object === Object && self,
									p = X || Z || Function("return this")(),
									H = p.Symbol,
									u = Object.prototype,
									S = u.hasOwnProperty,
									G = u.toString,
									T = H ? H.toStringTag : void 0,
									W = Object.prototype.toString,
									Q = H ? H.toStringTag : void 0;
								function a(f) {
									return null == f
										? void 0 === f
											? "[object Undefined]"
											: "[object Null]"
										: Q && Q in Object(f)
										? (function (f) {
												var n = S.call(f, T),
													z = f[T];
												try {
													f[T] = void 0;
													var v = !0;
												} catch (f) {}
												var j = G.call(f);
												return v && (n ? (f[T] = z) : delete f[T]), j;
										  })(f)
										: (function (f) {
												return W.call(f);
										  })(f);
								}
								function J(f) {
									return "number" == typeof f && f > -1 && f % 1 == 0 && f <= 9007199254740991;
								}
								function U(f) {
									return (
										null != f &&
										J(f.length) &&
										!(function (f) {
											if (!h(f)) return !1;
											var n = a(f);
											return "[object Function]" == n || "[object GeneratorFunction]" == n || "[object AsyncFunction]" == n || "[object Proxy]" == n;
										})(f)
									);
								}
								var Y = {};
								function o() {}
								function k(f) {
									return function () {
										if (null !== f) {
											var n = f;
											(f = null), n.apply(this, arguments);
										}
									};
								}
								var d = "function" == typeof Symbol && Symbol.iterator;
								function m(f) {
									return null != f && "object" == typeof f;
								}
								function C(f) {
									return m(f) && "[object Arguments]" == a(f);
								}
								var R = Object.prototype,
									L = R.hasOwnProperty,
									s = R.propertyIsEnumerable,
									b = C(
										(function () {
											return arguments;
										})()
									)
										? C
										: function (f) {
												return m(f) && L.call(f, "callee") && !s.call(f, "callee");
										  },
									V = Array.isArray,
									q = "object" == typeof z && z && !z.nodeType && z,
									D = q && "object" == typeof n && n && !n.nodeType && n,
									N = D && D.exports === q ? p.Buffer : void 0,
									F =
										(N ? N.isBuffer : void 0) ||
										function () {
											return !1;
										},
									w = /^(?:0|[1-9]\d*)$/;
								function g(f, n) {
									var z = typeof f;
									return !!(n = null == n ? 9007199254740991 : n) && ("number" == z || ("symbol" != z && w.test(f))) && f > -1 && f % 1 == 0 && f < n;
								}
								var B = {};
								(B["[object Float32Array]"] =
									B["[object Float64Array]"] =
									B["[object Int8Array]"] =
									B["[object Int16Array]"] =
									B["[object Int32Array]"] =
									B["[object Uint8Array]"] =
									B["[object Uint8ClampedArray]"] =
									B["[object Uint16Array]"] =
									B["[object Uint32Array]"] =
										!0),
									(B["[object Arguments]"] =
										B["[object Array]"] =
										B["[object ArrayBuffer]"] =
										B["[object Boolean]"] =
										B["[object DataView]"] =
										B["[object Date]"] =
										B["[object Error]"] =
										B["[object Function]"] =
										B["[object Map]"] =
										B["[object Number]"] =
										B["[object Object]"] =
										B["[object RegExp]"] =
										B["[object Set]"] =
										B["[object String]"] =
										B["[object WeakMap]"] =
											!1);
								var _,
									$ = "object" == typeof z && z && !z.nodeType && z,
									ff = $ && "object" == typeof n && n && !n.nodeType && n,
									nf = ff && ff.exports === $ && X.process,
									zf = (function () {
										try {
											return (ff && ff.require && ff.require("util").types) || (nf && nf.binding && nf.binding("util"));
										} catch (f) {}
									})(),
									vf = zf && zf.isTypedArray,
									jf = vf
										? ((_ = vf),
										  function (f) {
												return _(f);
										  })
										: function (f) {
												return m(f) && J(f.length) && !!B[a(f)];
										  },
									xf = Object.prototype.hasOwnProperty;
								var Of = Object.prototype,
									Pf = (function (f, n) {
										return function (z) {
											return f(n(z));
										};
									})(Object.keys, Object),
									hf = Object.prototype.hasOwnProperty;
								function cf(f) {
									return U(f)
										? (function (f, n) {
												var z = V(f),
													v = !z && b(f),
													j = !z && !v && F(f),
													x = !z && !v && !j && jf(f),
													O = z || v || j || x,
													P = O
														? (function (f, n) {
																for (var z = -1, v = Array(f); ++z < f; ) v[z] = n(z);
																return v;
														  })(f.length, String)
														: [],
													h = P.length;
												for (var c in f)
													(!n && !xf.call(f, c)) ||
														(O &&
															("length" == c ||
																(j && ("offset" == c || "parent" == c)) ||
																(x && ("buffer" == c || "byteLength" == c || "byteOffset" == c)) ||
																g(c, h))) ||
														P.push(c);
												return P;
										  })(f)
										: (function (f) {
												if (((z = (n = f) && n.constructor), n !== (("function" == typeof z && z.prototype) || Of))) return Pf(f);
												var n,
													z,
													v = [];
												for (var j in Object(f)) hf.call(f, j) && "constructor" != j && v.push(j);
												return v;
										  })(f);
								}
								function lf(f) {
									return function () {
										if (null === f) throw new Error("Callback was already called.");
										var n = f;
										(f = null), n.apply(this, arguments);
									};
								}
								function ef(f) {
									return function (n, z, v) {
										if (((v = k(v || o)), f <= 0 || !n)) return v(null);
										var j = (function (f) {
												if (U(f))
													return (function (f) {
														var n = -1,
															z = f.length;
														return function () {
															return ++n < z ? { value: f[n], key: n } : null;
														};
													})(f);
												var n,
													z,
													v,
													j,
													x = (function (f) {
														return d && f[d] && f[d]();
													})(f);
												return x
													? (function (f) {
															var n = -1;
															return function () {
																var z = f.next();
																return z.done ? null : (n++, { value: z.value, key: n });
															};
													  })(x)
													: ((z = cf((n = f))),
													  (v = -1),
													  (j = z.length),
													  function () {
															var f = z[++v];
															return v < j ? { value: n[f], key: f } : null;
													  });
											})(n),
											x = !1,
											O = 0,
											P = !1;
										function h(f, n) {
											if (((O -= 1), f)) (x = !0), v(f);
											else {
												if (n === Y || (x && O <= 0)) return (x = !0), v(null);
												P || c();
											}
										}
										function c() {
											for (P = !0; O < f && !x; ) {
												var n = j();
												if (null === n) return (x = !0), void (O <= 0 && v(null));
												(O += 1), z(n.value, n.key, lf(h));
											}
											P = !1;
										}
										c();
									};
								}
								function If(f, n, z, v) {
									ef(n)(f, i(z), v);
								}
								function Mf(f, n) {
									return function (z, v, j) {
										return f(z, n, v, j);
									};
								}
								function yf(f, n, z) {
									z = k(z || o);
									var v = 0,
										j = 0,
										x = f.length;
									function O(f, n) {
										f ? z(f) : (++j !== x && n !== Y) || z(null);
									}
									for (0 === x && z(null); v < x; v++) n(f[v], v, lf(O));
								}
								var Ef = Mf(If, 1 / 0),
									rf = function (f, n, z) {
										(U(f) ? yf : Ef)(f, i(n), z);
									};
								function Kf(f) {
									return function (n, z, v) {
										return f(rf, n, i(z), v);
									};
								}
								function Af(f, n, z, v) {
									(v = v || o), (n = n || []);
									var j = [],
										x = 0,
										O = i(z);
									f(
										n,
										function (f, n, z) {
											var v = x++;
											O(f, function (f, n) {
												(j[v] = n), z(f);
											});
										},
										function (f) {
											v(f, j);
										}
									);
								}
								var tf = Kf(Af),
									Xf = t(tf);
								function Zf(f) {
									return function (n, z, v, j) {
										return f(ef(z), n, i(v), j);
									};
								}
								var pf = Zf(Af),
									Hf = Mf(pf, 1),
									uf = t(Hf);
								function Sf(f, n) {
									for (var z = -1, v = null == f ? 0 : f.length; ++z < v && !1 !== n(f[z], z, f); );
									return f;
								}
								function Gf(f, n) {
									return (
										f &&
										(function (f, n, z) {
											for (var v = -1, j = Object(f), x = z(f), O = x.length; O--; ) {
												var P = x[++v];
												if (!1 === n(j[P], P, j)) break;
											}
											return f;
										})(f, n, cf)
									);
								}
								function Tf(f) {
									return f != f;
								}
								function Wf(f, n, z) {
									return n == n
										? (function (f, n, z) {
												for (var v = z - 1, j = f.length; ++v < j; ) if (f[v] === n) return v;
												return -1;
										  })(f, n, z)
										: (function (f, n, z, v) {
												for (var j = f.length, x = z + -1; ++x < j; ) if (n(f[x], x, f)) return x;
												return -1;
										  })(f, Tf, z);
								}
								var Qf = function (f, n, z) {
									"function" == typeof n && ((z = n), (n = null)), (z = k(z || o));
									var v = cf(f).length;
									if (!v) return z(null);
									n || (n = v);
									var j = {},
										O = 0,
										P = !1,
										h = Object.create(null),
										c = [],
										l = [],
										e = {};
									function I(f, n) {
										c.push(function () {
											!(function (f, n) {
												if (!P) {
													var v = lf(function (n, v) {
														if ((O--, arguments.length > 2 && (v = x(arguments, 1)), n)) {
															var c = {};
															Gf(j, function (f, n) {
																c[n] = f;
															}),
																(c[f] = v),
																(P = !0),
																(h = Object.create(null)),
																z(n, c);
														} else (j[f] = v), y(f);
													});
													O++;
													var c = i(n[n.length - 1]);
													n.length > 1 ? c(j, v) : c(v);
												}
											})(f, n);
										});
									}
									function M() {
										if (0 === c.length && 0 === O) return z(null, j);
										for (; c.length && O < n; ) c.shift()();
									}
									function y(f) {
										Sf(h[f] || [], function (f) {
											f();
										}),
											M();
									}
									function E(n) {
										var z = [];
										return (
											Gf(f, function (f, v) {
												V(f) && Wf(f, n, 0) >= 0 && z.push(v);
											}),
											z
										);
									}
									Gf(f, function (n, z) {
										if (!V(n)) return I(z, [n]), void l.push(z);
										var v = n.slice(0, n.length - 1),
											j = v.length;
										if (0 === j) return I(z, n), void l.push(z);
										(e[z] = j),
											Sf(v, function (x) {
												if (!f[x]) throw new Error("async.auto task `" + z + "` has a non-existent dependency `" + x + "` in " + v.join(", "));
												!(function (f, n) {
													var z = h[f];
													z || (z = h[f] = []), z.push(n);
												})(x, function () {
													0 == --j && I(z, n);
												});
											});
									}),
										(function () {
											for (var f = 0; l.length; )
												f++,
													Sf(E(l.pop()), function (f) {
														0 == --e[f] && l.push(f);
													});
											if (f !== v) throw new Error("async.auto cannot execute tasks due to a recursive dependency");
										})(),
										M();
								};
								function af(f, n) {
									for (var z = -1, v = null == f ? 0 : f.length, j = Array(v); ++z < v; ) j[z] = n(f[z], z, f);
									return j;
								}
								var Jf = H ? H.prototype : void 0,
									Uf = Jf ? Jf.toString : void 0;
								function Yf(f) {
									if ("string" == typeof f) return f;
									if (V(f)) return af(f, Yf) + "";
									if (
										(function (f) {
											return "symbol" == typeof f || (m(f) && "[object Symbol]" == a(f));
										})(f)
									)
										return Uf ? Uf.call(f) : "";
									var n = f + "";
									return "0" == n && 1 / f == -1 / 0 ? "-0" : n;
								}
								var of = RegExp("[\\u200d\\ud800-\\udfff\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff\\ufe0e\\ufe0f]"),
									kf = "[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]",
									df = "\\ud83c[\\udffb-\\udfff]",
									mf = "[^\\ud800-\\udfff]",
									Cf = "(?:\\ud83c[\\udde6-\\uddff]){2}",
									Rf = "[\\ud800-\\udbff][\\udc00-\\udfff]",
									Lf = "(?:" + kf + "|" + df + ")?",
									sf = "[\\ufe0e\\ufe0f]?",
									bf = sf + Lf + "(?:\\u200d(?:" + [mf, Cf, Rf].join("|") + ")" + sf + Lf + ")*",
									Vf = "(?:" + [mf + kf + "?", kf, Cf, Rf, "[\\ud800-\\udfff]"].join("|") + ")",
									qf = RegExp(df + "(?=" + df + ")|" + Vf + bf, "g");
								function Df(f) {
									return (function (f) {
										return of.test(f);
									})(f)
										? (function (f) {
												return f.match(qf) || [];
										  })(f)
										: (function (f) {
												return f.split("");
										  })(f);
								}
								var Nf = /^\s+|\s+$/g;
								function Ff(f, n, z) {
									var v;
									if ((f = null == (v = f) ? "" : Yf(v)) && (z || void 0 === n)) return f.replace(Nf, "");
									if (!f || !(n = Yf(n))) return f;
									var j = Df(f),
										x = Df(n),
										O = (function (f, n) {
											for (var z = -1, v = f.length; ++z < v && Wf(n, f[z], 0) > -1; );
											return z;
										})(j, x),
										P =
											(function (f, n) {
												for (var z = f.length; z-- && Wf(n, f[z], 0) > -1; );
												return z;
											})(j, x) + 1;
									return (function (f, n, z) {
										var v = f.length;
										return (
											(z = void 0 === z ? v : z),
											!n && z >= v
												? f
												: (function (f, n, z) {
														var v = -1,
															j = f.length;
														n < 0 && (n = -n > j ? 0 : j + n), (z = z > j ? j : z) < 0 && (z += j), (j = n > z ? 0 : (z - n) >>> 0), (n >>>= 0);
														for (var x = Array(j); ++v < j; ) x[v] = f[v + n];
														return x;
												  })(f, n, z)
										);
									})(j, O, P).join("");
								}
								var wf = /^(?:async\s+)?(function)?\s*[^\(]*\(\s*([^\)]*)\)/m,
									gf = /,/,
									Bf = /(=.+)?(\s*)$/,
									_f = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
								function $f(f, n) {
									var z = {};
									Gf(f, function (f, n) {
										var v,
											j = A(f),
											x = (!j && 1 === f.length) || (j && 0 === f.length);
										if (V(f)) (v = f.slice(0, -1)), (f = f[f.length - 1]), (z[n] = v.concat(v.length > 0 ? O : f));
										else if (x) z[n] = f;
										else {
											if (
												((v = (function (f) {
													return (f = (f = (f = f.toString().replace(_f, "")).match(wf)[2].replace(" ", "")) ? f.split(gf) : []).map(function (f) {
														return Ff(f.replace(Bf, ""));
													});
												})(f)),
												0 === f.length && !j && 0 === v.length)
											)
												throw new Error("autoInject task functions require explicit parameters.");
											j || v.pop(), (z[n] = v.concat(O));
										}
										function O(n, z) {
											var j = af(v, function (f) {
												return n[f];
											});
											j.push(z), i(f).apply(null, j);
										}
									}),
										Qf(z, n);
								}
								function fn() {
									(this.head = this.tail = null), (this.length = 0);
								}
								function nn(f, n) {
									(f.length = 1), (f.head = f.tail = n);
								}
								function zn(f, n, z) {
									if (null == n) n = 1;
									else if (0 === n) throw new Error("Concurrency must not be zero");
									var v = i(f),
										j = 0,
										x = [],
										O = !1;
									function P(f, n, z) {
										if (null != z && "function" != typeof z) throw new Error("task callback must be a function");
										if (((l.started = !0), V(f) || (f = [f]), 0 === f.length && l.idle()))
											return M(function () {
												l.drain();
											});
										for (var v = 0, j = f.length; v < j; v++) {
											var x = { data: f[v], callback: z || o };
											n ? l._tasks.unshift(x) : l._tasks.push(x);
										}
										O ||
											((O = !0),
											M(function () {
												(O = !1), l.process();
											}));
									}
									function h(f) {
										return function (n) {
											j -= 1;
											for (var z = 0, v = f.length; z < v; z++) {
												var O = f[z],
													P = Wf(x, O, 0);
												0 === P ? x.shift() : P > 0 && x.splice(P, 1), O.callback.apply(O, arguments), null != n && l.error(n, O.data);
											}
											j <= l.concurrency - l.buffer && l.unsaturated(), l.idle() && l.drain(), l.process();
										};
									}
									var c = !1,
										l = {
											_tasks: new fn(),
											concurrency: n,
											payload: z,
											saturated: o,
											unsaturated: o,
											buffer: n / 4,
											empty: o,
											drain: o,
											error: o,
											started: !1,
											paused: !1,
											push: function (f, n) {
												P(f, !1, n);
											},
											kill: function () {
												(l.drain = o), l._tasks.empty();
											},
											unshift: function (f, n) {
												P(f, !0, n);
											},
											remove: function (f) {
												l._tasks.remove(f);
											},
											process: function () {
												if (!c) {
													for (c = !0; !l.paused && j < l.concurrency && l._tasks.length; ) {
														var f = [],
															n = [],
															z = l._tasks.length;
														l.payload && (z = Math.min(z, l.payload));
														for (var O = 0; O < z; O++) {
															var P = l._tasks.shift();
															f.push(P), x.push(P), n.push(P.data);
														}
														(j += 1), 0 === l._tasks.length && l.empty(), j === l.concurrency && l.saturated();
														var e = lf(h(f));
														v(n, e);
													}
													c = !1;
												}
											},
											length: function () {
												return l._tasks.length;
											},
											running: function () {
												return j;
											},
											workersList: function () {
												return x;
											},
											idle: function () {
												return l._tasks.length + j === 0;
											},
											pause: function () {
												l.paused = !0;
											},
											resume: function () {
												!1 !== l.paused && ((l.paused = !1), M(l.process));
											}
										};
									return l;
								}
								function vn(f, n) {
									return zn(f, 1, n);
								}
								(fn.prototype.removeLink = function (f) {
									return (
										f.prev ? (f.prev.next = f.next) : (this.head = f.next),
										f.next ? (f.next.prev = f.prev) : (this.tail = f.prev),
										(f.prev = f.next = null),
										(this.length -= 1),
										f
									);
								}),
									(fn.prototype.empty = function () {
										for (; this.head; ) this.shift();
										return this;
									}),
									(fn.prototype.insertAfter = function (f, n) {
										(n.prev = f), (n.next = f.next), f.next ? (f.next.prev = n) : (this.tail = n), (f.next = n), (this.length += 1);
									}),
									(fn.prototype.insertBefore = function (f, n) {
										(n.prev = f.prev), (n.next = f), f.prev ? (f.prev.next = n) : (this.head = n), (f.prev = n), (this.length += 1);
									}),
									(fn.prototype.unshift = function (f) {
										this.head ? this.insertBefore(this.head, f) : nn(this, f);
									}),
									(fn.prototype.push = function (f) {
										this.tail ? this.insertAfter(this.tail, f) : nn(this, f);
									}),
									(fn.prototype.shift = function () {
										return this.head && this.removeLink(this.head);
									}),
									(fn.prototype.pop = function () {
										return this.tail && this.removeLink(this.tail);
									}),
									(fn.prototype.toArray = function () {
										for (var f = Array(this.length), n = this.head, z = 0; z < this.length; z++) (f[z] = n.data), (n = n.next);
										return f;
									}),
									(fn.prototype.remove = function (f) {
										for (var n = this.head; n; ) {
											var z = n.next;
											f(n) && this.removeLink(n), (n = z);
										}
										return this;
									});
								var jn = Mf(If, 1);
								function xn(f, n, z, v) {
									v = k(v || o);
									var j = i(z);
									jn(
										f,
										function (f, z, v) {
											j(n, f, function (f, z) {
												(n = z), v(f);
											});
										},
										function (f) {
											v(f, n);
										}
									);
								}
								function On() {
									var f = af(arguments, i);
									return function () {
										var n = x(arguments),
											z = this,
											v = n[n.length - 1];
										"function" == typeof v ? n.pop() : (v = o),
											xn(
												f,
												n,
												function (f, n, v) {
													n.apply(
														z,
														f.concat(function (f) {
															var n = x(arguments, 1);
															v(f, n);
														})
													);
												},
												function (f, n) {
													v.apply(z, [f].concat(n));
												}
											);
									};
								}
								var Pn = function () {
										return On.apply(null, x(arguments).reverse());
									},
									hn = Array.prototype.concat,
									cn = function (f, n, z, v) {
										v = v || o;
										var j = i(z);
										pf(
											f,
											n,
											function (f, n) {
												j(f, function (f) {
													return f ? n(f) : n(null, x(arguments, 1));
												});
											},
											function (f, n) {
												for (var z = [], j = 0; j < n.length; j++) n[j] && (z = hn.apply(z, n[j]));
												return v(f, z);
											}
										);
									},
									ln = Mf(cn, 1 / 0),
									en = Mf(cn, 1),
									In = function () {
										var f = x(arguments),
											n = [null].concat(f);
										return function () {
											var f = arguments[arguments.length - 1];
											return f.apply(this, n);
										};
									};
								function Mn(f) {
									return f;
								}
								function yn(f, n) {
									return function (z, v, j, x) {
										x = x || o;
										var O,
											P = !1;
										z(
											v,
											function (z, v, x) {
												j(z, function (v, j) {
													v ? x(v) : f(j) && !O ? ((P = !0), (O = n(!0, z)), x(null, Y)) : x();
												});
											},
											function (f) {
												f ? x(f) : x(null, P ? O : n(!1));
											}
										);
									};
								}
								function En(f, n) {
									return n;
								}
								var rn = Kf(yn(Mn, En)),
									Kn = Zf(yn(Mn, En)),
									An = Mf(Kn, 1);
								function tn(f) {
									return function (n) {
										var z = x(arguments, 1);
										z.push(function (n) {
											var z = x(arguments, 1);
											"object" == typeof console &&
												(n
													? console.error && console.error(n)
													: console[f] &&
													  Sf(z, function (n) {
															console[f](n);
													  }));
										}),
											i(n).apply(null, z);
									};
								}
								var Xn = tn("dir");
								function Zn(f, n, z) {
									z = lf(z || o);
									var v = i(f),
										j = i(n);
									function O(f) {
										if (f) return z(f);
										var n = x(arguments, 1);
										n.push(P), j.apply(this, n);
									}
									function P(f, n) {
										return f ? z(f) : n ? void v(O) : z(null);
									}
									P(null, !0);
								}
								function pn(f, n, z) {
									z = lf(z || o);
									var v = i(f),
										j = function (f) {
											if (f) return z(f);
											var O = x(arguments, 1);
											if (n.apply(this, O)) return v(j);
											z.apply(null, [null].concat(O));
										};
									v(j);
								}
								function Hn(f, n, z) {
									pn(
										f,
										function () {
											return !n.apply(this, arguments);
										},
										z
									);
								}
								function un(f, n, z) {
									z = lf(z || o);
									var v = i(n),
										j = i(f);
									function x(f) {
										if (f) return z(f);
										j(O);
									}
									function O(f, n) {
										return f ? z(f) : n ? void v(x) : z(null);
									}
									j(O);
								}
								function Sn(f) {
									return function (n, z, v) {
										return f(n, v);
									};
								}
								function Gn(f, n, z) {
									rf(f, Sn(i(n)), z);
								}
								function Tn(f, n, z, v) {
									ef(n)(f, Sn(i(z)), v);
								}
								var Wn = Mf(Tn, 1);
								function Qn(f) {
									return A(f)
										? f
										: P(function (n, z) {
												var v = !0;
												n.push(function () {
													var f = arguments;
													v
														? M(function () {
																z.apply(null, f);
														  })
														: z.apply(null, f);
												}),
													f.apply(this, n),
													(v = !1);
										  });
								}
								function an(f) {
									return !f;
								}
								var Jn = Kf(yn(an, an)),
									Un = Zf(yn(an, an)),
									Yn = Mf(Un, 1);
								function on(f) {
									return function (n) {
										return null == n ? void 0 : n[f];
									};
								}
								function kn(f, n, z, v) {
									var j = new Array(n.length);
									f(
										n,
										function (f, n, v) {
											z(f, function (f, z) {
												(j[n] = !!z), v(f);
											});
										},
										function (f) {
											if (f) return v(f);
											for (var z = [], x = 0; x < n.length; x++) j[x] && z.push(n[x]);
											v(null, z);
										}
									);
								}
								function dn(f, n, z, v) {
									var j = [];
									f(
										n,
										function (f, n, v) {
											z(f, function (z, x) {
												z ? v(z) : (x && j.push({ index: n, value: f }), v());
											});
										},
										function (f) {
											f
												? v(f)
												: v(
														null,
														af(
															j.sort(function (f, n) {
																return f.index - n.index;
															}),
															on("value")
														)
												  );
										}
									);
								}
								function mn(f, n, z, v) {
									(U(n) ? kn : dn)(f, n, i(z), v || o);
								}
								var Cn = Kf(mn),
									Rn = Zf(mn),
									Ln = Mf(Rn, 1);
								function sn(f, n) {
									var z = lf(n || o),
										v = i(Qn(f));
									!(function f(n) {
										if (n) return z(n);
										v(f);
									})();
								}
								var bn = function (f, n, z, v) {
										v = v || o;
										var j = i(z);
										pf(
											f,
											n,
											function (f, n) {
												j(f, function (z, v) {
													return z ? n(z) : n(null, { key: v, val: f });
												});
											},
											function (f, n) {
												for (var z = {}, j = Object.prototype.hasOwnProperty, x = 0; x < n.length; x++)
													if (n[x]) {
														var O = n[x].key,
															P = n[x].val;
														j.call(z, O) ? z[O].push(P) : (z[O] = [P]);
													}
												return v(f, z);
											}
										);
									},
									Vn = Mf(bn, 1 / 0),
									qn = Mf(bn, 1),
									Dn = tn("log");
								function Nn(f, n, z, v) {
									v = k(v || o);
									var j = {},
										x = i(z);
									If(
										f,
										n,
										function (f, n, z) {
											x(f, n, function (f, v) {
												if (f) return z(f);
												(j[n] = v), z();
											});
										},
										function (f) {
											v(f, j);
										}
									);
								}
								var Fn = Mf(Nn, 1 / 0),
									wn = Mf(Nn, 1);
								function gn(f, n) {
									return n in f;
								}
								function Bn(f, n) {
									var z = Object.create(null),
										v = Object.create(null);
									n = n || Mn;
									var j = i(f),
										O = P(function (f, O) {
											var P = n.apply(null, f);
											gn(z, P)
												? M(function () {
														O.apply(null, z[P]);
												  })
												: gn(v, P)
												? v[P].push(O)
												: ((v[P] = [O]),
												  j.apply(
														null,
														f.concat(function () {
															var f = x(arguments);
															z[P] = f;
															var n = v[P];
															delete v[P];
															for (var j = 0, O = n.length; j < O; j++) n[j].apply(null, f);
														})
												  ));
										});
									return (O.memo = z), (O.unmemoized = f), O;
								}
								var _n = I(l ? f.nextTick : c ? j : e);
								function $n(f, n, z) {
									z = z || o;
									var v = U(n) ? [] : {};
									f(
										n,
										function (f, n, z) {
											i(f)(function (f, j) {
												arguments.length > 2 && (j = x(arguments, 1)), (v[n] = j), z(f);
											});
										},
										function (f) {
											z(f, v);
										}
									);
								}
								function fz(f, n) {
									$n(rf, f, n);
								}
								function nz(f, n, z) {
									$n(ef(n), f, z);
								}
								var zz = function (f, n) {
										var z = i(f);
										return zn(
											function (f, n) {
												z(f[0], n);
											},
											n,
											1
										);
									},
									vz = function (f, n) {
										var z = zz(f, n);
										return (
											(z.push = function (f, n, v) {
												if ((null == v && (v = o), "function" != typeof v)) throw new Error("task callback must be a function");
												if (((z.started = !0), V(f) || (f = [f]), 0 === f.length))
													return M(function () {
														z.drain();
													});
												n = n || 0;
												for (var j = z._tasks.head; j && n >= j.priority; ) j = j.next;
												for (var x = 0, O = f.length; x < O; x++) {
													var P = { data: f[x], priority: n, callback: v };
													j ? z._tasks.insertBefore(j, P) : z._tasks.push(P);
												}
												M(z.process);
											}),
											delete z.unshift,
											z
										);
									};
								function jz(f, n) {
									if (((n = k(n || o)), !V(f))) return n(new TypeError("First argument to race must be an array of functions"));
									if (!f.length) return n();
									for (var z = 0, v = f.length; z < v; z++) i(f[z])(n);
								}
								function xz(f, n, z, v) {
									xn(x(f).reverse(), n, z, v);
								}
								function Oz(f) {
									var n = i(f);
									return P(function (f, z) {
										return (
											f.push(function (f, n) {
												var v;
												f ? z(null, { error: f }) : ((v = arguments.length <= 2 ? n : x(arguments, 1)), z(null, { value: v }));
											}),
											n.apply(this, f)
										);
									});
								}
								function Pz(f) {
									var n;
									return (
										V(f)
											? (n = af(f, Oz))
											: ((n = {}),
											  Gf(f, function (f, z) {
													n[z] = Oz.call(this, f);
											  })),
										n
									);
								}
								function hz(f, n, z, v) {
									mn(
										f,
										n,
										function (f, n) {
											z(f, function (f, z) {
												n(f, !z);
											});
										},
										v
									);
								}
								var cz = Kf(hz),
									lz = Zf(hz),
									ez = Mf(lz, 1);
								function Iz(f) {
									return function () {
										return f;
									};
								}
								function Mz(f, n, z) {
									var v = 5,
										j = 0,
										x = { times: v, intervalFunc: Iz(j) };
									function O(f, n) {
										if ("object" == typeof n)
											(f.times = +n.times || v),
												(f.intervalFunc = "function" == typeof n.interval ? n.interval : Iz(+n.interval || j)),
												(f.errorFilter = n.errorFilter);
										else {
											if ("number" != typeof n && "string" != typeof n) throw new Error("Invalid arguments for async.retry");
											f.times = +n || v;
										}
									}
									if ((arguments.length < 3 && "function" == typeof f ? ((z = n || o), (n = f)) : (O(x, f), (z = z || o)), "function" != typeof n))
										throw new Error("Invalid arguments for async.retry");
									var P = i(n),
										h = 1;
									function c() {
										P(function (f) {
											f && h++ < x.times && ("function" != typeof x.errorFilter || x.errorFilter(f))
												? setTimeout(c, x.intervalFunc(h))
												: z.apply(null, arguments);
										});
									}
									c();
								}
								var yz = function (f, n) {
									n || ((n = f), (f = null));
									var z = i(n);
									return P(function (n, v) {
										function j(f) {
											z.apply(null, n.concat(f));
										}
										f ? Mz(f, j, v) : Mz(j, v);
									});
								};
								function Ez(f, n) {
									$n(jn, f, n);
								}
								var rz = Kf(yn(Boolean, Mn)),
									Kz = Zf(yn(Boolean, Mn)),
									Az = Mf(Kz, 1);
								function iz(f, n, z) {
									var v = i(n);
									function j(f, n) {
										var z = f.criteria,
											v = n.criteria;
										return z < v ? -1 : z > v ? 1 : 0;
									}
									tf(
										f,
										function (f, n) {
											v(f, function (z, v) {
												if (z) return n(z);
												n(null, { value: f, criteria: v });
											});
										},
										function (f, n) {
											if (f) return z(f);
											z(null, af(n.sort(j), on("value")));
										}
									);
								}
								function tz(f, n, z) {
									var v = i(f);
									return P(function (j, x) {
										var O,
											P = !1;
										j.push(function () {
											P || (x.apply(null, arguments), clearTimeout(O));
										}),
											(O = setTimeout(function () {
												var n = f.name || "anonymous",
													v = new Error('Callback function "' + n + '" timed out.');
												(v.code = "ETIMEDOUT"), z && (v.info = z), (P = !0), x(v);
											}, n)),
											v.apply(null, j);
									});
								}
								var Xz = Math.ceil,
									Zz = Math.max;
								function pz(f, n, z, v) {
									var j = i(z);
									pf(
										(function (f, n, z, v) {
											for (var j = -1, x = Zz(Xz((n - f) / 1), 0), O = Array(x); x--; ) (O[++j] = f), (f += 1);
											return O;
										})(0, f),
										n,
										j,
										v
									);
								}
								var Hz = Mf(pz, 1 / 0),
									uz = Mf(pz, 1);
								function Sz(f, n, z, v) {
									arguments.length <= 3 && ((v = z), (z = n), (n = V(f) ? [] : {})), (v = k(v || o));
									var j = i(z);
									rf(
										f,
										function (f, z, v) {
											j(n, f, z, v);
										},
										function (f) {
											v(f, n);
										}
									);
								}
								function Gz(f, n) {
									var z,
										v = null;
									(n = n || o),
										Wn(
											f,
											function (f, n) {
												i(f)(function (f, j) {
													(z = arguments.length > 2 ? x(arguments, 1) : j), (v = f), n(!f);
												});
											},
											function () {
												n(v, z);
											}
										);
								}
								function Tz(f) {
									return function () {
										return (f.unmemoized || f).apply(null, arguments);
									};
								}
								function Wz(f, n, z) {
									z = lf(z || o);
									var v = i(n);
									if (!f()) return z(null);
									var j = function (n) {
										if (n) return z(n);
										if (f()) return v(j);
										var O = x(arguments, 1);
										z.apply(null, [null].concat(O));
									};
									v(j);
								}
								function Qz(f, n, z) {
									Wz(
										function () {
											return !f.apply(this, arguments);
										},
										n,
										z
									);
								}
								var az = function (f, n) {
										if (((n = k(n || o)), !V(f))) return n(new Error("First argument to waterfall must be an array of functions"));
										if (!f.length) return n();
										var z = 0;
										function v(n) {
											var v = i(f[z++]);
											n.push(lf(j)), v.apply(null, n);
										}
										function j(j) {
											if (j || z === f.length) return n.apply(null, arguments);
											v(x(arguments, 1));
										}
										v([]);
									},
									Jz = {
										apply: O,
										applyEach: Xf,
										applyEachSeries: uf,
										asyncify: y,
										auto: Qf,
										autoInject: $f,
										cargo: vn,
										compose: Pn,
										concat: ln,
										concatLimit: cn,
										concatSeries: en,
										constant: In,
										detect: rn,
										detectLimit: Kn,
										detectSeries: An,
										dir: Xn,
										doDuring: Zn,
										doUntil: Hn,
										doWhilst: pn,
										during: un,
										each: Gn,
										eachLimit: Tn,
										eachOf: rf,
										eachOfLimit: If,
										eachOfSeries: jn,
										eachSeries: Wn,
										ensureAsync: Qn,
										every: Jn,
										everyLimit: Un,
										everySeries: Yn,
										filter: Cn,
										filterLimit: Rn,
										filterSeries: Ln,
										forever: sn,
										groupBy: Vn,
										groupByLimit: bn,
										groupBySeries: qn,
										log: Dn,
										map: tf,
										mapLimit: pf,
										mapSeries: Hf,
										mapValues: Fn,
										mapValuesLimit: Nn,
										mapValuesSeries: wn,
										memoize: Bn,
										nextTick: _n,
										parallel: fz,
										parallelLimit: nz,
										priorityQueue: vz,
										queue: zz,
										race: jz,
										reduce: xn,
										reduceRight: xz,
										reflect: Oz,
										reflectAll: Pz,
										reject: cz,
										rejectLimit: lz,
										rejectSeries: ez,
										retry: Mz,
										retryable: yz,
										seq: On,
										series: Ez,
										setImmediate: M,
										some: rz,
										someLimit: Kz,
										someSeries: Az,
										sortBy: iz,
										timeout: tz,
										times: Hz,
										timesLimit: pz,
										timesSeries: uz,
										transform: Sz,
										tryEach: Gz,
										unmemoize: Tz,
										until: Qz,
										waterfall: az,
										whilst: Wz,
										all: Jn,
										allLimit: Un,
										allSeries: Yn,
										any: rz,
										anyLimit: Kz,
										anySeries: Az,
										find: rn,
										findLimit: Kn,
										findSeries: An,
										forEach: Gn,
										forEachSeries: Wn,
										forEachLimit: Tn,
										forEachOf: rf,
										forEachOfSeries: jn,
										forEachOfLimit: If,
										inject: xn,
										foldl: xn,
										foldr: xz,
										select: Cn,
										selectLimit: Rn,
										selectSeries: Ln,
										wrapSync: y
									};
								(z.default = Jz),
									(z.apply = O),
									(z.applyEach = Xf),
									(z.applyEachSeries = uf),
									(z.asyncify = y),
									(z.auto = Qf),
									(z.autoInject = $f),
									(z.cargo = vn),
									(z.compose = Pn),
									(z.concat = ln),
									(z.concatLimit = cn),
									(z.concatSeries = en),
									(z.constant = In),
									(z.detect = rn),
									(z.detectLimit = Kn),
									(z.detectSeries = An),
									(z.dir = Xn),
									(z.doDuring = Zn),
									(z.doUntil = Hn),
									(z.doWhilst = pn),
									(z.during = un),
									(z.each = Gn),
									(z.eachLimit = Tn),
									(z.eachOf = rf),
									(z.eachOfLimit = If),
									(z.eachOfSeries = jn),
									(z.eachSeries = Wn),
									(z.ensureAsync = Qn),
									(z.every = Jn),
									(z.everyLimit = Un),
									(z.everySeries = Yn),
									(z.filter = Cn),
									(z.filterLimit = Rn),
									(z.filterSeries = Ln),
									(z.forever = sn),
									(z.groupBy = Vn),
									(z.groupByLimit = bn),
									(z.groupBySeries = qn),
									(z.log = Dn),
									(z.map = tf),
									(z.mapLimit = pf),
									(z.mapSeries = Hf),
									(z.mapValues = Fn),
									(z.mapValuesLimit = Nn),
									(z.mapValuesSeries = wn),
									(z.memoize = Bn),
									(z.nextTick = _n),
									(z.parallel = fz),
									(z.parallelLimit = nz),
									(z.priorityQueue = vz),
									(z.queue = zz),
									(z.race = jz),
									(z.reduce = xn),
									(z.reduceRight = xz),
									(z.reflect = Oz),
									(z.reflectAll = Pz),
									(z.reject = cz),
									(z.rejectLimit = lz),
									(z.rejectSeries = ez),
									(z.retry = Mz),
									(z.retryable = yz),
									(z.seq = On),
									(z.series = Ez),
									(z.setImmediate = M),
									(z.some = rz),
									(z.someLimit = Kz),
									(z.someSeries = Az),
									(z.sortBy = iz),
									(z.timeout = tz),
									(z.times = Hz),
									(z.timesLimit = pz),
									(z.timesSeries = uz),
									(z.transform = Sz),
									(z.tryEach = Gz),
									(z.unmemoize = Tz),
									(z.until = Qz),
									(z.waterfall = az),
									(z.whilst = Wz),
									(z.all = Jn),
									(z.allLimit = Un),
									(z.allSeries = Yn),
									(z.any = rz),
									(z.anyLimit = Kz),
									(z.anySeries = Az),
									(z.find = rn),
									(z.findLimit = Kn),
									(z.findSeries = An),
									(z.forEach = Gn),
									(z.forEachSeries = Wn),
									(z.forEachLimit = Tn),
									(z.forEachOf = rf),
									(z.forEachOfSeries = jn),
									(z.forEachOfLimit = If),
									(z.inject = xn),
									(z.foldl = xn),
									(z.foldr = xz),
									(z.select = Cn),
									(z.selectLimit = Rn),
									(z.selectSeries = Ln),
									(z.wrapSync = y),
									Object.defineProperty(z, "__esModule", { value: !0 });
							});
						}.call(
							this,
							f("_process"),
							"undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {},
							f("timers").setImmediate
						));
					},
					{ _process: 26, timers: 27 }
				],
				2: [
					function (f, n, z) {
						!(function () {
							"use strict";
							var f = -1,
								z = function (f) {
									null == f && (f = 1024);
									var n = function (f, n, z) {
											for (var v = n; v < z; v++) f[v] = 1 - v;
											if (0 < P.array[P.array.length - 1]) {
												for (var j = P.array.length - 2; 0 < P.array[j]; ) j--;
												f[n] = -j;
											}
										},
										z = function (f, n, z) {
											for (var v = n; v < z; v++) f[v] = -v - 1;
										},
										v = function (f) {
											var v = 2 * f,
												j = x(O.signed, O.bytes, v);
											n(j, O.array.length, v), j.set(O.array), (O.array = null), (O.array = j);
											var h = x(P.signed, P.bytes, v);
											z(h, P.array.length, v), h.set(P.array), (P.array = null), (P.array = h);
										},
										j = 1,
										O = { signed: !0, bytes: 4, array: x(!0, 4, f) },
										P = { signed: !0, bytes: 4, array: x(!0, 4, f) };
									return (
										(O.array[0] = 1),
										(P.array[0] = 0),
										n(O.array, 1, O.array.length),
										z(P.array, 1, P.array.length),
										{
											getBaseBuffer: function () {
												return O.array;
											},
											getCheckBuffer: function () {
												return P.array;
											},
											loadBaseBuffer: function (f) {
												return (O.array = f), this;
											},
											loadCheckBuffer: function (f) {
												return (P.array = f), this;
											},
											size: function () {
												return Math.max(O.array.length, P.array.length);
											},
											getBase: function (f) {
												return O.array.length - 1 < f ? 1 - f : O.array[f];
											},
											getCheck: function (f) {
												return P.array.length - 1 < f ? -f - 1 : P.array[f];
											},
											setBase: function (f, n) {
												O.array.length - 1 < f && v(f), (O.array[f] = n);
											},
											setCheck: function (f, n) {
												P.array.length - 1 < f && v(f), (P.array[f] = n);
											},
											setFirstUnusedNode: function (f) {
												j = f;
											},
											getFirstUnusedNode: function () {
												return j;
											},
											shrink: function () {
												for (var f = this.size() - 1; !(0 <= P.array[f]); ) f--;
												(O.array = O.array.subarray(0, f + 2)), (P.array = P.array.subarray(0, f + 2));
											},
											calc: function () {
												for (var f = 0, n = P.array.length, z = 0; z < n; z++) P.array[z] < 0 && f++;
												return { all: n, unused: f, efficiency: (n - f) / n };
											},
											dump: function () {
												var f,
													n = "",
													z = "";
												for (f = 0; f < O.array.length; f++) n = n + " " + this.getBase(f);
												for (f = 0; f < P.array.length; f++) z = z + " " + this.getCheck(f);
												return console.log("base:" + n), console.log("chck:" + z), "base:" + n + " chck:" + z;
											}
										}
									);
								};
							function v(f) {
								(this.bc = z(f)), (this.keys = []);
							}
							function j(f) {
								(this.bc = f), this.bc.shrink();
							}
							(v.prototype.append = function (f, n) {
								return this.keys.push({ k: f, v: n }), this;
							}),
								(v.prototype.build = function (f, n) {
									if ((null == f && (f = this.keys), null == f)) return new j(this.bc);
									null == n && (n = !1);
									var z = f.map(function (f) {
										return { k: P(f.k + "\0"), v: f.v };
									});
									return (
										(this.keys = n
											? z
											: z.sort(function (f, n) {
													for (var z = f.k, v = n.k, j = Math.min(z.length, v.length), x = 0; x < j; x++) if (z[x] !== v[x]) return z[x] - v[x];
													return z.length - v.length;
											  })),
										(z = null),
										this._build(0, 0, 0, this.keys.length),
										new j(this.bc)
									);
								}),
								(v.prototype._build = function (f, n, z, v) {
									var j = this.getChildrenInfo(n, z, v),
										x = this.findAllocatableBase(j);
									this.setBC(f, j, x);
									for (var O = 0; O < j.length; O += 3) {
										var P = j[O];
										if (0 !== P) {
											var h = j[O + 1],
												c = j[O + 2],
												l = x + P;
											this._build(l, n + 1, h, c);
										}
									}
								}),
								(v.prototype.getChildrenInfo = function (f, n, z) {
									var v = this.keys[n].k[f],
										j = 0,
										x = new Int32Array(3 * z);
									(x[j++] = v), (x[j++] = n);
									for (var O = n, P = n; O < n + z; O++) {
										var h = this.keys[O].k[f];
										v !== h && ((x[j++] = O - P), (x[j++] = h), (x[j++] = O), (v = h), (P = O));
									}
									return (x[j++] = O - P), x.subarray(0, j);
								}),
								(v.prototype.setBC = function (f, n, z) {
									var v,
										j = this.bc;
									for (j.setBase(f, z), v = 0; v < n.length; v += 3) {
										var x = n[v],
											O = z + x,
											P = -j.getBase(O),
											h = -j.getCheck(O);
										O !== j.getFirstUnusedNode() ? j.setCheck(P, -h) : j.setFirstUnusedNode(h), j.setBase(h, -P);
										var c = f;
										if ((j.setCheck(O, c), 0 === x)) {
											var l = n[v + 1],
												e = this.keys[l].v;
											null == e && (e = 0);
											var I = -e - 1;
											j.setBase(O, I);
										}
									}
								}),
								(v.prototype.findAllocatableBase = function (f) {
									for (var n, z = this.bc, v = z.getFirstUnusedNode(); ; )
										if ((n = v - f[0]) < 0) v = -z.getCheck(v);
										else {
											for (var j = !0, x = 0; x < f.length; x += 3) {
												var O = n + f[x];
												if (!this.isUnusedNode(O)) {
													(v = -z.getCheck(v)), (j = !1);
													break;
												}
											}
											if (j) return n;
										}
								}),
								(v.prototype.isUnusedNode = function (f) {
									var n = this.bc.getCheck(f);
									return 0 !== f && n < 0;
								}),
								(j.prototype.contain = function (n) {
									for (var z = this.bc, v = P((n += "\0")), j = 0, x = f, O = 0; O < v.length; O++) {
										var h = v[O];
										if ((x = this.traverse(j, h)) === f) return !1;
										if (z.getBase(x) <= 0) return !0;
										j = x;
									}
									return !1;
								}),
								(j.prototype.lookup = function (n) {
									for (var z = P((n += "\0")), v = 0, j = f, x = 0; x < z.length; x++) {
										var O = z[x];
										if ((j = this.traverse(v, O)) === f) return f;
										v = j;
									}
									var h = this.bc.getBase(j);
									return h <= 0 ? -h - 1 : f;
								}),
								(j.prototype.commonPrefixSearch = function (n) {
									for (var z = P(n), v = 0, j = f, x = [], c = 0; c < z.length; c++) {
										var l = z[c];
										if ((j = this.traverse(v, l)) === f) break;
										v = j;
										var e = this.traverse(j, 0);
										if (e !== f) {
											var I = this.bc.getBase(e),
												M = {};
											I <= 0 && (M.v = -I - 1), (M.k = h(O(z, 0, c + 1))), x.push(M);
										}
									}
									return x;
								}),
								(j.prototype.traverse = function (n, z) {
									var v = this.bc.getBase(n) + z;
									return this.bc.getCheck(v) === n ? v : f;
								}),
								(j.prototype.size = function () {
									return this.bc.size();
								}),
								(j.prototype.calc = function () {
									return this.bc.calc();
								}),
								(j.prototype.dump = function () {
									return this.bc.dump();
								});
							var x = function (f, n, z) {
									if (f)
										switch (n) {
											case 1:
												return new Int8Array(z);
											case 2:
												return new Int16Array(z);
											case 4:
												return new Int32Array(z);
											default:
												throw new RangeError("Invalid newArray parameter element_bytes:" + n);
										}
									else
										switch (n) {
											case 1:
												return new Uint8Array(z);
											case 2:
												return new Uint16Array(z);
											case 4:
												return new Uint32Array(z);
											default:
												throw new RangeError("Invalid newArray parameter element_bytes:" + n);
										}
								},
								O = function (f, n, z) {
									var v = new ArrayBuffer(z),
										j = new Uint8Array(v, 0, z),
										x = f.subarray(n, z);
									return j.set(x), j;
								},
								P = function (f) {
									for (var n = new Uint8Array(new ArrayBuffer(4 * f.length)), z = 0, v = 0; z < f.length; ) {
										var j,
											x = f.charCodeAt(z++);
										if (x >= 55296 && x <= 56319) {
											var O = x,
												P = f.charCodeAt(z++);
											if (!(P >= 56320 && P <= 57343)) return null;
											j = 1024 * (O - 55296) + 65536 + (P - 56320);
										} else j = x;
										j < 128
											? (n[v++] = j)
											: j < 2048
											? ((n[v++] = (j >>> 6) | 192), (n[v++] = (63 & j) | 128))
											: j < 65536
											? ((n[v++] = (j >>> 12) | 224), (n[v++] = ((j >> 6) & 63) | 128), (n[v++] = (63 & j) | 128))
											: j < 1 << 21 &&
											  ((n[v++] = (j >>> 18) | 240), (n[v++] = ((j >> 12) & 63) | 128), (n[v++] = ((j >> 6) & 63) | 128), (n[v++] = (63 & j) | 128));
									}
									return n.subarray(0, v);
								},
								h = function (f) {
									for (var n, z, v, j, x = "", O = 0; O < f.length; )
										(n =
											(z = f[O++]) < 128
												? z
												: z >> 5 == 6
												? ((31 & z) << 6) | (63 & f[O++])
												: z >> 4 == 14
												? ((15 & z) << 12) | ((63 & f[O++]) << 6) | (63 & f[O++])
												: ((7 & z) << 18) | ((63 & f[O++]) << 12) | ((63 & f[O++]) << 6) | (63 & f[O++])) < 65536
											? (x += String.fromCharCode(n))
											: ((v = 55296 | ((n -= 65536) >> 10)), (j = 56320 | (1023 & n)), (x += String.fromCharCode(v, j)));
									return x;
								},
								c = {
									builder: function (f) {
										return new v(f);
									},
									load: function (f, n) {
										var v = z(0);
										return v.loadBaseBuffer(f), v.loadCheckBuffer(n), new j(v);
									}
								};
							void 0 === n ? (window.doublearray = c) : (n.exports = c);
						})();
					},
					{}
				],
				3: [
					function (f, n, z) {
						"use strict";
						var v = f("./viterbi/ViterbiBuilder"),
							j = f("./viterbi/ViterbiSearcher"),
							x = f("./util/IpadicFormatter"),
							O = /、|。/;
						function P(f) {
							(this.token_info_dictionary = f.token_info_dictionary),
								(this.unknown_dictionary = f.unknown_dictionary),
								(this.viterbi_builder = new v(f)),
								(this.viterbi_searcher = new j(f.connection_costs)),
								(this.formatter = new x());
						}
						(P.splitByPunctuation = function (f) {
							for (var n = [], z = f; "" !== z; ) {
								var v = z.search(O);
								if (v < 0) {
									n.push(z);
									break;
								}
								n.push(z.substring(0, v + 1)), (z = z.substring(v + 1));
							}
							return n;
						}),
							(P.prototype.tokenize = function (f) {
								for (var n = P.splitByPunctuation(f), z = [], v = 0; v < n.length; v++) {
									var j = n[v];
									this.tokenizeForSentence(j, z);
								}
								return z;
							}),
							(P.prototype.tokenizeForSentence = function (f, n) {
								null == n && (n = []);
								var z = this.getLattice(f),
									v = this.viterbi_searcher.search(z),
									j = 0;
								n.length > 0 && (j = n[n.length - 1].word_position);
								for (var x = 0; x < v.length; x++) {
									var O,
										P,
										h,
										c = v[x];
									"KNOWN" === c.type
										? ((P = null == (h = this.token_info_dictionary.getFeatures(c.name)) ? [] : h.split(",")),
										  (O = this.formatter.formatEntry(c.name, j + c.start_pos, c.type, P)))
										: "UNKNOWN" === c.type
										? ((P = null == (h = this.unknown_dictionary.getFeatures(c.name)) ? [] : h.split(",")),
										  (O = this.formatter.formatUnknownEntry(c.name, j + c.start_pos, c.type, P, c.surface_form)))
										: (O = this.formatter.formatEntry(c.name, j + c.start_pos, c.type, [])),
										n.push(O);
								}
								return n;
							}),
							(P.prototype.getLattice = function (f) {
								return this.viterbi_builder.build(f);
							}),
							(n.exports = P);
					},
					{
						"./util/IpadicFormatter": 19,
						"./viterbi/ViterbiBuilder": 21,
						"./viterbi/ViterbiSearcher": 24
					}
				],
				4: [
					function (f, n, z) {
						"use strict";
						var v = f("./Tokenizer"),
							j = f("./loader/NodeDictionaryLoader");
						function x(f) {
							null == f.dicPath ? (this.dic_path = "dict/") : (this.dic_path = f.dicPath);
						}
						(x.prototype.build = function (f) {
							new j(this.dic_path).load(function (n, z) {
								f(n, new v(z));
							});
						}),
							(n.exports = x);
					},
					{ "./Tokenizer": 3, "./loader/NodeDictionaryLoader": 16 }
				],
				5: [
					function (f, n, z) {
						"use strict";
						n.exports = function (f, n, z, v, j) {
							(this.class_id = f), (this.class_name = n), (this.is_always_invoke = z), (this.is_grouping = v), (this.max_length = j);
						};
					},
					{}
				],
				6: [
					function (f, n, z) {
						"use strict";
						var v = f("./InvokeDefinitionMap"),
							j = f("./CharacterClass"),
							x = f("../util/SurrogateAwareString"),
							O = "DEFAULT";
						function P() {
							(this.character_category_map = new Uint8Array(65536)),
								(this.compatible_category_map = new Uint32Array(65536)),
								(this.invoke_definition_map = null);
						}
						(P.load = function (f, n, z) {
							var j = new P();
							return (j.character_category_map = f), (j.compatible_category_map = n), (j.invoke_definition_map = v.load(z)), j;
						}),
							(P.parseCharCategory = function (f, n) {
								var z = n[1],
									v = parseInt(n[2]),
									x = parseInt(n[3]),
									O = parseInt(n[4]);
								return !isFinite(v) || (0 !== v && 1 !== v)
									? (console.log("char.def parse error. INVOKE is 0 or 1 in:" + v), null)
									: !isFinite(x) || (0 !== x && 1 !== x)
									? (console.log("char.def parse error. GROUP is 0 or 1 in:" + x), null)
									: !isFinite(O) || O < 0
									? (console.log("char.def parse error. LENGTH is 1 to n:" + O), null)
									: new j(f, z, 1 === v, 1 === x, O);
							}),
							(P.parseCategoryMapping = function (f) {
								var n = parseInt(f[1]),
									z = f[2],
									v = 3 < f.length ? f.slice(3) : [];
								return (
									(!isFinite(n) || n < 0 || n > 65535) && console.log("char.def parse error. CODE is invalid:" + n),
									{ start: n, default: z, compatible: v }
								);
							}),
							(P.parseRangeCategoryMapping = function (f) {
								var n = parseInt(f[1]),
									z = parseInt(f[2]),
									v = f[3],
									j = 4 < f.length ? f.slice(4) : [];
								return (
									(!isFinite(n) || n < 0 || n > 65535) && console.log("char.def parse error. CODE is invalid:" + n),
									(!isFinite(z) || z < 0 || z > 65535) && console.log("char.def parse error. CODE is invalid:" + z),
									{ start: n, end: z, default: v, compatible: j }
								);
							}),
							(P.prototype.initCategoryMappings = function (f) {
								var n;
								if (null != f)
									for (var z = 0; z < f.length; z++) {
										var v = f[z],
											j = v.end || v.start;
										for (n = v.start; n <= j; n++) {
											this.character_category_map[n] = this.invoke_definition_map.lookup(v.default);
											for (var x = 0; x < v.compatible.length; x++) {
												var P = this.compatible_category_map[n],
													h = v.compatible[x];
												if (null != h) {
													var c = this.invoke_definition_map.lookup(h);
													null != c && ((P |= 1 << c), (this.compatible_category_map[n] = P));
												}
											}
										}
									}
								var l = this.invoke_definition_map.lookup(O);
								if (null != l)
									for (n = 0; n < this.character_category_map.length; n++)
										0 === this.character_category_map[n] && (this.character_category_map[n] = 1 << l);
							}),
							(P.prototype.lookupCompatibleCategory = function (f) {
								var n,
									z = [],
									v = f.charCodeAt(0);
								if ((v < this.compatible_category_map.length && (n = this.compatible_category_map[v]), null == n || 0 === n)) return z;
								for (var j = 0; j < 32; j++)
									if ((n << (31 - j)) >>> 31 == 1) {
										var x = this.invoke_definition_map.getCharacterClass(j);
										if (null == x) continue;
										z.push(x);
									}
								return z;
							}),
							(P.prototype.lookup = function (f) {
								var n,
									z = f.charCodeAt(0);
								return (
									x.isSurrogatePair(f)
										? (n = this.invoke_definition_map.lookup(O))
										: z < this.character_category_map.length && (n = this.character_category_map[z]),
									null == n && (n = this.invoke_definition_map.lookup(O)),
									this.invoke_definition_map.getCharacterClass(n)
								);
							}),
							(n.exports = P);
					},
					{
						"../util/SurrogateAwareString": 20,
						"./CharacterClass": 5,
						"./InvokeDefinitionMap": 9
					}
				],
				7: [
					function (f, n, z) {
						"use strict";
						function v(f, n) {
							(this.forward_dimension = f),
								(this.backward_dimension = n),
								(this.buffer = new Int16Array(f * n + 2)),
								(this.buffer[0] = f),
								(this.buffer[1] = n);
						}
						(v.prototype.put = function (f, n, z) {
							var v = f * this.backward_dimension + n + 2;
							if (this.buffer.length < v + 1) throw "ConnectionCosts buffer overflow";
							this.buffer[v] = z;
						}),
							(v.prototype.get = function (f, n) {
								var z = f * this.backward_dimension + n + 2;
								if (this.buffer.length < z + 1) throw "ConnectionCosts buffer overflow";
								return this.buffer[z];
							}),
							(v.prototype.loadConnectionCosts = function (f) {
								(this.forward_dimension = f[0]), (this.backward_dimension = f[1]), (this.buffer = f);
							}),
							(n.exports = v);
					},
					{}
				],
				8: [
					function (f, n, z) {
						"use strict";
						var v = f("doublearray"),
							j = f("./TokenInfoDictionary"),
							x = f("./ConnectionCosts"),
							O = f("./UnknownDictionary");
						function P(f, n, z, P) {
							(this.trie = null != f ? f : v.builder(0).build([{ k: "", v: 1 }])),
								(this.token_info_dictionary = null != n ? n : new j()),
								(this.connection_costs = null != z ? z : new x(0, 0)),
								(this.unknown_dictionary = null != P ? P : new O());
						}
						(P.prototype.loadTrie = function (f, n) {
							return (this.trie = v.load(f, n)), this;
						}),
							(P.prototype.loadTokenInfoDictionaries = function (f, n, z) {
								return (
									this.token_info_dictionary.loadDictionary(f),
									this.token_info_dictionary.loadPosVector(n),
									this.token_info_dictionary.loadTargetMap(z),
									this
								);
							}),
							(P.prototype.loadConnectionCosts = function (f) {
								return this.connection_costs.loadConnectionCosts(f), this;
							}),
							(P.prototype.loadUnknownDictionaries = function (f, n, z, v, j, x) {
								return this.unknown_dictionary.loadUnknownDictionaries(f, n, z, v, j, x), this;
							}),
							(n.exports = P);
					},
					{
						"./ConnectionCosts": 7,
						"./TokenInfoDictionary": 10,
						"./UnknownDictionary": 11,
						doublearray: 2
					}
				],
				9: [
					function (f, n, z) {
						"use strict";
						var v = f("../util/ByteBuffer"),
							j = f("./CharacterClass");
						function x() {
							(this.map = []), (this.lookup_table = {});
						}
						(x.load = function (f) {
							for (var n = new x(), z = [], O = new v(f); O.position + 1 < O.size(); ) {
								var P = z.length,
									h = O.get(),
									c = O.get(),
									l = O.getInt(),
									e = O.getString();
								z.push(new j(P, e, h, c, l));
							}
							return n.init(z), n;
						}),
							(x.prototype.init = function (f) {
								if (null != f)
									for (var n = 0; n < f.length; n++) {
										var z = f[n];
										(this.map[n] = z), (this.lookup_table[z.class_name] = n);
									}
							}),
							(x.prototype.getCharacterClass = function (f) {
								return this.map[f];
							}),
							(x.prototype.lookup = function (f) {
								var n = this.lookup_table[f];
								return null == n ? null : n;
							}),
							(x.prototype.toBuffer = function () {
								for (var f = new v(), n = 0; n < this.map.length; n++) {
									var z = this.map[n];
									f.put(z.is_always_invoke), f.put(z.is_grouping), f.putInt(z.max_length), f.putString(z.class_name);
								}
								return f.shrink(), f.buffer;
							}),
							(n.exports = x);
					},
					{ "../util/ByteBuffer": 18, "./CharacterClass": 5 }
				],
				10: [
					function (f, n, z) {
						"use strict";
						var v = f("../util/ByteBuffer");
						function j() {
							(this.dictionary = new v(10485760)), (this.target_map = {}), (this.pos_buffer = new v(10485760));
						}
						(j.prototype.buildDictionary = function (f) {
							for (var n = {}, z = 0; z < f.length; z++) {
								var v = f[z];
								if (!(v.length < 4)) {
									var j = v[0],
										x = v[1],
										O = v[2],
										P = v[3],
										h = v.slice(4).join(",");
									(isFinite(x) && isFinite(O) && isFinite(P)) || console.log(v), (n[this.put(x, O, P, j, h)] = j);
								}
							}
							return this.dictionary.shrink(), this.pos_buffer.shrink(), n;
						}),
							(j.prototype.put = function (f, n, z, v, j) {
								var x = this.dictionary.position,
									O = this.pos_buffer.position;
								return (
									this.dictionary.putShort(f),
									this.dictionary.putShort(n),
									this.dictionary.putShort(z),
									this.dictionary.putInt(O),
									this.pos_buffer.putString(v + "," + j),
									x
								);
							}),
							(j.prototype.addMapping = function (f, n) {
								var z = this.target_map[f];
								null == z && (z = []), z.push(n), (this.target_map[f] = z);
							}),
							(j.prototype.targetMapToBuffer = function () {
								var f = new v(),
									n = Object.keys(this.target_map).length;
								for (var z in (f.putInt(n), this.target_map)) {
									var j = this.target_map[z],
										x = j.length;
									f.putInt(parseInt(z)), f.putInt(x);
									for (var O = 0; O < j.length; O++) f.putInt(j[O]);
								}
								return f.shrink();
							}),
							(j.prototype.loadDictionary = function (f) {
								return (this.dictionary = new v(f)), this;
							}),
							(j.prototype.loadPosVector = function (f) {
								return (this.pos_buffer = new v(f)), this;
							}),
							(j.prototype.loadTargetMap = function (f) {
								var n = new v(f);
								for (n.position = 0, this.target_map = {}, n.readInt(); !(n.buffer.length < n.position + 1); )
									for (var z = n.readInt(), j = n.readInt(), x = 0; x < j; x++) {
										var O = n.readInt();
										this.addMapping(z, O);
									}
								return this;
							}),
							(j.prototype.getFeatures = function (f) {
								var n = parseInt(f);
								if (isNaN(n)) return "";
								var z = this.dictionary.getInt(n + 6);
								return this.pos_buffer.getString(z);
							}),
							(n.exports = j);
					},
					{ "../util/ByteBuffer": 18 }
				],
				11: [
					function (f, n, z) {
						"use strict";
						var v = f("./TokenInfoDictionary"),
							j = f("./CharacterDefinition"),
							x = f("../util/ByteBuffer");
						function O() {
							(this.dictionary = new x(10485760)), (this.target_map = {}), (this.pos_buffer = new x(10485760)), (this.character_definition = null);
						}
						(O.prototype = Object.create(v.prototype)),
							(O.prototype.characterDefinition = function (f) {
								return (this.character_definition = f), this;
							}),
							(O.prototype.lookup = function (f) {
								return this.character_definition.lookup(f);
							}),
							(O.prototype.lookupCompatibleCategory = function (f) {
								return this.character_definition.lookupCompatibleCategory(f);
							}),
							(O.prototype.loadUnknownDictionaries = function (f, n, z, v, x, O) {
								this.loadDictionary(f), this.loadPosVector(n), this.loadTargetMap(z), (this.character_definition = j.load(v, x, O));
							}),
							(n.exports = O);
					},
					{
						"../util/ByteBuffer": 18,
						"./CharacterDefinition": 6,
						"./TokenInfoDictionary": 10
					}
				],
				12: [
					function (f, n, z) {
						"use strict";
						var v = f("../CharacterDefinition"),
							j = f("../InvokeDefinitionMap"),
							x = /^(\w+)\s+(\d)\s+(\d)\s+(\d)/,
							O = /^(0x[0-9A-F]{4})(?:\s+([^#\s]+))(?:\s+([^#\s]+))*/,
							P = /^(0x[0-9A-F]{4})\.\.(0x[0-9A-F]{4})(?:\s+([^#\s]+))(?:\s+([^#\s]+))*/;
						function h() {
							(this.char_def = new v()),
								(this.char_def.invoke_definition_map = new j()),
								(this.character_category_definition = []),
								(this.category_mapping = []);
						}
						(h.prototype.putLine = function (f) {
							var n = x.exec(f);
							if (null == n) {
								var z = O.exec(f);
								if (null != z) {
									var j = v.parseCategoryMapping(z);
									this.category_mapping.push(j);
								}
								var h = P.exec(f);
								if (null != h) {
									var c = v.parseRangeCategoryMapping(h);
									this.category_mapping.push(c);
								}
							} else {
								var l = this.character_category_definition.length,
									e = v.parseCharCategory(l, n);
								if (null == e) return;
								this.character_category_definition.push(e);
							}
						}),
							(h.prototype.build = function () {
								return (
									this.char_def.invoke_definition_map.init(this.character_category_definition),
									this.char_def.initCategoryMappings(this.category_mapping),
									this.char_def
								);
							}),
							(n.exports = h);
					},
					{ "../CharacterDefinition": 6, "../InvokeDefinitionMap": 9 }
				],
				13: [
					function (f, n, z) {
						"use strict";
						var v = f("../ConnectionCosts");
						function j() {
							(this.lines = 0), (this.connection_cost = null);
						}
						(j.prototype.putLine = function (f) {
							if (0 === this.lines) {
								var n = f.split(" "),
									z = n[0],
									j = n[1];
								if (z < 0 || j < 0) throw "Parse error of matrix.def";
								return (this.connection_cost = new v(z, j)), this.lines++, this;
							}
							var x = f.split(" ");
							if (3 !== x.length) return this;
							var O = parseInt(x[0]),
								P = parseInt(x[1]),
								h = parseInt(x[2]);
							if (
								O < 0 ||
								P < 0 ||
								!isFinite(O) ||
								!isFinite(P) ||
								this.connection_cost.forward_dimension <= O ||
								this.connection_cost.backward_dimension <= P
							)
								throw "Parse error of matrix.def";
							return this.connection_cost.put(O, P, h), this.lines++, this;
						}),
							(j.prototype.build = function () {
								return this.connection_cost;
							}),
							(n.exports = j);
					},
					{ "../ConnectionCosts": 7 }
				],
				14: [
					function (f, n, z) {
						"use strict";
						var v = f("doublearray"),
							j = f("../DynamicDictionaries"),
							x = f("../TokenInfoDictionary"),
							O = f("./ConnectionCostsBuilder"),
							P = f("./CharacterDefinitionBuilder"),
							h = f("../UnknownDictionary");
						function c() {
							(this.tid_entries = []), (this.unk_entries = []), (this.cc_builder = new O()), (this.cd_builder = new P());
						}
						(c.prototype.addTokenInfoDictionary = function (f) {
							var n = f.split(",");
							return this.tid_entries.push(n), this;
						}),
							(c.prototype.putCostMatrixLine = function (f) {
								return this.cc_builder.putLine(f), this;
							}),
							(c.prototype.putCharDefLine = function (f) {
								return this.cd_builder.putLine(f), this;
							}),
							(c.prototype.putUnkDefLine = function (f) {
								return this.unk_entries.push(f.split(",")), this;
							}),
							(c.prototype.build = function () {
								var f = this.buildTokenInfoDictionary(),
									n = this.buildUnknownDictionary();
								return new j(f.trie, f.token_info_dictionary, this.cc_builder.build(), n);
							}),
							(c.prototype.buildTokenInfoDictionary = function () {
								var f = new x(),
									n = f.buildDictionary(this.tid_entries),
									z = this.buildDoubleArray();
								for (var v in n) {
									var j = n[v],
										O = z.lookup(j);
									f.addMapping(O, v);
								}
								return { trie: z, token_info_dictionary: f };
							}),
							(c.prototype.buildUnknownDictionary = function () {
								var f = new h(),
									n = f.buildDictionary(this.unk_entries),
									z = this.cd_builder.build();
								for (var v in (f.characterDefinition(z), n)) {
									var j = n[v],
										x = z.invoke_definition_map.lookup(j);
									f.addMapping(x, v);
								}
								return f;
							}),
							(c.prototype.buildDoubleArray = function () {
								var f = 0,
									n = this.tid_entries.map(function (n) {
										return { k: n[0], v: f++ };
									});
								return v.builder(1048576).build(n);
							}),
							(n.exports = c);
					},
					{
						"../DynamicDictionaries": 8,
						"../TokenInfoDictionary": 10,
						"../UnknownDictionary": 11,
						"./CharacterDefinitionBuilder": 12,
						"./ConnectionCostsBuilder": 13,
						doublearray: 2
					}
				],
				15: [
					function (f, n, z) {
						"use strict";
						var v = f("./TokenizerBuilder"),
							j = f("./dict/builder/DictionaryBuilder"),
							x = {
								builder: function (f) {
									return new v(f);
								},
								dictionaryBuilder: function () {
									return new j();
								}
							};
						n.exports = x;
					},
					{ "./TokenizerBuilder": 4, "./dict/builder/DictionaryBuilder": 14 }
				],
				16: [
					function (f, n, z) {
						"use strict";
						var v = f("zlibjs/bin/gunzip.min.js"),
							j = f("./DictionaryLoader");
						function x(f) {
							j.apply(this, [f]);
						}
						(x.prototype = Object.create(j.prototype)),
							(x.prototype.loadArrayBuffer = function (f, n, z = !1, j = null) {
								if (z) {
									var x = (function (f) {
											for (var n = window.atob(f), z = n.length, v = new Uint8Array(z), j = 0; j < z; j++) v[j] = n.charCodeAt(j);
											return v.buffer;
										})(j),
										O = new v.Zlib.Gunzip(new Uint8Array(x)).decompress();
									n(null, O.buffer);
								} else {
									var P = new XMLHttpRequest();
									P.open("GET", f, !0),
										(P.responseType = "arraybuffer"),
										(P.onload = function () {
											if (this.status > 0 && 200 !== this.status) n(P.statusText, null);
											else {
												var f = this.response,
													z = new v.Zlib.Gunzip(new Uint8Array(f)).decompress();
												n(null, z.buffer);
											}
										}),
										(P.onerror = function (f) {
											n(f, null);
										}),
										P.send();
								}
							}),
							(n.exports = x);
					},
					{ "./DictionaryLoader": 17, "zlibjs/bin/gunzip.min.js": 28 }
				],
				17: [
					function (f, n, z) {
						"use strict";
						f("path");
						var v = f("async"),
							j = f("../dict/DynamicDictionaries");
						function x(f) {
							(this.dic = new j()), (this.dic_path = f);
						}
						(x.prototype.loadArrayBuffer = function (f, n, z = !1, v = null) {
							throw new Error("DictionaryLoader#loadArrayBuffer should be overwrite");
						}),
							(x.prototype.load = function (f) {
								var n = this.dic,
									z = (this.dic_path, this.loadArrayBuffer);
								v.parallel(
									[
										function (f) {
											v.map(
												[base_dat_gz, check_dat_gz],
												function (f, n) {
													z(
														null,
														function (f, z) {
															if (f) return n(f);
															n(null, z);
														},
														!0,
														f
													);
												},
												function (z, v) {
													if (z) return f(z);
													var j = new Int32Array(v[0]),
														x = new Int32Array(v[1]);
													n.loadTrie(j, x), f(null);
												}
											);
										},
										function (f) {
											v.map(
												[tid_dat_gz, tid_pos_dat_gz, tid_map_dat_gz],
												function (f, n) {
													z(
														null,
														function (f, z) {
															if (f) return n(f);
															n(null, z);
														},
														!0,
														f
													);
												},
												function (z, v) {
													if (z) return f(z);
													var j = new Uint8Array(v[0]),
														x = new Uint8Array(v[1]),
														O = new Uint8Array(v[2]);
													n.loadTokenInfoDictionaries(j, x, O), f(null);
												}
											);
										},
										function (f) {
											z(
												null,
												function (z, v) {
													if (z) return f(z);
													var j = new Int16Array(v);
													n.loadConnectionCosts(j), f(null);
												},
												!0,
												cc_dat_gz
											);
										},
										function (f) {
											v.map(
												[unk_dat_gz, unk_pos_dat_gz, unk_map_dat_gz, unk_char_dat_gz, unk_compat_dat_gz, unk_invoke_data_gz],
												function (f, n) {
													z(
														null,
														function (f, z) {
															if (f) return n(f);
															n(null, z);
														},
														!0,
														f
													);
												},
												function (z, v) {
													if (z) return f(z);
													var j = new Uint8Array(v[0]),
														x = new Uint8Array(v[1]),
														O = new Uint8Array(v[2]),
														P = new Uint8Array(v[3]),
														h = new Uint32Array(v[4]),
														c = new Uint8Array(v[5]);
													n.loadUnknownDictionaries(j, x, O, P, h, c), f(null);
												}
											);
										}
									],
									function (z) {
										f(z, n);
									}
								);
							}),
							(n.exports = x);
					},
					{ "../dict/DynamicDictionaries": 8, async: 1, path: 25 }
				],
				18: [
					function (f, n, z) {
						"use strict";
						function v(f) {
							var n;
							if (null == f) n = 1048576;
							else {
								if ("number" != typeof f) {
									if (f instanceof Uint8Array) return (this.buffer = f), void (this.position = 0);
									throw typeof f + " is invalid parameter type for ByteBuffer constructor";
								}
								n = f;
							}
							(this.buffer = new Uint8Array(n)), (this.position = 0);
						}
						(v.prototype.size = function () {
							return this.buffer.length;
						}),
							(v.prototype.reallocate = function () {
								var f = new Uint8Array(2 * this.buffer.length);
								f.set(this.buffer), (this.buffer = f);
							}),
							(v.prototype.shrink = function () {
								return (this.buffer = this.buffer.subarray(0, this.position)), this.buffer;
							}),
							(v.prototype.put = function (f) {
								this.buffer.length < this.position + 1 && this.reallocate(), (this.buffer[this.position++] = f);
							}),
							(v.prototype.get = function (f) {
								return null == f && ((f = this.position), (this.position += 1)), this.buffer.length < f + 1 ? 0 : this.buffer[f];
							}),
							(v.prototype.putShort = function (f) {
								if (65535 < f) throw f + " is over short value";
								var n = 255 & f,
									z = (65280 & f) >> 8;
								this.put(n), this.put(z);
							}),
							(v.prototype.getShort = function (f) {
								if ((null == f && ((f = this.position), (this.position += 2)), this.buffer.length < f + 2)) return 0;
								var n = this.buffer[f],
									z = (this.buffer[f + 1] << 8) + n;
								return 32768 & z && (z = -((z - 1) ^ 65535)), z;
							}),
							(v.prototype.putInt = function (f) {
								if (4294967295 < f) throw f + " is over integer value";
								var n = 255 & f,
									z = (65280 & f) >> 8,
									v = (16711680 & f) >> 16,
									j = (4278190080 & f) >> 24;
								this.put(n), this.put(z), this.put(v), this.put(j);
							}),
							(v.prototype.getInt = function (f) {
								if ((null == f && ((f = this.position), (this.position += 4)), this.buffer.length < f + 4)) return 0;
								var n = this.buffer[f],
									z = this.buffer[f + 1],
									v = this.buffer[f + 2];
								return (this.buffer[f + 3] << 24) + (v << 16) + (z << 8) + n;
							}),
							(v.prototype.readInt = function () {
								var f = this.position;
								return (this.position += 4), this.getInt(f);
							}),
							(v.prototype.putString = function (f) {
								for (
									var n = (function (f) {
											for (var n = new Uint8Array(4 * f.length), z = 0, v = 0; z < f.length; ) {
												var j,
													x = f.charCodeAt(z++);
												if (x >= 55296 && x <= 56319) {
													var O = x,
														P = f.charCodeAt(z++);
													if (!(P >= 56320 && P <= 57343)) return null;
													j = 1024 * (O - 55296) + 65536 + (P - 56320);
												} else j = x;
												j < 128
													? (n[v++] = j)
													: j < 2048
													? ((n[v++] = (j >>> 6) | 192), (n[v++] = (63 & j) | 128))
													: j < 65536
													? ((n[v++] = (j >>> 12) | 224), (n[v++] = ((j >> 6) & 63) | 128), (n[v++] = (63 & j) | 128))
													: j < 1 << 21 &&
													  ((n[v++] = (j >>> 18) | 240),
													  (n[v++] = ((j >> 12) & 63) | 128),
													  (n[v++] = ((j >> 6) & 63) | 128),
													  (n[v++] = (63 & j) | 128));
											}
											return n.subarray(0, v);
										})(f),
										z = 0;
									z < n.length;
									z++
								)
									this.put(n[z]);
								this.put(0);
							}),
							(v.prototype.getString = function (f) {
								var n,
									z = [];
								for (null == f && (f = this.position); !(this.buffer.length < f + 1) && 0 !== (n = this.get(f++)); ) z.push(n);
								return (
									(this.position = f),
									(function (f) {
										for (var n, z, v, j, x = "", O = 0; O < f.length; )
											(n =
												(z = f[O++]) < 128
													? z
													: z >> 5 == 6
													? ((31 & z) << 6) | (63 & f[O++])
													: z >> 4 == 14
													? ((15 & z) << 12) | ((63 & f[O++]) << 6) | (63 & f[O++])
													: ((7 & z) << 18) | ((63 & f[O++]) << 12) | ((63 & f[O++]) << 6) | (63 & f[O++])) < 65536
												? (x += String.fromCharCode(n))
												: ((v = 55296 | ((n -= 65536) >> 10)), (j = 56320 | (1023 & n)), (x += String.fromCharCode(v, j)));
										return x;
									})(z)
								);
							}),
							(n.exports = v);
					},
					{}
				],
				19: [
					function (f, n, z) {
						"use strict";
						function v() {}
						(v.prototype.formatEntry = function (f, n, z, v) {
							var j = {};
							return (
								(j.word_id = f),
								(j.word_type = z),
								(j.word_position = n),
								(j.surface_form = v[0]),
								(j.pos = v[1]),
								(j.pos_detail_1 = v[2]),
								(j.pos_detail_2 = v[3]),
								(j.pos_detail_3 = v[4]),
								(j.conjugated_type = v[5]),
								(j.conjugated_form = v[6]),
								(j.basic_form = v[7]),
								(j.reading = v[8]),
								(j.pronunciation = v[9]),
								j
							);
						}),
							(v.prototype.formatUnknownEntry = function (f, n, z, v, j) {
								var x = {};
								return (
									(x.word_id = f),
									(x.word_type = z),
									(x.word_position = n),
									(x.surface_form = j),
									(x.pos = v[1]),
									(x.pos_detail_1 = v[2]),
									(x.pos_detail_2 = v[3]),
									(x.pos_detail_3 = v[4]),
									(x.conjugated_type = v[5]),
									(x.conjugated_form = v[6]),
									(x.basic_form = v[7]),
									x
								);
							}),
							(n.exports = v);
					},
					{}
				],
				20: [
					function (f, n, z) {
						"use strict";
						function v(f) {
							(this.str = f), (this.index_mapping = []);
							for (var n = 0; n < f.length; n++) {
								var z = f.charAt(n);
								this.index_mapping.push(n), v.isSurrogatePair(z) && n++;
							}
							this.length = this.index_mapping.length;
						}
						(v.prototype.slice = function (f) {
							if (this.index_mapping.length <= f) return "";
							var n = this.index_mapping[f];
							return this.str.slice(n);
						}),
							(v.prototype.charAt = function (f) {
								if (this.str.length <= f) return "";
								var n = this.index_mapping[f],
									z = this.index_mapping[f + 1];
								return null == z ? this.str.slice(n) : this.str.slice(n, z);
							}),
							(v.prototype.charCodeAt = function (f) {
								if (this.index_mapping.length <= f) return NaN;
								var n,
									z = this.index_mapping[f],
									v = this.str.charCodeAt(z);
								return v >= 55296 && v <= 56319 && z < this.str.length && (n = this.str.charCodeAt(z + 1)) >= 56320 && n <= 57343
									? 1024 * (v - 55296) + n - 56320 + 65536
									: v;
							}),
							(v.prototype.toString = function () {
								return this.str;
							}),
							(v.isSurrogatePair = function (f) {
								var n = f.charCodeAt(0);
								return n >= 55296 && n <= 56319;
							}),
							(n.exports = v);
					},
					{}
				],
				21: [
					function (f, n, z) {
						"use strict";
						var v = f("./ViterbiNode"),
							j = f("./ViterbiLattice"),
							x = f("../util/SurrogateAwareString");
						function O(f) {
							(this.trie = f.trie), (this.token_info_dictionary = f.token_info_dictionary), (this.unknown_dictionary = f.unknown_dictionary);
						}
						(O.prototype.build = function (f) {
							for (var n, z, O, P, h, c = new j(), l = new x(f), e = 0; e < l.length; e++) {
								for (var I = l.slice(e), M = this.trie.commonPrefixSearch(I), y = 0; y < M.length; y++) {
									(z = M[y].v), (n = M[y].k);
									for (var E = this.token_info_dictionary.target_map[z], r = 0; r < E.length; r++) {
										var K = parseInt(E[r]);
										(O = this.token_info_dictionary.dictionary.getShort(K)),
											(P = this.token_info_dictionary.dictionary.getShort(K + 2)),
											(h = this.token_info_dictionary.dictionary.getShort(K + 4)),
											c.append(new v(K, h, e + 1, n.length, "KNOWN", O, P, n));
									}
								}
								var A = new x(I),
									i = new x(A.charAt(0)),
									t = this.unknown_dictionary.lookup(i.toString());
								if (null == M || 0 === M.length || 1 === t.is_always_invoke) {
									if (((n = i), 1 === t.is_grouping && 1 < A.length))
										for (var X = 1; X < A.length; X++) {
											var Z = A.charAt(X),
												p = this.unknown_dictionary.lookup(Z);
											if (t.class_name !== p.class_name) break;
											n += Z;
										}
									for (var H = this.unknown_dictionary.target_map[t.class_id], u = 0; u < H.length; u++) {
										var S = parseInt(H[u]);
										(O = this.unknown_dictionary.dictionary.getShort(S)),
											(P = this.unknown_dictionary.dictionary.getShort(S + 2)),
											(h = this.unknown_dictionary.dictionary.getShort(S + 4)),
											c.append(new v(S, h, e + 1, n.length, "UNKNOWN", O, P, n.toString()));
									}
								}
							}
							return c.appendEos(), c;
						}),
							(n.exports = O);
					},
					{
						"../util/SurrogateAwareString": 20,
						"./ViterbiLattice": 22,
						"./ViterbiNode": 23
					}
				],
				22: [
					function (f, n, z) {
						"use strict";
						var v = f("./ViterbiNode");
						function j() {
							(this.nodes_end_at = []), (this.nodes_end_at[0] = [new v(-1, 0, 0, 0, "BOS", 0, 0, "")]), (this.eos_pos = 1);
						}
						(j.prototype.append = function (f) {
							var n = f.start_pos + f.length - 1;
							this.eos_pos < n && (this.eos_pos = n);
							var z = this.nodes_end_at[n];
							null == z && (z = []), z.push(f), (this.nodes_end_at[n] = z);
						}),
							(j.prototype.appendEos = function () {
								var f = this.nodes_end_at.length;
								this.eos_pos++, (this.nodes_end_at[f] = [new v(-1, 0, this.eos_pos, 0, "EOS", 0, 0, "")]);
							}),
							(n.exports = j);
					},
					{ "./ViterbiNode": 23 }
				],
				23: [
					function (f, n, z) {
						"use strict";
						n.exports = function (f, n, z, v, j, x, O, P) {
							(this.name = f),
								(this.cost = n),
								(this.start_pos = z),
								(this.length = v),
								(this.left_id = x),
								(this.right_id = O),
								(this.prev = null),
								(this.surface_form = P),
								(this.shortest_cost = "BOS" === j ? 0 : Number.MAX_VALUE),
								(this.type = j);
						};
					},
					{}
				],
				24: [
					function (f, n, z) {
						"use strict";
						function v(f) {
							this.connection_costs = f;
						}
						(v.prototype.search = function (f) {
							return (f = this.forward(f)), this.backward(f);
						}),
							(v.prototype.forward = function (f) {
								var n, z, v;
								for (n = 1; n <= f.eos_pos; n++) {
									var j = f.nodes_end_at[n];
									if (null != j)
										for (z = 0; z < j.length; z++) {
											var x,
												O = j[z],
												P = Number.MAX_VALUE,
												h = f.nodes_end_at[O.start_pos - 1];
											if (null != h) {
												for (v = 0; v < h.length; v++) {
													var c,
														l = h[v];
													null == O.left_id || null == l.right_id
														? (console.log("Left or right is null"), (c = 0))
														: (c = this.connection_costs.get(l.right_id, O.left_id));
													var e = l.shortest_cost + c + O.cost;
													e < P && ((x = l), (P = e));
												}
												(O.prev = x), (O.shortest_cost = P);
											}
										}
								}
								return f;
							}),
							(v.prototype.backward = function (f) {
								var n = [],
									z = f.nodes_end_at[f.nodes_end_at.length - 1][0].prev;
								if (null == z) return [];
								for (; "BOS" !== z.type; ) {
									if ((n.push(z), null == z.prev)) return [];
									z = z.prev;
								}
								return n.reverse();
							}),
							(n.exports = v);
					},
					{}
				],
				25: [
					function (f, n, z) {
						(function (f) {
							function n(f, n) {
								for (var z = 0, v = f.length - 1; v >= 0; v--) {
									var j = f[v];
									"." === j ? f.splice(v, 1) : ".." === j ? (f.splice(v, 1), z++) : z && (f.splice(v, 1), z--);
								}
								if (n) for (; z--; z) f.unshift("..");
								return f;
							}
							function v(f, n) {
								if (f.filter) return f.filter(n);
								for (var z = [], v = 0; v < f.length; v++) n(f[v], v, f) && z.push(f[v]);
								return z;
							}
							(z.resolve = function () {
								for (var z = "", j = !1, x = arguments.length - 1; x >= -1 && !j; x--) {
									var O = x >= 0 ? arguments[x] : f.cwd();
									if ("string" != typeof O) throw new TypeError("Arguments to path.resolve must be strings");
									O && ((z = O + "/" + z), (j = "/" === O.charAt(0)));
								}
								return (
									(j ? "/" : "") +
										(z = n(
											v(z.split("/"), function (f) {
												return !!f;
											}),
											!j
										).join("/")) || "."
								);
							}),
								(z.normalize = function (f) {
									var x = z.isAbsolute(f),
										O = "/" === j(f, -1);
									return (
										(f = n(
											v(f.split("/"), function (f) {
												return !!f;
											}),
											!x
										).join("/")) ||
											x ||
											(f = "."),
										f && O && (f += "/"),
										(x ? "/" : "") + f
									);
								}),
								(z.isAbsolute = function (f) {
									return "/" === f.charAt(0);
								}),
								(z.join = function () {
									var f = Array.prototype.slice.call(arguments, 0);
									return z.normalize(
										v(f, function (f, n) {
											if ("string" != typeof f) throw new TypeError("Arguments to path.join must be strings");
											return f;
										}).join("/")
									);
								}),
								(z.relative = function (f, n) {
									function v(f) {
										for (var n = 0; n < f.length && "" === f[n]; n++);
										for (var z = f.length - 1; z >= 0 && "" === f[z]; z--);
										return n > z ? [] : f.slice(n, z - n + 1);
									}
									(f = z.resolve(f).substr(1)), (n = z.resolve(n).substr(1));
									for (var j = v(f.split("/")), x = v(n.split("/")), O = Math.min(j.length, x.length), P = O, h = 0; h < O; h++)
										if (j[h] !== x[h]) {
											P = h;
											break;
										}
									var c = [];
									for (h = P; h < j.length; h++) c.push("..");
									return (c = c.concat(x.slice(P))).join("/");
								}),
								(z.sep = "/"),
								(z.delimiter = ":"),
								(z.dirname = function (f) {
									if (("string" != typeof f && (f += ""), 0 === f.length)) return ".";
									for (var n = f.charCodeAt(0), z = 47 === n, v = -1, j = !0, x = f.length - 1; x >= 1; --x)
										if (47 === (n = f.charCodeAt(x))) {
											if (!j) {
												v = x;
												break;
											}
										} else j = !1;
									return -1 === v ? (z ? "/" : ".") : z && 1 === v ? "/" : f.slice(0, v);
								}),
								(z.basename = function (f, n) {
									var z = (function (f) {
										"string" != typeof f && (f += "");
										var n,
											z = 0,
											v = -1,
											j = !0;
										for (n = f.length - 1; n >= 0; --n)
											if (47 === f.charCodeAt(n)) {
												if (!j) {
													z = n + 1;
													break;
												}
											} else -1 === v && ((j = !1), (v = n + 1));
										return -1 === v ? "" : f.slice(z, v);
									})(f);
									return n && z.substr(-1 * n.length) === n && (z = z.substr(0, z.length - n.length)), z;
								}),
								(z.extname = function (f) {
									"string" != typeof f && (f += "");
									for (var n = -1, z = 0, v = -1, j = !0, x = 0, O = f.length - 1; O >= 0; --O) {
										var P = f.charCodeAt(O);
										if (47 !== P) -1 === v && ((j = !1), (v = O + 1)), 46 === P ? (-1 === n ? (n = O) : 1 !== x && (x = 1)) : -1 !== n && (x = -1);
										else if (!j) {
											z = O + 1;
											break;
										}
									}
									return -1 === n || -1 === v || 0 === x || (1 === x && n === v - 1 && n === z + 1) ? "" : f.slice(n, v);
								});
							var j =
								"b" === "ab".substr(-1)
									? function (f, n, z) {
											return f.substr(n, z);
									  }
									: function (f, n, z) {
											return n < 0 && (n = f.length + n), f.substr(n, z);
									  };
						}.call(this, f("_process")));
					},
					{ _process: 26 }
				],
				26: [
					function (f, n, z) {
						var v,
							j,
							x = (n.exports = {});
						function O() {
							throw new Error("setTimeout has not been defined");
						}
						function P() {
							throw new Error("clearTimeout has not been defined");
						}
						function h(f) {
							if (v === setTimeout) return setTimeout(f, 0);
							if ((v === O || !v) && setTimeout) return (v = setTimeout), setTimeout(f, 0);
							try {
								return v(f, 0);
							} catch (n) {
								try {
									return v.call(null, f, 0);
								} catch (n) {
									return v.call(this, f, 0);
								}
							}
						}
						!(function () {
							try {
								v = "function" == typeof setTimeout ? setTimeout : O;
							} catch (f) {
								v = O;
							}
							try {
								j = "function" == typeof clearTimeout ? clearTimeout : P;
							} catch (f) {
								j = P;
							}
						})();
						var c,
							l = [],
							e = !1,
							I = -1;
						function M() {
							e && c && ((e = !1), c.length ? (l = c.concat(l)) : (I = -1), l.length && y());
						}
						function y() {
							if (!e) {
								var f = h(M);
								e = !0;
								for (var n = l.length; n; ) {
									for (c = l, l = []; ++I < n; ) c && c[I].run();
									(I = -1), (n = l.length);
								}
								(c = null),
									(e = !1),
									(function (f) {
										if (j === clearTimeout) return clearTimeout(f);
										if ((j === P || !j) && clearTimeout) return (j = clearTimeout), clearTimeout(f);
										try {
											j(f);
										} catch (n) {
											try {
												return j.call(null, f);
											} catch (n) {
												return j.call(this, f);
											}
										}
									})(f);
							}
						}
						function E(f, n) {
							(this.fun = f), (this.array = n);
						}
						function r() {}
						(x.nextTick = function (f) {
							var n = new Array(arguments.length - 1);
							if (arguments.length > 1) for (var z = 1; z < arguments.length; z++) n[z - 1] = arguments[z];
							l.push(new E(f, n)), 1 !== l.length || e || h(y);
						}),
							(E.prototype.run = function () {
								this.fun.apply(null, this.array);
							}),
							(x.title = "browser"),
							(x.browser = !0),
							(x.env = {}),
							(x.argv = []),
							(x.version = ""),
							(x.versions = {}),
							(x.on = r),
							(x.addListener = r),
							(x.once = r),
							(x.off = r),
							(x.removeListener = r),
							(x.removeAllListeners = r),
							(x.emit = r),
							(x.prependListener = r),
							(x.prependOnceListener = r),
							(x.listeners = function (f) {
								return [];
							}),
							(x.binding = function (f) {
								throw new Error("process.binding is not supported");
							}),
							(x.cwd = function () {
								return "/";
							}),
							(x.chdir = function (f) {
								throw new Error("process.chdir is not supported");
							}),
							(x.umask = function () {
								return 0;
							});
					},
					{}
				],
				27: [
					function (f, n, z) {
						(function (n, v) {
							var j = f("process/browser.js").nextTick,
								x = Function.prototype.apply,
								O = Array.prototype.slice,
								P = {},
								h = 0;
							function c(f, n) {
								(this._id = f), (this._clearFn = n);
							}
							(z.setTimeout = function () {
								return new c(x.call(setTimeout, window, arguments), clearTimeout);
							}),
								(z.setInterval = function () {
									return new c(x.call(setInterval, window, arguments), clearInterval);
								}),
								(z.clearTimeout = z.clearInterval =
									function (f) {
										f.close();
									}),
								(c.prototype.unref = c.prototype.ref = function () {}),
								(c.prototype.close = function () {
									this._clearFn.call(window, this._id);
								}),
								(z.enroll = function (f, n) {
									clearTimeout(f._idleTimeoutId), (f._idleTimeout = n);
								}),
								(z.unenroll = function (f) {
									clearTimeout(f._idleTimeoutId), (f._idleTimeout = -1);
								}),
								(z._unrefActive = z.active =
									function (f) {
										clearTimeout(f._idleTimeoutId);
										var n = f._idleTimeout;
										n >= 0 &&
											(f._idleTimeoutId = setTimeout(function () {
												f._onTimeout && f._onTimeout();
											}, n));
									}),
								(z.setImmediate =
									"function" == typeof n
										? n
										: function (f) {
												var n = h++,
													v = !(arguments.length < 2) && O.call(arguments, 1);
												return (
													(P[n] = !0),
													j(function () {
														P[n] && (v ? f.apply(null, v) : f.call(null), z.clearImmediate(n));
													}),
													n
												);
										  }),
								(z.clearImmediate =
									"function" == typeof v
										? v
										: function (f) {
												delete P[f];
										  });
						}.call(this, f("timers").setImmediate, f("timers").clearImmediate));
					},
					{ "process/browser.js": 26, timers: 27 }
				],
				28: [
					function (f, n, z) {
						/** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */ (function () {
							"use strict";
							function f(f) {
								throw f;
							}
							var n = void 0,
								z = this;
							function v(f, v) {
								var j,
									x = f.split("."),
									O = z;
								!(x[0] in O) && O.execScript && O.execScript("var " + x[0]);
								for (; x.length && (j = x.shift()); ) x.length || v === n ? (O = O[j] ? O[j] : (O[j] = {})) : (O[j] = v);
							}
							var j,
								x =
									"undefined" != typeof Uint8Array &&
									"undefined" != typeof Uint16Array &&
									"undefined" != typeof Uint32Array &&
									"undefined" != typeof DataView;
							for (new (x ? Uint8Array : Array)(256), j = 0; 256 > j; ++j) for (var O = (O = j) >>> 1; O; O >>>= 1);
							function P(f, n, z) {
								var v,
									j = "number" == typeof n ? n : (n = 0),
									x = "number" == typeof z ? z : f.length;
								for (v = -1, j = 7 & x; j--; ++n) v = (v >>> 8) ^ c[255 & (v ^ f[n])];
								for (j = x >> 3; j--; n += 8)
									v =
										((v =
											((v =
												((v =
													((v =
														((v = ((v = ((v = (v >>> 8) ^ c[255 & (v ^ f[n])]) >>> 8) ^ c[255 & (v ^ f[n + 1])]) >>> 8) ^ c[255 & (v ^ f[n + 2])]) >>>
															8) ^
														c[255 & (v ^ f[n + 3])]) >>>
														8) ^
													c[255 & (v ^ f[n + 4])]) >>>
													8) ^
												c[255 & (v ^ f[n + 5])]) >>>
												8) ^
											c[255 & (v ^ f[n + 6])]) >>>
											8) ^
										c[255 & (v ^ f[n + 7])];
								return (4294967295 ^ v) >>> 0;
							}
							var h = [
									0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685, 2657392035, 249268274, 2044508324, 3772115230, 2547177864,
									162941995, 2125561021, 3887607047, 2428444049, 498536548, 1789927666, 4089016648, 2227061214, 450548861, 1843258603, 4107580753,
									2211677639, 325883990, 1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755, 2366115317, 997073096, 1281953886,
									3579855332, 2724688242, 1006888145, 1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206, 2898065728, 853044451,
									1172266101, 3705015759, 2882616665, 651767980, 1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705, 3099436303,
									671266974, 1594198024, 3322730930, 2970347812, 795835527, 1483230225, 3244367275, 3060149565, 1994146192, 31158534, 2563907772,
									4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290, 251722036, 2517215374, 3775830040, 2137656763, 141376813,
									2439277719, 3865271297, 1802195444, 476864866, 2238001368, 4066508878, 1812370925, 453092731, 2181625025, 4111451223, 1706088902,
									314042704, 2344532202, 4240017532, 1658658271, 366619977, 2362670323, 4224994405, 1303535960, 984961486, 2747007092, 3569037538,
									1256170817, 1037604311, 2765210733, 3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467, 855842277, 2852801631,
									3708648649, 1342533948, 654459306, 3188396048, 3373015174, 1466479909, 544179635, 3110523913, 3462522015, 1591671054, 702138776,
									2966460450, 3352799412, 1504918807, 783551873, 3082640443, 3233442989, 3988292384, 2596254646, 62317068, 1957810842, 3939845945,
									2647816111, 81470997, 1943803523, 3814918930, 2489596804, 225274430, 2053790376, 3826175755, 2466906013, 167816743, 2097651377,
									4027552580, 2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225, 1852507879, 4275313526, 2312317920, 282753626,
									1742555852, 4189708143, 2394877945, 397917763, 1622183637, 3604390888, 2714866558, 953729732, 1340076626, 3518719985, 2797360999,
									1068828381, 1219638859, 3624741850, 2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135, 1181335161, 3412177804,
									3160834842, 628085408, 1382605366, 3423369109, 3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954, 1555261956,
									3268935591, 3050360625, 752459403, 1541320221, 2607071920, 3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877,
									83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603, 3855990285, 2094854071, 198958881, 2262029012, 4057260610,
									1759359992, 534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934, 4279200368, 1711684554, 285281116, 2405801727,
									4167216745, 1634467795, 376229701, 2685067896, 3608007406, 1308918612, 956543938, 2808555105, 3495958263, 1231636301, 1047427035,
									2932959818, 3654703836, 1088359270, 936918e3, 2847714899, 3736837829, 1202900863, 817233897, 3183342108, 3401237130, 1404277552,
									615818150, 3134207493, 3453421203, 1423857449, 601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471, 3272380065,
									1510334235, 755167117
								],
								c = x ? new Uint32Array(h) : h;
							function l() {}
							function e(f) {
								var n,
									z,
									v,
									j,
									O,
									P,
									h,
									c,
									l,
									e,
									I = f.length,
									M = 0,
									y = Number.POSITIVE_INFINITY;
								for (c = 0; c < I; ++c) f[c] > M && (M = f[c]), f[c] < y && (y = f[c]);
								for (n = 1 << M, z = new (x ? Uint32Array : Array)(n), v = 1, j = 0, O = 2; v <= M; ) {
									for (c = 0; c < I; ++c)
										if (f[c] === v) {
											for (P = 0, h = j, l = 0; l < v; ++l) (P = (P << 1) | (1 & h)), (h >>= 1);
											for (e = (v << 16) | c, l = P; l < n; l += O) z[l] = e;
											++j;
										}
									++v, (j <<= 1), (O <<= 1);
								}
								return [z, M, y];
							}
							(l.prototype.getName = function () {
								return this.name;
							}),
								(l.prototype.getData = function () {
									return this.data;
								}),
								(l.prototype.G = function () {
									return this.H;
								});
							var I,
								M = [];
							for (I = 0; 288 > I; I++)
								switch (!0) {
									case 143 >= I:
										M.push([I + 48, 8]);
										break;
									case 255 >= I:
										M.push([I - 144 + 400, 9]);
										break;
									case 279 >= I:
										M.push([I - 256 + 0, 7]);
										break;
									case 287 >= I:
										M.push([I - 280 + 192, 8]);
										break;
									default:
										f("invalid literal: " + I);
								}
							var y = (function () {
								function n(n) {
									switch (!0) {
										case 3 === n:
											return [257, n - 3, 0];
										case 4 === n:
											return [258, n - 4, 0];
										case 5 === n:
											return [259, n - 5, 0];
										case 6 === n:
											return [260, n - 6, 0];
										case 7 === n:
											return [261, n - 7, 0];
										case 8 === n:
											return [262, n - 8, 0];
										case 9 === n:
											return [263, n - 9, 0];
										case 10 === n:
											return [264, n - 10, 0];
										case 12 >= n:
											return [265, n - 11, 1];
										case 14 >= n:
											return [266, n - 13, 1];
										case 16 >= n:
											return [267, n - 15, 1];
										case 18 >= n:
											return [268, n - 17, 1];
										case 22 >= n:
											return [269, n - 19, 2];
										case 26 >= n:
											return [270, n - 23, 2];
										case 30 >= n:
											return [271, n - 27, 2];
										case 34 >= n:
											return [272, n - 31, 2];
										case 42 >= n:
											return [273, n - 35, 3];
										case 50 >= n:
											return [274, n - 43, 3];
										case 58 >= n:
											return [275, n - 51, 3];
										case 66 >= n:
											return [276, n - 59, 3];
										case 82 >= n:
											return [277, n - 67, 4];
										case 98 >= n:
											return [278, n - 83, 4];
										case 114 >= n:
											return [279, n - 99, 4];
										case 130 >= n:
											return [280, n - 115, 4];
										case 162 >= n:
											return [281, n - 131, 5];
										case 194 >= n:
											return [282, n - 163, 5];
										case 226 >= n:
											return [283, n - 195, 5];
										case 257 >= n:
											return [284, n - 227, 5];
										case 258 === n:
											return [285, n - 258, 0];
										default:
											f("invalid length: " + n);
									}
								}
								var z,
									v,
									j = [];
								for (z = 3; 258 >= z; z++) (v = n(z)), (j[z] = (v[2] << 24) | (v[1] << 16) | v[0]);
								return j;
							})();
							function E(n, z) {
								switch (
									((this.i = []),
									(this.j = 32768),
									(this.d = this.f = this.c = this.n = 0),
									(this.input = x ? new Uint8Array(n) : n),
									(this.o = !1),
									(this.k = K),
									(this.w = !1),
									(!z && (z = {})) ||
										(z.index && (this.c = z.index),
										z.bufferSize && (this.j = z.bufferSize),
										z.bufferType && (this.k = z.bufferType),
										z.resize && (this.w = z.resize)),
									this.k)
								) {
									case r:
										(this.a = 32768), (this.b = new (x ? Uint8Array : Array)(32768 + this.j + 258));
										break;
									case K:
										(this.a = 0), (this.b = new (x ? Uint8Array : Array)(this.j)), (this.e = this.D), (this.q = this.A), (this.l = this.C);
										break;
									default:
										f(Error("invalid inflate mode"));
								}
							}
							x && new Uint32Array(y);
							var r = 0,
								K = 1;
							E.prototype.g = function () {
								for (; !this.o; ) {
									var z = k(this, 3);
									switch ((1 & z && (this.o = !0), (z >>>= 1))) {
										case 0:
											var v = this.input,
												j = this.c,
												O = this.b,
												P = this.a,
												h = v.length,
												c = n,
												l = O.length,
												I = n;
											switch (
												((this.d = this.f = 0),
												j + 1 >= h && f(Error("invalid uncompressed block header: LEN")),
												(c = v[j++] | (v[j++] << 8)),
												j + 1 >= h && f(Error("invalid uncompressed block header: NLEN")),
												c === ~(v[j++] | (v[j++] << 8)) && f(Error("invalid uncompressed block header: length verify")),
												j + c > v.length && f(Error("input buffer is broken")),
												this.k)
											) {
												case r:
													for (; P + c > O.length; ) {
														if (((c -= I = l - P), x)) O.set(v.subarray(j, j + I), P), (P += I), (j += I);
														else for (; I--; ) O[P++] = v[j++];
														(this.a = P), (O = this.e()), (P = this.a);
													}
													break;
												case K:
													for (; P + c > O.length; ) O = this.e({ t: 2 });
													break;
												default:
													f(Error("invalid inflate mode"));
											}
											if (x) O.set(v.subarray(j, j + c), P), (P += c), (j += c);
											else for (; c--; ) O[P++] = v[j++];
											(this.c = j), (this.a = P), (this.b = O);
											break;
										case 1:
											this.l(U, o);
											break;
										case 2:
											var M,
												y,
												E,
												A,
												i = k(this, 5) + 257,
												t = k(this, 5) + 1,
												Z = k(this, 4) + 4,
												p = new (x ? Uint8Array : Array)(X.length),
												H = n,
												u = n,
												S = n,
												G = n,
												T = n;
											for (T = 0; T < Z; ++T) p[X[T]] = k(this, 3);
											if (!x) for (T = Z, Z = p.length; T < Z; ++T) p[X[T]] = 0;
											for (M = e(p), H = new (x ? Uint8Array : Array)(i + t), T = 0, A = i + t; T < A; )
												switch (((u = d(this, M)), u)) {
													case 16:
														for (G = 3 + k(this, 2); G--; ) H[T++] = S;
														break;
													case 17:
														for (G = 3 + k(this, 3); G--; ) H[T++] = 0;
														S = 0;
														break;
													case 18:
														for (G = 11 + k(this, 7); G--; ) H[T++] = 0;
														S = 0;
														break;
													default:
														S = H[T++] = u;
												}
											(y = e(x ? H.subarray(0, i) : H.slice(0, i))), (E = e(x ? H.subarray(i) : H.slice(i))), this.l(y, E);
											break;
										default:
											f(Error("unknown BTYPE: " + z));
									}
								}
								return this.q();
							};
							var A,
								i,
								t = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
								X = x ? new Uint16Array(t) : t,
								Z = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 258, 258],
								p = x ? new Uint16Array(Z) : Z,
								H = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0],
								u = x ? new Uint8Array(H) : H,
								S = [
									1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289,
									16385, 24577
								],
								G = x ? new Uint16Array(S) : S,
								T = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13],
								W = x ? new Uint8Array(T) : T,
								Q = new (x ? Uint8Array : Array)(288);
							for (A = 0, i = Q.length; A < i; ++A) Q[A] = 143 >= A ? 8 : 255 >= A ? 9 : 279 >= A ? 7 : 8;
							var a,
								J,
								U = e(Q),
								Y = new (x ? Uint8Array : Array)(30);
							for (a = 0, J = Y.length; a < J; ++a) Y[a] = 5;
							var o = e(Y);
							function k(n, z) {
								for (var v, j = n.f, x = n.d, O = n.input, P = n.c, h = O.length; x < z; )
									P >= h && f(Error("input buffer is broken")), (j |= O[P++] << x), (x += 8);
								return (v = j & ((1 << z) - 1)), (n.f = j >>> z), (n.d = x - z), (n.c = P), v;
							}
							function d(n, z) {
								for (var v, j, x = n.f, O = n.d, P = n.input, h = n.c, c = P.length, l = z[0], e = z[1]; O < e && !(h >= c); )
									(x |= P[h++] << O), (O += 8);
								return (
									(j = (v = l[x & ((1 << e) - 1)]) >>> 16) > O && f(Error("invalid code length: " + j)),
									(n.f = x >> j),
									(n.d = O - j),
									(n.c = h),
									65535 & v
								);
							}
							function m(f) {
								(this.input = f), (this.c = 0), (this.m = []), (this.s = !1);
							}
							(E.prototype.l = function (f, n) {
								var z = this.b,
									v = this.a;
								this.r = f;
								for (var j, x, O, P, h = z.length - 258; 256 !== (j = d(this, f)); )
									if (256 > j) v >= h && ((this.a = v), (z = this.e()), (v = this.a)), (z[v++] = j);
									else
										for (
											P = p[(x = j - 257)],
												0 < u[x] && (P += k(this, u[x])),
												j = d(this, n),
												O = G[j],
												0 < W[j] && (O += k(this, W[j])),
												v >= h && ((this.a = v), (z = this.e()), (v = this.a));
											P--;

										)
											z[v] = z[v++ - O];
								for (; 8 <= this.d; ) (this.d -= 8), this.c--;
								this.a = v;
							}),
								(E.prototype.C = function (f, n) {
									var z = this.b,
										v = this.a;
									this.r = f;
									for (var j, x, O, P, h = z.length; 256 !== (j = d(this, f)); )
										if (256 > j) v >= h && (h = (z = this.e()).length), (z[v++] = j);
										else
											for (
												P = p[(x = j - 257)],
													0 < u[x] && (P += k(this, u[x])),
													j = d(this, n),
													O = G[j],
													0 < W[j] && (O += k(this, W[j])),
													v + P > h && (h = (z = this.e()).length);
												P--;

											)
												z[v] = z[v++ - O];
									for (; 8 <= this.d; ) (this.d -= 8), this.c--;
									this.a = v;
								}),
								(E.prototype.e = function () {
									var f,
										n,
										z = new (x ? Uint8Array : Array)(this.a - 32768),
										v = this.a - 32768,
										j = this.b;
									if (x) z.set(j.subarray(32768, z.length));
									else for (f = 0, n = z.length; f < n; ++f) z[f] = j[f + 32768];
									if ((this.i.push(z), (this.n += z.length), x)) j.set(j.subarray(v, v + 32768));
									else for (f = 0; 32768 > f; ++f) j[f] = j[v + f];
									return (this.a = 32768), j;
								}),
								(E.prototype.D = function (f) {
									var n,
										z,
										v,
										j = (this.input.length / this.c + 1) | 0,
										O = this.input,
										P = this.b;
									return (
										f && ("number" == typeof f.t && (j = f.t), "number" == typeof f.z && (j += f.z)),
										(z = 2 > j ? ((v = (((O.length - this.c) / this.r[2] / 2) * 258) | 0) < P.length ? P.length + v : P.length << 1) : P.length * j),
										x ? (n = new Uint8Array(z)).set(P) : (n = P),
										(this.b = n)
									);
								}),
								(E.prototype.q = function () {
									var f,
										n,
										z,
										v,
										j,
										O = 0,
										P = this.b,
										h = this.i,
										c = new (x ? Uint8Array : Array)(this.n + (this.a - 32768));
									if (0 === h.length) return x ? this.b.subarray(32768, this.a) : this.b.slice(32768, this.a);
									for (n = 0, z = h.length; n < z; ++n) for (v = 0, j = (f = h[n]).length; v < j; ++v) c[O++] = f[v];
									for (n = 32768, z = this.a; n < z; ++n) c[O++] = P[n];
									return (this.i = []), (this.buffer = c);
								}),
								(E.prototype.A = function () {
									var f,
										n = this.a;
									return (
										x
											? this.w
												? (f = new Uint8Array(n)).set(this.b.subarray(0, n))
												: (f = this.b.subarray(0, n))
											: (this.b.length > n && (this.b.length = n), (f = this.b)),
										(this.buffer = f)
									);
								}),
								(m.prototype.F = function () {
									return this.s || this.g(), this.m.slice();
								}),
								(m.prototype.g = function () {
									for (var z = this.input.length; this.c < z; ) {
										var v,
											j,
											O = new l(),
											h = n,
											c = n,
											e = n,
											I = n,
											M = n,
											y = n,
											r = n,
											K = this.input,
											A = this.c;
										if (
											((O.u = K[A++]),
											(O.v = K[A++]),
											(31 !== O.u || 139 !== O.v) && f(Error("invalid file signature:" + O.u + "," + O.v)),
											(O.p = K[A++]),
											8 === O.p || f(Error("unknown compression method: " + O.p)),
											(O.h = K[A++]),
											(j = K[A++] | (K[A++] << 8) | (K[A++] << 16) | (K[A++] << 24)),
											(O.H = new Date(1e3 * j)),
											(O.N = K[A++]),
											(O.M = K[A++]),
											0 < (4 & O.h) && ((O.I = K[A++] | (K[A++] << 8)), (A += O.I)),
											0 < (8 & O.h))
										) {
											for (y = [], M = 0; 0 < (I = K[A++]); ) y[M++] = String.fromCharCode(I);
											O.name = y.join("");
										}
										if (0 < (16 & O.h)) {
											for (y = [], M = 0; 0 < (I = K[A++]); ) y[M++] = String.fromCharCode(I);
											O.J = y.join("");
										}
										0 < (2 & O.h) && ((O.B = 65535 & P(K, 0, A)), O.B !== (K[A++] | (K[A++] << 8)) && f(Error("invalid header crc16"))),
											(h = K[K.length - 4] | (K[K.length - 3] << 8) | (K[K.length - 2] << 16) | (K[K.length - 1] << 24)),
											K.length - A - 4 - 4 < 512 * h && (e = h),
											(c = new E(K, { index: A, bufferSize: e })),
											(O.data = v = c.g()),
											(A = c.c),
											(O.K = r = (K[A++] | (K[A++] << 8) | (K[A++] << 16) | (K[A++] << 24)) >>> 0),
											P(v, n, n) !== r && f(Error("invalid CRC-32 checksum: 0x" + P(v, n, n).toString(16) + " / 0x" + r.toString(16))),
											(O.L = h = (K[A++] | (K[A++] << 8) | (K[A++] << 16) | (K[A++] << 24)) >>> 0),
											(4294967295 & v.length) !== h && f(Error("invalid input size: " + (4294967295 & v.length) + " / " + h)),
											this.m.push(O),
											(this.c = A);
									}
									this.s = !0;
									var i,
										t,
										X,
										Z = this.m,
										p = 0,
										H = 0;
									for (i = 0, t = Z.length; i < t; ++i) H += Z[i].data.length;
									if (x) for (X = new Uint8Array(H), i = 0; i < t; ++i) X.set(Z[i].data, p), (p += Z[i].data.length);
									else {
										for (X = [], i = 0; i < t; ++i) X[i] = Z[i].data;
										X = Array.prototype.concat.apply([], X);
									}
									return X;
								}),
								v("Zlib.Gunzip", m),
								v("Zlib.Gunzip.prototype.decompress", m.prototype.g),
								v("Zlib.Gunzip.prototype.getMembers", m.prototype.F),
								v("Zlib.GunzipMember", l),
								v("Zlib.GunzipMember.prototype.getName", l.prototype.getName),
								v("Zlib.GunzipMember.prototype.getData", l.prototype.getData),
								v("Zlib.GunzipMember.prototype.getMtime", l.prototype.G);
						}.call(this));
					},
					{}
				],
				29: [
					function (f, n, z) {
						"use strict";
						Object.defineProperty(z, "__esModule", { value: !0 });
						var v,
							j = (function () {
								function f(f, n) {
									for (var z = 0; z < n.length; z++) {
										var v = n[z];
										(v.enumerable = v.enumerable || !1), (v.configurable = !0), "value" in v && (v.writable = !0), Object.defineProperty(f, v.key, v);
									}
								}
								return function (n, z, v) {
									return z && f(n.prototype, z), v && f(n, v), n;
								};
							})(),
							x = (v = f("kuromoji")) && v.__esModule ? v : { default: v };
						function O(f, n) {
							if (!(f instanceof n)) throw new TypeError("Cannot call a class as a function");
						}
						var P = !1;
						"undefined" == typeof window && void 0 !== n && n.exports && (P = !0);
						var h = (function () {
							function n() {
								var z = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
									v = z.dictPath;
								O(this, n),
									(this._analyzer = null),
									(this._dictPath = v || (P ? f.resolve("kuromoji").replace(/src(?!.*src).*/, "dict/") : "node_modules/kuromoji/dict/"));
							}
							return (
								j(n, [
									{
										key: "init",
										value: function () {
											var f = this;
											return new Promise(function (n, z) {
												var v = f;
												null == f._analyzer
													? x.default.builder({ dicPath: f._dictPath }).build(function (f, j) {
															if (f) return z(f);
															(v._analyzer = j), n();
													  })
													: z(new Error("This analyzer has already been initialized."));
											});
										}
									},
									{
										key: "parse",
										value: function () {
											var f = this,
												n = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "";
											return new Promise(function (z, v) {
												if ("" === n.trim()) return z([]);
												for (var j = f._analyzer.tokenize(n), x = 0; x < j.length; x++)
													(j[x].verbose = {}),
														(j[x].verbose.word_id = j[x].word_id),
														(j[x].verbose.word_type = j[x].word_type),
														(j[x].verbose.word_position = j[x].word_position),
														delete j[x].word_id,
														delete j[x].word_type,
														delete j[x].word_position;
												z(j);
											});
										}
									}
								]),
								n
							);
						})();
						(z.default = h), (n.exports = z.default);
					},
					{ kuromoji: 15 }
				]
			},
			{},
			[29]
		)(29);
	});

const dict1_url = "https://cdn.jsdelivr.net/gh/spicetify/spicetify-lyrics-romaji@main/dictionary/split_1.js";
const dict2_url = "https://cdn.jsdelivr.net/gh/spicetify/spicetify-lyrics-romaji@main/dictionary/split_2.js";

class Translator {
	constructor() {
		this.kuroshiro = new Kuroshiro.default();
		this.missingdicts = true;
		this.initializing = false;
		this.downloadingdicts = false;
		this.finished = false;
		this.init();
	}

	init() {
		if (typeof base_dat_gz === "undefined" || typeof tid_pos_dat_gz === "undefined") {
			if (!this.downloadingdicts) {
				setTimeout(this.include_external.bind(this), 0, dict1_url);
				setTimeout(this.include_external.bind(this), 0, dict2_url);
				this.downloadingdicts = true;
			}
			setTimeout(this.init.bind(this), 100);
			return;
		}
		this.missingdicts = false;
		this.initializing = true;
		this.kuroshiro.init(new KuromojiAnalyzer()).then(() => {
			this.initializing = false;
			this.finished = true;
		});
	}

	include_external(url) {
		var s = document.createElement("script");
		s.setAttribute("type", "text/javascript");
		s.setAttribute("src", url);
		var nodes = document.getElementsByTagName("*");
		var node = nodes[nodes.length - 1].parentNode;
		node.appendChild(s);
	}

	async romajifyText(text, target = "romaji", mode = "spaced") {
		if (!this.finished) {
			setTimeout(this.romajifyText.bind(this), 100, text, target, mode);
			return;
		}

		return this.kuroshiro.convert(text, {
			to: target,
			mode: mode
		});
	}
}
