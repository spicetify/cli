(function (f) {
	if (typeof exports === "object" && typeof module !== "undefined") {
		module.exports = f();
	} else if (typeof define === "function" && define.amd) {
		define([], f);
	} else {
		var g;
		if (typeof window !== "undefined") {
			g = window;
		} else if (typeof global !== "undefined") {
			g = global;
		} else if (typeof self !== "undefined") {
			g = self;
		} else {
			g = this;
		}
		g.Kuroshiro = f();
	}
})(function () {
	var define, module, exports;
	return (function () {
		function r(e, n, t) {
			function o(i, f) {
				if (!n[i]) {
					if (!e[i]) {
						var c = "function" == typeof require && require;
						if (!f && c) return c(i, !0);
						if (u) return u(i, !0);
						var a = new Error("Cannot find module '" + i + "'");
						throw ((a.code = "MODULE_NOT_FOUND"), a);
					}
					var p = (n[i] = { exports: {} });
					e[i][0].call(
						p.exports,
						function (r) {
							var n = e[i][1][r];
							return o(n || r);
						},
						p,
						p.exports,
						r,
						e,
						n,
						t
					);
				}
				return n[i].exports;
			}
			for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
			return o;
		}
		return r;
	})()(
		{
			1: [
				function (require, module, exports) {
					module.exports = require("regenerator-runtime");
				},
				{ "regenerator-runtime": 2 }
			],
			2: [
				function (require, module, exports) {
					/**
					 * Copyright (c) 2014-present, Facebook, Inc.
					 *
					 * This source code is licensed under the MIT license found in the
					 * LICENSE file in the root directory of this source tree.
					 */

					var runtime = (function (exports) {
						"use strict";

						var Op = Object.prototype;
						var hasOwn = Op.hasOwnProperty;
						var undefined; // More compressible than void 0.
						var $Symbol = typeof Symbol === "function" ? Symbol : {};
						var iteratorSymbol = $Symbol.iterator || "@@iterator";
						var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
						var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

						function define(obj, key, value) {
							Object.defineProperty(obj, key, {
								value: value,
								enumerable: true,
								configurable: true,
								writable: true
							});
							return obj[key];
						}
						try {
							// IE 8 has a broken Object.defineProperty that only works on DOM objects.
							define({}, "");
						} catch (err) {
							define = function (obj, key, value) {
								return (obj[key] = value);
							};
						}

						function wrap(innerFn, outerFn, self, tryLocsList) {
							// If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
							var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
							var generator = Object.create(protoGenerator.prototype);
							var context = new Context(tryLocsList || []);

							// The ._invoke method unifies the implementations of the .next,
							// .throw, and .return methods.
							generator._invoke = makeInvokeMethod(innerFn, self, context);

							return generator;
						}
						exports.wrap = wrap;

						// Try/catch helper to minimize deoptimizations. Returns a completion
						// record like context.tryEntries[i].completion. This interface could
						// have been (and was previously) designed to take a closure to be
						// invoked without arguments, but in all the cases we care about we
						// already have an existing method we want to call, so there's no need
						// to create a new function object. We can even get away with assuming
						// the method takes exactly one argument, since that happens to be true
						// in every case, so we don't have to touch the arguments object. The
						// only additional allocation required is the completion record, which
						// has a stable shape and so hopefully should be cheap to allocate.
						function tryCatch(fn, obj, arg) {
							try {
								return { type: "normal", arg: fn.call(obj, arg) };
							} catch (err) {
								return { type: "throw", arg: err };
							}
						}

						var GenStateSuspendedStart = "suspendedStart";
						var GenStateSuspendedYield = "suspendedYield";
						var GenStateExecuting = "executing";
						var GenStateCompleted = "completed";

						// Returning this object from the innerFn has the same effect as
						// breaking out of the dispatch switch statement.
						var ContinueSentinel = {};

						// Dummy constructor functions that we use as the .constructor and
						// .constructor.prototype properties for functions that return Generator
						// objects. For full spec compliance, you may wish to configure your
						// minifier not to mangle the names of these two functions.
						function Generator() {}
						function GeneratorFunction() {}
						function GeneratorFunctionPrototype() {}

						// This is a polyfill for %IteratorPrototype% for environments that
						// don't natively support it.
						var IteratorPrototype = {};
						IteratorPrototype[iteratorSymbol] = function () {
							return this;
						};

						var getProto = Object.getPrototypeOf;
						var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
						if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
							// This environment has a native %IteratorPrototype%; use it instead
							// of the polyfill.
							IteratorPrototype = NativeIteratorPrototype;
						}

						var Gp = (GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype));
						GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
						GeneratorFunctionPrototype.constructor = GeneratorFunction;
						GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction");

						// Helper for defining the .next, .throw, and .return methods of the
						// Iterator interface in terms of a single ._invoke method.
						function defineIteratorMethods(prototype) {
							["next", "throw", "return"].forEach(function (method) {
								define(prototype, method, function (arg) {
									return this._invoke(method, arg);
								});
							});
						}

						exports.isGeneratorFunction = function (genFun) {
							var ctor = typeof genFun === "function" && genFun.constructor;
							return ctor
								? ctor === GeneratorFunction ||
										// For the native GeneratorFunction constructor, the best we can
										// do is to check its .name property.
										(ctor.displayName || ctor.name) === "GeneratorFunction"
								: false;
						};

						exports.mark = function (genFun) {
							if (Object.setPrototypeOf) {
								Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
							} else {
								genFun.__proto__ = GeneratorFunctionPrototype;
								define(genFun, toStringTagSymbol, "GeneratorFunction");
							}
							genFun.prototype = Object.create(Gp);
							return genFun;
						};

						// Within the body of any async function, `await x` is transformed to
						// `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
						// `hasOwn.call(value, "__await")` to determine if the yielded value is
						// meant to be awaited.
						exports.awrap = function (arg) {
							return { __await: arg };
						};

						function AsyncIterator(generator, PromiseImpl) {
							function invoke(method, arg, resolve, reject) {
								var record = tryCatch(generator[method], generator, arg);
								if (record.type === "throw") {
									reject(record.arg);
								} else {
									var result = record.arg;
									var value = result.value;
									if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
										return PromiseImpl.resolve(value.__await).then(
											function (value) {
												invoke("next", value, resolve, reject);
											},
											function (err) {
												invoke("throw", err, resolve, reject);
											}
										);
									}

									return PromiseImpl.resolve(value).then(
										function (unwrapped) {
											// When a yielded Promise is resolved, its final value becomes
											// the .value of the Promise<{value,done}> result for the
											// current iteration.
											result.value = unwrapped;
											resolve(result);
										},
										function (error) {
											// If a rejected Promise was yielded, throw the rejection back
											// into the async generator function so it can be handled there.
											return invoke("throw", error, resolve, reject);
										}
									);
								}
							}

							var previousPromise;

							function enqueue(method, arg) {
								function callInvokeWithMethodAndArg() {
									return new PromiseImpl(function (resolve, reject) {
										invoke(method, arg, resolve, reject);
									});
								}

								return (previousPromise =
									// If enqueue has been called before, then we want to wait until
									// all previous Promises have been resolved before calling invoke,
									// so that results are always delivered in the correct order. If
									// enqueue has not been called before, then it is important to
									// call invoke immediately, without waiting on a callback to fire,
									// so that the async generator function has the opportunity to do
									// any necessary setup in a predictable way. This predictability
									// is why the Promise constructor synchronously invokes its
									// executor callback, and why async functions synchronously
									// execute code before the first await. Since we implement simple
									// async functions in terms of async generators, it is especially
									// important to get this right, even though it requires care.
									previousPromise
										? previousPromise.then(
												callInvokeWithMethodAndArg,
												// Avoid propagating failures to Promises returned by later
												// invocations of the iterator.
												callInvokeWithMethodAndArg
										  )
										: callInvokeWithMethodAndArg());
							}

							// Define the unified helper method that is used to implement .next,
							// .throw, and .return (see defineIteratorMethods).
							this._invoke = enqueue;
						}

						defineIteratorMethods(AsyncIterator.prototype);
						AsyncIterator.prototype[asyncIteratorSymbol] = function () {
							return this;
						};
						exports.AsyncIterator = AsyncIterator;

						// Note that simple async functions are implemented on top of
						// AsyncIterator objects; they just return a Promise for the value of
						// the final result produced by the iterator.
						exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
							if (PromiseImpl === void 0) PromiseImpl = Promise;

							var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);

							return exports.isGeneratorFunction(outerFn)
								? iter // If outerFn is a generator, return the full iterator.
								: iter.next().then(function (result) {
										return result.done ? result.value : iter.next();
								  });
						};

						function makeInvokeMethod(innerFn, self, context) {
							var state = GenStateSuspendedStart;

							return function invoke(method, arg) {
								if (state === GenStateExecuting) {
									throw new Error("Generator is already running");
								}

								if (state === GenStateCompleted) {
									if (method === "throw") {
										throw arg;
									}

									// Be forgiving, per 25.3.3.3.3 of the spec:
									// https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
									return doneResult();
								}

								context.method = method;
								context.arg = arg;

								while (true) {
									var delegate = context.delegate;
									if (delegate) {
										var delegateResult = maybeInvokeDelegate(delegate, context);
										if (delegateResult) {
											if (delegateResult === ContinueSentinel) continue;
											return delegateResult;
										}
									}

									if (context.method === "next") {
										// Setting context._sent for legacy support of Babel's
										// function.sent implementation.
										context.sent = context._sent = context.arg;
									} else if (context.method === "throw") {
										if (state === GenStateSuspendedStart) {
											state = GenStateCompleted;
											throw context.arg;
										}

										context.dispatchException(context.arg);
									} else if (context.method === "return") {
										context.abrupt("return", context.arg);
									}

									state = GenStateExecuting;

									var record = tryCatch(innerFn, self, context);
									if (record.type === "normal") {
										// If an exception is thrown from innerFn, we leave state ===
										// GenStateExecuting and loop back for another invocation.
										state = context.done ? GenStateCompleted : GenStateSuspendedYield;

										if (record.arg === ContinueSentinel) {
											continue;
										}

										return {
											value: record.arg,
											done: context.done
										};
									} else if (record.type === "throw") {
										state = GenStateCompleted;
										// Dispatch the exception by looping back around to the
										// context.dispatchException(context.arg) call above.
										context.method = "throw";
										context.arg = record.arg;
									}
								}
							};
						}

						// Call delegate.iterator[context.method](context.arg) and handle the
						// result, either by returning a { value, done } result from the
						// delegate iterator, or by modifying context.method and context.arg,
						// setting context.delegate to null, and returning the ContinueSentinel.
						function maybeInvokeDelegate(delegate, context) {
							var method = delegate.iterator[context.method];
							if (method === undefined) {
								// A .throw or .return when the delegate iterator has no .throw
								// method always terminates the yield* loop.
								context.delegate = null;

								if (context.method === "throw") {
									// Note: ["return"] must be used for ES3 parsing compatibility.
									if (delegate.iterator["return"]) {
										// If the delegate iterator has a return method, give it a
										// chance to clean up.
										context.method = "return";
										context.arg = undefined;
										maybeInvokeDelegate(delegate, context);

										if (context.method === "throw") {
											// If maybeInvokeDelegate(context) changed context.method from
											// "return" to "throw", let that override the TypeError below.
											return ContinueSentinel;
										}
									}

									context.method = "throw";
									context.arg = new TypeError("The iterator does not provide a 'throw' method");
								}

								return ContinueSentinel;
							}

							var record = tryCatch(method, delegate.iterator, context.arg);

							if (record.type === "throw") {
								context.method = "throw";
								context.arg = record.arg;
								context.delegate = null;
								return ContinueSentinel;
							}

							var info = record.arg;

							if (!info) {
								context.method = "throw";
								context.arg = new TypeError("iterator result is not an object");
								context.delegate = null;
								return ContinueSentinel;
							}

							if (info.done) {
								// Assign the result of the finished delegate to the temporary
								// variable specified by delegate.resultName (see delegateYield).
								context[delegate.resultName] = info.value;

								// Resume execution at the desired location (see delegateYield).
								context.next = delegate.nextLoc;

								// If context.method was "throw" but the delegate handled the
								// exception, let the outer generator proceed normally. If
								// context.method was "next", forget context.arg since it has been
								// "consumed" by the delegate iterator. If context.method was
								// "return", allow the original .return call to continue in the
								// outer generator.
								if (context.method !== "return") {
									context.method = "next";
									context.arg = undefined;
								}
							} else {
								// Re-yield the result returned by the delegate method.
								return info;
							}

							// The delegate iterator is finished, so forget it and continue with
							// the outer generator.
							context.delegate = null;
							return ContinueSentinel;
						}

						// Define Generator.prototype.{next,throw,return} in terms of the
						// unified ._invoke helper method.
						defineIteratorMethods(Gp);

						define(Gp, toStringTagSymbol, "Generator");

						// A Generator should always return itself as the iterator object when the
						// @@iterator function is called on it. Some browsers' implementations of the
						// iterator prototype chain incorrectly implement this, causing the Generator
						// object to not be returned from this call. This ensures that doesn't happen.
						// See https://github.com/facebook/regenerator/issues/274 for more details.
						Gp[iteratorSymbol] = function () {
							return this;
						};

						Gp.toString = function () {
							return "[object Generator]";
						};

						function pushTryEntry(locs) {
							var entry = { tryLoc: locs[0] };

							if (1 in locs) {
								entry.catchLoc = locs[1];
							}

							if (2 in locs) {
								entry.finallyLoc = locs[2];
								entry.afterLoc = locs[3];
							}

							this.tryEntries.push(entry);
						}

						function resetTryEntry(entry) {
							var record = entry.completion || {};
							record.type = "normal";
							delete record.arg;
							entry.completion = record;
						}

						function Context(tryLocsList) {
							// The root entry object (effectively a try statement without a catch
							// or a finally block) gives us a place to store values thrown from
							// locations where there is no enclosing try statement.
							this.tryEntries = [{ tryLoc: "root" }];
							tryLocsList.forEach(pushTryEntry, this);
							this.reset(true);
						}

						exports.keys = function (object) {
							var keys = [];
							for (var key in object) {
								keys.push(key);
							}
							keys.reverse();

							// Rather than returning an object with a next method, we keep
							// things simple and return the next function itself.
							return function next() {
								while (keys.length) {
									var key = keys.pop();
									if (key in object) {
										next.value = key;
										next.done = false;
										return next;
									}
								}

								// To avoid creating an additional object, we just hang the .value
								// and .done properties off the next function object itself. This
								// also ensures that the minifier will not anonymize the function.
								next.done = true;
								return next;
							};
						};

						function values(iterable) {
							if (iterable) {
								var iteratorMethod = iterable[iteratorSymbol];
								if (iteratorMethod) {
									return iteratorMethod.call(iterable);
								}

								if (typeof iterable.next === "function") {
									return iterable;
								}

								if (!isNaN(iterable.length)) {
									var i = -1,
										next = function next() {
											while (++i < iterable.length) {
												if (hasOwn.call(iterable, i)) {
													next.value = iterable[i];
													next.done = false;
													return next;
												}
											}

											next.value = undefined;
											next.done = true;

											return next;
										};

									return (next.next = next);
								}
							}

							// Return an iterator with no values.
							return { next: doneResult };
						}
						exports.values = values;

						function doneResult() {
							return { value: undefined, done: true };
						}

						Context.prototype = {
							constructor: Context,

							reset: function (skipTempReset) {
								this.prev = 0;
								this.next = 0;
								// Resetting context._sent for legacy support of Babel's
								// function.sent implementation.
								this.sent = this._sent = undefined;
								this.done = false;
								this.delegate = null;

								this.method = "next";
								this.arg = undefined;

								this.tryEntries.forEach(resetTryEntry);

								if (!skipTempReset) {
									for (var name in this) {
										// Not sure about the optimal order of these conditions:
										if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
											this[name] = undefined;
										}
									}
								}
							},

							stop: function () {
								this.done = true;

								var rootEntry = this.tryEntries[0];
								var rootRecord = rootEntry.completion;
								if (rootRecord.type === "throw") {
									throw rootRecord.arg;
								}

								return this.rval;
							},

							dispatchException: function (exception) {
								if (this.done) {
									throw exception;
								}

								var context = this;
								function handle(loc, caught) {
									record.type = "throw";
									record.arg = exception;
									context.next = loc;

									if (caught) {
										// If the dispatched exception was caught by a catch block,
										// then let that catch block handle the exception normally.
										context.method = "next";
										context.arg = undefined;
									}

									return !!caught;
								}

								for (var i = this.tryEntries.length - 1; i >= 0; --i) {
									var entry = this.tryEntries[i];
									var record = entry.completion;

									if (entry.tryLoc === "root") {
										// Exception thrown outside of any try block that could handle
										// it, so set the completion value of the entire function to
										// throw the exception.
										return handle("end");
									}

									if (entry.tryLoc <= this.prev) {
										var hasCatch = hasOwn.call(entry, "catchLoc");
										var hasFinally = hasOwn.call(entry, "finallyLoc");

										if (hasCatch && hasFinally) {
											if (this.prev < entry.catchLoc) {
												return handle(entry.catchLoc, true);
											} else if (this.prev < entry.finallyLoc) {
												return handle(entry.finallyLoc);
											}
										} else if (hasCatch) {
											if (this.prev < entry.catchLoc) {
												return handle(entry.catchLoc, true);
											}
										} else if (hasFinally) {
											if (this.prev < entry.finallyLoc) {
												return handle(entry.finallyLoc);
											}
										} else {
											throw new Error("try statement without catch or finally");
										}
									}
								}
							},

							abrupt: function (type, arg) {
								for (var i = this.tryEntries.length - 1; i >= 0; --i) {
									var entry = this.tryEntries[i];
									if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
										var finallyEntry = entry;
										break;
									}
								}

								if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
									// Ignore the finally entry if control is not jumping to a
									// location outside the try/catch block.
									finallyEntry = null;
								}

								var record = finallyEntry ? finallyEntry.completion : {};
								record.type = type;
								record.arg = arg;

								if (finallyEntry) {
									this.method = "next";
									this.next = finallyEntry.finallyLoc;
									return ContinueSentinel;
								}

								return this.complete(record);
							},

							complete: function (record, afterLoc) {
								if (record.type === "throw") {
									throw record.arg;
								}

								if (record.type === "break" || record.type === "continue") {
									this.next = record.arg;
								} else if (record.type === "return") {
									this.rval = this.arg = record.arg;
									this.method = "return";
									this.next = "end";
								} else if (record.type === "normal" && afterLoc) {
									this.next = afterLoc;
								}

								return ContinueSentinel;
							},

							finish: function (finallyLoc) {
								for (var i = this.tryEntries.length - 1; i >= 0; --i) {
									var entry = this.tryEntries[i];
									if (entry.finallyLoc === finallyLoc) {
										this.complete(entry.completion, entry.afterLoc);
										resetTryEntry(entry);
										return ContinueSentinel;
									}
								}
							},

							catch: function (tryLoc) {
								for (var i = this.tryEntries.length - 1; i >= 0; --i) {
									var entry = this.tryEntries[i];
									if (entry.tryLoc === tryLoc) {
										var record = entry.completion;
										if (record.type === "throw") {
											var thrown = record.arg;
											resetTryEntry(entry);
										}
										return thrown;
									}
								}

								// The context.catch method must only be called with a location
								// argument that corresponds to a known catch block.
								throw new Error("illegal catch attempt");
							},

							delegateYield: function (iterable, resultName, nextLoc) {
								this.delegate = {
									iterator: values(iterable),
									resultName: resultName,
									nextLoc: nextLoc
								};

								if (this.method === "next") {
									// Deliberately forget the last sent value so that we don't
									// accidentally pass it on to the delegate.
									this.arg = undefined;
								}

								return ContinueSentinel;
							}
						};

						// Regardless of whether this script is executing as a CommonJS module
						// or not, return the runtime object so that we can declare the variable
						// regeneratorRuntime in the outer scope, which allows this module to be
						// injected easily by `bin/regenerator --include-runtime script.js`.
						return exports;
					})(
						// If this script is executing as a CommonJS module, use module.exports
						// as the regeneratorRuntime namespace. Otherwise create a new empty
						// object. Either way, the resulting object will be used to initialize
						// the regeneratorRuntime variable at the top of this file.
						typeof module === "object" ? module.exports : {}
					);

					try {
						regeneratorRuntime = runtime;
					} catch (accidentalStrictMode) {
						// This module should not be running in strict mode, so the above
						// assignment should always work unless something is misconfigured. Just
						// in case runtime.js accidentally runs in strict mode, we can escape
						// strict mode using a global Function call. This could conceivably fail
						// if a Content Security Policy forbids using Function, but in that case
						// the proper solution is to fix the accidental strict mode problem. If
						// you've misconfigured your bundler to force strict mode and applied a
						// CSP to forbid Function, and you're not willing to fix either of those
						// problems, please detail your unique predicament in a GitHub issue.
						Function("r", "regeneratorRuntime = r")(runtime);
					}
				},
				{}
			],
			3: [
				function (require, module, exports) {
					"use strict";

					Object.defineProperty(exports, "__esModule", {
						value: true
					});
					exports.default = void 0;

					var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

					var _util = require("./util");

					function _interopRequireDefault(obj) {
						return obj && obj.__esModule
							? obj
							: {
									default: obj
							  };
					}

					function _typeof(obj) {
						"@babel/helpers - typeof";

						if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
							_typeof = function _typeof(obj) {
								return typeof obj;
							};
						} else {
							_typeof = function _typeof(obj) {
								return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
							};
						}

						return _typeof(obj);
					}

					function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
						try {
							var info = gen[key](arg);
							var value = info.value;
						} catch (error) {
							reject(error);
							return;
						}

						if (info.done) {
							resolve(value);
						} else {
							Promise.resolve(value).then(_next, _throw);
						}
					}

					function _asyncToGenerator(fn) {
						return function () {
							var self = this,
								args = arguments;
							return new Promise(function (resolve, reject) {
								var gen = fn.apply(self, args);

								function _next(value) {
									asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
								}

								function _throw(err) {
									asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
								}

								_next(undefined);
							});
						};
					}

					function _classCallCheck(instance, Constructor) {
						if (!(instance instanceof Constructor)) {
							throw new TypeError("Cannot call a class as a function");
						}
					}

					function _defineProperties(target, props) {
						for (var i = 0; i < props.length; i++) {
							var descriptor = props[i];
							descriptor.enumerable = descriptor.enumerable || false;
							descriptor.configurable = true;
							if ("value" in descriptor) descriptor.writable = true;
							Object.defineProperty(target, descriptor.key, descriptor);
						}
					}

					function _createClass(Constructor, protoProps, staticProps) {
						if (protoProps) _defineProperties(Constructor.prototype, protoProps);
						if (staticProps) _defineProperties(Constructor, staticProps);
						return Constructor;
					}
					/**
					 * Kuroshiro Class
					 */

					var Kuroshiro = /*#__PURE__*/ (function () {
						/**
						 * Constructor
						 * @constructs Kuroshiro
						 */
						function Kuroshiro() {
							_classCallCheck(this, Kuroshiro);

							this._analyzer = null;
						}
						/**
						 * Initialize Kuroshiro
						 * @memberOf Kuroshiro
						 * @instance
						 * @returns {Promise} Promise object represents the result of initialization
						 */

						_createClass(Kuroshiro, [
							{
								key: "init",
								value: (function () {
									var _init = _asyncToGenerator(
										/*#__PURE__*/ _regenerator.default.mark(function _callee(analyzer) {
											return _regenerator.default.wrap(
												function _callee$(_context) {
													while (1) {
														switch ((_context.prev = _context.next)) {
															case 0:
																if (
																	!(
																		!analyzer ||
																		_typeof(analyzer) !== "object" ||
																		typeof analyzer.init !== "function" ||
																		typeof analyzer.parse !== "function"
																	)
																) {
																	_context.next = 4;
																	break;
																}

																throw new Error("Invalid initialization parameter.");

															case 4:
																if (!(this._analyzer == null)) {
																	_context.next = 10;
																	break;
																}

																_context.next = 7;
																return analyzer.init();

															case 7:
																this._analyzer = analyzer;
																_context.next = 11;
																break;

															case 10:
																throw new Error("Kuroshiro has already been initialized.");

															case 11:
															case "end":
																return _context.stop();
														}
													}
												},
												_callee,
												this
											);
										})
									);

									function init(_x) {
										return _init.apply(this, arguments);
									}

									return init;
								})()
								/**
								 * Convert given string to target syllabary with options available
								 * @memberOf Kuroshiro
								 * @instance
								 * @param {string} str Given String
								 * @param {Object} [options] Settings Object
								 * @param {string} [options.to="hiragana"] Target syllabary ["hiragana"|"katakana"|"romaji"]
								 * @param {string} [options.mode="normal"] Convert mode ["normal"|"spaced"|"okurigana"|"furigana"]
								 * @param {string} [options.romajiSystem="hepburn"] Romanization System ["nippon"|"passport"|"hepburn"]
								 * @param {string} [options.delimiter_start="("] Delimiter(Start)
								 * @param {string} [options.delimiter_end=")"] Delimiter(End)
								 * @returns {Promise} Promise object represents the result of conversion
								 */
							},
							{
								key: "convert",
								value: (function () {
									var _convert = _asyncToGenerator(
										/*#__PURE__*/ _regenerator.default.mark(function _callee2(str, options) {
											var ROMAJI_SYSTEMS,
												rawTokens,
												tokens,
												romajiConv,
												hi,
												tmp,
												hpattern,
												hc,
												hreg,
												hmatches,
												pickKJ,
												hc1,
												notations,
												i,
												strType,
												pattern,
												isLastTokenKanji,
												subs,
												c,
												reg,
												matches,
												pickKanji,
												c1,
												c2,
												c3,
												result,
												n0,
												n1,
												n2,
												n3,
												n4,
												n5;
											return _regenerator.default.wrap(
												function _callee2$(_context2) {
													while (1) {
														switch ((_context2.prev = _context2.next)) {
															case 0:
																options = options || {};
																options.to = options.to || "hiragana";
																options.mode = options.mode || "normal";
																options.romajiSystem = options.romajiSystem || _util.ROMANIZATION_SYSTEM.HEPBURN;
																options.delimiter_start = options.delimiter_start || "(";
																options.delimiter_end = options.delimiter_end || ")";
																str = str || "";

																if (!(["hiragana", "katakana", "romaji"].indexOf(options.to) === -1)) {
																	_context2.next = 9;
																	break;
																}

																throw new Error("Invalid Target Syllabary.");

															case 9:
																if (!(["normal", "spaced", "okurigana", "furigana"].indexOf(options.mode) === -1)) {
																	_context2.next = 11;
																	break;
																}

																throw new Error("Invalid Conversion Mode.");

															case 11:
																ROMAJI_SYSTEMS = Object.keys(_util.ROMANIZATION_SYSTEM).map(function (e) {
																	return _util.ROMANIZATION_SYSTEM[e];
																});

																if (!(ROMAJI_SYSTEMS.indexOf(options.romajiSystem) === -1)) {
																	_context2.next = 14;
																	break;
																}

																throw new Error("Invalid Romanization System.");

															case 14:
																_context2.next = 16;
																return this._analyzer.parse(str);

															case 16:
																rawTokens = _context2.sent;
																tokens = (0, _util.patchTokens)(rawTokens);

																if (!(options.mode === "normal" || options.mode === "spaced")) {
																	_context2.next = 36;
																	break;
																}

																_context2.t0 = options.to;
																_context2.next =
																	_context2.t0 === "katakana" ? 22 : _context2.t0 === "romaji" ? 25 : _context2.t0 === "hiragana" ? 29 : 33;
																break;

															case 22:
																if (!(options.mode === "normal")) {
																	_context2.next = 24;
																	break;
																}

																return _context2.abrupt(
																	"return",
																	tokens
																		.map(function (token) {
																			return token.reading;
																		})
																		.join("")
																);

															case 24:
																return _context2.abrupt(
																	"return",
																	tokens
																		.map(function (token) {
																			return token.reading;
																		})
																		.join(" ")
																);

															case 25:
																romajiConv = function romajiConv(token) {
																	var preToken;

																	if ((0, _util.hasJapanese)(token.surface_form)) {
																		preToken = token.pronunciation || token.reading;
																	} else {
																		preToken = token.surface_form;
																	}

																	return (0, _util.toRawRomaji)(preToken, options.romajiSystem);
																};

																if (!(options.mode === "normal")) {
																	_context2.next = 28;
																	break;
																}

																return _context2.abrupt("return", tokens.map(romajiConv).join(""));

															case 28:
																return _context2.abrupt("return", tokens.map(romajiConv).join(" "));

															case 29:
																for (hi = 0; hi < tokens.length; hi++) {
																	if ((0, _util.hasKanji)(tokens[hi].surface_form)) {
																		if (!(0, _util.hasKatakana)(tokens[hi].surface_form)) {
																			tokens[hi].reading = (0, _util.toRawHiragana)(tokens[hi].reading);
																		} else {
																			// handle katakana-kanji-mixed tokens
																			tokens[hi].reading = (0, _util.toRawHiragana)(tokens[hi].reading);
																			tmp = "";
																			hpattern = "";

																			for (hc = 0; hc < tokens[hi].surface_form.length; hc++) {
																				if ((0, _util.isKanji)(tokens[hi].surface_form[hc])) {
																					hpattern += "(.*)";
																				} else {
																					hpattern += (0, _util.isKatakana)(tokens[hi].surface_form[hc])
																						? (0, _util.toRawHiragana)(tokens[hi].surface_form[hc])
																						: tokens[hi].surface_form[hc];
																				}
																			}

																			hreg = new RegExp(hpattern);
																			hmatches = hreg.exec(tokens[hi].reading);

																			if (hmatches) {
																				pickKJ = 0;

																				for (hc1 = 0; hc1 < tokens[hi].surface_form.length; hc1++) {
																					if ((0, _util.isKanji)(tokens[hi].surface_form[hc1])) {
																						tmp += hmatches[pickKJ + 1];
																						pickKJ++;
																					} else {
																						tmp += tokens[hi].surface_form[hc1];
																					}
																				}

																				tokens[hi].reading = tmp;
																			}
																		}
																	} else {
																		tokens[hi].reading = tokens[hi].surface_form;
																	}
																}

																if (!(options.mode === "normal")) {
																	_context2.next = 32;
																	break;
																}

																return _context2.abrupt(
																	"return",
																	tokens
																		.map(function (token) {
																			return token.reading;
																		})
																		.join("")
																);

															case 32:
																return _context2.abrupt(
																	"return",
																	tokens
																		.map(function (token) {
																			return token.reading;
																		})
																		.join(" ")
																);

															case 33:
																throw new Error("Unknown option.to param");

															case 34:
																_context2.next = 73;
																break;

															case 36:
																if (!(options.mode === "okurigana" || options.mode === "furigana")) {
																	_context2.next = 73;
																	break;
																}

																notations = []; // [basic, basic_type[1=kanji,2=kana,3=others], notation, pronunciation]

																i = 0;

															case 39:
																if (!(i < tokens.length)) {
																	_context2.next = 62;
																	break;
																}

																strType = (0, _util.getStrType)(tokens[i].surface_form);
																_context2.t1 = strType;
																_context2.next =
																	_context2.t1 === 0 ? 44 : _context2.t1 === 1 ? 46 : _context2.t1 === 2 ? 54 : _context2.t1 === 3 ? 56 : 58;
																break;

															case 44:
																notations.push([
																	tokens[i].surface_form,
																	1,
																	(0, _util.toRawHiragana)(tokens[i].reading),
																	tokens[i].pronunciation || tokens[i].reading
																]);
																return _context2.abrupt("break", 59);

															case 46:
																pattern = "";
																isLastTokenKanji = false;
																subs = []; // recognize kanjis and group them

																for (c = 0; c < tokens[i].surface_form.length; c++) {
																	if ((0, _util.isKanji)(tokens[i].surface_form[c])) {
																		if (!isLastTokenKanji) {
																			// ignore successive kanji tokens (#10)
																			isLastTokenKanji = true;
																			pattern += "(.+)";
																			subs.push(tokens[i].surface_form[c]);
																		} else {
																			subs[subs.length - 1] += tokens[i].surface_form[c];
																		}
																	} else {
																		isLastTokenKanji = false;
																		subs.push(tokens[i].surface_form[c]);
																		pattern += (0, _util.isKatakana)(tokens[i].surface_form[c])
																			? (0, _util.toRawHiragana)(tokens[i].surface_form[c])
																			: tokens[i].surface_form[c];
																	}
																}

																reg = new RegExp("^".concat(pattern, "$"));
																matches = reg.exec((0, _util.toRawHiragana)(tokens[i].reading));

																if (matches) {
																	pickKanji = 1;

																	for (c1 = 0; c1 < subs.length; c1++) {
																		if ((0, _util.isKanji)(subs[c1][0])) {
																			notations.push([subs[c1], 1, matches[pickKanji], (0, _util.toRawKatakana)(matches[pickKanji])]);
																			pickKanji += 1;
																		} else {
																			notations.push([subs[c1], 2, (0, _util.toRawHiragana)(subs[c1]), (0, _util.toRawKatakana)(subs[c1])]);
																		}
																	}
																} else {
																	notations.push([
																		tokens[i].surface_form,
																		1,
																		(0, _util.toRawHiragana)(tokens[i].reading),
																		tokens[i].pronunciation || tokens[i].reading
																	]);
																}

																return _context2.abrupt("break", 59);

															case 54:
																for (c2 = 0; c2 < tokens[i].surface_form.length; c2++) {
																	notations.push([
																		tokens[i].surface_form[c2],
																		2,
																		(0, _util.toRawHiragana)(tokens[i].reading[c2]),
																		(tokens[i].pronunciation && tokens[i].pronunciation[c2]) || tokens[i].reading[c2]
																	]);
																}

																return _context2.abrupt("break", 59);

															case 56:
																for (c3 = 0; c3 < tokens[i].surface_form.length; c3++) {
																	notations.push([tokens[i].surface_form[c3], 3, tokens[i].surface_form[c3], tokens[i].surface_form[c3]]);
																}

																return _context2.abrupt("break", 59);

															case 58:
																throw new Error("Unknown strType");

															case 59:
																i++;
																_context2.next = 39;
																break;

															case 62:
																result = "";
																_context2.t2 = options.to;
																_context2.next =
																	_context2.t2 === "katakana" ? 66 : _context2.t2 === "romaji" ? 68 : _context2.t2 === "hiragana" ? 70 : 72;
																break;

															case 66:
																if (options.mode === "okurigana") {
																	for (n0 = 0; n0 < notations.length; n0++) {
																		if (notations[n0][1] !== 1) {
																			result += notations[n0][0];
																		} else {
																			result +=
																				notations[n0][0] +
																				options.delimiter_start +
																				(0, _util.toRawKatakana)(notations[n0][2]) +
																				options.delimiter_end;
																		}
																	}
																} else {
																	// furigana
																	for (n1 = 0; n1 < notations.length; n1++) {
																		if (notations[n1][1] !== 1) {
																			result += notations[n1][0];
																		} else {
																			result += "<ruby>"
																				.concat(notations[n1][0], "<rp>")
																				.concat(options.delimiter_start, "</rp><rt>")
																				.concat((0, _util.toRawKatakana)(notations[n1][2]), "</rt><rp>")
																				.concat(options.delimiter_end, "</rp></ruby>");
																		}
																	}
																}

																return _context2.abrupt("return", result);

															case 68:
																if (options.mode === "okurigana") {
																	for (n2 = 0; n2 < notations.length; n2++) {
																		if (notations[n2][1] !== 1) {
																			result += notations[n2][0];
																		} else {
																			result +=
																				notations[n2][0] +
																				options.delimiter_start +
																				(0, _util.toRawRomaji)(notations[n2][3], options.romajiSystem) +
																				options.delimiter_end;
																		}
																	}
																} else {
																	// furigana
																	result += "<ruby>";

																	for (n3 = 0; n3 < notations.length; n3++) {
																		result += ""
																			.concat(notations[n3][0], "<rp>")
																			.concat(options.delimiter_start, "</rp><rt>")
																			.concat((0, _util.toRawRomaji)(notations[n3][3], options.romajiSystem), "</rt><rp>")
																			.concat(options.delimiter_end, "</rp>");
																	}

																	result += "</ruby>";
																}

																return _context2.abrupt("return", result);

															case 70:
																if (options.mode === "okurigana") {
																	for (n4 = 0; n4 < notations.length; n4++) {
																		if (notations[n4][1] !== 1) {
																			result += notations[n4][0];
																		} else {
																			result += notations[n4][0] + options.delimiter_start + notations[n4][2] + options.delimiter_end;
																		}
																	}
																} else {
																	// furigana
																	for (n5 = 0; n5 < notations.length; n5++) {
																		if (notations[n5][1] !== 1) {
																			result += notations[n5][0];
																		} else {
																			result += "<ruby>"
																				.concat(notations[n5][0], "<rp>")
																				.concat(options.delimiter_start, "</rp><rt>")
																				.concat(notations[n5][2], "</rt><rp>")
																				.concat(options.delimiter_end, "</rp></ruby>");
																		}
																	}
																}

																return _context2.abrupt("return", result);

															case 72:
																throw new Error("Invalid Target Syllabary.");

															case 73:
															case "end":
																return _context2.stop();
														}
													}
												},
												_callee2,
												this
											);
										})
									);

									function convert(_x2, _x3) {
										return _convert.apply(this, arguments);
									}

									return convert;
								})()
							}
						]);

						return Kuroshiro;
					})();

					var Util = {
						isHiragana: _util.isHiragana,
						isKatakana: _util.isKatakana,
						isKana: _util.isKana,
						isKanji: _util.isKanji,
						isJapanese: _util.isJapanese,
						hasHiragana: _util.hasHiragana,
						hasKatakana: _util.hasKatakana,
						hasKana: _util.hasKana,
						hasKanji: _util.hasKanji,
						hasJapanese: _util.hasJapanese,
						kanaToHiragna: _util.kanaToHiragna,
						kanaToKatakana: _util.kanaToKatakana,
						kanaToRomaji: _util.kanaToRomaji
					};
					Kuroshiro.Util = Util;
					var _default = Kuroshiro;
					exports.default = _default;
				},
				{ "./util": 5, "@babel/runtime/regenerator": 1 }
			],
			4: [
				function (require, module, exports) {
					"use strict";

					Object.defineProperty(exports, "__esModule", {
						value: true
					});
					exports.default = void 0;

					var _core = _interopRequireDefault(require("./core"));

					function _interopRequireDefault(obj) {
						return obj && obj.__esModule
							? obj
							: {
									default: obj
							  };
					}

					var _default = _core.default;
					exports.default = _default;
				},
				{ "./core": 3 }
			],
			5: [
				function (require, module, exports) {
					"use strict";

					Object.defineProperty(exports, "__esModule", {
						value: true
					});
					exports.kanaToRomaji =
						exports.kanaToKatakana =
						exports.kanaToHiragna =
						exports.toRawRomaji =
						exports.toRawKatakana =
						exports.toRawHiragana =
						exports.hasJapanese =
						exports.hasKanji =
						exports.hasKana =
						exports.hasKatakana =
						exports.hasHiragana =
						exports.isJapanese =
						exports.isKanji =
						exports.isKana =
						exports.isKatakana =
						exports.isHiragana =
						exports.patchTokens =
						exports.getStrType =
						exports.ROMANIZATION_SYSTEM =
							void 0;

					function _toConsumableArray(arr) {
						return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
					}

					function _nonIterableSpread() {
						throw new TypeError(
							"Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
						);
					}

					function _unsupportedIterableToArray(o, minLen) {
						if (!o) return;
						if (typeof o === "string") return _arrayLikeToArray(o, minLen);
						var n = Object.prototype.toString.call(o).slice(8, -1);
						if (n === "Object" && o.constructor) n = o.constructor.name;
						if (n === "Map" || n === "Set") return Array.from(o);
						if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
					}

					function _iterableToArray(iter) {
						if ((typeof Symbol !== "undefined" && iter[Symbol.iterator] != null) || iter["@@iterator"] != null) return Array.from(iter);
					}

					function _arrayWithoutHoles(arr) {
						if (Array.isArray(arr)) return _arrayLikeToArray(arr);
					}

					function _arrayLikeToArray(arr, len) {
						if (len == null || len > arr.length) len = arr.length;

						for (var i = 0, arr2 = new Array(len); i < len; i++) {
							arr2[i] = arr[i];
						}

						return arr2;
					}

					var KATAKANA_HIRAGANA_SHIFT = "\u3041".charCodeAt(0) - "\u30A1".charCodeAt(0);
					var HIRAGANA_KATAKANA_SHIFT = "\u30A1".charCodeAt(0) - "\u3041".charCodeAt(0);
					var ROMANIZATION_SYSTEM = {
						NIPPON: "nippon",
						PASSPORT: "passport",
						HEPBURN: "hepburn"
					};
					/**
					 * Check if given char is a hiragana
					 *
					 * @param {string} ch Given char
					 * @return {boolean} if given char is a hiragana
					 */

					exports.ROMANIZATION_SYSTEM = ROMANIZATION_SYSTEM;

					var isHiragana = function isHiragana(ch) {
						ch = ch[0];
						return ch >= "\u3040" && ch <= "\u309F";
					};
					/**
					 * Check if given char is a katakana
					 *
					 * @param {string} ch Given char
					 * @return {boolean} if given char is a katakana
					 */

					exports.isHiragana = isHiragana;

					var isKatakana = function isKatakana(ch) {
						ch = ch[0];
						return ch >= "\u30A0" && ch <= "\u30FF";
					};
					/**
					 * Check if given char is a kana
					 *
					 * @param {string} ch Given char
					 * @return {boolean} if given char is a kana
					 */

					exports.isKatakana = isKatakana;

					var isKana = function isKana(ch) {
						return isHiragana(ch) || isKatakana(ch);
					};
					/**
					 * Check if given char is a kanji
					 *
					 * @param {string} ch Given char
					 * @return {boolean} if given char is a kanji
					 */

					exports.isKana = isKana;

					var isKanji = function isKanji(ch) {
						ch = ch[0];
						return (ch >= "\u4E00" && ch <= "\u9FCF") || (ch >= "\uF900" && ch <= "\uFAFF") || (ch >= "\u3400" && ch <= "\u4DBF");
					};
					/**
					 * Check if given char is a Japanese
					 *
					 * @param {string} ch Given char
					 * @return {boolean} if given char is a Japanese
					 */

					exports.isKanji = isKanji;

					var isJapanese = function isJapanese(ch) {
						return isKana(ch) || isKanji(ch);
					};
					/**
					 * Check if given string has hiragana
					 *
					 * @param {string} str Given string
					 * @return {boolean} if given string has hiragana
					 */

					exports.isJapanese = isJapanese;

					var hasHiragana = function hasHiragana(str) {
						for (var i = 0; i < str.length; i++) {
							if (isHiragana(str[i])) return true;
						}

						return false;
					};
					/**
					 * Check if given string has katakana
					 *
					 * @param {string} str Given string
					 * @return {boolean} if given string has katakana
					 */

					exports.hasHiragana = hasHiragana;

					var hasKatakana = function hasKatakana(str) {
						for (var i = 0; i < str.length; i++) {
							if (isKatakana(str[i])) return true;
						}

						return false;
					};
					/**
					 * Check if given string has kana
					 *
					 * @param {string} str Given string
					 * @return {boolean} if given string has kana
					 */

					exports.hasKatakana = hasKatakana;

					var hasKana = function hasKana(str) {
						for (var i = 0; i < str.length; i++) {
							if (isKana(str[i])) return true;
						}

						return false;
					};
					/**
					 * Check if given string has kanji
					 *
					 * @param {string} str Given string
					 * @return {boolean} if given string has kanji
					 */

					exports.hasKana = hasKana;

					var hasKanji = function hasKanji(str) {
						for (var i = 0; i < str.length; i++) {
							if (isKanji(str[i])) return true;
						}

						return false;
					};
					/**
					 * Check if given string has Japanese
					 *
					 * @param {string} str Given string
					 * @return {boolean} if given string has Japanese
					 */

					exports.hasKanji = hasKanji;

					var hasJapanese = function hasJapanese(str) {
						for (var i = 0; i < str.length; i++) {
							if (isJapanese(str[i])) return true;
						}

						return false;
					};
					/**
					 * Convert kana to hiragana
					 *
					 * @param {string} str Given string
					 * @return {string} Hiragana string
					 */

					exports.hasJapanese = hasJapanese;

					var toRawHiragana = function toRawHiragana(str) {
						return _toConsumableArray(str)
							.map(function (ch) {
								if (ch > "\u30A0" && ch < "\u30F7") {
									return String.fromCharCode(ch.charCodeAt(0) + KATAKANA_HIRAGANA_SHIFT);
								}

								return ch;
							})
							.join("");
					};
					/**
					 * Convert kana to katakana
					 *
					 * @param {string} str Given string
					 * @return {string} Katakana string
					 */

					exports.toRawHiragana = toRawHiragana;

					var toRawKatakana = function toRawKatakana(str) {
						return _toConsumableArray(str)
							.map(function (ch) {
								if (ch > "\u3040" && ch < "\u3097") {
									return String.fromCharCode(ch.charCodeAt(0) + HIRAGANA_KATAKANA_SHIFT);
								}

								return ch;
							})
							.join("");
					};
					/**
					 * Convert kana to romaji
					 *
					 * @param {string} str Given string
					 * @param {string} system To which romanization system the given string is converted
					 * @return {string} Romaji string
					 */

					exports.toRawKatakana = toRawKatakana;

					var toRawRomaji = function toRawRomaji(str, system) {
						system = system || ROMANIZATION_SYSTEM.HEPBURN;
						var romajiSystem = {
							nippon: {
								// 数字と記号
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
								// 直音-清音(ア～ノ)
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
								// 直音-清音(ハ～ヲ)
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
								// 直音-濁音(ガ～ボ)、半濁音(パ～ポ)
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
								// 拗音-清音(キャ～リョ)
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
								// 拗音-濁音(ギャ～ビョ)、半濁音(ピャ～ピョ)、合拗音(クヮ、グヮ)
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
								// 小書きの仮名、符号
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
								// ー: "",
								"　": " ",
								// 外来音(イェ～グォ)
								いぇ: "ye",
								// うぃ: "",
								// うぇ: "",
								// うぉ: "",
								きぇ: "kye",
								// くぁ: "",
								くぃ: "kwi",
								くぇ: "kwe",
								くぉ: "kwo",
								// ぐぁ: "",
								ぐぃ: "gwi",
								ぐぇ: "gwe",
								ぐぉ: "gwo",
								イェ: "ye",
								// ウィ: "",
								// ウェ: "",
								// ウォ: "",
								// ヴ: "",
								// ヴァ: "",
								// ヴィ: "",
								// ヴェ: "",
								// ヴォ: "",
								// ヴュ: "",
								// ヴョ: "",
								キェ: "kya",
								// クァ: "",
								クィ: "kwi",
								クェ: "kwe",
								クォ: "kwo",
								// グァ: "",
								グィ: "gwi",
								グェ: "gwe",
								グォ: "gwo",
								// 外来音(シェ～フョ)
								しぇ: "sye",
								じぇ: "zye",
								すぃ: "swi",
								ずぃ: "zwi",
								ちぇ: "tye",
								つぁ: "twa",
								つぃ: "twi",
								つぇ: "twe",
								つぉ: "two",
								// てぃ: "ti",
								// てゅ: "tyu",
								// でぃ: "di",
								// でゅ: "dyu",
								// とぅ: "tu",
								// どぅ: "du",
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
								// ティ: "ti",
								// テュ: "tyu",
								// ディ: "di",
								// デュ: "dyu",
								// トゥ: "tu",
								// ドゥ: "du",
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
								// 数字と記号
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
								// 直音-清音(ア～ノ)
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
								// 直音-清音(ハ～ヲ)
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
								// 直音-濁音(ガ～ボ)、半濁音(パ～ポ)
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
								// 拗音-清音(キャ～リョ)
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
								// 拗音-濁音(ギャ～ビョ)、半濁音(ピャ～ピョ)、合拗音(クヮ、グヮ)
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
								// くゎ: "",
								// ぐゎ: "",
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
								// クヮ: "",
								// グヮ: "",
								// 小書きの仮名、符号
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
								// ー: "",
								"　": " ",
								// 外来音(イェ～グォ)
								// いぇ: "",
								// うぃ: "",
								// うぇ: "",
								// うぉ: "",
								// きぇ: "",
								// くぁ: "",
								// くぃ: "",
								// くぇ: "",
								// くぉ: "",
								// ぐぁ: "",
								// ぐぃ: "",
								// ぐぇ: "",
								// ぐぉ: "",
								// イェ: "",
								// ウィ: "",
								// ウェ: "",
								// ウォ: "",
								ヴ: "b" // ヴァ: "",
								// ヴィ: "",
								// ヴェ: "",
								// ヴォ: "",
								// ヴュ: "",
								// ヴョ: "",
								// キェ: "",
								// クァ: "",
								// クィ: "",
								// クェ: "",
								// クォ: "",
								// グァ: "",
								// グィ: "",
								// グェ: "",
								// グォ: "",
								// 外来音(シェ～フョ)
								// しぇ: "",
								// じぇ: "",
								// すぃ: "",
								// ずぃ: "",
								// ちぇ: "",
								// つぁ: "",
								// つぃ: "",
								// つぇ: "",
								// つぉ: "",
								// てぃ: "",
								// てゅ: "",
								// でぃ: "",
								// でゅ: "",
								// とぅ: "",
								// どぅ: "",
								// にぇ: "",
								// ひぇ: "",
								// ふぁ: "",
								// ふぃ: "",
								// ふぇ: "",
								// ふぉ: "",
								// ふゅ: "",
								// ふょ: "",
								// シェ: "",
								// ジェ: "",
								// スィ: "",
								// ズィ: "",
								// チェ: "",
								// ツァ: "",
								// ツィ: "",
								// ツェ: "",
								// ツォ: "",
								// ティ: "",
								// テュ: "",
								// ディ: "",
								// デュ: "",
								// トゥ: "",
								// ドゥ: "",
								// ニェ: "",
								// ヒェ: "",
								// ファ: "",
								// フィ: "",
								// フェ: "",
								// フォ: "",
								// フュ: "",
								// フョ: ""
							},
							hepburn: {
								// 数字と記号
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
								// 直音-清音(ア～ノ)
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
								// 直音-清音(ハ～ヲ)
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
								// 直音-濁音(ガ～ボ)、半濁音(パ～ポ)
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
								// 拗音-清音(キャ～リョ)
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
								// 拗音-濁音(ギャ～ビョ)、半濁音(ピャ～ピョ)、合拗音(クヮ、グヮ)
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
								// "くゎ: "",
								// ぐゎ: "",
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
								// クヮ: "",
								// グヮ: "",
								// 小書きの仮名、符号
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
								// ー: "",
								"　": " ",
								// 外来音(イェ～グォ)
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
								// 外来音(シェ～フョ)
								しぇ: "she",
								じぇ: "je",
								// すぃ: "",
								// ずぃ: "",
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
								// スィ: "",
								// ズィ: "",
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
						};
						var reg_tsu = /(っ|ッ)([bcdfghijklmnopqrstuvwyz])/gm;
						var reg_xtsu = /っ|ッ/gm;
						var pnt = 0;
						var ch;
						var r;
						var result = ""; // [PASSPORT] 長音省略 「―」の場合

						if (system === ROMANIZATION_SYSTEM.PASSPORT) {
							str = str.replace(/ー/gm, "");
						} // [NIPPON|HEPBURN] 撥音の特殊表記 a、i、u、e、o、y

						if (system === ROMANIZATION_SYSTEM.NIPPON || system === ROMANIZATION_SYSTEM.HEPBURN) {
							var reg_hatu = new RegExp(
								/(ん|ン)(?=あ|い|う|え|お|ア|イ|ウ|エ|オ|ぁ|ぃ|ぅ|ぇ|ぉ|ァ|ィ|ゥ|ェ|ォ|や|ゆ|よ|ヤ|ユ|ヨ|ゃ|ゅ|ょ|ャ|ュ|ョ)/g
							);
							var match;
							var indices = [];

							while ((match = reg_hatu.exec(str)) !== null) {
								indices.push(match.index + 1);
							}

							if (indices.length !== 0) {
								var mStr = "";

								for (var i = 0; i < indices.length; i++) {
									if (i === 0) {
										mStr += "".concat(str.slice(0, indices[i]), "'");
									} else {
										mStr += "".concat(str.slice(indices[i - 1], indices[i]), "'");
									}
								}

								mStr += str.slice(indices[indices.length - 1]);
								str = mStr;
							}
						} // [ALL] kana to roman chars

						var max = str.length;

						while (pnt <= max) {
							if ((r = romajiSystem[system][str.substring(pnt, pnt + 2)])) {
								result += r;
								pnt += 2;
							} else {
								result += (r = romajiSystem[system][(ch = str.substring(pnt, pnt + 1))]) ? r : ch;
								pnt += 1;
							}
						}

						result = result.replace(reg_tsu, "$2$2"); // [PASSPORT|HEPBURN] 子音を重ねて特殊表記

						if (system === ROMANIZATION_SYSTEM.PASSPORT || system === ROMANIZATION_SYSTEM.HEPBURN) {
							result = result.replace(/cc/gm, "tc");
						}

						result = result.replace(reg_xtsu, "tsu"); // [PASSPORT|HEPBURN] 撥音の特殊表記 b、m、p

						if (system === ROMANIZATION_SYSTEM.PASSPORT || system === ROMANIZATION_SYSTEM.HEPBURN) {
							result = result.replace(/nm/gm, "mm");
							result = result.replace(/nb/gm, "mb");
							result = result.replace(/np/gm, "mp");
						} // [NIPPON] 長音変換

						if (system === ROMANIZATION_SYSTEM.NIPPON) {
							result = result.replace(/aー/gm, "â");
							result = result.replace(/iー/gm, "î");
							result = result.replace(/uー/gm, "û");
							result = result.replace(/eー/gm, "ê");
							result = result.replace(/oー/gm, "ô");
						} // [HEPBURN] 長音変換

						if (system === ROMANIZATION_SYSTEM.HEPBURN) {
							result = result.replace(/aー/gm, "ā");
							result = result.replace(/iー/gm, "ī");
							result = result.replace(/uー/gm, "ū");
							result = result.replace(/eー/gm, "ē");
							result = result.replace(/oー/gm, "ō");
						}

						return result;
					};
					/**
					 * Get the type of given string
					 *
					 * @param {string} str Given string
					 * @return {number} Type number. 0 for pure kanji, 1 for kanji-kana-mixed, 2 for pure kana, 3 for others
					 */

					exports.toRawRomaji = toRawRomaji;

					var getStrType = function getStrType(str) {
						var hasKJ = false;
						var hasHK = false;

						for (var i = 0; i < str.length; i++) {
							if (isKanji(str[i])) {
								hasKJ = true;
							} else if (isHiragana(str[i]) || isKatakana(str[i])) {
								hasHK = true;
							}
						}

						if (hasKJ && hasHK) return 1;
						if (hasKJ) return 0;
						if (hasHK) return 2;
						return 3;
					};
					/**
					 * Patch tokens for conversion
					 * @param {Object} tokens Given tokens
					 * @return {Object} Patched tokens
					 */

					exports.getStrType = getStrType;

					var patchTokens = function patchTokens(tokens) {
						// patch for token structure
						for (var cr = 0; cr < tokens.length; cr++) {
							if (hasJapanese(tokens[cr].surface_form)) {
								if (!tokens[cr].reading) {
									if (tokens[cr].surface_form.split("").every(isKana)) {
										tokens[cr].reading = toRawKatakana(tokens[cr].surface_form);
									} else {
										tokens[cr].reading = tokens[cr].surface_form;
									}
								} else if (hasHiragana(tokens[cr].reading)) {
									tokens[cr].reading = toRawKatakana(tokens[cr].reading);
								}
							} else {
								tokens[cr].reading = tokens[cr].surface_form;
							}
						} // patch for 助動詞"う" after 動詞

						for (var i = 0; i < tokens.length; i++) {
							if (tokens[i].pos && tokens[i].pos === "助動詞" && (tokens[i].surface_form === "う" || tokens[i].surface_form === "ウ")) {
								if (i - 1 >= 0 && tokens[i - 1].pos && tokens[i - 1].pos === "動詞") {
									tokens[i - 1].surface_form += "う";

									if (tokens[i - 1].pronunciation) {
										tokens[i - 1].pronunciation += "ー";
									} else {
										tokens[i - 1].pronunciation = "".concat(tokens[i - 1].reading, "\u30FC");
									}

									tokens[i - 1].reading += "ウ";
									tokens.splice(i, 1);
									i--;
								}
							}
						} // patch for "っ" at the tail of 動詞、形容詞

						for (var j = 0; j < tokens.length; j++) {
							if (
								tokens[j].pos &&
								(tokens[j].pos === "動詞" || tokens[j].pos === "形容詞") &&
								tokens[j].surface_form.length > 1 &&
								(tokens[j].surface_form[tokens[j].surface_form.length - 1] === "っ" ||
									tokens[j].surface_form[tokens[j].surface_form.length - 1] === "ッ")
							) {
								if (j + 1 < tokens.length) {
									tokens[j].surface_form += tokens[j + 1].surface_form;

									if (tokens[j].pronunciation) {
										tokens[j].pronunciation += tokens[j + 1].pronunciation;
									} else {
										tokens[j].pronunciation = "".concat(tokens[j].reading).concat(tokens[j + 1].reading);
									}

									tokens[j].reading += tokens[j + 1].reading;
									tokens.splice(j + 1, 1);
									j--;
								}
							}
						}

						return tokens;
					};
					/**
					 * Convert kana to hiragana
					 *
					 * @param {string} str Given string
					 * @return {string} Hiragana string
					 */

					exports.patchTokens = patchTokens;

					var kanaToHiragna = function kanaToHiragna(str) {
						return toRawHiragana(str);
					};
					/**
					 * Convert kana to katakana
					 *
					 * @param {string} str Given string
					 * @return {string} Katakana string
					 */

					exports.kanaToHiragna = kanaToHiragna;

					var kanaToKatakana = function kanaToKatakana(str) {
						return toRawKatakana(str);
					};
					/**
					 * Convert kana to romaji
					 *
					 * @param {string} str Given string
					 * @param {string} system To which romanization system the given string is converted. ["nippon"|"passport"|"hepburn"]
					 * @return {string} Romaji string
					 */

					exports.kanaToKatakana = kanaToKatakana;

					var kanaToRomaji = function kanaToRomaji(str, system) {
						return toRawRomaji(str, system);
					};

					exports.kanaToRomaji = kanaToRomaji;
				},
				{}
			]
		},
		{},
		[4]
	)(4);
});
