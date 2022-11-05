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
		g.KuromojiAnalyzer = f();
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
					(function (process, global, setImmediate) {
						(function (global, factory) {
							typeof exports === "object" && typeof module !== "undefined"
								? factory(exports)
								: typeof define === "function" && define.amd
								? define(["exports"], factory)
								: factory((global.async = global.async || {}));
						})(this, function (exports) {
							"use strict";

							function slice(arrayLike, start) {
								start = start | 0;
								var newLen = Math.max(arrayLike.length - start, 0);
								var newArr = Array(newLen);
								for (var idx = 0; idx < newLen; idx++) {
									newArr[idx] = arrayLike[start + idx];
								}
								return newArr;
							}

							/**
							 * Creates a continuation function with some arguments already applied.
							 *
							 * Useful as a shorthand when combined with other control flow functions. Any
							 * arguments passed to the returned function are added to the arguments
							 * originally passed to apply.
							 *
							 * @name apply
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {Function} fn - The function you want to eventually apply all
							 * arguments to. Invokes with (arguments...).
							 * @param {...*} arguments... - Any number of arguments to automatically apply
							 * when the continuation is called.
							 * @returns {Function} the partially-applied function
							 * @example
							 *
							 * // using apply
							 * async.parallel([
							 *     async.apply(fs.writeFile, 'testfile1', 'test1'),
							 *     async.apply(fs.writeFile, 'testfile2', 'test2')
							 * ]);
							 *
							 *
							 * // the same process without using apply
							 * async.parallel([
							 *     function(callback) {
							 *         fs.writeFile('testfile1', 'test1', callback);
							 *     },
							 *     function(callback) {
							 *         fs.writeFile('testfile2', 'test2', callback);
							 *     }
							 * ]);
							 *
							 * // It's possible to pass any number of additional arguments when calling the
							 * // continuation:
							 *
							 * node> var fn = async.apply(sys.puts, 'one');
							 * node> fn('two', 'three');
							 * one
							 * two
							 * three
							 */
							var apply = function (fn /*, ...args*/) {
								var args = slice(arguments, 1);
								return function (/*callArgs*/) {
									var callArgs = slice(arguments);
									return fn.apply(null, args.concat(callArgs));
								};
							};

							var initialParams = function (fn) {
								return function (/*...args, callback*/) {
									var args = slice(arguments);
									var callback = args.pop();
									fn.call(this, args, callback);
								};
							};

							/**
							 * Checks if `value` is the
							 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
							 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
							 *
							 * @static
							 * @memberOf _
							 * @since 0.1.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
							 * @example
							 *
							 * _.isObject({});
							 * // => true
							 *
							 * _.isObject([1, 2, 3]);
							 * // => true
							 *
							 * _.isObject(_.noop);
							 * // => true
							 *
							 * _.isObject(null);
							 * // => false
							 */
							function isObject(value) {
								var type = typeof value;
								return value != null && (type == "object" || type == "function");
							}

							var hasSetImmediate = typeof setImmediate === "function" && setImmediate;
							var hasNextTick = typeof process === "object" && typeof process.nextTick === "function";

							function fallback(fn) {
								setTimeout(fn, 0);
							}

							function wrap(defer) {
								return function (fn /*, ...args*/) {
									var args = slice(arguments, 1);
									defer(function () {
										fn.apply(null, args);
									});
								};
							}

							var _defer;

							if (hasSetImmediate) {
								_defer = setImmediate;
							} else if (hasNextTick) {
								_defer = process.nextTick;
							} else {
								_defer = fallback;
							}

							var setImmediate$1 = wrap(_defer);

							/**
							 * Take a sync function and make it async, passing its return value to a
							 * callback. This is useful for plugging sync functions into a waterfall,
							 * series, or other async functions. Any arguments passed to the generated
							 * function will be passed to the wrapped function (except for the final
							 * callback argument). Errors thrown will be passed to the callback.
							 *
							 * If the function passed to `asyncify` returns a Promise, that promises's
							 * resolved/rejected state will be used to call the callback, rather than simply
							 * the synchronous return value.
							 *
							 * This also means you can asyncify ES2017 `async` functions.
							 *
							 * @name asyncify
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @alias wrapSync
							 * @category Util
							 * @param {Function} func - The synchronous function, or Promise-returning
							 * function to convert to an {@link AsyncFunction}.
							 * @returns {AsyncFunction} An asynchronous wrapper of the `func`. To be
							 * invoked with `(args..., callback)`.
							 * @example
							 *
							 * // passing a regular synchronous function
							 * async.waterfall([
							 *     async.apply(fs.readFile, filename, "utf8"),
							 *     async.asyncify(JSON.parse),
							 *     function (data, next) {
							 *         // data is the result of parsing the text.
							 *         // If there was a parsing error, it would have been caught.
							 *     }
							 * ], callback);
							 *
							 * // passing a function returning a promise
							 * async.waterfall([
							 *     async.apply(fs.readFile, filename, "utf8"),
							 *     async.asyncify(function (contents) {
							 *         return db.model.create(contents);
							 *     }),
							 *     function (model, next) {
							 *         // `model` is the instantiated model object.
							 *         // If there was an error, this function would be skipped.
							 *     }
							 * ], callback);
							 *
							 * // es2017 example, though `asyncify` is not needed if your JS environment
							 * // supports async functions out of the box
							 * var q = async.queue(async.asyncify(async function(file) {
							 *     var intermediateStep = await processFile(file);
							 *     return await somePromise(intermediateStep)
							 * }));
							 *
							 * q.push(files);
							 */
							function asyncify(func) {
								return initialParams(function (args, callback) {
									var result;
									try {
										result = func.apply(this, args);
									} catch (e) {
										return callback(e);
									}
									// if result is Promise object
									if (isObject(result) && typeof result.then === "function") {
										result.then(
											function (value) {
												invokeCallback(callback, null, value);
											},
											function (err) {
												invokeCallback(callback, err.message ? err : new Error(err));
											}
										);
									} else {
										callback(null, result);
									}
								});
							}

							function invokeCallback(callback, error, value) {
								try {
									callback(error, value);
								} catch (e) {
									setImmediate$1(rethrow, e);
								}
							}

							function rethrow(error) {
								throw error;
							}

							var supportsSymbol = typeof Symbol === "function";

							function isAsync(fn) {
								return supportsSymbol && fn[Symbol.toStringTag] === "AsyncFunction";
							}

							function wrapAsync(asyncFn) {
								return isAsync(asyncFn) ? asyncify(asyncFn) : asyncFn;
							}

							function applyEach$1(eachfn) {
								return function (fns /*, ...args*/) {
									var args = slice(arguments, 1);
									var go = initialParams(function (args, callback) {
										var that = this;
										return eachfn(
											fns,
											function (fn, cb) {
												wrapAsync(fn).apply(that, args.concat(cb));
											},
											callback
										);
									});
									if (args.length) {
										return go.apply(this, args);
									} else {
										return go;
									}
								};
							}

							/** Detect free variable `global` from Node.js. */
							var freeGlobal = typeof global == "object" && global && global.Object === Object && global;

							/** Detect free variable `self`. */
							var freeSelf = typeof self == "object" && self && self.Object === Object && self;

							/** Used as a reference to the global object. */
							var root = freeGlobal || freeSelf || Function("return this")();

							/** Built-in value references. */
							var Symbol$1 = root.Symbol;

							/** Used for built-in method references. */
							var objectProto = Object.prototype;

							/** Used to check objects for own properties. */
							var hasOwnProperty = objectProto.hasOwnProperty;

							/**
							 * Used to resolve the
							 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
							 * of values.
							 */
							var nativeObjectToString = objectProto.toString;

							/** Built-in value references. */
							var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : undefined;

							/**
							 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
							 *
							 * @private
							 * @param {*} value The value to query.
							 * @returns {string} Returns the raw `toStringTag`.
							 */
							function getRawTag(value) {
								var isOwn = hasOwnProperty.call(value, symToStringTag$1),
									tag = value[symToStringTag$1];

								try {
									value[symToStringTag$1] = undefined;
									var unmasked = true;
								} catch (e) {}

								var result = nativeObjectToString.call(value);
								if (unmasked) {
									if (isOwn) {
										value[symToStringTag$1] = tag;
									} else {
										delete value[symToStringTag$1];
									}
								}
								return result;
							}

							/** Used for built-in method references. */
							var objectProto$1 = Object.prototype;

							/**
							 * Used to resolve the
							 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
							 * of values.
							 */
							var nativeObjectToString$1 = objectProto$1.toString;

							/**
							 * Converts `value` to a string using `Object.prototype.toString`.
							 *
							 * @private
							 * @param {*} value The value to convert.
							 * @returns {string} Returns the converted string.
							 */
							function objectToString(value) {
								return nativeObjectToString$1.call(value);
							}

							/** `Object#toString` result references. */
							var nullTag = "[object Null]";
							var undefinedTag = "[object Undefined]";

							/** Built-in value references. */
							var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;

							/**
							 * The base implementation of `getTag` without fallbacks for buggy environments.
							 *
							 * @private
							 * @param {*} value The value to query.
							 * @returns {string} Returns the `toStringTag`.
							 */
							function baseGetTag(value) {
								if (value == null) {
									return value === undefined ? undefinedTag : nullTag;
								}
								return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
							}

							/** `Object#toString` result references. */
							var asyncTag = "[object AsyncFunction]";
							var funcTag = "[object Function]";
							var genTag = "[object GeneratorFunction]";
							var proxyTag = "[object Proxy]";

							/**
							 * Checks if `value` is classified as a `Function` object.
							 *
							 * @static
							 * @memberOf _
							 * @since 0.1.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
							 * @example
							 *
							 * _.isFunction(_);
							 * // => true
							 *
							 * _.isFunction(/abc/);
							 * // => false
							 */
							function isFunction(value) {
								if (!isObject(value)) {
									return false;
								}
								// The use of `Object#toString` avoids issues with the `typeof` operator
								// in Safari 9 which returns 'object' for typed arrays and other constructors.
								var tag = baseGetTag(value);
								return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
							}

							/** Used as references for various `Number` constants. */
							var MAX_SAFE_INTEGER = 9007199254740991;

							/**
							 * Checks if `value` is a valid array-like length.
							 *
							 * **Note:** This method is loosely based on
							 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
							 *
							 * @static
							 * @memberOf _
							 * @since 4.0.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
							 * @example
							 *
							 * _.isLength(3);
							 * // => true
							 *
							 * _.isLength(Number.MIN_VALUE);
							 * // => false
							 *
							 * _.isLength(Infinity);
							 * // => false
							 *
							 * _.isLength('3');
							 * // => false
							 */
							function isLength(value) {
								return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
							}

							/**
							 * Checks if `value` is array-like. A value is considered array-like if it's
							 * not a function and has a `value.length` that's an integer greater than or
							 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
							 *
							 * @static
							 * @memberOf _
							 * @since 4.0.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
							 * @example
							 *
							 * _.isArrayLike([1, 2, 3]);
							 * // => true
							 *
							 * _.isArrayLike(document.body.children);
							 * // => true
							 *
							 * _.isArrayLike('abc');
							 * // => true
							 *
							 * _.isArrayLike(_.noop);
							 * // => false
							 */
							function isArrayLike(value) {
								return value != null && isLength(value.length) && !isFunction(value);
							}

							// A temporary value used to identify if the loop should be broken.
							// See #1064, #1293
							var breakLoop = {};

							/**
							 * This method returns `undefined`.
							 *
							 * @static
							 * @memberOf _
							 * @since 2.3.0
							 * @category Util
							 * @example
							 *
							 * _.times(2, _.noop);
							 * // => [undefined, undefined]
							 */
							function noop() {
								// No operation performed.
							}

							function once(fn) {
								return function () {
									if (fn === null) return;
									var callFn = fn;
									fn = null;
									callFn.apply(this, arguments);
								};
							}

							var iteratorSymbol = typeof Symbol === "function" && Symbol.iterator;

							var getIterator = function (coll) {
								return iteratorSymbol && coll[iteratorSymbol] && coll[iteratorSymbol]();
							};

							/**
							 * The base implementation of `_.times` without support for iteratee shorthands
							 * or max array length checks.
							 *
							 * @private
							 * @param {number} n The number of times to invoke `iteratee`.
							 * @param {Function} iteratee The function invoked per iteration.
							 * @returns {Array} Returns the array of results.
							 */
							function baseTimes(n, iteratee) {
								var index = -1,
									result = Array(n);

								while (++index < n) {
									result[index] = iteratee(index);
								}
								return result;
							}

							/**
							 * Checks if `value` is object-like. A value is object-like if it's not `null`
							 * and has a `typeof` result of "object".
							 *
							 * @static
							 * @memberOf _
							 * @since 4.0.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
							 * @example
							 *
							 * _.isObjectLike({});
							 * // => true
							 *
							 * _.isObjectLike([1, 2, 3]);
							 * // => true
							 *
							 * _.isObjectLike(_.noop);
							 * // => false
							 *
							 * _.isObjectLike(null);
							 * // => false
							 */
							function isObjectLike(value) {
								return value != null && typeof value == "object";
							}

							/** `Object#toString` result references. */
							var argsTag = "[object Arguments]";

							/**
							 * The base implementation of `_.isArguments`.
							 *
							 * @private
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
							 */
							function baseIsArguments(value) {
								return isObjectLike(value) && baseGetTag(value) == argsTag;
							}

							/** Used for built-in method references. */
							var objectProto$3 = Object.prototype;

							/** Used to check objects for own properties. */
							var hasOwnProperty$2 = objectProto$3.hasOwnProperty;

							/** Built-in value references. */
							var propertyIsEnumerable = objectProto$3.propertyIsEnumerable;

							/**
							 * Checks if `value` is likely an `arguments` object.
							 *
							 * @static
							 * @memberOf _
							 * @since 0.1.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
							 *  else `false`.
							 * @example
							 *
							 * _.isArguments(function() { return arguments; }());
							 * // => true
							 *
							 * _.isArguments([1, 2, 3]);
							 * // => false
							 */
							var isArguments = baseIsArguments(
								(function () {
									return arguments;
								})()
							)
								? baseIsArguments
								: function (value) {
										return isObjectLike(value) && hasOwnProperty$2.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
								  };

							/**
							 * Checks if `value` is classified as an `Array` object.
							 *
							 * @static
							 * @memberOf _
							 * @since 0.1.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
							 * @example
							 *
							 * _.isArray([1, 2, 3]);
							 * // => true
							 *
							 * _.isArray(document.body.children);
							 * // => false
							 *
							 * _.isArray('abc');
							 * // => false
							 *
							 * _.isArray(_.noop);
							 * // => false
							 */
							var isArray = Array.isArray;

							/**
							 * This method returns `false`.
							 *
							 * @static
							 * @memberOf _
							 * @since 4.13.0
							 * @category Util
							 * @returns {boolean} Returns `false`.
							 * @example
							 *
							 * _.times(2, _.stubFalse);
							 * // => [false, false]
							 */
							function stubFalse() {
								return false;
							}

							/** Detect free variable `exports`. */
							var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;

							/** Detect free variable `module`. */
							var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;

							/** Detect the popular CommonJS extension `module.exports`. */
							var moduleExports = freeModule && freeModule.exports === freeExports;

							/** Built-in value references. */
							var Buffer = moduleExports ? root.Buffer : undefined;

							/* Built-in method references for those with the same name as other `lodash` methods. */
							var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

							/**
							 * Checks if `value` is a buffer.
							 *
							 * @static
							 * @memberOf _
							 * @since 4.3.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
							 * @example
							 *
							 * _.isBuffer(new Buffer(2));
							 * // => true
							 *
							 * _.isBuffer(new Uint8Array(2));
							 * // => false
							 */
							var isBuffer = nativeIsBuffer || stubFalse;

							/** Used as references for various `Number` constants. */
							var MAX_SAFE_INTEGER$1 = 9007199254740991;

							/** Used to detect unsigned integer values. */
							var reIsUint = /^(?:0|[1-9]\d*)$/;

							/**
							 * Checks if `value` is a valid array-like index.
							 *
							 * @private
							 * @param {*} value The value to check.
							 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
							 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
							 */
							function isIndex(value, length) {
								var type = typeof value;
								length = length == null ? MAX_SAFE_INTEGER$1 : length;

								return !!length && (type == "number" || (type != "symbol" && reIsUint.test(value))) && value > -1 && value % 1 == 0 && value < length;
							}

							/** `Object#toString` result references. */
							var argsTag$1 = "[object Arguments]";
							var arrayTag = "[object Array]";
							var boolTag = "[object Boolean]";
							var dateTag = "[object Date]";
							var errorTag = "[object Error]";
							var funcTag$1 = "[object Function]";
							var mapTag = "[object Map]";
							var numberTag = "[object Number]";
							var objectTag = "[object Object]";
							var regexpTag = "[object RegExp]";
							var setTag = "[object Set]";
							var stringTag = "[object String]";
							var weakMapTag = "[object WeakMap]";

							var arrayBufferTag = "[object ArrayBuffer]";
							var dataViewTag = "[object DataView]";
							var float32Tag = "[object Float32Array]";
							var float64Tag = "[object Float64Array]";
							var int8Tag = "[object Int8Array]";
							var int16Tag = "[object Int16Array]";
							var int32Tag = "[object Int32Array]";
							var uint8Tag = "[object Uint8Array]";
							var uint8ClampedTag = "[object Uint8ClampedArray]";
							var uint16Tag = "[object Uint16Array]";
							var uint32Tag = "[object Uint32Array]";

							/** Used to identify `toStringTag` values of typed arrays. */
							var typedArrayTags = {};
							typedArrayTags[float32Tag] =
								typedArrayTags[float64Tag] =
								typedArrayTags[int8Tag] =
								typedArrayTags[int16Tag] =
								typedArrayTags[int32Tag] =
								typedArrayTags[uint8Tag] =
								typedArrayTags[uint8ClampedTag] =
								typedArrayTags[uint16Tag] =
								typedArrayTags[uint32Tag] =
									true;
							typedArrayTags[argsTag$1] =
								typedArrayTags[arrayTag] =
								typedArrayTags[arrayBufferTag] =
								typedArrayTags[boolTag] =
								typedArrayTags[dataViewTag] =
								typedArrayTags[dateTag] =
								typedArrayTags[errorTag] =
								typedArrayTags[funcTag$1] =
								typedArrayTags[mapTag] =
								typedArrayTags[numberTag] =
								typedArrayTags[objectTag] =
								typedArrayTags[regexpTag] =
								typedArrayTags[setTag] =
								typedArrayTags[stringTag] =
								typedArrayTags[weakMapTag] =
									false;

							/**
							 * The base implementation of `_.isTypedArray` without Node.js optimizations.
							 *
							 * @private
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
							 */
							function baseIsTypedArray(value) {
								return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
							}

							/**
							 * The base implementation of `_.unary` without support for storing metadata.
							 *
							 * @private
							 * @param {Function} func The function to cap arguments for.
							 * @returns {Function} Returns the new capped function.
							 */
							function baseUnary(func) {
								return function (value) {
									return func(value);
								};
							}

							/** Detect free variable `exports`. */
							var freeExports$1 = typeof exports == "object" && exports && !exports.nodeType && exports;

							/** Detect free variable `module`. */
							var freeModule$1 = freeExports$1 && typeof module == "object" && module && !module.nodeType && module;

							/** Detect the popular CommonJS extension `module.exports`. */
							var moduleExports$1 = freeModule$1 && freeModule$1.exports === freeExports$1;

							/** Detect free variable `process` from Node.js. */
							var freeProcess = moduleExports$1 && freeGlobal.process;

							/** Used to access faster Node.js helpers. */
							var nodeUtil = (function () {
								try {
									// Use `util.types` for Node.js 10+.
									var types = freeModule$1 && freeModule$1.require && freeModule$1.require("util").types;

									if (types) {
										return types;
									}

									// Legacy `process.binding('util')` for Node.js < 10.
									return freeProcess && freeProcess.binding && freeProcess.binding("util");
								} catch (e) {}
							})();

							/* Node.js helper references. */
							var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

							/**
							 * Checks if `value` is classified as a typed array.
							 *
							 * @static
							 * @memberOf _
							 * @since 3.0.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
							 * @example
							 *
							 * _.isTypedArray(new Uint8Array);
							 * // => true
							 *
							 * _.isTypedArray([]);
							 * // => false
							 */
							var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

							/** Used for built-in method references. */
							var objectProto$2 = Object.prototype;

							/** Used to check objects for own properties. */
							var hasOwnProperty$1 = objectProto$2.hasOwnProperty;

							/**
							 * Creates an array of the enumerable property names of the array-like `value`.
							 *
							 * @private
							 * @param {*} value The value to query.
							 * @param {boolean} inherited Specify returning inherited property names.
							 * @returns {Array} Returns the array of property names.
							 */
							function arrayLikeKeys(value, inherited) {
								var isArr = isArray(value),
									isArg = !isArr && isArguments(value),
									isBuff = !isArr && !isArg && isBuffer(value),
									isType = !isArr && !isArg && !isBuff && isTypedArray(value),
									skipIndexes = isArr || isArg || isBuff || isType,
									result = skipIndexes ? baseTimes(value.length, String) : [],
									length = result.length;

								for (var key in value) {
									if (
										(inherited || hasOwnProperty$1.call(value, key)) &&
										!(
											skipIndexes &&
											// Safari 9 has enumerable `arguments.length` in strict mode.
											(key == "length" ||
												// Node.js 0.10 has enumerable non-index properties on buffers.
												(isBuff && (key == "offset" || key == "parent")) ||
												// PhantomJS 2 has enumerable non-index properties on typed arrays.
												(isType && (key == "buffer" || key == "byteLength" || key == "byteOffset")) ||
												// Skip index properties.
												isIndex(key, length))
										)
									) {
										result.push(key);
									}
								}
								return result;
							}

							/** Used for built-in method references. */
							var objectProto$5 = Object.prototype;

							/**
							 * Checks if `value` is likely a prototype object.
							 *
							 * @private
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
							 */
							function isPrototype(value) {
								var Ctor = value && value.constructor,
									proto = (typeof Ctor == "function" && Ctor.prototype) || objectProto$5;

								return value === proto;
							}

							/**
							 * Creates a unary function that invokes `func` with its argument transformed.
							 *
							 * @private
							 * @param {Function} func The function to wrap.
							 * @param {Function} transform The argument transform.
							 * @returns {Function} Returns the new function.
							 */
							function overArg(func, transform) {
								return function (arg) {
									return func(transform(arg));
								};
							}

							/* Built-in method references for those with the same name as other `lodash` methods. */
							var nativeKeys = overArg(Object.keys, Object);

							/** Used for built-in method references. */
							var objectProto$4 = Object.prototype;

							/** Used to check objects for own properties. */
							var hasOwnProperty$3 = objectProto$4.hasOwnProperty;

							/**
							 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
							 *
							 * @private
							 * @param {Object} object The object to query.
							 * @returns {Array} Returns the array of property names.
							 */
							function baseKeys(object) {
								if (!isPrototype(object)) {
									return nativeKeys(object);
								}
								var result = [];
								for (var key in Object(object)) {
									if (hasOwnProperty$3.call(object, key) && key != "constructor") {
										result.push(key);
									}
								}
								return result;
							}

							/**
							 * Creates an array of the own enumerable property names of `object`.
							 *
							 * **Note:** Non-object values are coerced to objects. See the
							 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
							 * for more details.
							 *
							 * @static
							 * @since 0.1.0
							 * @memberOf _
							 * @category Object
							 * @param {Object} object The object to query.
							 * @returns {Array} Returns the array of property names.
							 * @example
							 *
							 * function Foo() {
							 *   this.a = 1;
							 *   this.b = 2;
							 * }
							 *
							 * Foo.prototype.c = 3;
							 *
							 * _.keys(new Foo);
							 * // => ['a', 'b'] (iteration order is not guaranteed)
							 *
							 * _.keys('hi');
							 * // => ['0', '1']
							 */
							function keys(object) {
								return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
							}

							function createArrayIterator(coll) {
								var i = -1;
								var len = coll.length;
								return function next() {
									return ++i < len ? { value: coll[i], key: i } : null;
								};
							}

							function createES2015Iterator(iterator) {
								var i = -1;
								return function next() {
									var item = iterator.next();
									if (item.done) return null;
									i++;
									return { value: item.value, key: i };
								};
							}

							function createObjectIterator(obj) {
								var okeys = keys(obj);
								var i = -1;
								var len = okeys.length;
								return function next() {
									var key = okeys[++i];
									return i < len ? { value: obj[key], key: key } : null;
								};
							}

							function iterator(coll) {
								if (isArrayLike(coll)) {
									return createArrayIterator(coll);
								}

								var iterator = getIterator(coll);
								return iterator ? createES2015Iterator(iterator) : createObjectIterator(coll);
							}

							function onlyOnce(fn) {
								return function () {
									if (fn === null) throw new Error("Callback was already called.");
									var callFn = fn;
									fn = null;
									callFn.apply(this, arguments);
								};
							}

							function _eachOfLimit(limit) {
								return function (obj, iteratee, callback) {
									callback = once(callback || noop);
									if (limit <= 0 || !obj) {
										return callback(null);
									}
									var nextElem = iterator(obj);
									var done = false;
									var running = 0;
									var looping = false;

									function iterateeCallback(err, value) {
										running -= 1;
										if (err) {
											done = true;
											callback(err);
										} else if (value === breakLoop || (done && running <= 0)) {
											done = true;
											return callback(null);
										} else if (!looping) {
											replenish();
										}
									}

									function replenish() {
										looping = true;
										while (running < limit && !done) {
											var elem = nextElem();
											if (elem === null) {
												done = true;
												if (running <= 0) {
													callback(null);
												}
												return;
											}
											running += 1;
											iteratee(elem.value, elem.key, onlyOnce(iterateeCallback));
										}
										looping = false;
									}

									replenish();
								};
							}

							/**
							 * The same as [`eachOf`]{@link module:Collections.eachOf} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name eachOfLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.eachOf]{@link module:Collections.eachOf}
							 * @alias forEachOfLimit
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async function to apply to each
							 * item in `coll`. The `key` is the item's key, or index in the case of an
							 * array.
							 * Invoked with (item, key, callback).
							 * @param {Function} [callback] - A callback which is called when all
							 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
							 */
							function eachOfLimit(coll, limit, iteratee, callback) {
								_eachOfLimit(limit)(coll, wrapAsync(iteratee), callback);
							}

							function doLimit(fn, limit) {
								return function (iterable, iteratee, callback) {
									return fn(iterable, limit, iteratee, callback);
								};
							}

							// eachOf implementation optimized for array-likes
							function eachOfArrayLike(coll, iteratee, callback) {
								callback = once(callback || noop);
								var index = 0,
									completed = 0,
									length = coll.length;
								if (length === 0) {
									callback(null);
								}

								function iteratorCallback(err, value) {
									if (err) {
										callback(err);
									} else if (++completed === length || value === breakLoop) {
										callback(null);
									}
								}

								for (; index < length; index++) {
									iteratee(coll[index], index, onlyOnce(iteratorCallback));
								}
							}

							// a generic version of eachOf which can handle array, object, and iterator cases.
							var eachOfGeneric = doLimit(eachOfLimit, Infinity);

							/**
							 * Like [`each`]{@link module:Collections.each}, except that it passes the key (or index) as the second argument
							 * to the iteratee.
							 *
							 * @name eachOf
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @alias forEachOf
							 * @category Collection
							 * @see [async.each]{@link module:Collections.each}
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - A function to apply to each
							 * item in `coll`.
							 * The `key` is the item's key, or index in the case of an array.
							 * Invoked with (item, key, callback).
							 * @param {Function} [callback] - A callback which is called when all
							 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
							 * @example
							 *
							 * var obj = {dev: "/dev.json", test: "/test.json", prod: "/prod.json"};
							 * var configs = {};
							 *
							 * async.forEachOf(obj, function (value, key, callback) {
							 *     fs.readFile(__dirname + value, "utf8", function (err, data) {
							 *         if (err) return callback(err);
							 *         try {
							 *             configs[key] = JSON.parse(data);
							 *         } catch (e) {
							 *             return callback(e);
							 *         }
							 *         callback();
							 *     });
							 * }, function (err) {
							 *     if (err) console.error(err.message);
							 *     // configs is now a map of JSON data
							 *     doSomethingWith(configs);
							 * });
							 */
							var eachOf = function (coll, iteratee, callback) {
								var eachOfImplementation = isArrayLike(coll) ? eachOfArrayLike : eachOfGeneric;
								eachOfImplementation(coll, wrapAsync(iteratee), callback);
							};

							function doParallel(fn) {
								return function (obj, iteratee, callback) {
									return fn(eachOf, obj, wrapAsync(iteratee), callback);
								};
							}

							function _asyncMap(eachfn, arr, iteratee, callback) {
								callback = callback || noop;
								arr = arr || [];
								var results = [];
								var counter = 0;
								var _iteratee = wrapAsync(iteratee);

								eachfn(
									arr,
									function (value, _, callback) {
										var index = counter++;
										_iteratee(value, function (err, v) {
											results[index] = v;
											callback(err);
										});
									},
									function (err) {
										callback(err, results);
									}
								);
							}

							/**
							 * Produces a new collection of values by mapping each value in `coll` through
							 * the `iteratee` function. The `iteratee` is called with an item from `coll`
							 * and a callback for when it has finished processing. Each of these callback
							 * takes 2 arguments: an `error`, and the transformed item from `coll`. If
							 * `iteratee` passes an error to its callback, the main `callback` (for the
							 * `map` function) is immediately called with the error.
							 *
							 * Note, that since this function applies the `iteratee` to each item in
							 * parallel, there is no guarantee that the `iteratee` functions will complete
							 * in order. However, the results array will be in the same order as the
							 * original `coll`.
							 *
							 * If `map` is passed an Object, the results will be an Array.  The results
							 * will roughly be in the order of the original Objects' keys (but this can
							 * vary across JavaScript engines).
							 *
							 * @name map
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with the transformed item.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Results is an Array of the
							 * transformed items from the `coll`. Invoked with (err, results).
							 * @example
							 *
							 * async.map(['file1','file2','file3'], fs.stat, function(err, results) {
							 *     // results is now an array of stats for each file
							 * });
							 */
							var map = doParallel(_asyncMap);

							/**
							 * Applies the provided arguments to each function in the array, calling
							 * `callback` after all functions have completed. If you only provide the first
							 * argument, `fns`, then it will return a function which lets you pass in the
							 * arguments as if it were a single function call. If more arguments are
							 * provided, `callback` is required while `args` is still optional.
							 *
							 * @name applyEach
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Array|Iterable|Object} fns - A collection of {@link AsyncFunction}s
							 * to all call with the same arguments
							 * @param {...*} [args] - any number of separate arguments to pass to the
							 * function.
							 * @param {Function} [callback] - the final argument should be the callback,
							 * called when all functions have completed processing.
							 * @returns {Function} - If only the first argument, `fns`, is provided, it will
							 * return a function which lets you pass in the arguments as if it were a single
							 * function call. The signature is `(..args, callback)`. If invoked with any
							 * arguments, `callback` is required.
							 * @example
							 *
							 * async.applyEach([enableSearch, updateSchema], 'bucket', callback);
							 *
							 * // partial application example:
							 * async.each(
							 *     buckets,
							 *     async.applyEach([enableSearch, updateSchema]),
							 *     callback
							 * );
							 */
							var applyEach = applyEach$1(map);

							function doParallelLimit(fn) {
								return function (obj, limit, iteratee, callback) {
									return fn(_eachOfLimit(limit), obj, wrapAsync(iteratee), callback);
								};
							}

							/**
							 * The same as [`map`]{@link module:Collections.map} but runs a maximum of `limit` async operations at a time.
							 *
							 * @name mapLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.map]{@link module:Collections.map}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with the transformed item.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Results is an array of the
							 * transformed items from the `coll`. Invoked with (err, results).
							 */
							var mapLimit = doParallelLimit(_asyncMap);

							/**
							 * The same as [`map`]{@link module:Collections.map} but runs only a single async operation at a time.
							 *
							 * @name mapSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.map]{@link module:Collections.map}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with the transformed item.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Results is an array of the
							 * transformed items from the `coll`. Invoked with (err, results).
							 */
							var mapSeries = doLimit(mapLimit, 1);

							/**
							 * The same as [`applyEach`]{@link module:ControlFlow.applyEach} but runs only a single async operation at a time.
							 *
							 * @name applyEachSeries
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.applyEach]{@link module:ControlFlow.applyEach}
							 * @category Control Flow
							 * @param {Array|Iterable|Object} fns - A collection of {@link AsyncFunction}s to all
							 * call with the same arguments
							 * @param {...*} [args] - any number of separate arguments to pass to the
							 * function.
							 * @param {Function} [callback] - the final argument should be the callback,
							 * called when all functions have completed processing.
							 * @returns {Function} - If only the first argument is provided, it will return
							 * a function which lets you pass in the arguments as if it were a single
							 * function call.
							 */
							var applyEachSeries = applyEach$1(mapSeries);

							/**
							 * A specialized version of `_.forEach` for arrays without support for
							 * iteratee shorthands.
							 *
							 * @private
							 * @param {Array} [array] The array to iterate over.
							 * @param {Function} iteratee The function invoked per iteration.
							 * @returns {Array} Returns `array`.
							 */
							function arrayEach(array, iteratee) {
								var index = -1,
									length = array == null ? 0 : array.length;

								while (++index < length) {
									if (iteratee(array[index], index, array) === false) {
										break;
									}
								}
								return array;
							}

							/**
							 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
							 *
							 * @private
							 * @param {boolean} [fromRight] Specify iterating from right to left.
							 * @returns {Function} Returns the new base function.
							 */
							function createBaseFor(fromRight) {
								return function (object, iteratee, keysFunc) {
									var index = -1,
										iterable = Object(object),
										props = keysFunc(object),
										length = props.length;

									while (length--) {
										var key = props[fromRight ? length : ++index];
										if (iteratee(iterable[key], key, iterable) === false) {
											break;
										}
									}
									return object;
								};
							}

							/**
							 * The base implementation of `baseForOwn` which iterates over `object`
							 * properties returned by `keysFunc` and invokes `iteratee` for each property.
							 * Iteratee functions may exit iteration early by explicitly returning `false`.
							 *
							 * @private
							 * @param {Object} object The object to iterate over.
							 * @param {Function} iteratee The function invoked per iteration.
							 * @param {Function} keysFunc The function to get the keys of `object`.
							 * @returns {Object} Returns `object`.
							 */
							var baseFor = createBaseFor();

							/**
							 * The base implementation of `_.forOwn` without support for iteratee shorthands.
							 *
							 * @private
							 * @param {Object} object The object to iterate over.
							 * @param {Function} iteratee The function invoked per iteration.
							 * @returns {Object} Returns `object`.
							 */
							function baseForOwn(object, iteratee) {
								return object && baseFor(object, iteratee, keys);
							}

							/**
							 * The base implementation of `_.findIndex` and `_.findLastIndex` without
							 * support for iteratee shorthands.
							 *
							 * @private
							 * @param {Array} array The array to inspect.
							 * @param {Function} predicate The function invoked per iteration.
							 * @param {number} fromIndex The index to search from.
							 * @param {boolean} [fromRight] Specify iterating from right to left.
							 * @returns {number} Returns the index of the matched value, else `-1`.
							 */
							function baseFindIndex(array, predicate, fromIndex, fromRight) {
								var length = array.length,
									index = fromIndex + (fromRight ? 1 : -1);

								while (fromRight ? index-- : ++index < length) {
									if (predicate(array[index], index, array)) {
										return index;
									}
								}
								return -1;
							}

							/**
							 * The base implementation of `_.isNaN` without support for number objects.
							 *
							 * @private
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
							 */
							function baseIsNaN(value) {
								return value !== value;
							}

							/**
							 * A specialized version of `_.indexOf` which performs strict equality
							 * comparisons of values, i.e. `===`.
							 *
							 * @private
							 * @param {Array} array The array to inspect.
							 * @param {*} value The value to search for.
							 * @param {number} fromIndex The index to search from.
							 * @returns {number} Returns the index of the matched value, else `-1`.
							 */
							function strictIndexOf(array, value, fromIndex) {
								var index = fromIndex - 1,
									length = array.length;

								while (++index < length) {
									if (array[index] === value) {
										return index;
									}
								}
								return -1;
							}

							/**
							 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
							 *
							 * @private
							 * @param {Array} array The array to inspect.
							 * @param {*} value The value to search for.
							 * @param {number} fromIndex The index to search from.
							 * @returns {number} Returns the index of the matched value, else `-1`.
							 */
							function baseIndexOf(array, value, fromIndex) {
								return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
							}

							/**
							 * Determines the best order for running the {@link AsyncFunction}s in `tasks`, based on
							 * their requirements. Each function can optionally depend on other functions
							 * being completed first, and each function is run as soon as its requirements
							 * are satisfied.
							 *
							 * If any of the {@link AsyncFunction}s pass an error to their callback, the `auto` sequence
							 * will stop. Further tasks will not execute (so any other functions depending
							 * on it will not run), and the main `callback` is immediately called with the
							 * error.
							 *
							 * {@link AsyncFunction}s also receive an object containing the results of functions which
							 * have completed so far as the first argument, if they have dependencies. If a
							 * task function has no dependencies, it will only be passed a callback.
							 *
							 * @name auto
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Object} tasks - An object. Each of its properties is either a
							 * function or an array of requirements, with the {@link AsyncFunction} itself the last item
							 * in the array. The object's key of a property serves as the name of the task
							 * defined by that property, i.e. can be used when specifying requirements for
							 * other tasks. The function receives one or two arguments:
							 * * a `results` object, containing the results of the previously executed
							 *   functions, only passed if the task has any dependencies,
							 * * a `callback(err, result)` function, which must be called when finished,
							 *   passing an `error` (which can be `null`) and the result of the function's
							 *   execution.
							 * @param {number} [concurrency=Infinity] - An optional `integer` for
							 * determining the maximum number of tasks that can be run in parallel. By
							 * default, as many as possible.
							 * @param {Function} [callback] - An optional callback which is called when all
							 * the tasks have been completed. It receives the `err` argument if any `tasks`
							 * pass an error to their callback. Results are always returned; however, if an
							 * error occurs, no further `tasks` will be performed, and the results object
							 * will only contain partial results. Invoked with (err, results).
							 * @returns undefined
							 * @example
							 *
							 * async.auto({
							 *     // this function will just be passed a callback
							 *     readData: async.apply(fs.readFile, 'data.txt', 'utf-8'),
							 *     showData: ['readData', function(results, cb) {
							 *         // results.readData is the file's contents
							 *         // ...
							 *     }]
							 * }, callback);
							 *
							 * async.auto({
							 *     get_data: function(callback) {
							 *         console.log('in get_data');
							 *         // async code to get some data
							 *         callback(null, 'data', 'converted to array');
							 *     },
							 *     make_folder: function(callback) {
							 *         console.log('in make_folder');
							 *         // async code to create a directory to store a file in
							 *         // this is run at the same time as getting the data
							 *         callback(null, 'folder');
							 *     },
							 *     write_file: ['get_data', 'make_folder', function(results, callback) {
							 *         console.log('in write_file', JSON.stringify(results));
							 *         // once there is some data and the directory exists,
							 *         // write the data to a file in the directory
							 *         callback(null, 'filename');
							 *     }],
							 *     email_link: ['write_file', function(results, callback) {
							 *         console.log('in email_link', JSON.stringify(results));
							 *         // once the file is written let's email a link to it...
							 *         // results.write_file contains the filename returned by write_file.
							 *         callback(null, {'file':results.write_file, 'email':'user@example.com'});
							 *     }]
							 * }, function(err, results) {
							 *     console.log('err = ', err);
							 *     console.log('results = ', results);
							 * });
							 */
							var auto = function (tasks, concurrency, callback) {
								if (typeof concurrency === "function") {
									// concurrency is optional, shift the args.
									callback = concurrency;
									concurrency = null;
								}
								callback = once(callback || noop);
								var keys$$1 = keys(tasks);
								var numTasks = keys$$1.length;
								if (!numTasks) {
									return callback(null);
								}
								if (!concurrency) {
									concurrency = numTasks;
								}

								var results = {};
								var runningTasks = 0;
								var hasError = false;

								var listeners = Object.create(null);

								var readyTasks = [];

								// for cycle detection:
								var readyToCheck = []; // tasks that have been identified as reachable
								// without the possibility of returning to an ancestor task
								var uncheckedDependencies = {};

								baseForOwn(tasks, function (task, key) {
									if (!isArray(task)) {
										// no dependencies
										enqueueTask(key, [task]);
										readyToCheck.push(key);
										return;
									}

									var dependencies = task.slice(0, task.length - 1);
									var remainingDependencies = dependencies.length;
									if (remainingDependencies === 0) {
										enqueueTask(key, task);
										readyToCheck.push(key);
										return;
									}
									uncheckedDependencies[key] = remainingDependencies;

									arrayEach(dependencies, function (dependencyName) {
										if (!tasks[dependencyName]) {
											throw new Error(
												"async.auto task `" + key + "` has a non-existent dependency `" + dependencyName + "` in " + dependencies.join(", ")
											);
										}
										addListener(dependencyName, function () {
											remainingDependencies--;
											if (remainingDependencies === 0) {
												enqueueTask(key, task);
											}
										});
									});
								});

								checkForDeadlocks();
								processQueue();

								function enqueueTask(key, task) {
									readyTasks.push(function () {
										runTask(key, task);
									});
								}

								function processQueue() {
									if (readyTasks.length === 0 && runningTasks === 0) {
										return callback(null, results);
									}
									while (readyTasks.length && runningTasks < concurrency) {
										var run = readyTasks.shift();
										run();
									}
								}

								function addListener(taskName, fn) {
									var taskListeners = listeners[taskName];
									if (!taskListeners) {
										taskListeners = listeners[taskName] = [];
									}

									taskListeners.push(fn);
								}

								function taskComplete(taskName) {
									var taskListeners = listeners[taskName] || [];
									arrayEach(taskListeners, function (fn) {
										fn();
									});
									processQueue();
								}

								function runTask(key, task) {
									if (hasError) return;

									var taskCallback = onlyOnce(function (err, result) {
										runningTasks--;
										if (arguments.length > 2) {
											result = slice(arguments, 1);
										}
										if (err) {
											var safeResults = {};
											baseForOwn(results, function (val, rkey) {
												safeResults[rkey] = val;
											});
											safeResults[key] = result;
											hasError = true;
											listeners = Object.create(null);

											callback(err, safeResults);
										} else {
											results[key] = result;
											taskComplete(key);
										}
									});

									runningTasks++;
									var taskFn = wrapAsync(task[task.length - 1]);
									if (task.length > 1) {
										taskFn(results, taskCallback);
									} else {
										taskFn(taskCallback);
									}
								}

								function checkForDeadlocks() {
									// Kahn's algorithm
									// https://en.wikipedia.org/wiki/Topological_sorting#Kahn.27s_algorithm
									// http://connalle.blogspot.com/2013/10/topological-sortingkahn-algorithm.html
									var currentTask;
									var counter = 0;
									while (readyToCheck.length) {
										currentTask = readyToCheck.pop();
										counter++;
										arrayEach(getDependents(currentTask), function (dependent) {
											if (--uncheckedDependencies[dependent] === 0) {
												readyToCheck.push(dependent);
											}
										});
									}

									if (counter !== numTasks) {
										throw new Error("async.auto cannot execute tasks due to a recursive dependency");
									}
								}

								function getDependents(taskName) {
									var result = [];
									baseForOwn(tasks, function (task, key) {
										if (isArray(task) && baseIndexOf(task, taskName, 0) >= 0) {
											result.push(key);
										}
									});
									return result;
								}
							};

							/**
							 * A specialized version of `_.map` for arrays without support for iteratee
							 * shorthands.
							 *
							 * @private
							 * @param {Array} [array] The array to iterate over.
							 * @param {Function} iteratee The function invoked per iteration.
							 * @returns {Array} Returns the new mapped array.
							 */
							function arrayMap(array, iteratee) {
								var index = -1,
									length = array == null ? 0 : array.length,
									result = Array(length);

								while (++index < length) {
									result[index] = iteratee(array[index], index, array);
								}
								return result;
							}

							/** `Object#toString` result references. */
							var symbolTag = "[object Symbol]";

							/**
							 * Checks if `value` is classified as a `Symbol` primitive or object.
							 *
							 * @static
							 * @memberOf _
							 * @since 4.0.0
							 * @category Lang
							 * @param {*} value The value to check.
							 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
							 * @example
							 *
							 * _.isSymbol(Symbol.iterator);
							 * // => true
							 *
							 * _.isSymbol('abc');
							 * // => false
							 */
							function isSymbol(value) {
								return typeof value == "symbol" || (isObjectLike(value) && baseGetTag(value) == symbolTag);
							}

							/** Used as references for various `Number` constants. */
							var INFINITY = 1 / 0;

							/** Used to convert symbols to primitives and strings. */
							var symbolProto = Symbol$1 ? Symbol$1.prototype : undefined;
							var symbolToString = symbolProto ? symbolProto.toString : undefined;

							/**
							 * The base implementation of `_.toString` which doesn't convert nullish
							 * values to empty strings.
							 *
							 * @private
							 * @param {*} value The value to process.
							 * @returns {string} Returns the string.
							 */
							function baseToString(value) {
								// Exit early for strings to avoid a performance hit in some environments.
								if (typeof value == "string") {
									return value;
								}
								if (isArray(value)) {
									// Recursively convert values (susceptible to call stack limits).
									return arrayMap(value, baseToString) + "";
								}
								if (isSymbol(value)) {
									return symbolToString ? symbolToString.call(value) : "";
								}
								var result = value + "";
								return result == "0" && 1 / value == -INFINITY ? "-0" : result;
							}

							/**
							 * The base implementation of `_.slice` without an iteratee call guard.
							 *
							 * @private
							 * @param {Array} array The array to slice.
							 * @param {number} [start=0] The start position.
							 * @param {number} [end=array.length] The end position.
							 * @returns {Array} Returns the slice of `array`.
							 */
							function baseSlice(array, start, end) {
								var index = -1,
									length = array.length;

								if (start < 0) {
									start = -start > length ? 0 : length + start;
								}
								end = end > length ? length : end;
								if (end < 0) {
									end += length;
								}
								length = start > end ? 0 : (end - start) >>> 0;
								start >>>= 0;

								var result = Array(length);
								while (++index < length) {
									result[index] = array[index + start];
								}
								return result;
							}

							/**
							 * Casts `array` to a slice if it's needed.
							 *
							 * @private
							 * @param {Array} array The array to inspect.
							 * @param {number} start The start position.
							 * @param {number} [end=array.length] The end position.
							 * @returns {Array} Returns the cast slice.
							 */
							function castSlice(array, start, end) {
								var length = array.length;
								end = end === undefined ? length : end;
								return !start && end >= length ? array : baseSlice(array, start, end);
							}

							/**
							 * Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
							 * that is not found in the character symbols.
							 *
							 * @private
							 * @param {Array} strSymbols The string symbols to inspect.
							 * @param {Array} chrSymbols The character symbols to find.
							 * @returns {number} Returns the index of the last unmatched string symbol.
							 */
							function charsEndIndex(strSymbols, chrSymbols) {
								var index = strSymbols.length;

								while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
								return index;
							}

							/**
							 * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
							 * that is not found in the character symbols.
							 *
							 * @private
							 * @param {Array} strSymbols The string symbols to inspect.
							 * @param {Array} chrSymbols The character symbols to find.
							 * @returns {number} Returns the index of the first unmatched string symbol.
							 */
							function charsStartIndex(strSymbols, chrSymbols) {
								var index = -1,
									length = strSymbols.length;

								while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
								return index;
							}

							/**
							 * Converts an ASCII `string` to an array.
							 *
							 * @private
							 * @param {string} string The string to convert.
							 * @returns {Array} Returns the converted array.
							 */
							function asciiToArray(string) {
								return string.split("");
							}

							/** Used to compose unicode character classes. */
							var rsAstralRange = "\\ud800-\\udfff";
							var rsComboMarksRange = "\\u0300-\\u036f";
							var reComboHalfMarksRange = "\\ufe20-\\ufe2f";
							var rsComboSymbolsRange = "\\u20d0-\\u20ff";
							var rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange;
							var rsVarRange = "\\ufe0e\\ufe0f";

							/** Used to compose unicode capture groups. */
							var rsZWJ = "\\u200d";

							/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
							var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");

							/**
							 * Checks if `string` contains Unicode symbols.
							 *
							 * @private
							 * @param {string} string The string to inspect.
							 * @returns {boolean} Returns `true` if a symbol is found, else `false`.
							 */
							function hasUnicode(string) {
								return reHasUnicode.test(string);
							}

							/** Used to compose unicode character classes. */
							var rsAstralRange$1 = "\\ud800-\\udfff";
							var rsComboMarksRange$1 = "\\u0300-\\u036f";
							var reComboHalfMarksRange$1 = "\\ufe20-\\ufe2f";
							var rsComboSymbolsRange$1 = "\\u20d0-\\u20ff";
							var rsComboRange$1 = rsComboMarksRange$1 + reComboHalfMarksRange$1 + rsComboSymbolsRange$1;
							var rsVarRange$1 = "\\ufe0e\\ufe0f";

							/** Used to compose unicode capture groups. */
							var rsAstral = "[" + rsAstralRange$1 + "]";
							var rsCombo = "[" + rsComboRange$1 + "]";
							var rsFitz = "\\ud83c[\\udffb-\\udfff]";
							var rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")";
							var rsNonAstral = "[^" + rsAstralRange$1 + "]";
							var rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}";
							var rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]";
							var rsZWJ$1 = "\\u200d";

							/** Used to compose unicode regexes. */
							var reOptMod = rsModifier + "?";
							var rsOptVar = "[" + rsVarRange$1 + "]?";
							var rsOptJoin = "(?:" + rsZWJ$1 + "(?:" + [rsNonAstral, rsRegional, rsSurrPair].join("|") + ")" + rsOptVar + reOptMod + ")*";
							var rsSeq = rsOptVar + reOptMod + rsOptJoin;
							var rsSymbol = "(?:" + [rsNonAstral + rsCombo + "?", rsCombo, rsRegional, rsSurrPair, rsAstral].join("|") + ")";

							/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
							var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");

							/**
							 * Converts a Unicode `string` to an array.
							 *
							 * @private
							 * @param {string} string The string to convert.
							 * @returns {Array} Returns the converted array.
							 */
							function unicodeToArray(string) {
								return string.match(reUnicode) || [];
							}

							/**
							 * Converts `string` to an array.
							 *
							 * @private
							 * @param {string} string The string to convert.
							 * @returns {Array} Returns the converted array.
							 */
							function stringToArray(string) {
								return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
							}

							/**
							 * Converts `value` to a string. An empty string is returned for `null`
							 * and `undefined` values. The sign of `-0` is preserved.
							 *
							 * @static
							 * @memberOf _
							 * @since 4.0.0
							 * @category Lang
							 * @param {*} value The value to convert.
							 * @returns {string} Returns the converted string.
							 * @example
							 *
							 * _.toString(null);
							 * // => ''
							 *
							 * _.toString(-0);
							 * // => '-0'
							 *
							 * _.toString([1, 2, 3]);
							 * // => '1,2,3'
							 */
							function toString(value) {
								return value == null ? "" : baseToString(value);
							}

							/** Used to match leading and trailing whitespace. */
							var reTrim = /^\s+|\s+$/g;

							/**
							 * Removes leading and trailing whitespace or specified characters from `string`.
							 *
							 * @static
							 * @memberOf _
							 * @since 3.0.0
							 * @category String
							 * @param {string} [string=''] The string to trim.
							 * @param {string} [chars=whitespace] The characters to trim.
							 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
							 * @returns {string} Returns the trimmed string.
							 * @example
							 *
							 * _.trim('  abc  ');
							 * // => 'abc'
							 *
							 * _.trim('-_-abc-_-', '_-');
							 * // => 'abc'
							 *
							 * _.map(['  foo  ', '  bar  '], _.trim);
							 * // => ['foo', 'bar']
							 */
							function trim(string, chars, guard) {
								string = toString(string);
								if (string && (guard || chars === undefined)) {
									return string.replace(reTrim, "");
								}
								if (!string || !(chars = baseToString(chars))) {
									return string;
								}
								var strSymbols = stringToArray(string),
									chrSymbols = stringToArray(chars),
									start = charsStartIndex(strSymbols, chrSymbols),
									end = charsEndIndex(strSymbols, chrSymbols) + 1;

								return castSlice(strSymbols, start, end).join("");
							}

							var FN_ARGS = /^(?:async\s+)?(function)?\s*[^\(]*\(\s*([^\)]*)\)/m;
							var FN_ARG_SPLIT = /,/;
							var FN_ARG = /(=.+)?(\s*)$/;
							var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;

							function parseParams(func) {
								func = func.toString().replace(STRIP_COMMENTS, "");
								func = func.match(FN_ARGS)[2].replace(" ", "");
								func = func ? func.split(FN_ARG_SPLIT) : [];
								func = func.map(function (arg) {
									return trim(arg.replace(FN_ARG, ""));
								});
								return func;
							}

							/**
							 * A dependency-injected version of the [async.auto]{@link module:ControlFlow.auto} function. Dependent
							 * tasks are specified as parameters to the function, after the usual callback
							 * parameter, with the parameter names matching the names of the tasks it
							 * depends on. This can provide even more readable task graphs which can be
							 * easier to maintain.
							 *
							 * If a final callback is specified, the task results are similarly injected,
							 * specified as named parameters after the initial error parameter.
							 *
							 * The autoInject function is purely syntactic sugar and its semantics are
							 * otherwise equivalent to [async.auto]{@link module:ControlFlow.auto}.
							 *
							 * @name autoInject
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.auto]{@link module:ControlFlow.auto}
							 * @category Control Flow
							 * @param {Object} tasks - An object, each of whose properties is an {@link AsyncFunction} of
							 * the form 'func([dependencies...], callback). The object's key of a property
							 * serves as the name of the task defined by that property, i.e. can be used
							 * when specifying requirements for other tasks.
							 * * The `callback` parameter is a `callback(err, result)` which must be called
							 *   when finished, passing an `error` (which can be `null`) and the result of
							 *   the function's execution. The remaining parameters name other tasks on
							 *   which the task is dependent, and the results from those tasks are the
							 *   arguments of those parameters.
							 * @param {Function} [callback] - An optional callback which is called when all
							 * the tasks have been completed. It receives the `err` argument if any `tasks`
							 * pass an error to their callback, and a `results` object with any completed
							 * task results, similar to `auto`.
							 * @example
							 *
							 * //  The example from `auto` can be rewritten as follows:
							 * async.autoInject({
							 *     get_data: function(callback) {
							 *         // async code to get some data
							 *         callback(null, 'data', 'converted to array');
							 *     },
							 *     make_folder: function(callback) {
							 *         // async code to create a directory to store a file in
							 *         // this is run at the same time as getting the data
							 *         callback(null, 'folder');
							 *     },
							 *     write_file: function(get_data, make_folder, callback) {
							 *         // once there is some data and the directory exists,
							 *         // write the data to a file in the directory
							 *         callback(null, 'filename');
							 *     },
							 *     email_link: function(write_file, callback) {
							 *         // once the file is written let's email a link to it...
							 *         // write_file contains the filename returned by write_file.
							 *         callback(null, {'file':write_file, 'email':'user@example.com'});
							 *     }
							 * }, function(err, results) {
							 *     console.log('err = ', err);
							 *     console.log('email_link = ', results.email_link);
							 * });
							 *
							 * // If you are using a JS minifier that mangles parameter names, `autoInject`
							 * // will not work with plain functions, since the parameter names will be
							 * // collapsed to a single letter identifier.  To work around this, you can
							 * // explicitly specify the names of the parameters your task function needs
							 * // in an array, similar to Angular.js dependency injection.
							 *
							 * // This still has an advantage over plain `auto`, since the results a task
							 * // depends on are still spread into arguments.
							 * async.autoInject({
							 *     //...
							 *     write_file: ['get_data', 'make_folder', function(get_data, make_folder, callback) {
							 *         callback(null, 'filename');
							 *     }],
							 *     email_link: ['write_file', function(write_file, callback) {
							 *         callback(null, {'file':write_file, 'email':'user@example.com'});
							 *     }]
							 *     //...
							 * }, function(err, results) {
							 *     console.log('err = ', err);
							 *     console.log('email_link = ', results.email_link);
							 * });
							 */
							function autoInject(tasks, callback) {
								var newTasks = {};

								baseForOwn(tasks, function (taskFn, key) {
									var params;
									var fnIsAsync = isAsync(taskFn);
									var hasNoDeps = (!fnIsAsync && taskFn.length === 1) || (fnIsAsync && taskFn.length === 0);

									if (isArray(taskFn)) {
										params = taskFn.slice(0, -1);
										taskFn = taskFn[taskFn.length - 1];

										newTasks[key] = params.concat(params.length > 0 ? newTask : taskFn);
									} else if (hasNoDeps) {
										// no dependencies, use the function as-is
										newTasks[key] = taskFn;
									} else {
										params = parseParams(taskFn);
										if (taskFn.length === 0 && !fnIsAsync && params.length === 0) {
											throw new Error("autoInject task functions require explicit parameters.");
										}

										// remove callback param
										if (!fnIsAsync) params.pop();

										newTasks[key] = params.concat(newTask);
									}

									function newTask(results, taskCb) {
										var newArgs = arrayMap(params, function (name) {
											return results[name];
										});
										newArgs.push(taskCb);
										wrapAsync(taskFn).apply(null, newArgs);
									}
								});

								auto(newTasks, callback);
							}

							// Simple doubly linked list (https://en.wikipedia.org/wiki/Doubly_linked_list) implementation
							// used for queues. This implementation assumes that the node provided by the user can be modified
							// to adjust the next and last properties. We implement only the minimal functionality
							// for queue support.
							function DLL() {
								this.head = this.tail = null;
								this.length = 0;
							}

							function setInitial(dll, node) {
								dll.length = 1;
								dll.head = dll.tail = node;
							}

							DLL.prototype.removeLink = function (node) {
								if (node.prev) node.prev.next = node.next;
								else this.head = node.next;
								if (node.next) node.next.prev = node.prev;
								else this.tail = node.prev;

								node.prev = node.next = null;
								this.length -= 1;
								return node;
							};

							DLL.prototype.empty = function () {
								while (this.head) this.shift();
								return this;
							};

							DLL.prototype.insertAfter = function (node, newNode) {
								newNode.prev = node;
								newNode.next = node.next;
								if (node.next) node.next.prev = newNode;
								else this.tail = newNode;
								node.next = newNode;
								this.length += 1;
							};

							DLL.prototype.insertBefore = function (node, newNode) {
								newNode.prev = node.prev;
								newNode.next = node;
								if (node.prev) node.prev.next = newNode;
								else this.head = newNode;
								node.prev = newNode;
								this.length += 1;
							};

							DLL.prototype.unshift = function (node) {
								if (this.head) this.insertBefore(this.head, node);
								else setInitial(this, node);
							};

							DLL.prototype.push = function (node) {
								if (this.tail) this.insertAfter(this.tail, node);
								else setInitial(this, node);
							};

							DLL.prototype.shift = function () {
								return this.head && this.removeLink(this.head);
							};

							DLL.prototype.pop = function () {
								return this.tail && this.removeLink(this.tail);
							};

							DLL.prototype.toArray = function () {
								var arr = Array(this.length);
								var curr = this.head;
								for (var idx = 0; idx < this.length; idx++) {
									arr[idx] = curr.data;
									curr = curr.next;
								}
								return arr;
							};

							DLL.prototype.remove = function (testFn) {
								var curr = this.head;
								while (!!curr) {
									var next = curr.next;
									if (testFn(curr)) {
										this.removeLink(curr);
									}
									curr = next;
								}
								return this;
							};

							function queue(worker, concurrency, payload) {
								if (concurrency == null) {
									concurrency = 1;
								} else if (concurrency === 0) {
									throw new Error("Concurrency must not be zero");
								}

								var _worker = wrapAsync(worker);
								var numRunning = 0;
								var workersList = [];

								var processingScheduled = false;
								function _insert(data, insertAtFront, callback) {
									if (callback != null && typeof callback !== "function") {
										throw new Error("task callback must be a function");
									}
									q.started = true;
									if (!isArray(data)) {
										data = [data];
									}
									if (data.length === 0 && q.idle()) {
										// call drain immediately if there are no tasks
										return setImmediate$1(function () {
											q.drain();
										});
									}

									for (var i = 0, l = data.length; i < l; i++) {
										var item = {
											data: data[i],
											callback: callback || noop
										};

										if (insertAtFront) {
											q._tasks.unshift(item);
										} else {
											q._tasks.push(item);
										}
									}

									if (!processingScheduled) {
										processingScheduled = true;
										setImmediate$1(function () {
											processingScheduled = false;
											q.process();
										});
									}
								}

								function _next(tasks) {
									return function (err) {
										numRunning -= 1;

										for (var i = 0, l = tasks.length; i < l; i++) {
											var task = tasks[i];

											var index = baseIndexOf(workersList, task, 0);
											if (index === 0) {
												workersList.shift();
											} else if (index > 0) {
												workersList.splice(index, 1);
											}

											task.callback.apply(task, arguments);

											if (err != null) {
												q.error(err, task.data);
											}
										}

										if (numRunning <= q.concurrency - q.buffer) {
											q.unsaturated();
										}

										if (q.idle()) {
											q.drain();
										}
										q.process();
									};
								}

								var isProcessing = false;
								var q = {
									_tasks: new DLL(),
									concurrency: concurrency,
									payload: payload,
									saturated: noop,
									unsaturated: noop,
									buffer: concurrency / 4,
									empty: noop,
									drain: noop,
									error: noop,
									started: false,
									paused: false,
									push: function (data, callback) {
										_insert(data, false, callback);
									},
									kill: function () {
										q.drain = noop;
										q._tasks.empty();
									},
									unshift: function (data, callback) {
										_insert(data, true, callback);
									},
									remove: function (testFn) {
										q._tasks.remove(testFn);
									},
									process: function () {
										// Avoid trying to start too many processing operations. This can occur
										// when callbacks resolve synchronously (#1267).
										if (isProcessing) {
											return;
										}
										isProcessing = true;
										while (!q.paused && numRunning < q.concurrency && q._tasks.length) {
											var tasks = [],
												data = [];
											var l = q._tasks.length;
											if (q.payload) l = Math.min(l, q.payload);
											for (var i = 0; i < l; i++) {
												var node = q._tasks.shift();
												tasks.push(node);
												workersList.push(node);
												data.push(node.data);
											}

											numRunning += 1;

											if (q._tasks.length === 0) {
												q.empty();
											}

											if (numRunning === q.concurrency) {
												q.saturated();
											}

											var cb = onlyOnce(_next(tasks));
											_worker(data, cb);
										}
										isProcessing = false;
									},
									length: function () {
										return q._tasks.length;
									},
									running: function () {
										return numRunning;
									},
									workersList: function () {
										return workersList;
									},
									idle: function () {
										return q._tasks.length + numRunning === 0;
									},
									pause: function () {
										q.paused = true;
									},
									resume: function () {
										if (q.paused === false) {
											return;
										}
										q.paused = false;
										setImmediate$1(q.process);
									}
								};
								return q;
							}

							/**
							 * A cargo of tasks for the worker function to complete. Cargo inherits all of
							 * the same methods and event callbacks as [`queue`]{@link module:ControlFlow.queue}.
							 * @typedef {Object} CargoObject
							 * @memberOf module:ControlFlow
							 * @property {Function} length - A function returning the number of items
							 * waiting to be processed. Invoke like `cargo.length()`.
							 * @property {number} payload - An `integer` for determining how many tasks
							 * should be process per round. This property can be changed after a `cargo` is
							 * created to alter the payload on-the-fly.
							 * @property {Function} push - Adds `task` to the `queue`. The callback is
							 * called once the `worker` has finished processing the task. Instead of a
							 * single task, an array of `tasks` can be submitted. The respective callback is
							 * used for every task in the list. Invoke like `cargo.push(task, [callback])`.
							 * @property {Function} saturated - A callback that is called when the
							 * `queue.length()` hits the concurrency and further tasks will be queued.
							 * @property {Function} empty - A callback that is called when the last item
							 * from the `queue` is given to a `worker`.
							 * @property {Function} drain - A callback that is called when the last item
							 * from the `queue` has returned from the `worker`.
							 * @property {Function} idle - a function returning false if there are items
							 * waiting or being processed, or true if not. Invoke like `cargo.idle()`.
							 * @property {Function} pause - a function that pauses the processing of tasks
							 * until `resume()` is called. Invoke like `cargo.pause()`.
							 * @property {Function} resume - a function that resumes the processing of
							 * queued tasks when the queue is paused. Invoke like `cargo.resume()`.
							 * @property {Function} kill - a function that removes the `drain` callback and
							 * empties remaining tasks from the queue forcing it to go idle. Invoke like `cargo.kill()`.
							 */

							/**
							 * Creates a `cargo` object with the specified payload. Tasks added to the
							 * cargo will be processed altogether (up to the `payload` limit). If the
							 * `worker` is in progress, the task is queued until it becomes available. Once
							 * the `worker` has completed some tasks, each callback of those tasks is
							 * called. Check out [these](https://camo.githubusercontent.com/6bbd36f4cf5b35a0f11a96dcd2e97711ffc2fb37/68747470733a2f2f662e636c6f75642e6769746875622e636f6d2f6173736574732f313637363837312f36383130382f62626330636662302d356632392d313165322d393734662d3333393763363464633835382e676966) [animations](https://camo.githubusercontent.com/f4810e00e1c5f5f8addbe3e9f49064fd5d102699/68747470733a2f2f662e636c6f75642e6769746875622e636f6d2f6173736574732f313637363837312f36383130312f38346339323036362d356632392d313165322d383134662d3964336430323431336266642e676966)
							 * for how `cargo` and `queue` work.
							 *
							 * While [`queue`]{@link module:ControlFlow.queue} passes only one task to one of a group of workers
							 * at a time, cargo passes an array of tasks to a single worker, repeating
							 * when the worker is finished.
							 *
							 * @name cargo
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.queue]{@link module:ControlFlow.queue}
							 * @category Control Flow
							 * @param {AsyncFunction} worker - An asynchronous function for processing an array
							 * of queued tasks. Invoked with `(tasks, callback)`.
							 * @param {number} [payload=Infinity] - An optional `integer` for determining
							 * how many tasks should be processed per round; if omitted, the default is
							 * unlimited.
							 * @returns {module:ControlFlow.CargoObject} A cargo object to manage the tasks. Callbacks can
							 * attached as certain properties to listen for specific events during the
							 * lifecycle of the cargo and inner queue.
							 * @example
							 *
							 * // create a cargo object with payload 2
							 * var cargo = async.cargo(function(tasks, callback) {
							 *     for (var i=0; i<tasks.length; i++) {
							 *         console.log('hello ' + tasks[i].name);
							 *     }
							 *     callback();
							 * }, 2);
							 *
							 * // add some items
							 * cargo.push({name: 'foo'}, function(err) {
							 *     console.log('finished processing foo');
							 * });
							 * cargo.push({name: 'bar'}, function(err) {
							 *     console.log('finished processing bar');
							 * });
							 * cargo.push({name: 'baz'}, function(err) {
							 *     console.log('finished processing baz');
							 * });
							 */
							function cargo(worker, payload) {
								return queue(worker, 1, payload);
							}

							/**
							 * The same as [`eachOf`]{@link module:Collections.eachOf} but runs only a single async operation at a time.
							 *
							 * @name eachOfSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.eachOf]{@link module:Collections.eachOf}
							 * @alias forEachOfSeries
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * Invoked with (item, key, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Invoked with (err).
							 */
							var eachOfSeries = doLimit(eachOfLimit, 1);

							/**
							 * Reduces `coll` into a single value using an async `iteratee` to return each
							 * successive step. `memo` is the initial state of the reduction. This function
							 * only operates in series.
							 *
							 * For performance reasons, it may make sense to split a call to this function
							 * into a parallel map, and then use the normal `Array.prototype.reduce` on the
							 * results. This function is for situations where each step in the reduction
							 * needs to be async; if you can get the data before reducing it, then it's
							 * probably a good idea to do so.
							 *
							 * @name reduce
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @alias inject
							 * @alias foldl
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {*} memo - The initial state of the reduction.
							 * @param {AsyncFunction} iteratee - A function applied to each item in the
							 * array to produce the next step in the reduction.
							 * The `iteratee` should complete with the next state of the reduction.
							 * If the iteratee complete with an error, the reduction is stopped and the
							 * main `callback` is immediately called with the error.
							 * Invoked with (memo, item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Result is the reduced value. Invoked with
							 * (err, result).
							 * @example
							 *
							 * async.reduce([1,2,3], 0, function(memo, item, callback) {
							 *     // pointless async:
							 *     process.nextTick(function() {
							 *         callback(null, memo + item)
							 *     });
							 * }, function(err, result) {
							 *     // result is now equal to the last value of memo, which is 6
							 * });
							 */
							function reduce(coll, memo, iteratee, callback) {
								callback = once(callback || noop);
								var _iteratee = wrapAsync(iteratee);
								eachOfSeries(
									coll,
									function (x, i, callback) {
										_iteratee(memo, x, function (err, v) {
											memo = v;
											callback(err);
										});
									},
									function (err) {
										callback(err, memo);
									}
								);
							}

							/**
							 * Version of the compose function that is more natural to read. Each function
							 * consumes the return value of the previous function. It is the equivalent of
							 * [compose]{@link module:ControlFlow.compose} with the arguments reversed.
							 *
							 * Each function is executed with the `this` binding of the composed function.
							 *
							 * @name seq
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.compose]{@link module:ControlFlow.compose}
							 * @category Control Flow
							 * @param {...AsyncFunction} functions - the asynchronous functions to compose
							 * @returns {Function} a function that composes the `functions` in order
							 * @example
							 *
							 * // Requires lodash (or underscore), express3 and dresende's orm2.
							 * // Part of an app, that fetches cats of the logged user.
							 * // This example uses `seq` function to avoid overnesting and error
							 * // handling clutter.
							 * app.get('/cats', function(request, response) {
							 *     var User = request.models.User;
							 *     async.seq(
							 *         _.bind(User.get, User),  // 'User.get' has signature (id, callback(err, data))
							 *         function(user, fn) {
							 *             user.getCats(fn);      // 'getCats' has signature (callback(err, data))
							 *         }
							 *     )(req.session.user_id, function (err, cats) {
							 *         if (err) {
							 *             console.error(err);
							 *             response.json({ status: 'error', message: err.message });
							 *         } else {
							 *             response.json({ status: 'ok', message: 'Cats found', data: cats });
							 *         }
							 *     });
							 * });
							 */
							function seq(/*...functions*/) {
								var _functions = arrayMap(arguments, wrapAsync);
								return function (/*...args*/) {
									var args = slice(arguments);
									var that = this;

									var cb = args[args.length - 1];
									if (typeof cb == "function") {
										args.pop();
									} else {
										cb = noop;
									}

									reduce(
										_functions,
										args,
										function (newargs, fn, cb) {
											fn.apply(
												that,
												newargs.concat(function (err /*, ...nextargs*/) {
													var nextargs = slice(arguments, 1);
													cb(err, nextargs);
												})
											);
										},
										function (err, results) {
											cb.apply(that, [err].concat(results));
										}
									);
								};
							}

							/**
							 * Creates a function which is a composition of the passed asynchronous
							 * functions. Each function consumes the return value of the function that
							 * follows. Composing functions `f()`, `g()`, and `h()` would produce the result
							 * of `f(g(h()))`, only this version uses callbacks to obtain the return values.
							 *
							 * Each function is executed with the `this` binding of the composed function.
							 *
							 * @name compose
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {...AsyncFunction} functions - the asynchronous functions to compose
							 * @returns {Function} an asynchronous function that is the composed
							 * asynchronous `functions`
							 * @example
							 *
							 * function add1(n, callback) {
							 *     setTimeout(function () {
							 *         callback(null, n + 1);
							 *     }, 10);
							 * }
							 *
							 * function mul3(n, callback) {
							 *     setTimeout(function () {
							 *         callback(null, n * 3);
							 *     }, 10);
							 * }
							 *
							 * var add1mul3 = async.compose(mul3, add1);
							 * add1mul3(4, function (err, result) {
							 *     // result now equals 15
							 * });
							 */
							var compose = function (/*...args*/) {
								return seq.apply(null, slice(arguments).reverse());
							};

							var _concat = Array.prototype.concat;

							/**
							 * The same as [`concat`]{@link module:Collections.concat} but runs a maximum of `limit` async operations at a time.
							 *
							 * @name concatLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.concat]{@link module:Collections.concat}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`,
							 * which should use an array as its result. Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished, or an error occurs. Results is an array
							 * containing the concatenated results of the `iteratee` function. Invoked with
							 * (err, results).
							 */
							var concatLimit = function (coll, limit, iteratee, callback) {
								callback = callback || noop;
								var _iteratee = wrapAsync(iteratee);
								mapLimit(
									coll,
									limit,
									function (val, callback) {
										_iteratee(val, function (err /*, ...args*/) {
											if (err) return callback(err);
											return callback(null, slice(arguments, 1));
										});
									},
									function (err, mapResults) {
										var result = [];
										for (var i = 0; i < mapResults.length; i++) {
											if (mapResults[i]) {
												result = _concat.apply(result, mapResults[i]);
											}
										}

										return callback(err, result);
									}
								);
							};

							/**
							 * Applies `iteratee` to each item in `coll`, concatenating the results. Returns
							 * the concatenated list. The `iteratee`s are called in parallel, and the
							 * results are concatenated as they return. There is no guarantee that the
							 * results array will be returned in the original order of `coll` passed to the
							 * `iteratee` function.
							 *
							 * @name concat
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`,
							 * which should use an array as its result. Invoked with (item, callback).
							 * @param {Function} [callback(err)] - A callback which is called after all the
							 * `iteratee` functions have finished, or an error occurs. Results is an array
							 * containing the concatenated results of the `iteratee` function. Invoked with
							 * (err, results).
							 * @example
							 *
							 * async.concat(['dir1','dir2','dir3'], fs.readdir, function(err, files) {
							 *     // files is now a list of filenames that exist in the 3 directories
							 * });
							 */
							var concat = doLimit(concatLimit, Infinity);

							/**
							 * The same as [`concat`]{@link module:Collections.concat} but runs only a single async operation at a time.
							 *
							 * @name concatSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.concat]{@link module:Collections.concat}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`.
							 * The iteratee should complete with an array an array of results.
							 * Invoked with (item, callback).
							 * @param {Function} [callback(err)] - A callback which is called after all the
							 * `iteratee` functions have finished, or an error occurs. Results is an array
							 * containing the concatenated results of the `iteratee` function. Invoked with
							 * (err, results).
							 */
							var concatSeries = doLimit(concatLimit, 1);

							/**
							 * Returns a function that when called, calls-back with the values provided.
							 * Useful as the first function in a [`waterfall`]{@link module:ControlFlow.waterfall}, or for plugging values in to
							 * [`auto`]{@link module:ControlFlow.auto}.
							 *
							 * @name constant
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {...*} arguments... - Any number of arguments to automatically invoke
							 * callback with.
							 * @returns {AsyncFunction} Returns a function that when invoked, automatically
							 * invokes the callback with the previous given arguments.
							 * @example
							 *
							 * async.waterfall([
							 *     async.constant(42),
							 *     function (value, next) {
							 *         // value === 42
							 *     },
							 *     //...
							 * ], callback);
							 *
							 * async.waterfall([
							 *     async.constant(filename, "utf8"),
							 *     fs.readFile,
							 *     function (fileData, next) {
							 *         //...
							 *     }
							 *     //...
							 * ], callback);
							 *
							 * async.auto({
							 *     hostname: async.constant("https://server.net/"),
							 *     port: findFreePort,
							 *     launchServer: ["hostname", "port", function (options, cb) {
							 *         startServer(options, cb);
							 *     }],
							 *     //...
							 * }, callback);
							 */
							var constant = function (/*...values*/) {
								var values = slice(arguments);
								var args = [null].concat(values);
								return function (/*...ignoredArgs, callback*/) {
									var callback = arguments[arguments.length - 1];
									return callback.apply(this, args);
								};
							};

							/**
							 * This method returns the first argument it receives.
							 *
							 * @static
							 * @since 0.1.0
							 * @memberOf _
							 * @category Util
							 * @param {*} value Any value.
							 * @returns {*} Returns `value`.
							 * @example
							 *
							 * var object = { 'a': 1 };
							 *
							 * console.log(_.identity(object) === object);
							 * // => true
							 */
							function identity(value) {
								return value;
							}

							function _createTester(check, getResult) {
								return function (eachfn, arr, iteratee, cb) {
									cb = cb || noop;
									var testPassed = false;
									var testResult;
									eachfn(
										arr,
										function (value, _, callback) {
											iteratee(value, function (err, result) {
												if (err) {
													callback(err);
												} else if (check(result) && !testResult) {
													testPassed = true;
													testResult = getResult(true, value);
													callback(null, breakLoop);
												} else {
													callback();
												}
											});
										},
										function (err) {
											if (err) {
												cb(err);
											} else {
												cb(null, testPassed ? testResult : getResult(false));
											}
										}
									);
								};
							}

							function _findGetResult(v, x) {
								return x;
							}

							/**
 * Returns the first value in `coll` that passes an async truth test. The
 * `iteratee` is applied in parallel, meaning the first iteratee to return
 * `true` will fire the detect `callback` with that result. That means the
 * result might not be the first item in the original `coll` (in terms of order)
 * that passes the test.

 * If order within the original `coll` is important, then look at
 * [`detectSeries`]{@link module:Collections.detectSeries}.
 *
 * @name detect
 * @static
 * @memberOf module:Collections
 * @method
 * @alias find
 * @category Collections
 * @param {Array|Iterable|Object} coll - A collection to iterate over.
 * @param {AsyncFunction} iteratee - A truth test to apply to each item in `coll`.
 * The iteratee must complete with a boolean value as its result.
 * Invoked with (item, callback).
 * @param {Function} [callback] - A callback which is called as soon as any
 * iteratee returns `true`, or after all the `iteratee` functions have finished.
 * Result will be the first item in the array that passes the truth test
 * (iteratee) or the value `undefined` if none passed. Invoked with
 * (err, result).
 * @example
 *
 * async.detect(['file1','file2','file3'], function(filePath, callback) {
 *     fs.access(filePath, function(err) {
 *         callback(null, !err)
 *     });
 * }, function(err, result) {
 *     // result now equals the first file in the list that exists
 * });
 */
							var detect = doParallel(_createTester(identity, _findGetResult));

							/**
							 * The same as [`detect`]{@link module:Collections.detect} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name detectLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.detect]{@link module:Collections.detect}
							 * @alias findLimit
							 * @category Collections
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - A truth test to apply to each item in `coll`.
							 * The iteratee must complete with a boolean value as its result.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called as soon as any
							 * iteratee returns `true`, or after all the `iteratee` functions have finished.
							 * Result will be the first item in the array that passes the truth test
							 * (iteratee) or the value `undefined` if none passed. Invoked with
							 * (err, result).
							 */
							var detectLimit = doParallelLimit(_createTester(identity, _findGetResult));

							/**
							 * The same as [`detect`]{@link module:Collections.detect} but runs only a single async operation at a time.
							 *
							 * @name detectSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.detect]{@link module:Collections.detect}
							 * @alias findSeries
							 * @category Collections
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - A truth test to apply to each item in `coll`.
							 * The iteratee must complete with a boolean value as its result.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called as soon as any
							 * iteratee returns `true`, or after all the `iteratee` functions have finished.
							 * Result will be the first item in the array that passes the truth test
							 * (iteratee) or the value `undefined` if none passed. Invoked with
							 * (err, result).
							 */
							var detectSeries = doLimit(detectLimit, 1);

							function consoleFunc(name) {
								return function (fn /*, ...args*/) {
									var args = slice(arguments, 1);
									args.push(function (err /*, ...args*/) {
										var args = slice(arguments, 1);
										if (typeof console === "object") {
											if (err) {
												if (console.error) {
													console.error(err);
												}
											} else if (console[name]) {
												arrayEach(args, function (x) {
													console[name](x);
												});
											}
										}
									});
									wrapAsync(fn).apply(null, args);
								};
							}

							/**
							 * Logs the result of an [`async` function]{@link AsyncFunction} to the
							 * `console` using `console.dir` to display the properties of the resulting object.
							 * Only works in Node.js or in browsers that support `console.dir` and
							 * `console.error` (such as FF and Chrome).
							 * If multiple arguments are returned from the async function,
							 * `console.dir` is called on each argument in order.
							 *
							 * @name dir
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {AsyncFunction} function - The function you want to eventually apply
							 * all arguments to.
							 * @param {...*} arguments... - Any number of arguments to apply to the function.
							 * @example
							 *
							 * // in a module
							 * var hello = function(name, callback) {
							 *     setTimeout(function() {
							 *         callback(null, {hello: name});
							 *     }, 1000);
							 * };
							 *
							 * // in the node repl
							 * node> async.dir(hello, 'world');
							 * {hello: 'world'}
							 */
							var dir = consoleFunc("dir");

							/**
							 * The post-check version of [`during`]{@link module:ControlFlow.during}. To reflect the difference in
							 * the order of operations, the arguments `test` and `fn` are switched.
							 *
							 * Also a version of [`doWhilst`]{@link module:ControlFlow.doWhilst} with asynchronous `test` function.
							 * @name doDuring
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.during]{@link module:ControlFlow.during}
							 * @category Control Flow
							 * @param {AsyncFunction} fn - An async function which is called each time
							 * `test` passes. Invoked with (callback).
							 * @param {AsyncFunction} test - asynchronous truth test to perform before each
							 * execution of `fn`. Invoked with (...args, callback), where `...args` are the
							 * non-error args from the previous callback of `fn`.
							 * @param {Function} [callback] - A callback which is called after the test
							 * function has failed and repeated execution of `fn` has stopped. `callback`
							 * will be passed an error if one occurred, otherwise `null`.
							 */
							function doDuring(fn, test, callback) {
								callback = onlyOnce(callback || noop);
								var _fn = wrapAsync(fn);
								var _test = wrapAsync(test);

								function next(err /*, ...args*/) {
									if (err) return callback(err);
									var args = slice(arguments, 1);
									args.push(check);
									_test.apply(this, args);
								}

								function check(err, truth) {
									if (err) return callback(err);
									if (!truth) return callback(null);
									_fn(next);
								}

								check(null, true);
							}

							/**
							 * The post-check version of [`whilst`]{@link module:ControlFlow.whilst}. To reflect the difference in
							 * the order of operations, the arguments `test` and `iteratee` are switched.
							 *
							 * `doWhilst` is to `whilst` as `do while` is to `while` in plain JavaScript.
							 *
							 * @name doWhilst
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.whilst]{@link module:ControlFlow.whilst}
							 * @category Control Flow
							 * @param {AsyncFunction} iteratee - A function which is called each time `test`
							 * passes. Invoked with (callback).
							 * @param {Function} test - synchronous truth test to perform after each
							 * execution of `iteratee`. Invoked with any non-error callback results of
							 * `iteratee`.
							 * @param {Function} [callback] - A callback which is called after the test
							 * function has failed and repeated execution of `iteratee` has stopped.
							 * `callback` will be passed an error and any arguments passed to the final
							 * `iteratee`'s callback. Invoked with (err, [results]);
							 */
							function doWhilst(iteratee, test, callback) {
								callback = onlyOnce(callback || noop);
								var _iteratee = wrapAsync(iteratee);
								var next = function (err /*, ...args*/) {
									if (err) return callback(err);
									var args = slice(arguments, 1);
									if (test.apply(this, args)) return _iteratee(next);
									callback.apply(null, [null].concat(args));
								};
								_iteratee(next);
							}

							/**
							 * Like ['doWhilst']{@link module:ControlFlow.doWhilst}, except the `test` is inverted. Note the
							 * argument ordering differs from `until`.
							 *
							 * @name doUntil
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.doWhilst]{@link module:ControlFlow.doWhilst}
							 * @category Control Flow
							 * @param {AsyncFunction} iteratee - An async function which is called each time
							 * `test` fails. Invoked with (callback).
							 * @param {Function} test - synchronous truth test to perform after each
							 * execution of `iteratee`. Invoked with any non-error callback results of
							 * `iteratee`.
							 * @param {Function} [callback] - A callback which is called after the test
							 * function has passed and repeated execution of `iteratee` has stopped. `callback`
							 * will be passed an error and any arguments passed to the final `iteratee`'s
							 * callback. Invoked with (err, [results]);
							 */
							function doUntil(iteratee, test, callback) {
								doWhilst(
									iteratee,
									function () {
										return !test.apply(this, arguments);
									},
									callback
								);
							}

							/**
							 * Like [`whilst`]{@link module:ControlFlow.whilst}, except the `test` is an asynchronous function that
							 * is passed a callback in the form of `function (err, truth)`. If error is
							 * passed to `test` or `fn`, the main callback is immediately called with the
							 * value of the error.
							 *
							 * @name during
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.whilst]{@link module:ControlFlow.whilst}
							 * @category Control Flow
							 * @param {AsyncFunction} test - asynchronous truth test to perform before each
							 * execution of `fn`. Invoked with (callback).
							 * @param {AsyncFunction} fn - An async function which is called each time
							 * `test` passes. Invoked with (callback).
							 * @param {Function} [callback] - A callback which is called after the test
							 * function has failed and repeated execution of `fn` has stopped. `callback`
							 * will be passed an error, if one occurred, otherwise `null`.
							 * @example
							 *
							 * var count = 0;
							 *
							 * async.during(
							 *     function (callback) {
							 *         return callback(null, count < 5);
							 *     },
							 *     function (callback) {
							 *         count++;
							 *         setTimeout(callback, 1000);
							 *     },
							 *     function (err) {
							 *         // 5 seconds have passed
							 *     }
							 * );
							 */
							function during(test, fn, callback) {
								callback = onlyOnce(callback || noop);
								var _fn = wrapAsync(fn);
								var _test = wrapAsync(test);

								function next(err) {
									if (err) return callback(err);
									_test(check);
								}

								function check(err, truth) {
									if (err) return callback(err);
									if (!truth) return callback(null);
									_fn(next);
								}

								_test(check);
							}

							function _withoutIndex(iteratee) {
								return function (value, index, callback) {
									return iteratee(value, callback);
								};
							}

							/**
							 * Applies the function `iteratee` to each item in `coll`, in parallel.
							 * The `iteratee` is called with an item from the list, and a callback for when
							 * it has finished. If the `iteratee` passes an error to its `callback`, the
							 * main `callback` (for the `each` function) is immediately called with the
							 * error.
							 *
							 * Note, that since this function applies `iteratee` to each item in parallel,
							 * there is no guarantee that the iteratee functions will complete in order.
							 *
							 * @name each
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @alias forEach
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to
							 * each item in `coll`. Invoked with (item, callback).
							 * The array index is not passed to the iteratee.
							 * If you need the index, use `eachOf`.
							 * @param {Function} [callback] - A callback which is called when all
							 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
							 * @example
							 *
							 * // assuming openFiles is an array of file names and saveFile is a function
							 * // to save the modified contents of that file:
							 *
							 * async.each(openFiles, saveFile, function(err){
							 *   // if any of the saves produced an error, err would equal that error
							 * });
							 *
							 * // assuming openFiles is an array of file names
							 * async.each(openFiles, function(file, callback) {
							 *
							 *     // Perform operation on file here.
							 *     console.log('Processing file ' + file);
							 *
							 *     if( file.length > 32 ) {
							 *       console.log('This file name is too long');
							 *       callback('File name too long');
							 *     } else {
							 *       // Do work to process file here
							 *       console.log('File processed');
							 *       callback();
							 *     }
							 * }, function(err) {
							 *     // if any of the file processing produced an error, err would equal that error
							 *     if( err ) {
							 *       // One of the iterations produced an error.
							 *       // All processing will now stop.
							 *       console.log('A file failed to process');
							 *     } else {
							 *       console.log('All files have been processed successfully');
							 *     }
							 * });
							 */
							function eachLimit(coll, iteratee, callback) {
								eachOf(coll, _withoutIndex(wrapAsync(iteratee)), callback);
							}

							/**
							 * The same as [`each`]{@link module:Collections.each} but runs a maximum of `limit` async operations at a time.
							 *
							 * @name eachLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.each]{@link module:Collections.each}
							 * @alias forEachLimit
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The array index is not passed to the iteratee.
							 * If you need the index, use `eachOfLimit`.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called when all
							 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
							 */
							function eachLimit$1(coll, limit, iteratee, callback) {
								_eachOfLimit(limit)(coll, _withoutIndex(wrapAsync(iteratee)), callback);
							}

							/**
							 * The same as [`each`]{@link module:Collections.each} but runs only a single async operation at a time.
							 *
							 * @name eachSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.each]{@link module:Collections.each}
							 * @alias forEachSeries
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to each
							 * item in `coll`.
							 * The array index is not passed to the iteratee.
							 * If you need the index, use `eachOfSeries`.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called when all
							 * `iteratee` functions have finished, or an error occurs. Invoked with (err).
							 */
							var eachSeries = doLimit(eachLimit$1, 1);

							/**
							 * Wrap an async function and ensure it calls its callback on a later tick of
							 * the event loop.  If the function already calls its callback on a next tick,
							 * no extra deferral is added. This is useful for preventing stack overflows
							 * (`RangeError: Maximum call stack size exceeded`) and generally keeping
							 * [Zalgo](http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony)
							 * contained. ES2017 `async` functions are returned as-is -- they are immune
							 * to Zalgo's corrupting influences, as they always resolve on a later tick.
							 *
							 * @name ensureAsync
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {AsyncFunction} fn - an async function, one that expects a node-style
							 * callback as its last argument.
							 * @returns {AsyncFunction} Returns a wrapped function with the exact same call
							 * signature as the function passed in.
							 * @example
							 *
							 * function sometimesAsync(arg, callback) {
							 *     if (cache[arg]) {
							 *         return callback(null, cache[arg]); // this would be synchronous!!
							 *     } else {
							 *         doSomeIO(arg, callback); // this IO would be asynchronous
							 *     }
							 * }
							 *
							 * // this has a risk of stack overflows if many results are cached in a row
							 * async.mapSeries(args, sometimesAsync, done);
							 *
							 * // this will defer sometimesAsync's callback if necessary,
							 * // preventing stack overflows
							 * async.mapSeries(args, async.ensureAsync(sometimesAsync), done);
							 */
							function ensureAsync(fn) {
								if (isAsync(fn)) return fn;
								return initialParams(function (args, callback) {
									var sync = true;
									args.push(function () {
										var innerArgs = arguments;
										if (sync) {
											setImmediate$1(function () {
												callback.apply(null, innerArgs);
											});
										} else {
											callback.apply(null, innerArgs);
										}
									});
									fn.apply(this, args);
									sync = false;
								});
							}

							function notId(v) {
								return !v;
							}

							/**
							 * Returns `true` if every element in `coll` satisfies an async test. If any
							 * iteratee call returns `false`, the main `callback` is immediately called.
							 *
							 * @name every
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @alias all
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async truth test to apply to each item
							 * in the collection in parallel.
							 * The iteratee must complete with a boolean result value.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Result will be either `true` or `false`
							 * depending on the values of the async tests. Invoked with (err, result).
							 * @example
							 *
							 * async.every(['file1','file2','file3'], function(filePath, callback) {
							 *     fs.access(filePath, function(err) {
							 *         callback(null, !err)
							 *     });
							 * }, function(err, result) {
							 *     // if result is true then every file exists
							 * });
							 */
							var every = doParallel(_createTester(notId, notId));

							/**
							 * The same as [`every`]{@link module:Collections.every} but runs a maximum of `limit` async operations at a time.
							 *
							 * @name everyLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.every]{@link module:Collections.every}
							 * @alias allLimit
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async truth test to apply to each item
							 * in the collection in parallel.
							 * The iteratee must complete with a boolean result value.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Result will be either `true` or `false`
							 * depending on the values of the async tests. Invoked with (err, result).
							 */
							var everyLimit = doParallelLimit(_createTester(notId, notId));

							/**
							 * The same as [`every`]{@link module:Collections.every} but runs only a single async operation at a time.
							 *
							 * @name everySeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.every]{@link module:Collections.every}
							 * @alias allSeries
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async truth test to apply to each item
							 * in the collection in series.
							 * The iteratee must complete with a boolean result value.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Result will be either `true` or `false`
							 * depending on the values of the async tests. Invoked with (err, result).
							 */
							var everySeries = doLimit(everyLimit, 1);

							/**
							 * The base implementation of `_.property` without support for deep paths.
							 *
							 * @private
							 * @param {string} key The key of the property to get.
							 * @returns {Function} Returns the new accessor function.
							 */
							function baseProperty(key) {
								return function (object) {
									return object == null ? undefined : object[key];
								};
							}

							function filterArray(eachfn, arr, iteratee, callback) {
								var truthValues = new Array(arr.length);
								eachfn(
									arr,
									function (x, index, callback) {
										iteratee(x, function (err, v) {
											truthValues[index] = !!v;
											callback(err);
										});
									},
									function (err) {
										if (err) return callback(err);
										var results = [];
										for (var i = 0; i < arr.length; i++) {
											if (truthValues[i]) results.push(arr[i]);
										}
										callback(null, results);
									}
								);
							}

							function filterGeneric(eachfn, coll, iteratee, callback) {
								var results = [];
								eachfn(
									coll,
									function (x, index, callback) {
										iteratee(x, function (err, v) {
											if (err) {
												callback(err);
											} else {
												if (v) {
													results.push({ index: index, value: x });
												}
												callback();
											}
										});
									},
									function (err) {
										if (err) {
											callback(err);
										} else {
											callback(
												null,
												arrayMap(
													results.sort(function (a, b) {
														return a.index - b.index;
													}),
													baseProperty("value")
												)
											);
										}
									}
								);
							}

							function _filter(eachfn, coll, iteratee, callback) {
								var filter = isArrayLike(coll) ? filterArray : filterGeneric;
								filter(eachfn, coll, wrapAsync(iteratee), callback || noop);
							}

							/**
							 * Returns a new array of all the values in `coll` which pass an async truth
							 * test. This operation is performed in parallel, but the results array will be
							 * in the same order as the original.
							 *
							 * @name filter
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @alias select
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {Function} iteratee - A truth test to apply to each item in `coll`.
							 * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
							 * with a boolean argument once it has completed. Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Invoked with (err, results).
							 * @example
							 *
							 * async.filter(['file1','file2','file3'], function(filePath, callback) {
							 *     fs.access(filePath, function(err) {
							 *         callback(null, !err)
							 *     });
							 * }, function(err, results) {
							 *     // results now equals an array of the existing files
							 * });
							 */
							var filter = doParallel(_filter);

							/**
							 * The same as [`filter`]{@link module:Collections.filter} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name filterLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.filter]{@link module:Collections.filter}
							 * @alias selectLimit
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {Function} iteratee - A truth test to apply to each item in `coll`.
							 * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
							 * with a boolean argument once it has completed. Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Invoked with (err, results).
							 */
							var filterLimit = doParallelLimit(_filter);

							/**
							 * The same as [`filter`]{@link module:Collections.filter} but runs only a single async operation at a time.
							 *
							 * @name filterSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.filter]{@link module:Collections.filter}
							 * @alias selectSeries
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {Function} iteratee - A truth test to apply to each item in `coll`.
							 * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
							 * with a boolean argument once it has completed. Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Invoked with (err, results)
							 */
							var filterSeries = doLimit(filterLimit, 1);

							/**
 * Calls the asynchronous function `fn` with a callback parameter that allows it
 * to call itself again, in series, indefinitely.

 * If an error is passed to the callback then `errback` is called with the
 * error, and execution stops, otherwise it will never be called.
 *
 * @name forever
 * @static
 * @memberOf module:ControlFlow
 * @method
 * @category Control Flow
 * @param {AsyncFunction} fn - an async function to call repeatedly.
 * Invoked with (next).
 * @param {Function} [errback] - when `fn` passes an error to it's callback,
 * this function will be called, and execution stops. Invoked with (err).
 * @example
 *
 * async.forever(
 *     function(next) {
 *         // next is suitable for passing to things that need a callback(err [, whatever]);
 *         // it will result in this function being called again.
 *     },
 *     function(err) {
 *         // if next is called with a value in its first parameter, it will appear
 *         // in here as 'err', and execution will stop.
 *     }
 * );
 */
							function forever(fn, errback) {
								var done = onlyOnce(errback || noop);
								var task = wrapAsync(ensureAsync(fn));

								function next(err) {
									if (err) return done(err);
									task(next);
								}
								next();
							}

							/**
							 * The same as [`groupBy`]{@link module:Collections.groupBy} but runs a maximum of `limit` async operations at a time.
							 *
							 * @name groupByLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.groupBy]{@link module:Collections.groupBy}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with a `key` to group the value under.
							 * Invoked with (value, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Result is an `Object` whoses
							 * properties are arrays of values which returned the corresponding key.
							 */
							var groupByLimit = function (coll, limit, iteratee, callback) {
								callback = callback || noop;
								var _iteratee = wrapAsync(iteratee);
								mapLimit(
									coll,
									limit,
									function (val, callback) {
										_iteratee(val, function (err, key) {
											if (err) return callback(err);
											return callback(null, { key: key, val: val });
										});
									},
									function (err, mapResults) {
										var result = {};
										// from MDN, handle object having an `hasOwnProperty` prop
										var hasOwnProperty = Object.prototype.hasOwnProperty;

										for (var i = 0; i < mapResults.length; i++) {
											if (mapResults[i]) {
												var key = mapResults[i].key;
												var val = mapResults[i].val;

												if (hasOwnProperty.call(result, key)) {
													result[key].push(val);
												} else {
													result[key] = [val];
												}
											}
										}

										return callback(err, result);
									}
								);
							};

							/**
							 * Returns a new object, where each value corresponds to an array of items, from
							 * `coll`, that returned the corresponding key. That is, the keys of the object
							 * correspond to the values passed to the `iteratee` callback.
							 *
							 * Note: Since this function applies the `iteratee` to each item in parallel,
							 * there is no guarantee that the `iteratee` functions will complete in order.
							 * However, the values for each key in the `result` will be in the same order as
							 * the original `coll`. For Objects, the values will roughly be in the order of
							 * the original Objects' keys (but this can vary across JavaScript engines).
							 *
							 * @name groupBy
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with a `key` to group the value under.
							 * Invoked with (value, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Result is an `Object` whoses
							 * properties are arrays of values which returned the corresponding key.
							 * @example
							 *
							 * async.groupBy(['userId1', 'userId2', 'userId3'], function(userId, callback) {
							 *     db.findById(userId, function(err, user) {
							 *         if (err) return callback(err);
							 *         return callback(null, user.age);
							 *     });
							 * }, function(err, result) {
							 *     // result is object containing the userIds grouped by age
							 *     // e.g. { 30: ['userId1', 'userId3'], 42: ['userId2']};
							 * });
							 */
							var groupBy = doLimit(groupByLimit, Infinity);

							/**
							 * The same as [`groupBy`]{@link module:Collections.groupBy} but runs only a single async operation at a time.
							 *
							 * @name groupBySeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.groupBy]{@link module:Collections.groupBy}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with a `key` to group the value under.
							 * Invoked with (value, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. Result is an `Object` whoses
							 * properties are arrays of values which returned the corresponding key.
							 */
							var groupBySeries = doLimit(groupByLimit, 1);

							/**
							 * Logs the result of an `async` function to the `console`. Only works in
							 * Node.js or in browsers that support `console.log` and `console.error` (such
							 * as FF and Chrome). If multiple arguments are returned from the async
							 * function, `console.log` is called on each argument in order.
							 *
							 * @name log
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {AsyncFunction} function - The function you want to eventually apply
							 * all arguments to.
							 * @param {...*} arguments... - Any number of arguments to apply to the function.
							 * @example
							 *
							 * // in a module
							 * var hello = function(name, callback) {
							 *     setTimeout(function() {
							 *         callback(null, 'hello ' + name);
							 *     }, 1000);
							 * };
							 *
							 * // in the node repl
							 * node> async.log(hello, 'world');
							 * 'hello world'
							 */
							var log = consoleFunc("log");

							/**
							 * The same as [`mapValues`]{@link module:Collections.mapValues} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name mapValuesLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.mapValues]{@link module:Collections.mapValues}
							 * @category Collection
							 * @param {Object} obj - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - A function to apply to each value and key
							 * in `coll`.
							 * The iteratee should complete with the transformed value as its result.
							 * Invoked with (value, key, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. `result` is a new object consisting
							 * of each key from `obj`, with each transformed value on the right-hand side.
							 * Invoked with (err, result).
							 */
							function mapValuesLimit(obj, limit, iteratee, callback) {
								callback = once(callback || noop);
								var newObj = {};
								var _iteratee = wrapAsync(iteratee);
								eachOfLimit(
									obj,
									limit,
									function (val, key, next) {
										_iteratee(val, key, function (err, result) {
											if (err) return next(err);
											newObj[key] = result;
											next();
										});
									},
									function (err) {
										callback(err, newObj);
									}
								);
							}

							/**
							 * A relative of [`map`]{@link module:Collections.map}, designed for use with objects.
							 *
							 * Produces a new Object by mapping each value of `obj` through the `iteratee`
							 * function. The `iteratee` is called each `value` and `key` from `obj` and a
							 * callback for when it has finished processing. Each of these callbacks takes
							 * two arguments: an `error`, and the transformed item from `obj`. If `iteratee`
							 * passes an error to its callback, the main `callback` (for the `mapValues`
							 * function) is immediately called with the error.
							 *
							 * Note, the order of the keys in the result is not guaranteed.  The keys will
							 * be roughly in the order they complete, (but this is very engine-specific)
							 *
							 * @name mapValues
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @category Collection
							 * @param {Object} obj - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - A function to apply to each value and key
							 * in `coll`.
							 * The iteratee should complete with the transformed value as its result.
							 * Invoked with (value, key, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. `result` is a new object consisting
							 * of each key from `obj`, with each transformed value on the right-hand side.
							 * Invoked with (err, result).
							 * @example
							 *
							 * async.mapValues({
							 *     f1: 'file1',
							 *     f2: 'file2',
							 *     f3: 'file3'
							 * }, function (file, key, callback) {
							 *   fs.stat(file, callback);
							 * }, function(err, result) {
							 *     // result is now a map of stats for each file, e.g.
							 *     // {
							 *     //     f1: [stats for file1],
							 *     //     f2: [stats for file2],
							 *     //     f3: [stats for file3]
							 *     // }
							 * });
							 */

							var mapValues = doLimit(mapValuesLimit, Infinity);

							/**
							 * The same as [`mapValues`]{@link module:Collections.mapValues} but runs only a single async operation at a time.
							 *
							 * @name mapValuesSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.mapValues]{@link module:Collections.mapValues}
							 * @category Collection
							 * @param {Object} obj - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - A function to apply to each value and key
							 * in `coll`.
							 * The iteratee should complete with the transformed value as its result.
							 * Invoked with (value, key, callback).
							 * @param {Function} [callback] - A callback which is called when all `iteratee`
							 * functions have finished, or an error occurs. `result` is a new object consisting
							 * of each key from `obj`, with each transformed value on the right-hand side.
							 * Invoked with (err, result).
							 */
							var mapValuesSeries = doLimit(mapValuesLimit, 1);

							function has(obj, key) {
								return key in obj;
							}

							/**
							 * Caches the results of an async function. When creating a hash to store
							 * function results against, the callback is omitted from the hash and an
							 * optional hash function can be used.
							 *
							 * If no hash function is specified, the first argument is used as a hash key,
							 * which may work reasonably if it is a string or a data type that converts to a
							 * distinct string. Note that objects and arrays will not behave reasonably.
							 * Neither will cases where the other arguments are significant. In such cases,
							 * specify your own hash function.
							 *
							 * The cache of results is exposed as the `memo` property of the function
							 * returned by `memoize`.
							 *
							 * @name memoize
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {AsyncFunction} fn - The async function to proxy and cache results from.
							 * @param {Function} hasher - An optional function for generating a custom hash
							 * for storing results. It has all the arguments applied to it apart from the
							 * callback, and must be synchronous.
							 * @returns {AsyncFunction} a memoized version of `fn`
							 * @example
							 *
							 * var slow_fn = function(name, callback) {
							 *     // do something
							 *     callback(null, result);
							 * };
							 * var fn = async.memoize(slow_fn);
							 *
							 * // fn can now be used as if it were slow_fn
							 * fn('some name', function() {
							 *     // callback
							 * });
							 */
							function memoize(fn, hasher) {
								var memo = Object.create(null);
								var queues = Object.create(null);
								hasher = hasher || identity;
								var _fn = wrapAsync(fn);
								var memoized = initialParams(function memoized(args, callback) {
									var key = hasher.apply(null, args);
									if (has(memo, key)) {
										setImmediate$1(function () {
											callback.apply(null, memo[key]);
										});
									} else if (has(queues, key)) {
										queues[key].push(callback);
									} else {
										queues[key] = [callback];
										_fn.apply(
											null,
											args.concat(function (/*args*/) {
												var args = slice(arguments);
												memo[key] = args;
												var q = queues[key];
												delete queues[key];
												for (var i = 0, l = q.length; i < l; i++) {
													q[i].apply(null, args);
												}
											})
										);
									}
								});
								memoized.memo = memo;
								memoized.unmemoized = fn;
								return memoized;
							}

							/**
							 * Calls `callback` on a later loop around the event loop. In Node.js this just
							 * calls `process.nextTick`.  In the browser it will use `setImmediate` if
							 * available, otherwise `setTimeout(callback, 0)`, which means other higher
							 * priority events may precede the execution of `callback`.
							 *
							 * This is used internally for browser-compatibility purposes.
							 *
							 * @name nextTick
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @see [async.setImmediate]{@link module:Utils.setImmediate}
							 * @category Util
							 * @param {Function} callback - The function to call on a later loop around
							 * the event loop. Invoked with (args...).
							 * @param {...*} args... - any number of additional arguments to pass to the
							 * callback on the next tick.
							 * @example
							 *
							 * var call_order = [];
							 * async.nextTick(function() {
							 *     call_order.push('two');
							 *     // call_order now equals ['one','two']
							 * });
							 * call_order.push('one');
							 *
							 * async.setImmediate(function (a, b, c) {
							 *     // a, b, and c equal 1, 2, and 3
							 * }, 1, 2, 3);
							 */
							var _defer$1;

							if (hasNextTick) {
								_defer$1 = process.nextTick;
							} else if (hasSetImmediate) {
								_defer$1 = setImmediate;
							} else {
								_defer$1 = fallback;
							}

							var nextTick = wrap(_defer$1);

							function _parallel(eachfn, tasks, callback) {
								callback = callback || noop;
								var results = isArrayLike(tasks) ? [] : {};

								eachfn(
									tasks,
									function (task, key, callback) {
										wrapAsync(task)(function (err, result) {
											if (arguments.length > 2) {
												result = slice(arguments, 1);
											}
											results[key] = result;
											callback(err);
										});
									},
									function (err) {
										callback(err, results);
									}
								);
							}

							/**
							 * Run the `tasks` collection of functions in parallel, without waiting until
							 * the previous function has completed. If any of the functions pass an error to
							 * its callback, the main `callback` is immediately called with the value of the
							 * error. Once the `tasks` have completed, the results are passed to the final
							 * `callback` as an array.
							 *
							 * **Note:** `parallel` is about kicking-off I/O tasks in parallel, not about
							 * parallel execution of code.  If your tasks do not use any timers or perform
							 * any I/O, they will actually be executed in series.  Any synchronous setup
							 * sections for each task will happen one after the other.  JavaScript remains
							 * single-threaded.
							 *
							 * **Hint:** Use [`reflect`]{@link module:Utils.reflect} to continue the
							 * execution of other tasks when a task fails.
							 *
							 * It is also possible to use an object instead of an array. Each property will
							 * be run as a function and the results will be passed to the final `callback`
							 * as an object instead of an array. This can be a more readable way of handling
							 * results from {@link async.parallel}.
							 *
							 * @name parallel
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Array|Iterable|Object} tasks - A collection of
							 * [async functions]{@link AsyncFunction} to run.
							 * Each async function can complete with any number of optional `result` values.
							 * @param {Function} [callback] - An optional callback to run once all the
							 * functions have completed successfully. This function gets a results array
							 * (or object) containing all the result arguments passed to the task callbacks.
							 * Invoked with (err, results).
							 *
							 * @example
							 * async.parallel([
							 *     function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'one');
							 *         }, 200);
							 *     },
							 *     function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'two');
							 *         }, 100);
							 *     }
							 * ],
							 * // optional callback
							 * function(err, results) {
							 *     // the results array will equal ['one','two'] even though
							 *     // the second function had a shorter timeout.
							 * });
							 *
							 * // an example using an object instead of an array
							 * async.parallel({
							 *     one: function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 1);
							 *         }, 200);
							 *     },
							 *     two: function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 2);
							 *         }, 100);
							 *     }
							 * }, function(err, results) {
							 *     // results is now equals to: {one: 1, two: 2}
							 * });
							 */
							function parallelLimit(tasks, callback) {
								_parallel(eachOf, tasks, callback);
							}

							/**
							 * The same as [`parallel`]{@link module:ControlFlow.parallel} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name parallelLimit
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.parallel]{@link module:ControlFlow.parallel}
							 * @category Control Flow
							 * @param {Array|Iterable|Object} tasks - A collection of
							 * [async functions]{@link AsyncFunction} to run.
							 * Each async function can complete with any number of optional `result` values.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {Function} [callback] - An optional callback to run once all the
							 * functions have completed successfully. This function gets a results array
							 * (or object) containing all the result arguments passed to the task callbacks.
							 * Invoked with (err, results).
							 */
							function parallelLimit$1(tasks, limit, callback) {
								_parallel(_eachOfLimit(limit), tasks, callback);
							}

							/**
							 * A queue of tasks for the worker function to complete.
							 * @typedef {Object} QueueObject
							 * @memberOf module:ControlFlow
							 * @property {Function} length - a function returning the number of items
							 * waiting to be processed. Invoke with `queue.length()`.
							 * @property {boolean} started - a boolean indicating whether or not any
							 * items have been pushed and processed by the queue.
							 * @property {Function} running - a function returning the number of items
							 * currently being processed. Invoke with `queue.running()`.
							 * @property {Function} workersList - a function returning the array of items
							 * currently being processed. Invoke with `queue.workersList()`.
							 * @property {Function} idle - a function returning false if there are items
							 * waiting or being processed, or true if not. Invoke with `queue.idle()`.
							 * @property {number} concurrency - an integer for determining how many `worker`
							 * functions should be run in parallel. This property can be changed after a
							 * `queue` is created to alter the concurrency on-the-fly.
							 * @property {Function} push - add a new task to the `queue`. Calls `callback`
							 * once the `worker` has finished processing the task. Instead of a single task,
							 * a `tasks` array can be submitted. The respective callback is used for every
							 * task in the list. Invoke with `queue.push(task, [callback])`,
							 * @property {Function} unshift - add a new task to the front of the `queue`.
							 * Invoke with `queue.unshift(task, [callback])`.
							 * @property {Function} remove - remove items from the queue that match a test
							 * function.  The test function will be passed an object with a `data` property,
							 * and a `priority` property, if this is a
							 * [priorityQueue]{@link module:ControlFlow.priorityQueue} object.
							 * Invoked with `queue.remove(testFn)`, where `testFn` is of the form
							 * `function ({data, priority}) {}` and returns a Boolean.
							 * @property {Function} saturated - a callback that is called when the number of
							 * running workers hits the `concurrency` limit, and further tasks will be
							 * queued.
							 * @property {Function} unsaturated - a callback that is called when the number
							 * of running workers is less than the `concurrency` & `buffer` limits, and
							 * further tasks will not be queued.
							 * @property {number} buffer - A minimum threshold buffer in order to say that
							 * the `queue` is `unsaturated`.
							 * @property {Function} empty - a callback that is called when the last item
							 * from the `queue` is given to a `worker`.
							 * @property {Function} drain - a callback that is called when the last item
							 * from the `queue` has returned from the `worker`.
							 * @property {Function} error - a callback that is called when a task errors.
							 * Has the signature `function(error, task)`.
							 * @property {boolean} paused - a boolean for determining whether the queue is
							 * in a paused state.
							 * @property {Function} pause - a function that pauses the processing of tasks
							 * until `resume()` is called. Invoke with `queue.pause()`.
							 * @property {Function} resume - a function that resumes the processing of
							 * queued tasks when the queue is paused. Invoke with `queue.resume()`.
							 * @property {Function} kill - a function that removes the `drain` callback and
							 * empties remaining tasks from the queue forcing it to go idle. No more tasks
							 * should be pushed to the queue after calling this function. Invoke with `queue.kill()`.
							 */

							/**
							 * Creates a `queue` object with the specified `concurrency`. Tasks added to the
							 * `queue` are processed in parallel (up to the `concurrency` limit). If all
							 * `worker`s are in progress, the task is queued until one becomes available.
							 * Once a `worker` completes a `task`, that `task`'s callback is called.
							 *
							 * @name queue
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {AsyncFunction} worker - An async function for processing a queued task.
							 * If you want to handle errors from an individual task, pass a callback to
							 * `q.push()`. Invoked with (task, callback).
							 * @param {number} [concurrency=1] - An `integer` for determining how many
							 * `worker` functions should be run in parallel.  If omitted, the concurrency
							 * defaults to `1`.  If the concurrency is `0`, an error is thrown.
							 * @returns {module:ControlFlow.QueueObject} A queue object to manage the tasks. Callbacks can
							 * attached as certain properties to listen for specific events during the
							 * lifecycle of the queue.
							 * @example
							 *
							 * // create a queue object with concurrency 2
							 * var q = async.queue(function(task, callback) {
							 *     console.log('hello ' + task.name);
							 *     callback();
							 * }, 2);
							 *
							 * // assign a callback
							 * q.drain = function() {
							 *     console.log('all items have been processed');
							 * };
							 *
							 * // add some items to the queue
							 * q.push({name: 'foo'}, function(err) {
							 *     console.log('finished processing foo');
							 * });
							 * q.push({name: 'bar'}, function (err) {
							 *     console.log('finished processing bar');
							 * });
							 *
							 * // add some items to the queue (batch-wise)
							 * q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function(err) {
							 *     console.log('finished processing item');
							 * });
							 *
							 * // add some items to the front of the queue
							 * q.unshift({name: 'bar'}, function (err) {
							 *     console.log('finished processing bar');
							 * });
							 */
							var queue$1 = function (worker, concurrency) {
								var _worker = wrapAsync(worker);
								return queue(
									function (items, cb) {
										_worker(items[0], cb);
									},
									concurrency,
									1
								);
							};

							/**
							 * The same as [async.queue]{@link module:ControlFlow.queue} only tasks are assigned a priority and
							 * completed in ascending priority order.
							 *
							 * @name priorityQueue
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.queue]{@link module:ControlFlow.queue}
							 * @category Control Flow
							 * @param {AsyncFunction} worker - An async function for processing a queued task.
							 * If you want to handle errors from an individual task, pass a callback to
							 * `q.push()`.
							 * Invoked with (task, callback).
							 * @param {number} concurrency - An `integer` for determining how many `worker`
							 * functions should be run in parallel.  If omitted, the concurrency defaults to
							 * `1`.  If the concurrency is `0`, an error is thrown.
							 * @returns {module:ControlFlow.QueueObject} A priorityQueue object to manage the tasks. There are two
							 * differences between `queue` and `priorityQueue` objects:
							 * * `push(task, priority, [callback])` - `priority` should be a number. If an
							 *   array of `tasks` is given, all tasks will be assigned the same priority.
							 * * The `unshift` method was removed.
							 */
							var priorityQueue = function (worker, concurrency) {
								// Start with a normal queue
								var q = queue$1(worker, concurrency);

								// Override push to accept second parameter representing priority
								q.push = function (data, priority, callback) {
									if (callback == null) callback = noop;
									if (typeof callback !== "function") {
										throw new Error("task callback must be a function");
									}
									q.started = true;
									if (!isArray(data)) {
										data = [data];
									}
									if (data.length === 0) {
										// call drain immediately if there are no tasks
										return setImmediate$1(function () {
											q.drain();
										});
									}

									priority = priority || 0;
									var nextNode = q._tasks.head;
									while (nextNode && priority >= nextNode.priority) {
										nextNode = nextNode.next;
									}

									for (var i = 0, l = data.length; i < l; i++) {
										var item = {
											data: data[i],
											priority: priority,
											callback: callback
										};

										if (nextNode) {
											q._tasks.insertBefore(nextNode, item);
										} else {
											q._tasks.push(item);
										}
									}
									setImmediate$1(q.process);
								};

								// Remove unshift function
								delete q.unshift;

								return q;
							};

							/**
							 * Runs the `tasks` array of functions in parallel, without waiting until the
							 * previous function has completed. Once any of the `tasks` complete or pass an
							 * error to its callback, the main `callback` is immediately called. It's
							 * equivalent to `Promise.race()`.
							 *
							 * @name race
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Array} tasks - An array containing [async functions]{@link AsyncFunction}
							 * to run. Each function can complete with an optional `result` value.
							 * @param {Function} callback - A callback to run once any of the functions have
							 * completed. This function gets an error or result from the first function that
							 * completed. Invoked with (err, result).
							 * @returns undefined
							 * @example
							 *
							 * async.race([
							 *     function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'one');
							 *         }, 200);
							 *     },
							 *     function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'two');
							 *         }, 100);
							 *     }
							 * ],
							 * // main callback
							 * function(err, result) {
							 *     // the result will be equal to 'two' as it finishes earlier
							 * });
							 */
							function race(tasks, callback) {
								callback = once(callback || noop);
								if (!isArray(tasks)) return callback(new TypeError("First argument to race must be an array of functions"));
								if (!tasks.length) return callback();
								for (var i = 0, l = tasks.length; i < l; i++) {
									wrapAsync(tasks[i])(callback);
								}
							}

							/**
							 * Same as [`reduce`]{@link module:Collections.reduce}, only operates on `array` in reverse order.
							 *
							 * @name reduceRight
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.reduce]{@link module:Collections.reduce}
							 * @alias foldr
							 * @category Collection
							 * @param {Array} array - A collection to iterate over.
							 * @param {*} memo - The initial state of the reduction.
							 * @param {AsyncFunction} iteratee - A function applied to each item in the
							 * array to produce the next step in the reduction.
							 * The `iteratee` should complete with the next state of the reduction.
							 * If the iteratee complete with an error, the reduction is stopped and the
							 * main `callback` is immediately called with the error.
							 * Invoked with (memo, item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Result is the reduced value. Invoked with
							 * (err, result).
							 */
							function reduceRight(array, memo, iteratee, callback) {
								var reversed = slice(array).reverse();
								reduce(reversed, memo, iteratee, callback);
							}

							/**
							 * Wraps the async function in another function that always completes with a
							 * result object, even when it errors.
							 *
							 * The result object has either the property `error` or `value`.
							 *
							 * @name reflect
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {AsyncFunction} fn - The async function you want to wrap
							 * @returns {Function} - A function that always passes null to it's callback as
							 * the error. The second argument to the callback will be an `object` with
							 * either an `error` or a `value` property.
							 * @example
							 *
							 * async.parallel([
							 *     async.reflect(function(callback) {
							 *         // do some stuff ...
							 *         callback(null, 'one');
							 *     }),
							 *     async.reflect(function(callback) {
							 *         // do some more stuff but error ...
							 *         callback('bad stuff happened');
							 *     }),
							 *     async.reflect(function(callback) {
							 *         // do some more stuff ...
							 *         callback(null, 'two');
							 *     })
							 * ],
							 * // optional callback
							 * function(err, results) {
							 *     // values
							 *     // results[0].value = 'one'
							 *     // results[1].error = 'bad stuff happened'
							 *     // results[2].value = 'two'
							 * });
							 */
							function reflect(fn) {
								var _fn = wrapAsync(fn);
								return initialParams(function reflectOn(args, reflectCallback) {
									args.push(function callback(error, cbArg) {
										if (error) {
											reflectCallback(null, { error: error });
										} else {
											var value;
											if (arguments.length <= 2) {
												value = cbArg;
											} else {
												value = slice(arguments, 1);
											}
											reflectCallback(null, { value: value });
										}
									});

									return _fn.apply(this, args);
								});
							}

							/**
							 * A helper function that wraps an array or an object of functions with `reflect`.
							 *
							 * @name reflectAll
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @see [async.reflect]{@link module:Utils.reflect}
							 * @category Util
							 * @param {Array|Object|Iterable} tasks - The collection of
							 * [async functions]{@link AsyncFunction} to wrap in `async.reflect`.
							 * @returns {Array} Returns an array of async functions, each wrapped in
							 * `async.reflect`
							 * @example
							 *
							 * let tasks = [
							 *     function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'one');
							 *         }, 200);
							 *     },
							 *     function(callback) {
							 *         // do some more stuff but error ...
							 *         callback(new Error('bad stuff happened'));
							 *     },
							 *     function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'two');
							 *         }, 100);
							 *     }
							 * ];
							 *
							 * async.parallel(async.reflectAll(tasks),
							 * // optional callback
							 * function(err, results) {
							 *     // values
							 *     // results[0].value = 'one'
							 *     // results[1].error = Error('bad stuff happened')
							 *     // results[2].value = 'two'
							 * });
							 *
							 * // an example using an object instead of an array
							 * let tasks = {
							 *     one: function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'one');
							 *         }, 200);
							 *     },
							 *     two: function(callback) {
							 *         callback('two');
							 *     },
							 *     three: function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 'three');
							 *         }, 100);
							 *     }
							 * };
							 *
							 * async.parallel(async.reflectAll(tasks),
							 * // optional callback
							 * function(err, results) {
							 *     // values
							 *     // results.one.value = 'one'
							 *     // results.two.error = 'two'
							 *     // results.three.value = 'three'
							 * });
							 */
							function reflectAll(tasks) {
								var results;
								if (isArray(tasks)) {
									results = arrayMap(tasks, reflect);
								} else {
									results = {};
									baseForOwn(tasks, function (task, key) {
										results[key] = reflect.call(this, task);
									});
								}
								return results;
							}

							function reject$1(eachfn, arr, iteratee, callback) {
								_filter(
									eachfn,
									arr,
									function (value, cb) {
										iteratee(value, function (err, v) {
											cb(err, !v);
										});
									},
									callback
								);
							}

							/**
							 * The opposite of [`filter`]{@link module:Collections.filter}. Removes values that pass an `async` truth test.
							 *
							 * @name reject
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.filter]{@link module:Collections.filter}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {Function} iteratee - An async truth test to apply to each item in
							 * `coll`.
							 * The should complete with a boolean value as its `result`.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Invoked with (err, results).
							 * @example
							 *
							 * async.reject(['file1','file2','file3'], function(filePath, callback) {
							 *     fs.access(filePath, function(err) {
							 *         callback(null, !err)
							 *     });
							 * }, function(err, results) {
							 *     // results now equals an array of missing files
							 *     createFiles(results);
							 * });
							 */
							var reject = doParallel(reject$1);

							/**
							 * The same as [`reject`]{@link module:Collections.reject} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name rejectLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.reject]{@link module:Collections.reject}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {Function} iteratee - An async truth test to apply to each item in
							 * `coll`.
							 * The should complete with a boolean value as its `result`.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Invoked with (err, results).
							 */
							var rejectLimit = doParallelLimit(reject$1);

							/**
							 * The same as [`reject`]{@link module:Collections.reject} but runs only a single async operation at a time.
							 *
							 * @name rejectSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.reject]{@link module:Collections.reject}
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {Function} iteratee - An async truth test to apply to each item in
							 * `coll`.
							 * The should complete with a boolean value as its `result`.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Invoked with (err, results).
							 */
							var rejectSeries = doLimit(rejectLimit, 1);

							/**
							 * Creates a function that returns `value`.
							 *
							 * @static
							 * @memberOf _
							 * @since 2.4.0
							 * @category Util
							 * @param {*} value The value to return from the new function.
							 * @returns {Function} Returns the new constant function.
							 * @example
							 *
							 * var objects = _.times(2, _.constant({ 'a': 1 }));
							 *
							 * console.log(objects);
							 * // => [{ 'a': 1 }, { 'a': 1 }]
							 *
							 * console.log(objects[0] === objects[1]);
							 * // => true
							 */
							function constant$1(value) {
								return function () {
									return value;
								};
							}

							/**
							 * Attempts to get a successful response from `task` no more than `times` times
							 * before returning an error. If the task is successful, the `callback` will be
							 * passed the result of the successful task. If all attempts fail, the callback
							 * will be passed the error and result (if any) of the final attempt.
							 *
							 * @name retry
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @see [async.retryable]{@link module:ControlFlow.retryable}
							 * @param {Object|number} [opts = {times: 5, interval: 0}| 5] - Can be either an
							 * object with `times` and `interval` or a number.
							 * * `times` - The number of attempts to make before giving up.  The default
							 *   is `5`.
							 * * `interval` - The time to wait between retries, in milliseconds.  The
							 *   default is `0`. The interval may also be specified as a function of the
							 *   retry count (see example).
							 * * `errorFilter` - An optional synchronous function that is invoked on
							 *   erroneous result. If it returns `true` the retry attempts will continue;
							 *   if the function returns `false` the retry flow is aborted with the current
							 *   attempt's error and result being returned to the final callback.
							 *   Invoked with (err).
							 * * If `opts` is a number, the number specifies the number of times to retry,
							 *   with the default interval of `0`.
							 * @param {AsyncFunction} task - An async function to retry.
							 * Invoked with (callback).
							 * @param {Function} [callback] - An optional callback which is called when the
							 * task has succeeded, or after the final failed attempt. It receives the `err`
							 * and `result` arguments of the last attempt at completing the `task`. Invoked
							 * with (err, results).
							 *
							 * @example
							 *
							 * // The `retry` function can be used as a stand-alone control flow by passing
							 * // a callback, as shown below:
							 *
							 * // try calling apiMethod 3 times
							 * async.retry(3, apiMethod, function(err, result) {
							 *     // do something with the result
							 * });
							 *
							 * // try calling apiMethod 3 times, waiting 200 ms between each retry
							 * async.retry({times: 3, interval: 200}, apiMethod, function(err, result) {
							 *     // do something with the result
							 * });
							 *
							 * // try calling apiMethod 10 times with exponential backoff
							 * // (i.e. intervals of 100, 200, 400, 800, 1600, ... milliseconds)
							 * async.retry({
							 *   times: 10,
							 *   interval: function(retryCount) {
							 *     return 50 * Math.pow(2, retryCount);
							 *   }
							 * }, apiMethod, function(err, result) {
							 *     // do something with the result
							 * });
							 *
							 * // try calling apiMethod the default 5 times no delay between each retry
							 * async.retry(apiMethod, function(err, result) {
							 *     // do something with the result
							 * });
							 *
							 * // try calling apiMethod only when error condition satisfies, all other
							 * // errors will abort the retry control flow and return to final callback
							 * async.retry({
							 *   errorFilter: function(err) {
							 *     return err.message === 'Temporary error'; // only retry on a specific error
							 *   }
							 * }, apiMethod, function(err, result) {
							 *     // do something with the result
							 * });
							 *
							 * // to retry individual methods that are not as reliable within other
							 * // control flow functions, use the `retryable` wrapper:
							 * async.auto({
							 *     users: api.getUsers.bind(api),
							 *     payments: async.retryable(3, api.getPayments.bind(api))
							 * }, function(err, results) {
							 *     // do something with the results
							 * });
							 *
							 */
							function retry(opts, task, callback) {
								var DEFAULT_TIMES = 5;
								var DEFAULT_INTERVAL = 0;

								var options = {
									times: DEFAULT_TIMES,
									intervalFunc: constant$1(DEFAULT_INTERVAL)
								};

								function parseTimes(acc, t) {
									if (typeof t === "object") {
										acc.times = +t.times || DEFAULT_TIMES;

										acc.intervalFunc = typeof t.interval === "function" ? t.interval : constant$1(+t.interval || DEFAULT_INTERVAL);

										acc.errorFilter = t.errorFilter;
									} else if (typeof t === "number" || typeof t === "string") {
										acc.times = +t || DEFAULT_TIMES;
									} else {
										throw new Error("Invalid arguments for async.retry");
									}
								}

								if (arguments.length < 3 && typeof opts === "function") {
									callback = task || noop;
									task = opts;
								} else {
									parseTimes(options, opts);
									callback = callback || noop;
								}

								if (typeof task !== "function") {
									throw new Error("Invalid arguments for async.retry");
								}

								var _task = wrapAsync(task);

								var attempt = 1;
								function retryAttempt() {
									_task(function (err) {
										if (err && attempt++ < options.times && (typeof options.errorFilter != "function" || options.errorFilter(err))) {
											setTimeout(retryAttempt, options.intervalFunc(attempt));
										} else {
											callback.apply(null, arguments);
										}
									});
								}

								retryAttempt();
							}

							/**
							 * A close relative of [`retry`]{@link module:ControlFlow.retry}.  This method
							 * wraps a task and makes it retryable, rather than immediately calling it
							 * with retries.
							 *
							 * @name retryable
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.retry]{@link module:ControlFlow.retry}
							 * @category Control Flow
							 * @param {Object|number} [opts = {times: 5, interval: 0}| 5] - optional
							 * options, exactly the same as from `retry`
							 * @param {AsyncFunction} task - the asynchronous function to wrap.
							 * This function will be passed any arguments passed to the returned wrapper.
							 * Invoked with (...args, callback).
							 * @returns {AsyncFunction} The wrapped function, which when invoked, will
							 * retry on an error, based on the parameters specified in `opts`.
							 * This function will accept the same parameters as `task`.
							 * @example
							 *
							 * async.auto({
							 *     dep1: async.retryable(3, getFromFlakyService),
							 *     process: ["dep1", async.retryable(3, function (results, cb) {
							 *         maybeProcessData(results.dep1, cb);
							 *     })]
							 * }, callback);
							 */
							var retryable = function (opts, task) {
								if (!task) {
									task = opts;
									opts = null;
								}
								var _task = wrapAsync(task);
								return initialParams(function (args, callback) {
									function taskFn(cb) {
										_task.apply(null, args.concat(cb));
									}

									if (opts) retry(opts, taskFn, callback);
									else retry(taskFn, callback);
								});
							};

							/**
							 * Run the functions in the `tasks` collection in series, each one running once
							 * the previous function has completed. If any functions in the series pass an
							 * error to its callback, no more functions are run, and `callback` is
							 * immediately called with the value of the error. Otherwise, `callback`
							 * receives an array of results when `tasks` have completed.
							 *
							 * It is also possible to use an object instead of an array. Each property will
							 * be run as a function, and the results will be passed to the final `callback`
							 * as an object instead of an array. This can be a more readable way of handling
							 *  results from {@link async.series}.
							 *
							 * **Note** that while many implementations preserve the order of object
							 * properties, the [ECMAScript Language Specification](http://www.ecma-international.org/ecma-262/5.1/#sec-8.6)
							 * explicitly states that
							 *
							 * > The mechanics and order of enumerating the properties is not specified.
							 *
							 * So if you rely on the order in which your series of functions are executed,
							 * and want this to work on all platforms, consider using an array.
							 *
							 * @name series
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Array|Iterable|Object} tasks - A collection containing
							 * [async functions]{@link AsyncFunction} to run in series.
							 * Each function can complete with any number of optional `result` values.
							 * @param {Function} [callback] - An optional callback to run once all the
							 * functions have completed. This function gets a results array (or object)
							 * containing all the result arguments passed to the `task` callbacks. Invoked
							 * with (err, result).
							 * @example
							 * async.series([
							 *     function(callback) {
							 *         // do some stuff ...
							 *         callback(null, 'one');
							 *     },
							 *     function(callback) {
							 *         // do some more stuff ...
							 *         callback(null, 'two');
							 *     }
							 * ],
							 * // optional callback
							 * function(err, results) {
							 *     // results is now equal to ['one', 'two']
							 * });
							 *
							 * async.series({
							 *     one: function(callback) {
							 *         setTimeout(function() {
							 *             callback(null, 1);
							 *         }, 200);
							 *     },
							 *     two: function(callback){
							 *         setTimeout(function() {
							 *             callback(null, 2);
							 *         }, 100);
							 *     }
							 * }, function(err, results) {
							 *     // results is now equal to: {one: 1, two: 2}
							 * });
							 */
							function series(tasks, callback) {
								_parallel(eachOfSeries, tasks, callback);
							}

							/**
							 * Returns `true` if at least one element in the `coll` satisfies an async test.
							 * If any iteratee call returns `true`, the main `callback` is immediately
							 * called.
							 *
							 * @name some
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @alias any
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async truth test to apply to each item
							 * in the collections in parallel.
							 * The iteratee should complete with a boolean `result` value.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called as soon as any
							 * iteratee returns `true`, or after all the iteratee functions have finished.
							 * Result will be either `true` or `false` depending on the values of the async
							 * tests. Invoked with (err, result).
							 * @example
							 *
							 * async.some(['file1','file2','file3'], function(filePath, callback) {
							 *     fs.access(filePath, function(err) {
							 *         callback(null, !err)
							 *     });
							 * }, function(err, result) {
							 *     // if result is true then at least one of the files exists
							 * });
							 */
							var some = doParallel(_createTester(Boolean, identity));

							/**
							 * The same as [`some`]{@link module:Collections.some} but runs a maximum of `limit` async operations at a time.
							 *
							 * @name someLimit
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.some]{@link module:Collections.some}
							 * @alias anyLimit
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - An async truth test to apply to each item
							 * in the collections in parallel.
							 * The iteratee should complete with a boolean `result` value.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called as soon as any
							 * iteratee returns `true`, or after all the iteratee functions have finished.
							 * Result will be either `true` or `false` depending on the values of the async
							 * tests. Invoked with (err, result).
							 */
							var someLimit = doParallelLimit(_createTester(Boolean, identity));

							/**
							 * The same as [`some`]{@link module:Collections.some} but runs only a single async operation at a time.
							 *
							 * @name someSeries
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @see [async.some]{@link module:Collections.some}
							 * @alias anySeries
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async truth test to apply to each item
							 * in the collections in series.
							 * The iteratee should complete with a boolean `result` value.
							 * Invoked with (item, callback).
							 * @param {Function} [callback] - A callback which is called as soon as any
							 * iteratee returns `true`, or after all the iteratee functions have finished.
							 * Result will be either `true` or `false` depending on the values of the async
							 * tests. Invoked with (err, result).
							 */
							var someSeries = doLimit(someLimit, 1);

							/**
							 * Sorts a list by the results of running each `coll` value through an async
							 * `iteratee`.
							 *
							 * @name sortBy
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {AsyncFunction} iteratee - An async function to apply to each item in
							 * `coll`.
							 * The iteratee should complete with a value to use as the sort criteria as
							 * its `result`.
							 * Invoked with (item, callback).
							 * @param {Function} callback - A callback which is called after all the
							 * `iteratee` functions have finished, or an error occurs. Results is the items
							 * from the original `coll` sorted by the values returned by the `iteratee`
							 * calls. Invoked with (err, results).
							 * @example
							 *
							 * async.sortBy(['file1','file2','file3'], function(file, callback) {
							 *     fs.stat(file, function(err, stats) {
							 *         callback(err, stats.mtime);
							 *     });
							 * }, function(err, results) {
							 *     // results is now the original array of files sorted by
							 *     // modified date
							 * });
							 *
							 * // By modifying the callback parameter the
							 * // sorting order can be influenced:
							 *
							 * // ascending order
							 * async.sortBy([1,9,3,5], function(x, callback) {
							 *     callback(null, x);
							 * }, function(err,result) {
							 *     // result callback
							 * });
							 *
							 * // descending order
							 * async.sortBy([1,9,3,5], function(x, callback) {
							 *     callback(null, x*-1);    //<- x*-1 instead of x, turns the order around
							 * }, function(err,result) {
							 *     // result callback
							 * });
							 */
							function sortBy(coll, iteratee, callback) {
								var _iteratee = wrapAsync(iteratee);
								map(
									coll,
									function (x, callback) {
										_iteratee(x, function (err, criteria) {
											if (err) return callback(err);
											callback(null, { value: x, criteria: criteria });
										});
									},
									function (err, results) {
										if (err) return callback(err);
										callback(null, arrayMap(results.sort(comparator), baseProperty("value")));
									}
								);

								function comparator(left, right) {
									var a = left.criteria,
										b = right.criteria;
									return a < b ? -1 : a > b ? 1 : 0;
								}
							}

							/**
							 * Sets a time limit on an asynchronous function. If the function does not call
							 * its callback within the specified milliseconds, it will be called with a
							 * timeout error. The code property for the error object will be `'ETIMEDOUT'`.
							 *
							 * @name timeout
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @category Util
							 * @param {AsyncFunction} asyncFn - The async function to limit in time.
							 * @param {number} milliseconds - The specified time limit.
							 * @param {*} [info] - Any variable you want attached (`string`, `object`, etc)
							 * to timeout Error for more information..
							 * @returns {AsyncFunction} Returns a wrapped function that can be used with any
							 * of the control flow functions.
							 * Invoke this function with the same parameters as you would `asyncFunc`.
							 * @example
							 *
							 * function myFunction(foo, callback) {
							 *     doAsyncTask(foo, function(err, data) {
							 *         // handle errors
							 *         if (err) return callback(err);
							 *
							 *         // do some stuff ...
							 *
							 *         // return processed data
							 *         return callback(null, data);
							 *     });
							 * }
							 *
							 * var wrapped = async.timeout(myFunction, 1000);
							 *
							 * // call `wrapped` as you would `myFunction`
							 * wrapped({ bar: 'bar' }, function(err, data) {
							 *     // if `myFunction` takes < 1000 ms to execute, `err`
							 *     // and `data` will have their expected values
							 *
							 *     // else `err` will be an Error with the code 'ETIMEDOUT'
							 * });
							 */
							function timeout(asyncFn, milliseconds, info) {
								var fn = wrapAsync(asyncFn);

								return initialParams(function (args, callback) {
									var timedOut = false;
									var timer;

									function timeoutCallback() {
										var name = asyncFn.name || "anonymous";
										var error = new Error('Callback function "' + name + '" timed out.');
										error.code = "ETIMEDOUT";
										if (info) {
											error.info = info;
										}
										timedOut = true;
										callback(error);
									}

									args.push(function () {
										if (!timedOut) {
											callback.apply(null, arguments);
											clearTimeout(timer);
										}
									});

									// setup timer and call original function
									timer = setTimeout(timeoutCallback, milliseconds);
									fn.apply(null, args);
								});
							}

							/* Built-in method references for those with the same name as other `lodash` methods. */
							var nativeCeil = Math.ceil;
							var nativeMax = Math.max;

							/**
							 * The base implementation of `_.range` and `_.rangeRight` which doesn't
							 * coerce arguments.
							 *
							 * @private
							 * @param {number} start The start of the range.
							 * @param {number} end The end of the range.
							 * @param {number} step The value to increment or decrement by.
							 * @param {boolean} [fromRight] Specify iterating from right to left.
							 * @returns {Array} Returns the range of numbers.
							 */
							function baseRange(start, end, step, fromRight) {
								var index = -1,
									length = nativeMax(nativeCeil((end - start) / (step || 1)), 0),
									result = Array(length);

								while (length--) {
									result[fromRight ? length : ++index] = start;
									start += step;
								}
								return result;
							}

							/**
							 * The same as [times]{@link module:ControlFlow.times} but runs a maximum of `limit` async operations at a
							 * time.
							 *
							 * @name timesLimit
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.times]{@link module:ControlFlow.times}
							 * @category Control Flow
							 * @param {number} count - The number of times to run the function.
							 * @param {number} limit - The maximum number of async operations at a time.
							 * @param {AsyncFunction} iteratee - The async function to call `n` times.
							 * Invoked with the iteration index and a callback: (n, next).
							 * @param {Function} callback - see [async.map]{@link module:Collections.map}.
							 */
							function timeLimit(count, limit, iteratee, callback) {
								var _iteratee = wrapAsync(iteratee);
								mapLimit(baseRange(0, count, 1), limit, _iteratee, callback);
							}

							/**
							 * Calls the `iteratee` function `n` times, and accumulates results in the same
							 * manner you would use with [map]{@link module:Collections.map}.
							 *
							 * @name times
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.map]{@link module:Collections.map}
							 * @category Control Flow
							 * @param {number} n - The number of times to run the function.
							 * @param {AsyncFunction} iteratee - The async function to call `n` times.
							 * Invoked with the iteration index and a callback: (n, next).
							 * @param {Function} callback - see {@link module:Collections.map}.
							 * @example
							 *
							 * // Pretend this is some complicated async factory
							 * var createUser = function(id, callback) {
							 *     callback(null, {
							 *         id: 'user' + id
							 *     });
							 * };
							 *
							 * // generate 5 users
							 * async.times(5, function(n, next) {
							 *     createUser(n, function(err, user) {
							 *         next(err, user);
							 *     });
							 * }, function(err, users) {
							 *     // we should now have 5 users
							 * });
							 */
							var times = doLimit(timeLimit, Infinity);

							/**
							 * The same as [times]{@link module:ControlFlow.times} but runs only a single async operation at a time.
							 *
							 * @name timesSeries
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.times]{@link module:ControlFlow.times}
							 * @category Control Flow
							 * @param {number} n - The number of times to run the function.
							 * @param {AsyncFunction} iteratee - The async function to call `n` times.
							 * Invoked with the iteration index and a callback: (n, next).
							 * @param {Function} callback - see {@link module:Collections.map}.
							 */
							var timesSeries = doLimit(timeLimit, 1);

							/**
							 * A relative of `reduce`.  Takes an Object or Array, and iterates over each
							 * element in series, each step potentially mutating an `accumulator` value.
							 * The type of the accumulator defaults to the type of collection passed in.
							 *
							 * @name transform
							 * @static
							 * @memberOf module:Collections
							 * @method
							 * @category Collection
							 * @param {Array|Iterable|Object} coll - A collection to iterate over.
							 * @param {*} [accumulator] - The initial state of the transform.  If omitted,
							 * it will default to an empty Object or Array, depending on the type of `coll`
							 * @param {AsyncFunction} iteratee - A function applied to each item in the
							 * collection that potentially modifies the accumulator.
							 * Invoked with (accumulator, item, key, callback).
							 * @param {Function} [callback] - A callback which is called after all the
							 * `iteratee` functions have finished. Result is the transformed accumulator.
							 * Invoked with (err, result).
							 * @example
							 *
							 * async.transform([1,2,3], function(acc, item, index, callback) {
							 *     // pointless async:
							 *     process.nextTick(function() {
							 *         acc.push(item * 2)
							 *         callback(null)
							 *     });
							 * }, function(err, result) {
							 *     // result is now equal to [2, 4, 6]
							 * });
							 *
							 * @example
							 *
							 * async.transform({a: 1, b: 2, c: 3}, function (obj, val, key, callback) {
							 *     setImmediate(function () {
							 *         obj[key] = val * 2;
							 *         callback();
							 *     })
							 * }, function (err, result) {
							 *     // result is equal to {a: 2, b: 4, c: 6}
							 * })
							 */
							function transform(coll, accumulator, iteratee, callback) {
								if (arguments.length <= 3) {
									callback = iteratee;
									iteratee = accumulator;
									accumulator = isArray(coll) ? [] : {};
								}
								callback = once(callback || noop);
								var _iteratee = wrapAsync(iteratee);

								eachOf(
									coll,
									function (v, k, cb) {
										_iteratee(accumulator, v, k, cb);
									},
									function (err) {
										callback(err, accumulator);
									}
								);
							}

							/**
							 * It runs each task in series but stops whenever any of the functions were
							 * successful. If one of the tasks were successful, the `callback` will be
							 * passed the result of the successful task. If all tasks fail, the callback
							 * will be passed the error and result (if any) of the final attempt.
							 *
							 * @name tryEach
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Array|Iterable|Object} tasks - A collection containing functions to
							 * run, each function is passed a `callback(err, result)` it must call on
							 * completion with an error `err` (which can be `null`) and an optional `result`
							 * value.
							 * @param {Function} [callback] - An optional callback which is called when one
							 * of the tasks has succeeded, or all have failed. It receives the `err` and
							 * `result` arguments of the last attempt at completing the `task`. Invoked with
							 * (err, results).
							 * @example
							 * async.tryEach([
							 *     function getDataFromFirstWebsite(callback) {
							 *         // Try getting the data from the first website
							 *         callback(err, data);
							 *     },
							 *     function getDataFromSecondWebsite(callback) {
							 *         // First website failed,
							 *         // Try getting the data from the backup website
							 *         callback(err, data);
							 *     }
							 * ],
							 * // optional callback
							 * function(err, results) {
							 *     Now do something with the data.
							 * });
							 *
							 */
							function tryEach(tasks, callback) {
								var error = null;
								var result;
								callback = callback || noop;
								eachSeries(
									tasks,
									function (task, callback) {
										wrapAsync(task)(function (err, res /*, ...args*/) {
											if (arguments.length > 2) {
												result = slice(arguments, 1);
											} else {
												result = res;
											}
											error = err;
											callback(!err);
										});
									},
									function () {
										callback(error, result);
									}
								);
							}

							/**
							 * Undoes a [memoize]{@link module:Utils.memoize}d function, reverting it to the original,
							 * unmemoized form. Handy for testing.
							 *
							 * @name unmemoize
							 * @static
							 * @memberOf module:Utils
							 * @method
							 * @see [async.memoize]{@link module:Utils.memoize}
							 * @category Util
							 * @param {AsyncFunction} fn - the memoized function
							 * @returns {AsyncFunction} a function that calls the original unmemoized function
							 */
							function unmemoize(fn) {
								return function () {
									return (fn.unmemoized || fn).apply(null, arguments);
								};
							}

							/**
							 * Repeatedly call `iteratee`, while `test` returns `true`. Calls `callback` when
							 * stopped, or an error occurs.
							 *
							 * @name whilst
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Function} test - synchronous truth test to perform before each
							 * execution of `iteratee`. Invoked with ().
							 * @param {AsyncFunction} iteratee - An async function which is called each time
							 * `test` passes. Invoked with (callback).
							 * @param {Function} [callback] - A callback which is called after the test
							 * function has failed and repeated execution of `iteratee` has stopped. `callback`
							 * will be passed an error and any arguments passed to the final `iteratee`'s
							 * callback. Invoked with (err, [results]);
							 * @returns undefined
							 * @example
							 *
							 * var count = 0;
							 * async.whilst(
							 *     function() { return count < 5; },
							 *     function(callback) {
							 *         count++;
							 *         setTimeout(function() {
							 *             callback(null, count);
							 *         }, 1000);
							 *     },
							 *     function (err, n) {
							 *         // 5 seconds have passed, n = 5
							 *     }
							 * );
							 */
							function whilst(test, iteratee, callback) {
								callback = onlyOnce(callback || noop);
								var _iteratee = wrapAsync(iteratee);
								if (!test()) return callback(null);
								var next = function (err /*, ...args*/) {
									if (err) return callback(err);
									if (test()) return _iteratee(next);
									var args = slice(arguments, 1);
									callback.apply(null, [null].concat(args));
								};
								_iteratee(next);
							}

							/**
							 * Repeatedly call `iteratee` until `test` returns `true`. Calls `callback` when
							 * stopped, or an error occurs. `callback` will be passed an error and any
							 * arguments passed to the final `iteratee`'s callback.
							 *
							 * The inverse of [whilst]{@link module:ControlFlow.whilst}.
							 *
							 * @name until
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @see [async.whilst]{@link module:ControlFlow.whilst}
							 * @category Control Flow
							 * @param {Function} test - synchronous truth test to perform before each
							 * execution of `iteratee`. Invoked with ().
							 * @param {AsyncFunction} iteratee - An async function which is called each time
							 * `test` fails. Invoked with (callback).
							 * @param {Function} [callback] - A callback which is called after the test
							 * function has passed and repeated execution of `iteratee` has stopped. `callback`
							 * will be passed an error and any arguments passed to the final `iteratee`'s
							 * callback. Invoked with (err, [results]);
							 */
							function until(test, iteratee, callback) {
								whilst(
									function () {
										return !test.apply(this, arguments);
									},
									iteratee,
									callback
								);
							}

							/**
							 * Runs the `tasks` array of functions in series, each passing their results to
							 * the next in the array. However, if any of the `tasks` pass an error to their
							 * own callback, the next function is not executed, and the main `callback` is
							 * immediately called with the error.
							 *
							 * @name waterfall
							 * @static
							 * @memberOf module:ControlFlow
							 * @method
							 * @category Control Flow
							 * @param {Array} tasks - An array of [async functions]{@link AsyncFunction}
							 * to run.
							 * Each function should complete with any number of `result` values.
							 * The `result` values will be passed as arguments, in order, to the next task.
							 * @param {Function} [callback] - An optional callback to run once all the
							 * functions have completed. This will be passed the results of the last task's
							 * callback. Invoked with (err, [results]).
							 * @returns undefined
							 * @example
							 *
							 * async.waterfall([
							 *     function(callback) {
							 *         callback(null, 'one', 'two');
							 *     },
							 *     function(arg1, arg2, callback) {
							 *         // arg1 now equals 'one' and arg2 now equals 'two'
							 *         callback(null, 'three');
							 *     },
							 *     function(arg1, callback) {
							 *         // arg1 now equals 'three'
							 *         callback(null, 'done');
							 *     }
							 * ], function (err, result) {
							 *     // result now equals 'done'
							 * });
							 *
							 * // Or, with named functions:
							 * async.waterfall([
							 *     myFirstFunction,
							 *     mySecondFunction,
							 *     myLastFunction,
							 * ], function (err, result) {
							 *     // result now equals 'done'
							 * });
							 * function myFirstFunction(callback) {
							 *     callback(null, 'one', 'two');
							 * }
							 * function mySecondFunction(arg1, arg2, callback) {
							 *     // arg1 now equals 'one' and arg2 now equals 'two'
							 *     callback(null, 'three');
							 * }
							 * function myLastFunction(arg1, callback) {
							 *     // arg1 now equals 'three'
							 *     callback(null, 'done');
							 * }
							 */
							var waterfall = function (tasks, callback) {
								callback = once(callback || noop);
								if (!isArray(tasks)) return callback(new Error("First argument to waterfall must be an array of functions"));
								if (!tasks.length) return callback();
								var taskIndex = 0;

								function nextTask(args) {
									var task = wrapAsync(tasks[taskIndex++]);
									args.push(onlyOnce(next));
									task.apply(null, args);
								}

								function next(err /*, ...args*/) {
									if (err || taskIndex === tasks.length) {
										return callback.apply(null, arguments);
									}
									nextTask(slice(arguments, 1));
								}

								nextTask([]);
							};

							/**
							 * An "async function" in the context of Async is an asynchronous function with
							 * a variable number of parameters, with the final parameter being a callback.
							 * (`function (arg1, arg2, ..., callback) {}`)
							 * The final callback is of the form `callback(err, results...)`, which must be
							 * called once the function is completed.  The callback should be called with a
							 * Error as its first argument to signal that an error occurred.
							 * Otherwise, if no error occurred, it should be called with `null` as the first
							 * argument, and any additional `result` arguments that may apply, to signal
							 * successful completion.
							 * The callback must be called exactly once, ideally on a later tick of the
							 * JavaScript event loop.
							 *
							 * This type of function is also referred to as a "Node-style async function",
							 * or a "continuation passing-style function" (CPS). Most of the methods of this
							 * library are themselves CPS/Node-style async functions, or functions that
							 * return CPS/Node-style async functions.
							 *
							 * Wherever we accept a Node-style async function, we also directly accept an
							 * [ES2017 `async` function]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function}.
							 * In this case, the `async` function will not be passed a final callback
							 * argument, and any thrown error will be used as the `err` argument of the
							 * implicit callback, and the return value will be used as the `result` value.
							 * (i.e. a `rejected` of the returned Promise becomes the `err` callback
							 * argument, and a `resolved` value becomes the `result`.)
							 *
							 * Note, due to JavaScript limitations, we can only detect native `async`
							 * functions and not transpilied implementations.
							 * Your environment must have `async`/`await` support for this to work.
							 * (e.g. Node > v7.6, or a recent version of a modern browser).
							 * If you are using `async` functions through a transpiler (e.g. Babel), you
							 * must still wrap the function with [asyncify]{@link module:Utils.asyncify},
							 * because the `async function` will be compiled to an ordinary function that
							 * returns a promise.
							 *
							 * @typedef {Function} AsyncFunction
							 * @static
							 */

							/**
							 * Async is a utility module which provides straight-forward, powerful functions
							 * for working with asynchronous JavaScript. Although originally designed for
							 * use with [Node.js](http://nodejs.org) and installable via
							 * `npm install --save async`, it can also be used directly in the browser.
							 * @module async
							 * @see AsyncFunction
							 */

							/**
							 * A collection of `async` functions for manipulating collections, such as
							 * arrays and objects.
							 * @module Collections
							 */

							/**
							 * A collection of `async` functions for controlling the flow through a script.
							 * @module ControlFlow
							 */

							/**
							 * A collection of `async` utility functions.
							 * @module Utils
							 */

							var index = {
								apply: apply,
								applyEach: applyEach,
								applyEachSeries: applyEachSeries,
								asyncify: asyncify,
								auto: auto,
								autoInject: autoInject,
								cargo: cargo,
								compose: compose,
								concat: concat,
								concatLimit: concatLimit,
								concatSeries: concatSeries,
								constant: constant,
								detect: detect,
								detectLimit: detectLimit,
								detectSeries: detectSeries,
								dir: dir,
								doDuring: doDuring,
								doUntil: doUntil,
								doWhilst: doWhilst,
								during: during,
								each: eachLimit,
								eachLimit: eachLimit$1,
								eachOf: eachOf,
								eachOfLimit: eachOfLimit,
								eachOfSeries: eachOfSeries,
								eachSeries: eachSeries,
								ensureAsync: ensureAsync,
								every: every,
								everyLimit: everyLimit,
								everySeries: everySeries,
								filter: filter,
								filterLimit: filterLimit,
								filterSeries: filterSeries,
								forever: forever,
								groupBy: groupBy,
								groupByLimit: groupByLimit,
								groupBySeries: groupBySeries,
								log: log,
								map: map,
								mapLimit: mapLimit,
								mapSeries: mapSeries,
								mapValues: mapValues,
								mapValuesLimit: mapValuesLimit,
								mapValuesSeries: mapValuesSeries,
								memoize: memoize,
								nextTick: nextTick,
								parallel: parallelLimit,
								parallelLimit: parallelLimit$1,
								priorityQueue: priorityQueue,
								queue: queue$1,
								race: race,
								reduce: reduce,
								reduceRight: reduceRight,
								reflect: reflect,
								reflectAll: reflectAll,
								reject: reject,
								rejectLimit: rejectLimit,
								rejectSeries: rejectSeries,
								retry: retry,
								retryable: retryable,
								seq: seq,
								series: series,
								setImmediate: setImmediate$1,
								some: some,
								someLimit: someLimit,
								someSeries: someSeries,
								sortBy: sortBy,
								timeout: timeout,
								times: times,
								timesLimit: timeLimit,
								timesSeries: timesSeries,
								transform: transform,
								tryEach: tryEach,
								unmemoize: unmemoize,
								until: until,
								waterfall: waterfall,
								whilst: whilst,

								// aliases
								all: every,
								allLimit: everyLimit,
								allSeries: everySeries,
								any: some,
								anyLimit: someLimit,
								anySeries: someSeries,
								find: detect,
								findLimit: detectLimit,
								findSeries: detectSeries,
								forEach: eachLimit,
								forEachSeries: eachSeries,
								forEachLimit: eachLimit$1,
								forEachOf: eachOf,
								forEachOfSeries: eachOfSeries,
								forEachOfLimit: eachOfLimit,
								inject: reduce,
								foldl: reduce,
								foldr: reduceRight,
								select: filter,
								selectLimit: filterLimit,
								selectSeries: filterSeries,
								wrapSync: asyncify
							};

							exports["default"] = index;
							exports.apply = apply;
							exports.applyEach = applyEach;
							exports.applyEachSeries = applyEachSeries;
							exports.asyncify = asyncify;
							exports.auto = auto;
							exports.autoInject = autoInject;
							exports.cargo = cargo;
							exports.compose = compose;
							exports.concat = concat;
							exports.concatLimit = concatLimit;
							exports.concatSeries = concatSeries;
							exports.constant = constant;
							exports.detect = detect;
							exports.detectLimit = detectLimit;
							exports.detectSeries = detectSeries;
							exports.dir = dir;
							exports.doDuring = doDuring;
							exports.doUntil = doUntil;
							exports.doWhilst = doWhilst;
							exports.during = during;
							exports.each = eachLimit;
							exports.eachLimit = eachLimit$1;
							exports.eachOf = eachOf;
							exports.eachOfLimit = eachOfLimit;
							exports.eachOfSeries = eachOfSeries;
							exports.eachSeries = eachSeries;
							exports.ensureAsync = ensureAsync;
							exports.every = every;
							exports.everyLimit = everyLimit;
							exports.everySeries = everySeries;
							exports.filter = filter;
							exports.filterLimit = filterLimit;
							exports.filterSeries = filterSeries;
							exports.forever = forever;
							exports.groupBy = groupBy;
							exports.groupByLimit = groupByLimit;
							exports.groupBySeries = groupBySeries;
							exports.log = log;
							exports.map = map;
							exports.mapLimit = mapLimit;
							exports.mapSeries = mapSeries;
							exports.mapValues = mapValues;
							exports.mapValuesLimit = mapValuesLimit;
							exports.mapValuesSeries = mapValuesSeries;
							exports.memoize = memoize;
							exports.nextTick = nextTick;
							exports.parallel = parallelLimit;
							exports.parallelLimit = parallelLimit$1;
							exports.priorityQueue = priorityQueue;
							exports.queue = queue$1;
							exports.race = race;
							exports.reduce = reduce;
							exports.reduceRight = reduceRight;
							exports.reflect = reflect;
							exports.reflectAll = reflectAll;
							exports.reject = reject;
							exports.rejectLimit = rejectLimit;
							exports.rejectSeries = rejectSeries;
							exports.retry = retry;
							exports.retryable = retryable;
							exports.seq = seq;
							exports.series = series;
							exports.setImmediate = setImmediate$1;
							exports.some = some;
							exports.someLimit = someLimit;
							exports.someSeries = someSeries;
							exports.sortBy = sortBy;
							exports.timeout = timeout;
							exports.times = times;
							exports.timesLimit = timeLimit;
							exports.timesSeries = timesSeries;
							exports.transform = transform;
							exports.tryEach = tryEach;
							exports.unmemoize = unmemoize;
							exports.until = until;
							exports.waterfall = waterfall;
							exports.whilst = whilst;
							exports.all = every;
							exports.allLimit = everyLimit;
							exports.allSeries = everySeries;
							exports.any = some;
							exports.anyLimit = someLimit;
							exports.anySeries = someSeries;
							exports.find = detect;
							exports.findLimit = detectLimit;
							exports.findSeries = detectSeries;
							exports.forEach = eachLimit;
							exports.forEachSeries = eachSeries;
							exports.forEachLimit = eachLimit$1;
							exports.forEachOf = eachOf;
							exports.forEachOfSeries = eachOfSeries;
							exports.forEachOfLimit = eachOfLimit;
							exports.inject = reduce;
							exports.foldl = reduce;
							exports.foldr = reduceRight;
							exports.select = filter;
							exports.selectLimit = filterLimit;
							exports.selectSeries = filterSeries;
							exports.wrapSync = asyncify;

							Object.defineProperty(exports, "__esModule", { value: true });
						});
					}.call(
						this,
						require("_process"),
						typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
						require("timers").setImmediate
					));
				},
				{ _process: 26, timers: 27 }
			],
			2: [
				function (require, module, exports) {
					// Copyright (c) 2014 Takuya Asano All Rights Reserved.

					(function () {
						"use strict";

						var TERM_CHAR = "\u0000", // terminal character
							TERM_CODE = 0, // terminal character code
							ROOT_ID = 0, // index of root node
							NOT_FOUND = -1, // traverse() returns if no nodes found
							BASE_SIGNED = true,
							CHECK_SIGNED = true,
							BASE_BYTES = 4,
							CHECK_BYTES = 4,
							MEMORY_EXPAND_RATIO = 2;

						var newBC = function (initial_size) {
							if (initial_size == null) {
								initial_size = 1024;
							}

							var initBase = function (_base, start, end) {
								// 'end' index does not include
								for (var i = start; i < end; i++) {
									_base[i] = -i + 1; // inversed previous empty node index
								}
								if (0 < check.array[check.array.length - 1]) {
									var last_used_id = check.array.length - 2;
									while (0 < check.array[last_used_id]) {
										last_used_id--;
									}
									_base[start] = -last_used_id;
								}
							};

							var initCheck = function (_check, start, end) {
								for (var i = start; i < end; i++) {
									_check[i] = -i - 1; // inversed next empty node index
								}
							};

							var realloc = function (min_size) {
								// expand arrays size by given ratio
								var new_size = min_size * MEMORY_EXPAND_RATIO;
								// console.log('re-allocate memory to ' + new_size);

								var base_new_array = newArrayBuffer(base.signed, base.bytes, new_size);
								initBase(base_new_array, base.array.length, new_size); // init BASE in new range
								base_new_array.set(base.array);
								base.array = null; // explicit GC
								base.array = base_new_array;

								var check_new_array = newArrayBuffer(check.signed, check.bytes, new_size);
								initCheck(check_new_array, check.array.length, new_size); // init CHECK in new range
								check_new_array.set(check.array);
								check.array = null; // explicit GC
								check.array = check_new_array;
							};

							var first_unused_node = ROOT_ID + 1;

							var base = {
								signed: BASE_SIGNED,
								bytes: BASE_BYTES,
								array: newArrayBuffer(BASE_SIGNED, BASE_BYTES, initial_size)
							};

							var check = {
								signed: CHECK_SIGNED,
								bytes: CHECK_BYTES,
								array: newArrayBuffer(CHECK_SIGNED, CHECK_BYTES, initial_size)
							};

							// init root node
							base.array[ROOT_ID] = 1;
							check.array[ROOT_ID] = ROOT_ID;

							// init BASE
							initBase(base.array, ROOT_ID + 1, base.array.length);

							// init CHECK
							initCheck(check.array, ROOT_ID + 1, check.array.length);

							return {
								getBaseBuffer: function () {
									return base.array;
								},
								getCheckBuffer: function () {
									return check.array;
								},
								loadBaseBuffer: function (base_buffer) {
									base.array = base_buffer;
									return this;
								},
								loadCheckBuffer: function (check_buffer) {
									check.array = check_buffer;
									return this;
								},
								size: function () {
									return Math.max(base.array.length, check.array.length);
								},
								getBase: function (index) {
									if (base.array.length - 1 < index) {
										return -index + 1;
										// realloc(index);
									}
									// if (!Number.isFinite(base.array[index])) {
									//     console.log('getBase:' + index);
									//     throw 'getBase' + index;
									// }
									return base.array[index];
								},
								getCheck: function (index) {
									if (check.array.length - 1 < index) {
										return -index - 1;
										// realloc(index);
									}
									// if (!Number.isFinite(check.array[index])) {
									//     console.log('getCheck:' + index);
									//     throw 'getCheck' + index;
									// }
									return check.array[index];
								},
								setBase: function (index, base_value) {
									if (base.array.length - 1 < index) {
										realloc(index);
									}
									base.array[index] = base_value;
								},
								setCheck: function (index, check_value) {
									if (check.array.length - 1 < index) {
										realloc(index);
									}
									check.array[index] = check_value;
								},
								setFirstUnusedNode: function (index) {
									// if (!Number.isFinite(index)) {
									//     throw 'assertion error: setFirstUnusedNode ' + index + ' is not finite number';
									// }
									first_unused_node = index;
								},
								getFirstUnusedNode: function () {
									// if (!Number.isFinite(first_unused_node)) {
									//     throw 'assertion error: getFirstUnusedNode ' + first_unused_node + ' is not finite number';
									// }
									return first_unused_node;
								},
								shrink: function () {
									var last_index = this.size() - 1;
									while (true) {
										if (0 <= check.array[last_index]) {
											break;
										}
										last_index--;
									}
									base.array = base.array.subarray(0, last_index + 2); // keep last unused node
									check.array = check.array.subarray(0, last_index + 2); // keep last unused node
								},
								calc: function () {
									var unused_count = 0;
									var size = check.array.length;
									for (var i = 0; i < size; i++) {
										if (check.array[i] < 0) {
											unused_count++;
										}
									}
									return {
										all: size,
										unused: unused_count,
										efficiency: (size - unused_count) / size
									};
								},
								dump: function () {
									// for debug
									var dump_base = "";
									var dump_check = "";

									var i;
									for (i = 0; i < base.array.length; i++) {
										dump_base = dump_base + " " + this.getBase(i);
									}
									for (i = 0; i < check.array.length; i++) {
										dump_check = dump_check + " " + this.getCheck(i);
									}

									console.log("base:" + dump_base);
									console.log("chck:" + dump_check);

									return "base:" + dump_base + " chck:" + dump_check;
								}
							};
						};

						/**
						 * Factory method of double array
						 */
						function DoubleArrayBuilder(initial_size) {
							this.bc = newBC(initial_size); // BASE and CHECK
							this.keys = [];
						}

						/**
						 * Append a key to initialize set
						 * (This method should be called by dictionary ordered key)
						 *
						 * @param {String} key
						 * @param {Number} value Integer value from 0 to max signed integer number - 1
						 */
						DoubleArrayBuilder.prototype.append = function (key, record) {
							this.keys.push({ k: key, v: record });
							return this;
						};

						/**
						 * Build double array for given keys
						 *
						 * @param {Array} keys Array of keys. A key is a Object which has properties 'k', 'v'.
						 * 'k' is a key string, 'v' is a record assigned to that key.
						 * @return {DoubleArray} Compiled double array
						 */
						DoubleArrayBuilder.prototype.build = function (keys, sorted) {
							if (keys == null) {
								keys = this.keys;
							}

							if (keys == null) {
								return new DoubleArray(this.bc);
							}

							if (sorted == null) {
								sorted = false;
							}

							// Convert key string to ArrayBuffer
							var buff_keys = keys.map(function (k) {
								return {
									k: stringToUtf8Bytes(k.k + TERM_CHAR),
									v: k.v
								};
							});

							// Sort keys by byte order
							if (sorted) {
								this.keys = buff_keys;
							} else {
								this.keys = buff_keys.sort(function (k1, k2) {
									var b1 = k1.k;
									var b2 = k2.k;
									var min_length = Math.min(b1.length, b2.length);
									for (var pos = 0; pos < min_length; pos++) {
										if (b1[pos] === b2[pos]) {
											continue;
										}
										return b1[pos] - b2[pos];
									}
									return b1.length - b2.length;
								});
							}

							buff_keys = null; // explicit GC

							this._build(ROOT_ID, 0, 0, this.keys.length);
							return new DoubleArray(this.bc);
						};

						/**
						 * Append nodes to BASE and CHECK array recursively
						 */
						DoubleArrayBuilder.prototype._build = function (parent_index, position, start, length) {
							var children_info = this.getChildrenInfo(position, start, length);
							var _base = this.findAllocatableBase(children_info);

							this.setBC(parent_index, children_info, _base);

							for (var i = 0; i < children_info.length; i = i + 3) {
								var child_code = children_info[i];
								if (child_code === TERM_CODE) {
									continue;
								}
								var child_start = children_info[i + 1];
								var child_len = children_info[i + 2];
								var child_index = _base + child_code;
								this._build(child_index, position + 1, child_start, child_len);
							}
						};

						DoubleArrayBuilder.prototype.getChildrenInfo = function (position, start, length) {
							var current_char = this.keys[start].k[position];
							var i = 0;
							var children_info = new Int32Array(length * 3);

							children_info[i++] = current_char; // char (current)
							children_info[i++] = start; // start index (current)

							var next_pos = start;
							var start_pos = start;
							for (; next_pos < start + length; next_pos++) {
								var next_char = this.keys[next_pos].k[position];
								if (current_char !== next_char) {
									children_info[i++] = next_pos - start_pos; // length (current)

									children_info[i++] = next_char; // char (next)
									children_info[i++] = next_pos; // start index (next)
									current_char = next_char;
									start_pos = next_pos;
								}
							}
							children_info[i++] = next_pos - start_pos;
							children_info = children_info.subarray(0, i);

							return children_info;
						};

						DoubleArrayBuilder.prototype.setBC = function (parent_id, children_info, _base) {
							var bc = this.bc;

							bc.setBase(parent_id, _base); // Update BASE of parent node

							var i;
							for (i = 0; i < children_info.length; i = i + 3) {
								var code = children_info[i];
								var child_id = _base + code;

								// Update linked list of unused nodes

								// Assertion
								// if (child_id < 0) {
								//     throw 'assertion error: child_id is negative'
								// }

								var prev_unused_id = -bc.getBase(child_id);
								var next_unused_id = -bc.getCheck(child_id);
								// if (prev_unused_id < 0) {
								//     throw 'assertion error: setBC'
								// }
								// if (next_unused_id < 0) {
								//     throw 'assertion error: setBC'
								// }
								if (child_id !== bc.getFirstUnusedNode()) {
									bc.setCheck(prev_unused_id, -next_unused_id);
								} else {
									// Update first_unused_node
									bc.setFirstUnusedNode(next_unused_id);
								}
								bc.setBase(next_unused_id, -prev_unused_id);

								var check = parent_id; // CHECK is parent node index
								bc.setCheck(child_id, check); // Update CHECK of child node

								// Update record
								if (code === TERM_CODE) {
									var start_pos = children_info[i + 1];
									// var len = children_info[i + 2];
									// if (len != 1) {
									//     throw 'assertion error: there are multiple terminal nodes. len:' + len;
									// }
									var value = this.keys[start_pos].v;

									if (value == null) {
										value = 0;
									}

									var base = -value - 1; // BASE is inverted record value
									bc.setBase(child_id, base); // Update BASE of child(leaf) node
								}
							}
						};

						/**
						 * Find BASE value that all children are allocatable in double array's region
						 */
						DoubleArrayBuilder.prototype.findAllocatableBase = function (children_info) {
							var bc = this.bc;

							// Assertion: keys are sorted by byte order
							// var c = -1;
							// for (var i = 0; i < children_info.length; i = i + 3) {
							//     if (children_info[i] < c) {
							//         throw 'assertion error: not sort key'
							//     }
							//     c = children_info[i];
							// }

							// iterate linked list of unused nodes
							var _base;
							var curr = bc.getFirstUnusedNode(); // current index
							// if (curr < 0) {
							//     throw 'assertion error: getFirstUnusedNode returns negative value'
							// }

							while (true) {
								_base = curr - children_info[0];

								if (_base < 0) {
									curr = -bc.getCheck(curr); // next

									// if (curr < 0) {
									//     throw 'assertion error: getCheck returns negative value'
									// }

									continue;
								}

								var empty_area_found = true;
								for (var i = 0; i < children_info.length; i = i + 3) {
									var code = children_info[i];
									var candidate_id = _base + code;

									if (!this.isUnusedNode(candidate_id)) {
										// candidate_id is used node
										// next
										curr = -bc.getCheck(curr);
										// if (curr < 0) {
										//     throw 'assertion error: getCheck returns negative value'
										// }

										empty_area_found = false;
										break;
									}
								}
								if (empty_area_found) {
									// Area is free
									return _base;
								}
							}
						};

						/**
						 * Check this double array index is unused or not
						 */
						DoubleArrayBuilder.prototype.isUnusedNode = function (index) {
							var bc = this.bc;
							var check = bc.getCheck(index);

							// if (index < 0) {
							//     throw 'assertion error: isUnusedNode index:' + index;
							// }

							if (index === ROOT_ID) {
								// root node
								return false;
							}
							if (check < 0) {
								// unused
								return true;
							}

							// used node (incl. leaf)
							return false;
						};

						/**
						 * Factory method of double array
						 */
						function DoubleArray(bc) {
							this.bc = bc; // BASE and CHECK
							this.bc.shrink();
						}

						/**
						 * Look up a given key in this trie
						 *
						 * @param {String} key
						 * @return {Boolean} True if this trie contains a given key
						 */
						DoubleArray.prototype.contain = function (key) {
							var bc = this.bc;

							key += TERM_CHAR;
							var buffer = stringToUtf8Bytes(key);

							var parent = ROOT_ID;
							var child = NOT_FOUND;

							for (var i = 0; i < buffer.length; i++) {
								var code = buffer[i];

								child = this.traverse(parent, code);
								if (child === NOT_FOUND) {
									return false;
								}

								if (bc.getBase(child) <= 0) {
									// leaf node
									return true;
								} else {
									// not leaf
									parent = child;
									continue;
								}
							}
							return false;
						};

						/**
						 * Look up a given key in this trie
						 *
						 * @param {String} key
						 * @return {Number} Record value assgned to this key, -1 if this key does not contain
						 */
						DoubleArray.prototype.lookup = function (key) {
							key += TERM_CHAR;
							var buffer = stringToUtf8Bytes(key);

							var parent = ROOT_ID;
							var child = NOT_FOUND;

							for (var i = 0; i < buffer.length; i++) {
								var code = buffer[i];
								child = this.traverse(parent, code);
								if (child === NOT_FOUND) {
									return NOT_FOUND;
								}
								parent = child;
							}

							var base = this.bc.getBase(child);
							if (base <= 0) {
								// leaf node
								return -base - 1;
							} else {
								// not leaf
								return NOT_FOUND;
							}
						};

						/**
						 * Common prefix search
						 *
						 * @param {String} key
						 * @return {Array} Each result object has 'k' and 'v' (key and record,
						 * respectively) properties assigned to matched string
						 */
						DoubleArray.prototype.commonPrefixSearch = function (key) {
							var buffer = stringToUtf8Bytes(key);

							var parent = ROOT_ID;
							var child = NOT_FOUND;

							var result = [];

							for (var i = 0; i < buffer.length; i++) {
								var code = buffer[i];

								child = this.traverse(parent, code);

								if (child !== NOT_FOUND) {
									parent = child;

									// look forward by terminal character code to check this node is a leaf or not
									var grand_child = this.traverse(child, TERM_CODE);

									if (grand_child !== NOT_FOUND) {
										var base = this.bc.getBase(grand_child);

										var r = {};

										if (base <= 0) {
											// If child is a leaf node, add record to result
											r.v = -base - 1;
										}

										// If child is a leaf node, add word to result
										r.k = utf8BytesToString(arrayCopy(buffer, 0, i + 1));

										result.push(r);
									}
									continue;
								} else {
									break;
								}
							}

							return result;
						};

						DoubleArray.prototype.traverse = function (parent, code) {
							var child = this.bc.getBase(parent) + code;
							if (this.bc.getCheck(child) === parent) {
								return child;
							} else {
								return NOT_FOUND;
							}
						};

						DoubleArray.prototype.size = function () {
							return this.bc.size();
						};

						DoubleArray.prototype.calc = function () {
							return this.bc.calc();
						};

						DoubleArray.prototype.dump = function () {
							return this.bc.dump();
						};

						// Array utility functions

						var newArrayBuffer = function (signed, bytes, size) {
							if (signed) {
								switch (bytes) {
									case 1:
										return new Int8Array(size);
									case 2:
										return new Int16Array(size);
									case 4:
										return new Int32Array(size);
									default:
										throw new RangeError("Invalid newArray parameter element_bytes:" + bytes);
								}
							} else {
								switch (bytes) {
									case 1:
										return new Uint8Array(size);
									case 2:
										return new Uint16Array(size);
									case 4:
										return new Uint32Array(size);
									default:
										throw new RangeError("Invalid newArray parameter element_bytes:" + bytes);
								}
							}
						};

						var arrayCopy = function (src, src_offset, length) {
							var buffer = new ArrayBuffer(length);
							var dstU8 = new Uint8Array(buffer, 0, length);
							var srcU8 = src.subarray(src_offset, length);
							dstU8.set(srcU8);
							return dstU8;
						};

						/**
						 * Convert String (UTF-16) to UTF-8 ArrayBuffer
						 *
						 * @param {String} str UTF-16 string to convert
						 * @return {Uint8Array} Byte sequence encoded by UTF-8
						 */
						var stringToUtf8Bytes = function (str) {
							// Max size of 1 character is 4 bytes
							var bytes = new Uint8Array(new ArrayBuffer(str.length * 4));

							var i = 0,
								j = 0;

							while (i < str.length) {
								var unicode_code;

								var utf16_code = str.charCodeAt(i++);
								if (utf16_code >= 0xd800 && utf16_code <= 0xdbff) {
									// surrogate pair
									var upper = utf16_code; // high surrogate
									var lower = str.charCodeAt(i++); // low surrogate

									if (lower >= 0xdc00 && lower <= 0xdfff) {
										unicode_code = (upper - 0xd800) * (1 << 10) + (1 << 16) + (lower - 0xdc00);
									} else {
										// malformed surrogate pair
										return null;
									}
								} else {
									// not surrogate code
									unicode_code = utf16_code;
								}

								if (unicode_code < 0x80) {
									// 1-byte
									bytes[j++] = unicode_code;
								} else if (unicode_code < 1 << 11) {
									// 2-byte
									bytes[j++] = (unicode_code >>> 6) | 0xc0;
									bytes[j++] = (unicode_code & 0x3f) | 0x80;
								} else if (unicode_code < 1 << 16) {
									// 3-byte
									bytes[j++] = (unicode_code >>> 12) | 0xe0;
									bytes[j++] = ((unicode_code >> 6) & 0x3f) | 0x80;
									bytes[j++] = (unicode_code & 0x3f) | 0x80;
								} else if (unicode_code < 1 << 21) {
									// 4-byte
									bytes[j++] = (unicode_code >>> 18) | 0xf0;
									bytes[j++] = ((unicode_code >> 12) & 0x3f) | 0x80;
									bytes[j++] = ((unicode_code >> 6) & 0x3f) | 0x80;
									bytes[j++] = (unicode_code & 0x3f) | 0x80;
								} else {
									// malformed UCS4 code
								}
							}

							return bytes.subarray(0, j);
						};

						/**
						 * Convert UTF-8 ArrayBuffer to String (UTF-16)
						 *
						 * @param {Uint8Array} bytes UTF-8 byte sequence to convert
						 * @return {String} String encoded by UTF-16
						 */
						var utf8BytesToString = function (bytes) {
							var str = "";
							var code, b1, b2, b3, b4, upper, lower;
							var i = 0;

							while (i < bytes.length) {
								b1 = bytes[i++];

								if (b1 < 0x80) {
									// 1 byte
									code = b1;
								} else if (b1 >> 5 === 0x06) {
									// 2 bytes
									b2 = bytes[i++];
									code = ((b1 & 0x1f) << 6) | (b2 & 0x3f);
								} else if (b1 >> 4 === 0x0e) {
									// 3 bytes
									b2 = bytes[i++];
									b3 = bytes[i++];
									code = ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
								} else {
									// 4 bytes
									b2 = bytes[i++];
									b3 = bytes[i++];
									b4 = bytes[i++];
									code = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
								}

								if (code < 0x10000) {
									str += String.fromCharCode(code);
								} else {
									// surrogate pair
									code -= 0x10000;
									upper = 0xd800 | (code >> 10);
									lower = 0xdc00 | (code & 0x3ff);
									str += String.fromCharCode(upper, lower);
								}
							}

							return str;
						};

						// public methods
						var doublearray = {
							builder: function (initial_size) {
								return new DoubleArrayBuilder(initial_size);
							},
							load: function (base_buffer, check_buffer) {
								var bc = newBC(0);
								bc.loadBaseBuffer(base_buffer);
								bc.loadCheckBuffer(check_buffer);
								return new DoubleArray(bc);
							}
						};

						if ("undefined" === typeof module) {
							// In browser
							window.doublearray = doublearray;
						} else {
							// In node
							module.exports = doublearray;
						}
					})();
				},
				{}
			],
			3: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var ViterbiBuilder = require("./viterbi/ViterbiBuilder");
					var ViterbiSearcher = require("./viterbi/ViterbiSearcher");
					var IpadicFormatter = require("./util/IpadicFormatter");

					var PUNCTUATION = /、|。/;

					/**
					 * Tokenizer
					 * @param {DynamicDictionaries} dic Dictionaries used by this tokenizer
					 * @constructor
					 */
					function Tokenizer(dic) {
						this.token_info_dictionary = dic.token_info_dictionary;
						this.unknown_dictionary = dic.unknown_dictionary;
						this.viterbi_builder = new ViterbiBuilder(dic);
						this.viterbi_searcher = new ViterbiSearcher(dic.connection_costs);
						this.formatter = new IpadicFormatter(); // TODO Other dictionaries
					}

					/**
					 * Split into sentence by punctuation
					 * @param {string} input Input text
					 * @returns {Array.<string>} Sentences end with punctuation
					 */
					Tokenizer.splitByPunctuation = function (input) {
						var sentences = [];
						var tail = input;
						while (true) {
							if (tail === "") {
								break;
							}
							var index = tail.search(PUNCTUATION);
							if (index < 0) {
								sentences.push(tail);
								break;
							}
							sentences.push(tail.substring(0, index + 1));
							tail = tail.substring(index + 1);
						}
						return sentences;
					};

					/**
					 * Tokenize text
					 * @param {string} text Input text to analyze
					 * @returns {Array} Tokens
					 */
					Tokenizer.prototype.tokenize = function (text) {
						var sentences = Tokenizer.splitByPunctuation(text);
						var tokens = [];
						for (var i = 0; i < sentences.length; i++) {
							var sentence = sentences[i];
							this.tokenizeForSentence(sentence, tokens);
						}
						return tokens;
					};

					Tokenizer.prototype.tokenizeForSentence = function (sentence, tokens) {
						if (tokens == null) {
							tokens = [];
						}
						var lattice = this.getLattice(sentence);
						var best_path = this.viterbi_searcher.search(lattice);
						var last_pos = 0;
						if (tokens.length > 0) {
							last_pos = tokens[tokens.length - 1].word_position;
						}

						for (var j = 0; j < best_path.length; j++) {
							var node = best_path[j];

							var token, features, features_line;
							if (node.type === "KNOWN") {
								features_line = this.token_info_dictionary.getFeatures(node.name);
								if (features_line == null) {
									features = [];
								} else {
									features = features_line.split(",");
								}
								token = this.formatter.formatEntry(node.name, last_pos + node.start_pos, node.type, features);
							} else if (node.type === "UNKNOWN") {
								// Unknown word
								features_line = this.unknown_dictionary.getFeatures(node.name);
								if (features_line == null) {
									features = [];
								} else {
									features = features_line.split(",");
								}
								token = this.formatter.formatUnknownEntry(node.name, last_pos + node.start_pos, node.type, features, node.surface_form);
							} else {
								// TODO User dictionary
								token = this.formatter.formatEntry(node.name, last_pos + node.start_pos, node.type, []);
							}

							tokens.push(token);
						}

						return tokens;
					};

					/**
					 * Build word lattice
					 * @param {string} text Input text to analyze
					 * @returns {ViterbiLattice} Word lattice
					 */
					Tokenizer.prototype.getLattice = function (text) {
						return this.viterbi_builder.build(text);
					};

					module.exports = Tokenizer;
				},
				{ "./util/IpadicFormatter": 19, "./viterbi/ViterbiBuilder": 21, "./viterbi/ViterbiSearcher": 24 }
			],
			4: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var Tokenizer = require("./Tokenizer");
					var DictionaryLoader = require("./loader/NodeDictionaryLoader");

					/**
					 * TokenizerBuilder create Tokenizer instance.
					 * @param {Object} option JSON object which have key-value pairs settings
					 * @param {string} option.dicPath Dictionary directory path (or URL using in browser)
					 * @constructor
					 */
					function TokenizerBuilder(option) {
						if (option.dicPath == null) {
							this.dic_path = "dict/";
						} else {
							this.dic_path = option.dicPath;
						}
					}

					/**
					 * Build Tokenizer instance by asynchronous manner
					 * @param {TokenizerBuilder~onLoad} callback Callback function
					 */
					TokenizerBuilder.prototype.build = function (callback) {
						var loader = new DictionaryLoader(this.dic_path);
						loader.load(function (err, dic) {
							callback(err, new Tokenizer(dic));
						});
					};

					/**
					 * Callback used by build
					 * @callback TokenizerBuilder~onLoad
					 * @param {Object} err Error object
					 * @param {Tokenizer} tokenizer Prepared Tokenizer
					 */

					module.exports = TokenizerBuilder;
				},
				{ "./Tokenizer": 3, "./loader/NodeDictionaryLoader": 16 }
			],
			5: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * CharacterClass
					 * @param {number} class_id
					 * @param {string} class_name
					 * @param {boolean} is_always_invoke
					 * @param {boolean} is_grouping
					 * @param {number} max_length
					 * @constructor
					 */
					function CharacterClass(class_id, class_name, is_always_invoke, is_grouping, max_length) {
						this.class_id = class_id;
						this.class_name = class_name;
						this.is_always_invoke = is_always_invoke;
						this.is_grouping = is_grouping;
						this.max_length = max_length;
					}

					module.exports = CharacterClass;
				},
				{}
			],
			6: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var InvokeDefinitionMap = require("./InvokeDefinitionMap");
					var CharacterClass = require("./CharacterClass");
					var SurrogateAwareString = require("../util/SurrogateAwareString");

					var DEFAULT_CATEGORY = "DEFAULT";

					/**
					 * CharacterDefinition represents char.def file and
					 * defines behavior of unknown word processing
					 * @constructor
					 */
					function CharacterDefinition() {
						this.character_category_map = new Uint8Array(65536); // for all UCS2 code points
						this.compatible_category_map = new Uint32Array(65536); // for all UCS2 code points
						this.invoke_definition_map = null;
					}

					/**
					 * Load CharacterDefinition
					 * @param {Uint8Array} cat_map_buffer
					 * @param {Uint32Array} compat_cat_map_buffer
					 * @param {InvokeDefinitionMap} invoke_def_buffer
					 * @returns {CharacterDefinition}
					 */
					CharacterDefinition.load = function (cat_map_buffer, compat_cat_map_buffer, invoke_def_buffer) {
						var char_def = new CharacterDefinition();
						char_def.character_category_map = cat_map_buffer;
						char_def.compatible_category_map = compat_cat_map_buffer;
						char_def.invoke_definition_map = InvokeDefinitionMap.load(invoke_def_buffer);
						return char_def;
					};

					CharacterDefinition.parseCharCategory = function (class_id, parsed_category_def) {
						var category = parsed_category_def[1];
						var invoke = parseInt(parsed_category_def[2]);
						var grouping = parseInt(parsed_category_def[3]);
						var max_length = parseInt(parsed_category_def[4]);
						if (!isFinite(invoke) || (invoke !== 0 && invoke !== 1)) {
							console.log("char.def parse error. INVOKE is 0 or 1 in:" + invoke);
							return null;
						}
						if (!isFinite(grouping) || (grouping !== 0 && grouping !== 1)) {
							console.log("char.def parse error. GROUP is 0 or 1 in:" + grouping);
							return null;
						}
						if (!isFinite(max_length) || max_length < 0) {
							console.log("char.def parse error. LENGTH is 1 to n:" + max_length);
							return null;
						}
						var is_invoke = invoke === 1;
						var is_grouping = grouping === 1;

						return new CharacterClass(class_id, category, is_invoke, is_grouping, max_length);
					};

					CharacterDefinition.parseCategoryMapping = function (parsed_category_mapping) {
						var start = parseInt(parsed_category_mapping[1]);
						var default_category = parsed_category_mapping[2];
						var compatible_category = 3 < parsed_category_mapping.length ? parsed_category_mapping.slice(3) : [];
						if (!isFinite(start) || start < 0 || start > 0xffff) {
							console.log("char.def parse error. CODE is invalid:" + start);
						}
						return { start: start, default: default_category, compatible: compatible_category };
					};

					CharacterDefinition.parseRangeCategoryMapping = function (parsed_category_mapping) {
						var start = parseInt(parsed_category_mapping[1]);
						var end = parseInt(parsed_category_mapping[2]);
						var default_category = parsed_category_mapping[3];
						var compatible_category = 4 < parsed_category_mapping.length ? parsed_category_mapping.slice(4) : [];
						if (!isFinite(start) || start < 0 || start > 0xffff) {
							console.log("char.def parse error. CODE is invalid:" + start);
						}
						if (!isFinite(end) || end < 0 || end > 0xffff) {
							console.log("char.def parse error. CODE is invalid:" + end);
						}
						return { start: start, end: end, default: default_category, compatible: compatible_category };
					};

					/**
					 * Initializing method
					 * @param {Array} category_mapping Array of category mapping
					 */
					CharacterDefinition.prototype.initCategoryMappings = function (category_mapping) {
						// Initialize map by DEFAULT class
						var code_point;
						if (category_mapping != null) {
							for (var i = 0; i < category_mapping.length; i++) {
								var mapping = category_mapping[i];
								var end = mapping.end || mapping.start;
								for (code_point = mapping.start; code_point <= end; code_point++) {
									// Default Category class ID
									this.character_category_map[code_point] = this.invoke_definition_map.lookup(mapping.default);

									for (var j = 0; j < mapping.compatible.length; j++) {
										var bitset = this.compatible_category_map[code_point];
										var compatible_category = mapping.compatible[j];
										if (compatible_category == null) {
											continue;
										}
										var class_id = this.invoke_definition_map.lookup(compatible_category); // Default Category
										if (class_id == null) {
											continue;
										}
										var class_id_bit = 1 << class_id;
										bitset = bitset | class_id_bit; // Set a bit of class ID 例えば、class_idが3のとき、3ビット目に1を立てる
										this.compatible_category_map[code_point] = bitset;
									}
								}
							}
						}
						var default_id = this.invoke_definition_map.lookup(DEFAULT_CATEGORY);
						if (default_id == null) {
							return;
						}
						for (code_point = 0; code_point < this.character_category_map.length; code_point++) {
							// 他に何のクラスも定義されていなかったときだけ DEFAULT
							if (this.character_category_map[code_point] === 0) {
								// DEFAULT class ID に対応するビットだけ1を立てる
								this.character_category_map[code_point] = 1 << default_id;
							}
						}
					};

					/**
					 * Lookup compatible categories for a character (not included 1st category)
					 * @param {string} ch UCS2 character (just 1st character is effective)
					 * @returns {Array.<CharacterClass>} character classes
					 */
					CharacterDefinition.prototype.lookupCompatibleCategory = function (ch) {
						var classes = [];

						/*
     if (SurrogateAwareString.isSurrogatePair(ch)) {
     // Surrogate pair character codes can not be defined by char.def
     return classes;
     }*/
						var code = ch.charCodeAt(0);
						var integer;
						if (code < this.compatible_category_map.length) {
							integer = this.compatible_category_map[code]; // Bitset
						}

						if (integer == null || integer === 0) {
							return classes;
						}

						for (var bit = 0; bit < 32; bit++) {
							// Treat "bit" as a class ID
							if ((integer << (31 - bit)) >>> 31 === 1) {
								var character_class = this.invoke_definition_map.getCharacterClass(bit);
								if (character_class == null) {
									continue;
								}
								classes.push(character_class);
							}
						}
						return classes;
					};

					/**
					 * Lookup category for a character
					 * @param {string} ch UCS2 character (just 1st character is effective)
					 * @returns {CharacterClass} character class
					 */
					CharacterDefinition.prototype.lookup = function (ch) {
						var class_id;

						var code = ch.charCodeAt(0);
						if (SurrogateAwareString.isSurrogatePair(ch)) {
							// Surrogate pair character codes can not be defined by char.def, so set DEFAULT category
							class_id = this.invoke_definition_map.lookup(DEFAULT_CATEGORY);
						} else if (code < this.character_category_map.length) {
							class_id = this.character_category_map[code]; // Read as integer value
						}

						if (class_id == null) {
							class_id = this.invoke_definition_map.lookup(DEFAULT_CATEGORY);
						}

						return this.invoke_definition_map.getCharacterClass(class_id);
					};

					module.exports = CharacterDefinition;
				},
				{ "../util/SurrogateAwareString": 20, "./CharacterClass": 5, "./InvokeDefinitionMap": 9 }
			],
			7: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * Connection costs matrix from cc.dat file.
					 * 2 dimension matrix [forward_id][backward_id] -> cost
					 * @constructor
					 * @param {number} forward_dimension
					 * @param {number} backward_dimension
					 */
					function ConnectionCosts(forward_dimension, backward_dimension) {
						this.forward_dimension = forward_dimension;
						this.backward_dimension = backward_dimension;

						// leading 2 integers for forward_dimension, backward_dimension, respectively
						this.buffer = new Int16Array(forward_dimension * backward_dimension + 2);
						this.buffer[0] = forward_dimension;
						this.buffer[1] = backward_dimension;
					}

					ConnectionCosts.prototype.put = function (forward_id, backward_id, cost) {
						var index = forward_id * this.backward_dimension + backward_id + 2;
						if (this.buffer.length < index + 1) {
							throw "ConnectionCosts buffer overflow";
						}
						this.buffer[index] = cost;
					};

					ConnectionCosts.prototype.get = function (forward_id, backward_id) {
						var index = forward_id * this.backward_dimension + backward_id + 2;
						if (this.buffer.length < index + 1) {
							throw "ConnectionCosts buffer overflow";
						}
						return this.buffer[index];
					};

					ConnectionCosts.prototype.loadConnectionCosts = function (connection_costs_buffer) {
						this.forward_dimension = connection_costs_buffer[0];
						this.backward_dimension = connection_costs_buffer[1];
						this.buffer = connection_costs_buffer;
					};

					module.exports = ConnectionCosts;
				},
				{}
			],
			8: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var doublearray = require("doublearray");
					var TokenInfoDictionary = require("./TokenInfoDictionary");
					var ConnectionCosts = require("./ConnectionCosts");
					var UnknownDictionary = require("./UnknownDictionary");

					/**
					 * Dictionaries container for Tokenizer
					 * @param {DoubleArray} trie
					 * @param {TokenInfoDictionary} token_info_dictionary
					 * @param {ConnectionCosts} connection_costs
					 * @param {UnknownDictionary} unknown_dictionary
					 * @constructor
					 */
					function DynamicDictionaries(trie, token_info_dictionary, connection_costs, unknown_dictionary) {
						if (trie != null) {
							this.trie = trie;
						} else {
							this.trie = doublearray.builder(0).build([{ k: "", v: 1 }]);
						}
						if (token_info_dictionary != null) {
							this.token_info_dictionary = token_info_dictionary;
						} else {
							this.token_info_dictionary = new TokenInfoDictionary();
						}
						if (connection_costs != null) {
							this.connection_costs = connection_costs;
						} else {
							// backward_size * backward_size
							this.connection_costs = new ConnectionCosts(0, 0);
						}
						if (unknown_dictionary != null) {
							this.unknown_dictionary = unknown_dictionary;
						} else {
							this.unknown_dictionary = new UnknownDictionary();
						}
					}

					// from base.dat & check.dat
					DynamicDictionaries.prototype.loadTrie = function (base_buffer, check_buffer) {
						this.trie = doublearray.load(base_buffer, check_buffer);
						return this;
					};

					DynamicDictionaries.prototype.loadTokenInfoDictionaries = function (token_info_buffer, pos_buffer, target_map_buffer) {
						this.token_info_dictionary.loadDictionary(token_info_buffer);
						this.token_info_dictionary.loadPosVector(pos_buffer);
						this.token_info_dictionary.loadTargetMap(target_map_buffer);
						return this;
					};

					DynamicDictionaries.prototype.loadConnectionCosts = function (cc_buffer) {
						this.connection_costs.loadConnectionCosts(cc_buffer);
						return this;
					};

					DynamicDictionaries.prototype.loadUnknownDictionaries = function (
						unk_buffer,
						unk_pos_buffer,
						unk_map_buffer,
						cat_map_buffer,
						compat_cat_map_buffer,
						invoke_def_buffer
					) {
						this.unknown_dictionary.loadUnknownDictionaries(
							unk_buffer,
							unk_pos_buffer,
							unk_map_buffer,
							cat_map_buffer,
							compat_cat_map_buffer,
							invoke_def_buffer
						);
						return this;
					};

					module.exports = DynamicDictionaries;
				},
				{ "./ConnectionCosts": 7, "./TokenInfoDictionary": 10, "./UnknownDictionary": 11, doublearray: 2 }
			],
			9: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var ByteBuffer = require("../util/ByteBuffer");
					var CharacterClass = require("./CharacterClass");

					/**
					 * InvokeDefinitionMap represents invoke definition a part of char.def
					 * @constructor
					 */
					function InvokeDefinitionMap() {
						this.map = [];
						this.lookup_table = {}; // Just for building dictionary
					}

					/**
					 * Load InvokeDefinitionMap from buffer
					 * @param {Uint8Array} invoke_def_buffer
					 * @returns {InvokeDefinitionMap}
					 */
					InvokeDefinitionMap.load = function (invoke_def_buffer) {
						var invoke_def = new InvokeDefinitionMap();
						var character_category_definition = [];

						var buffer = new ByteBuffer(invoke_def_buffer);
						while (buffer.position + 1 < buffer.size()) {
							var class_id = character_category_definition.length;
							var is_always_invoke = buffer.get();
							var is_grouping = buffer.get();
							var max_length = buffer.getInt();
							var class_name = buffer.getString();
							character_category_definition.push(new CharacterClass(class_id, class_name, is_always_invoke, is_grouping, max_length));
						}

						invoke_def.init(character_category_definition);

						return invoke_def;
					};

					/**
					 * Initializing method
					 * @param {Array.<CharacterClass>} character_category_definition Array of CharacterClass
					 */
					InvokeDefinitionMap.prototype.init = function (character_category_definition) {
						if (character_category_definition == null) {
							return;
						}
						for (var i = 0; i < character_category_definition.length; i++) {
							var character_class = character_category_definition[i];
							this.map[i] = character_class;
							this.lookup_table[character_class.class_name] = i;
						}
					};

					/**
					 * Get class information by class ID
					 * @param {number} class_id
					 * @returns {CharacterClass}
					 */
					InvokeDefinitionMap.prototype.getCharacterClass = function (class_id) {
						return this.map[class_id];
					};

					/**
					 * For building character definition dictionary
					 * @param {string} class_name character
					 * @returns {number} class_id
					 */
					InvokeDefinitionMap.prototype.lookup = function (class_name) {
						var class_id = this.lookup_table[class_name];
						if (class_id == null) {
							return null;
						}
						return class_id;
					};

					/**
					 * Transform from map to binary buffer
					 * @returns {Uint8Array}
					 */
					InvokeDefinitionMap.prototype.toBuffer = function () {
						var buffer = new ByteBuffer();
						for (var i = 0; i < this.map.length; i++) {
							var char_class = this.map[i];
							buffer.put(char_class.is_always_invoke);
							buffer.put(char_class.is_grouping);
							buffer.putInt(char_class.max_length);
							buffer.putString(char_class.class_name);
						}
						buffer.shrink();
						return buffer.buffer;
					};

					module.exports = InvokeDefinitionMap;
				},
				{ "../util/ByteBuffer": 18, "./CharacterClass": 5 }
			],
			10: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var ByteBuffer = require("../util/ByteBuffer");

					/**
					 * TokenInfoDictionary
					 * @constructor
					 */
					function TokenInfoDictionary() {
						this.dictionary = new ByteBuffer(10 * 1024 * 1024);
						this.target_map = {}; // trie_id (of surface form) -> token_info_id (of token)
						this.pos_buffer = new ByteBuffer(10 * 1024 * 1024);
					}

					// left_id right_id word_cost ...
					// ^ this position is token_info_id
					TokenInfoDictionary.prototype.buildDictionary = function (entries) {
						var dictionary_entries = {}; // using as hashmap, string -> string (word_id -> surface_form) to build dictionary

						for (var i = 0; i < entries.length; i++) {
							var entry = entries[i];

							if (entry.length < 4) {
								continue;
							}

							var surface_form = entry[0];
							var left_id = entry[1];
							var right_id = entry[2];
							var word_cost = entry[3];
							var feature = entry.slice(4).join(","); // TODO Optimize

							// Assertion
							if (!isFinite(left_id) || !isFinite(right_id) || !isFinite(word_cost)) {
								console.log(entry);
							}

							var token_info_id = this.put(left_id, right_id, word_cost, surface_form, feature);
							dictionary_entries[token_info_id] = surface_form;
						}

						// Remove last unused area
						this.dictionary.shrink();
						this.pos_buffer.shrink();

						return dictionary_entries;
					};

					TokenInfoDictionary.prototype.put = function (left_id, right_id, word_cost, surface_form, feature) {
						var token_info_id = this.dictionary.position;
						var pos_id = this.pos_buffer.position;

						this.dictionary.putShort(left_id);
						this.dictionary.putShort(right_id);
						this.dictionary.putShort(word_cost);
						this.dictionary.putInt(pos_id);
						this.pos_buffer.putString(surface_form + "," + feature);

						return token_info_id;
					};

					TokenInfoDictionary.prototype.addMapping = function (source, target) {
						var mapping = this.target_map[source];
						if (mapping == null) {
							mapping = [];
						}
						mapping.push(target);

						this.target_map[source] = mapping;
					};

					TokenInfoDictionary.prototype.targetMapToBuffer = function () {
						var buffer = new ByteBuffer();
						var map_keys_size = Object.keys(this.target_map).length;
						buffer.putInt(map_keys_size);
						for (var key in this.target_map) {
							var values = this.target_map[key]; // Array
							var map_values_size = values.length;
							buffer.putInt(parseInt(key));
							buffer.putInt(map_values_size);
							for (var i = 0; i < values.length; i++) {
								buffer.putInt(values[i]);
							}
						}
						return buffer.shrink(); // Shrink-ed Typed Array
					};

					// from tid.dat
					TokenInfoDictionary.prototype.loadDictionary = function (array_buffer) {
						this.dictionary = new ByteBuffer(array_buffer);
						return this;
					};

					// from tid_pos.dat
					TokenInfoDictionary.prototype.loadPosVector = function (array_buffer) {
						this.pos_buffer = new ByteBuffer(array_buffer);
						return this;
					};

					// from tid_map.dat
					TokenInfoDictionary.prototype.loadTargetMap = function (array_buffer) {
						var buffer = new ByteBuffer(array_buffer);
						buffer.position = 0;
						this.target_map = {};
						buffer.readInt(); // map_keys_size
						while (true) {
							if (buffer.buffer.length < buffer.position + 1) {
								break;
							}
							var key = buffer.readInt();
							var map_values_size = buffer.readInt();
							for (var i = 0; i < map_values_size; i++) {
								var value = buffer.readInt();
								this.addMapping(key, value);
							}
						}
						return this;
					};

					/**
					 * Look up features in the dictionary
					 * @param {string} token_info_id_str Word ID to look up
					 * @returns {string} Features string concatenated by ","
					 */
					TokenInfoDictionary.prototype.getFeatures = function (token_info_id_str) {
						var token_info_id = parseInt(token_info_id_str);
						if (isNaN(token_info_id)) {
							// TODO throw error
							return "";
						}
						var pos_id = this.dictionary.getInt(token_info_id + 6);
						return this.pos_buffer.getString(pos_id);
					};

					module.exports = TokenInfoDictionary;
				},
				{ "../util/ByteBuffer": 18 }
			],
			11: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var TokenInfoDictionary = require("./TokenInfoDictionary");
					var CharacterDefinition = require("./CharacterDefinition");
					var ByteBuffer = require("../util/ByteBuffer");

					/**
					 * UnknownDictionary
					 * @constructor
					 */
					function UnknownDictionary() {
						this.dictionary = new ByteBuffer(10 * 1024 * 1024);
						this.target_map = {}; // class_id (of CharacterClass) -> token_info_id (of unknown class)
						this.pos_buffer = new ByteBuffer(10 * 1024 * 1024);
						this.character_definition = null;
					}

					// Inherit from TokenInfoDictionary as a super class
					UnknownDictionary.prototype = Object.create(TokenInfoDictionary.prototype);

					UnknownDictionary.prototype.characterDefinition = function (character_definition) {
						this.character_definition = character_definition;
						return this;
					};

					UnknownDictionary.prototype.lookup = function (ch) {
						return this.character_definition.lookup(ch);
					};

					UnknownDictionary.prototype.lookupCompatibleCategory = function (ch) {
						return this.character_definition.lookupCompatibleCategory(ch);
					};

					UnknownDictionary.prototype.loadUnknownDictionaries = function (
						unk_buffer,
						unk_pos_buffer,
						unk_map_buffer,
						cat_map_buffer,
						compat_cat_map_buffer,
						invoke_def_buffer
					) {
						this.loadDictionary(unk_buffer);
						this.loadPosVector(unk_pos_buffer);
						this.loadTargetMap(unk_map_buffer);
						this.character_definition = CharacterDefinition.load(cat_map_buffer, compat_cat_map_buffer, invoke_def_buffer);
					};

					module.exports = UnknownDictionary;
				},
				{ "../util/ByteBuffer": 18, "./CharacterDefinition": 6, "./TokenInfoDictionary": 10 }
			],
			12: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var CharacterDefinition = require("../CharacterDefinition");
					var InvokeDefinitionMap = require("../InvokeDefinitionMap");

					var CATEGORY_DEF_PATTERN = /^(\w+)\s+(\d)\s+(\d)\s+(\d)/;
					var CATEGORY_MAPPING_PATTERN = /^(0x[0-9A-F]{4})(?:\s+([^#\s]+))(?:\s+([^#\s]+))*/;
					var RANGE_CATEGORY_MAPPING_PATTERN = /^(0x[0-9A-F]{4})\.\.(0x[0-9A-F]{4})(?:\s+([^#\s]+))(?:\s+([^#\s]+))*/;

					/**
					 * CharacterDefinitionBuilder
					 * @constructor
					 */
					function CharacterDefinitionBuilder() {
						this.char_def = new CharacterDefinition();
						this.char_def.invoke_definition_map = new InvokeDefinitionMap();
						this.character_category_definition = [];
						this.category_mapping = [];
					}

					CharacterDefinitionBuilder.prototype.putLine = function (line) {
						var parsed_category_def = CATEGORY_DEF_PATTERN.exec(line);
						if (parsed_category_def != null) {
							var class_id = this.character_category_definition.length;
							var char_class = CharacterDefinition.parseCharCategory(class_id, parsed_category_def);
							if (char_class == null) {
								return;
							}
							this.character_category_definition.push(char_class);
							return;
						}
						var parsed_category_mapping = CATEGORY_MAPPING_PATTERN.exec(line);
						if (parsed_category_mapping != null) {
							var mapping = CharacterDefinition.parseCategoryMapping(parsed_category_mapping);
							this.category_mapping.push(mapping);
						}
						var parsed_range_category_mapping = RANGE_CATEGORY_MAPPING_PATTERN.exec(line);
						if (parsed_range_category_mapping != null) {
							var range_mapping = CharacterDefinition.parseRangeCategoryMapping(parsed_range_category_mapping);
							this.category_mapping.push(range_mapping);
						}
					};

					CharacterDefinitionBuilder.prototype.build = function () {
						// TODO If DEFAULT category does not exist, throw error
						this.char_def.invoke_definition_map.init(this.character_category_definition);
						this.char_def.initCategoryMappings(this.category_mapping);
						return this.char_def;
					};

					module.exports = CharacterDefinitionBuilder;
				},
				{ "../CharacterDefinition": 6, "../InvokeDefinitionMap": 9 }
			],
			13: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var ConnectionCosts = require("../ConnectionCosts");

					/**
					 * Builder class for constructing ConnectionCosts object
					 * @constructor
					 */
					function ConnectionCostsBuilder() {
						this.lines = 0;
						this.connection_cost = null;
					}

					ConnectionCostsBuilder.prototype.putLine = function (line) {
						if (this.lines === 0) {
							var dimensions = line.split(" ");
							var forward_dimension = dimensions[0];
							var backward_dimension = dimensions[1];

							if (forward_dimension < 0 || backward_dimension < 0) {
								throw "Parse error of matrix.def";
							}

							this.connection_cost = new ConnectionCosts(forward_dimension, backward_dimension);
							this.lines++;
							return this;
						}

						var costs = line.split(" ");

						if (costs.length !== 3) {
							return this;
						}

						var forward_id = parseInt(costs[0]);
						var backward_id = parseInt(costs[1]);
						var cost = parseInt(costs[2]);

						if (
							forward_id < 0 ||
							backward_id < 0 ||
							!isFinite(forward_id) ||
							!isFinite(backward_id) ||
							this.connection_cost.forward_dimension <= forward_id ||
							this.connection_cost.backward_dimension <= backward_id
						) {
							throw "Parse error of matrix.def";
						}

						this.connection_cost.put(forward_id, backward_id, cost);
						this.lines++;
						return this;
					};

					ConnectionCostsBuilder.prototype.build = function () {
						return this.connection_cost;
					};

					module.exports = ConnectionCostsBuilder;
				},
				{ "../ConnectionCosts": 7 }
			],
			14: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var doublearray = require("doublearray");
					var DynamicDictionaries = require("../DynamicDictionaries");
					var TokenInfoDictionary = require("../TokenInfoDictionary");
					var ConnectionCostsBuilder = require("./ConnectionCostsBuilder");
					var CharacterDefinitionBuilder = require("./CharacterDefinitionBuilder");
					var UnknownDictionary = require("../UnknownDictionary");

					/**
					 * Build dictionaries (token info, connection costs)
					 *
					 * Generates from matrix.def
					 * cc.dat: Connection costs
					 *
					 * Generates from *.csv
					 * dat.dat: Double array
					 * tid.dat: Token info dictionary
					 * tid_map.dat: targetMap
					 * tid_pos.dat: posList (part of speech)
					 */
					function DictionaryBuilder() {
						// Array of entries, each entry in Mecab form
						// (0: surface form, 1: left id, 2: right id, 3: word cost, 4: part of speech id, 5-: other features)
						this.tid_entries = [];
						this.unk_entries = [];
						this.cc_builder = new ConnectionCostsBuilder();
						this.cd_builder = new CharacterDefinitionBuilder();
					}

					DictionaryBuilder.prototype.addTokenInfoDictionary = function (line) {
						var new_entry = line.split(",");
						this.tid_entries.push(new_entry);
						return this;
					};

					/**
					 * Put one line of "matrix.def" file for building ConnectionCosts object
					 * @param {string} line is a line of "matrix.def"
					 */
					DictionaryBuilder.prototype.putCostMatrixLine = function (line) {
						this.cc_builder.putLine(line);
						return this;
					};

					DictionaryBuilder.prototype.putCharDefLine = function (line) {
						this.cd_builder.putLine(line);
						return this;
					};

					/**
					 * Put one line of "unk.def" file for building UnknownDictionary object
					 * @param {string} line is a line of "unk.def"
					 */
					DictionaryBuilder.prototype.putUnkDefLine = function (line) {
						this.unk_entries.push(line.split(","));
						return this;
					};

					DictionaryBuilder.prototype.build = function () {
						var dictionaries = this.buildTokenInfoDictionary();
						var unknown_dictionary = this.buildUnknownDictionary();

						return new DynamicDictionaries(dictionaries.trie, dictionaries.token_info_dictionary, this.cc_builder.build(), unknown_dictionary);
					};

					/**
					 * Build TokenInfoDictionary
					 *
					 * @returns {{trie: *, token_info_dictionary: *}}
					 */
					DictionaryBuilder.prototype.buildTokenInfoDictionary = function () {
						var token_info_dictionary = new TokenInfoDictionary();

						// using as hashmap, string -> string (word_id -> surface_form) to build dictionary
						var dictionary_entries = token_info_dictionary.buildDictionary(this.tid_entries);

						var trie = this.buildDoubleArray();

						for (var token_info_id in dictionary_entries) {
							var surface_form = dictionary_entries[token_info_id];
							var trie_id = trie.lookup(surface_form);

							// Assertion
							// if (trie_id < 0) {
							//     console.log("Not Found:" + surface_form);
							// }

							token_info_dictionary.addMapping(trie_id, token_info_id);
						}

						return {
							trie: trie,
							token_info_dictionary: token_info_dictionary
						};
					};

					DictionaryBuilder.prototype.buildUnknownDictionary = function () {
						var unk_dictionary = new UnknownDictionary();

						// using as hashmap, string -> string (word_id -> surface_form) to build dictionary
						var dictionary_entries = unk_dictionary.buildDictionary(this.unk_entries);

						var char_def = this.cd_builder.build(); // Create CharacterDefinition

						unk_dictionary.characterDefinition(char_def);

						for (var token_info_id in dictionary_entries) {
							var class_name = dictionary_entries[token_info_id];
							var class_id = char_def.invoke_definition_map.lookup(class_name);

							// Assertion
							// if (trie_id < 0) {
							//     console.log("Not Found:" + surface_form);
							// }

							unk_dictionary.addMapping(class_id, token_info_id);
						}

						return unk_dictionary;
					};

					/**
					 * Build double array trie
					 *
					 * @returns {DoubleArray} Double-Array trie
					 */
					DictionaryBuilder.prototype.buildDoubleArray = function () {
						var trie_id = 0;
						var words = this.tid_entries.map(function (entry) {
							var surface_form = entry[0];
							return { k: surface_form, v: trie_id++ };
						});

						var builder = doublearray.builder(1024 * 1024);
						return builder.build(words);
					};

					module.exports = DictionaryBuilder;
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
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var TokenizerBuilder = require("./TokenizerBuilder");
					var DictionaryBuilder = require("./dict/builder/DictionaryBuilder");

					// Public methods
					var kuromoji = {
						builder: function (option) {
							return new TokenizerBuilder(option);
						},
						dictionaryBuilder: function () {
							return new DictionaryBuilder();
						}
					};

					module.exports = kuromoji;
				},
				{ "./TokenizerBuilder": 4, "./dict/builder/DictionaryBuilder": 14 }
			],
			16: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var zlib = require("zlibjs/bin/gunzip.min.js");
					var DictionaryLoader = require("./DictionaryLoader");

					/**
					 * BrowserDictionaryLoader inherits DictionaryLoader, using jQuery XHR for download
					 * @param {string} dic_path Dictionary path
					 * @constructor
					 */
					function BrowserDictionaryLoader(dic_path) {
						DictionaryLoader.apply(this, [dic_path]);
					}

					BrowserDictionaryLoader.prototype = Object.create(DictionaryLoader.prototype);

					/**
					 * Utility function to load gzipped dictionary
					 * @param {string} url Dictionary URL
					 * @param {BrowserDictionaryLoader~onLoad} callback Callback function
					 */

					function base64ToArrayBuffer(base64) {
						var binary_string = window.atob(base64);
						var len = binary_string.length;
						var bytes = new Uint8Array(len);
						for (var i = 0; i < len; i++) {
							bytes[i] = binary_string.charCodeAt(i);
						}
						return bytes.buffer;
					}

					function arrayBufferToBase64(buffer) {
						var binary = "";
						var bytes = new Uint8Array(buffer);
						var len = bytes.byteLength;
						for (var i = 0; i < len; i++) {
							binary += String.fromCharCode(bytes[i]);
						}
						return window.btoa(binary);
					}

					function exportToBase64(arraybuffer, filename) {
						var base64String = arrayBufferToBase64(arraybuffer);

						let dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(base64String);

						let exportFileDefaultName = filename + ".txt";

						let linkElement = document.createElement("a");
						linkElement.setAttribute("href", dataUri);
						linkElement.setAttribute("download", exportFileDefaultName);
						linkElement.click();
					}

					BrowserDictionaryLoader.prototype.loadArrayBuffer = function (url, callback, from_string = false, string = null) {
						if (from_string) {
							var arraybuffer = base64ToArrayBuffer(string);
							var gz = new zlib.Zlib.Gunzip(new Uint8Array(arraybuffer));
							var typed_array = gz.decompress();
							callback(null, typed_array.buffer);
							return;
						}
						var xhr = new XMLHttpRequest();
						xhr.open("GET", url, true);
						xhr.responseType = "arraybuffer";
						xhr.onload = function () {
							if (this.status > 0 && this.status !== 200) {
								callback(xhr.statusText, null);
								return;
							}
							var arraybuffer = this.response;
							//exportToBase64(arraybuffer, url);
							var gz = new zlib.Zlib.Gunzip(new Uint8Array(arraybuffer));
							var typed_array = gz.decompress();
							callback(null, typed_array.buffer);
						};
						xhr.onerror = function (err) {
							callback(err, null);
						};
						xhr.send();
					};

					/**
					 * Callback
					 * @callback BrowserDictionaryLoader~onLoad
					 * @param {Object} err Error object
					 * @param {Uint8Array} buffer Loaded buffer
					 */

					module.exports = BrowserDictionaryLoader;
				},
				{ "./DictionaryLoader": 17, "zlibjs/bin/gunzip.min.js": 28 }
			],
			17: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var path = require("path");
					var async = require("async");
					var DynamicDictionaries = require("../dict/DynamicDictionaries");

					/**
					 * DictionaryLoader base constructor
					 * @param {string} dic_path Dictionary path
					 * @constructor
					 */
					function DictionaryLoader(dic_path) {
						this.dic = new DynamicDictionaries();
						this.dic_path = dic_path;
					}

					DictionaryLoader.prototype.loadArrayBuffer = function (file, callback, from_string = false, string = null) {
						throw new Error("DictionaryLoader#loadArrayBuffer should be overwrite");
					};

					/**
					 * Load dictionary files
					 * @param {DictionaryLoader~onLoad} load_callback Callback function called after loaded
					 */
					DictionaryLoader.prototype.load = function (load_callback) {
						var dic = this.dic;
						var dic_path = this.dic_path;
						var loadArrayBuffer = this.loadArrayBuffer;

						async.parallel(
							[
								// Trie
								function (callback) {
									async.map(
										[base_dat_gz, check_dat_gz],
										function (base64, _callback) {
											loadArrayBuffer(
												null,
												function (err, buffer) {
													if (err) {
														return _callback(err);
													}
													_callback(null, buffer);
												},
												true,
												base64
											);
										},
										function (err, buffers) {
											if (err) {
												return callback(err);
											}
											var base_buffer = new Int32Array(buffers[0]);
											var check_buffer = new Int32Array(buffers[1]);

											dic.loadTrie(base_buffer, check_buffer);
											callback(null);
										}
									);
								},
								// Token info dictionaries
								function (callback) {
									async.map(
										[tid_dat_gz, tid_pos_dat_gz, tid_map_dat_gz],
										function (base64, _callback) {
											loadArrayBuffer(
												null,
												function (err, buffer) {
													if (err) {
														return _callback(err);
													}
													_callback(null, buffer);
												},
												true,
												base64
											);
										},
										function (err, buffers) {
											if (err) {
												return callback(err);
											}
											var token_info_buffer = new Uint8Array(buffers[0]);
											var pos_buffer = new Uint8Array(buffers[1]);
											var target_map_buffer = new Uint8Array(buffers[2]);

											dic.loadTokenInfoDictionaries(token_info_buffer, pos_buffer, target_map_buffer);
											callback(null);
										}
									);
								},
								// Connection cost matrix
								function (callback) {
									loadArrayBuffer(
										null,
										function (err, buffer) {
											if (err) {
												return callback(err);
											}
											var cc_buffer = new Int16Array(buffer);
											dic.loadConnectionCosts(cc_buffer);
											callback(null);
										},
										true,
										cc_dat_gz
									);
								},
								// Unknown dictionaries
								function (callback) {
									async.map(
										[unk_dat_gz, unk_pos_dat_gz, unk_map_dat_gz, unk_char_dat_gz, unk_compat_dat_gz, unk_invoke_data_gz],
										function (base64, _callback) {
											loadArrayBuffer(
												null,
												function (err, buffer) {
													if (err) {
														return _callback(err);
													}
													_callback(null, buffer);
												},
												true,
												base64
											);
										},
										function (err, buffers) {
											if (err) {
												return callback(err);
											}
											var unk_buffer = new Uint8Array(buffers[0]);
											var unk_pos_buffer = new Uint8Array(buffers[1]);
											var unk_map_buffer = new Uint8Array(buffers[2]);
											var cat_map_buffer = new Uint8Array(buffers[3]);
											var compat_cat_map_buffer = new Uint32Array(buffers[4]);
											var invoke_def_buffer = new Uint8Array(buffers[5]);

											dic.loadUnknownDictionaries(
												unk_buffer,
												unk_pos_buffer,
												unk_map_buffer,
												cat_map_buffer,
												compat_cat_map_buffer,
												invoke_def_buffer
											);
											// dic.loadUnknownDictionaries(char_buffer, unk_buffer);
											callback(null);
										}
									);
								}
							],
							function (err) {
								load_callback(err, dic);
							}
						);
					};

					/**
					 * Callback
					 * @callback DictionaryLoader~onLoad
					 * @param {Object} err Error object
					 * @param {DynamicDictionaries} dic Loaded dictionary
					 */

					module.exports = DictionaryLoader;
				},
				{ "../dict/DynamicDictionaries": 8, async: 1, path: 25 }
			],
			18: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * Convert String (UTF-16) to UTF-8 ArrayBuffer
					 *
					 * @param {String} str UTF-16 string to convert
					 * @return {Uint8Array} Byte sequence encoded by UTF-8
					 */
					var stringToUtf8Bytes = function (str) {
						// Max size of 1 character is 4 bytes
						var bytes = new Uint8Array(str.length * 4);

						var i = 0,
							j = 0;

						while (i < str.length) {
							var unicode_code;

							var utf16_code = str.charCodeAt(i++);
							if (utf16_code >= 0xd800 && utf16_code <= 0xdbff) {
								// surrogate pair
								var upper = utf16_code; // high surrogate
								var lower = str.charCodeAt(i++); // low surrogate

								if (lower >= 0xdc00 && lower <= 0xdfff) {
									unicode_code = (upper - 0xd800) * (1 << 10) + (1 << 16) + (lower - 0xdc00);
								} else {
									// malformed surrogate pair
									return null;
								}
							} else {
								// not surrogate code
								unicode_code = utf16_code;
							}

							if (unicode_code < 0x80) {
								// 1-byte
								bytes[j++] = unicode_code;
							} else if (unicode_code < 1 << 11) {
								// 2-byte
								bytes[j++] = (unicode_code >>> 6) | 0xc0;
								bytes[j++] = (unicode_code & 0x3f) | 0x80;
							} else if (unicode_code < 1 << 16) {
								// 3-byte
								bytes[j++] = (unicode_code >>> 12) | 0xe0;
								bytes[j++] = ((unicode_code >> 6) & 0x3f) | 0x80;
								bytes[j++] = (unicode_code & 0x3f) | 0x80;
							} else if (unicode_code < 1 << 21) {
								// 4-byte
								bytes[j++] = (unicode_code >>> 18) | 0xf0;
								bytes[j++] = ((unicode_code >> 12) & 0x3f) | 0x80;
								bytes[j++] = ((unicode_code >> 6) & 0x3f) | 0x80;
								bytes[j++] = (unicode_code & 0x3f) | 0x80;
							} else {
								// malformed UCS4 code
							}
						}

						return bytes.subarray(0, j);
					};

					/**
					 * Convert UTF-8 ArrayBuffer to String (UTF-16)
					 *
					 * @param {Array} bytes UTF-8 byte sequence to convert
					 * @return {String} String encoded by UTF-16
					 */
					var utf8BytesToString = function (bytes) {
						var str = "";
						var code, b1, b2, b3, b4, upper, lower;
						var i = 0;

						while (i < bytes.length) {
							b1 = bytes[i++];

							if (b1 < 0x80) {
								// 1 byte
								code = b1;
							} else if (b1 >> 5 === 0x06) {
								// 2 bytes
								b2 = bytes[i++];
								code = ((b1 & 0x1f) << 6) | (b2 & 0x3f);
							} else if (b1 >> 4 === 0x0e) {
								// 3 bytes
								b2 = bytes[i++];
								b3 = bytes[i++];
								code = ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
							} else {
								// 4 bytes
								b2 = bytes[i++];
								b3 = bytes[i++];
								b4 = bytes[i++];
								code = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
							}

							if (code < 0x10000) {
								str += String.fromCharCode(code);
							} else {
								// surrogate pair
								code -= 0x10000;
								upper = 0xd800 | (code >> 10);
								lower = 0xdc00 | (code & 0x3ff);
								str += String.fromCharCode(upper, lower);
							}
						}

						return str;
					};

					/**
					 * Utilities to manipulate byte sequence
					 * @param {(number|Uint8Array)} arg Initial size of this buffer (number), or buffer to set (Uint8Array)
					 * @constructor
					 */
					function ByteBuffer(arg) {
						var initial_size;
						if (arg == null) {
							initial_size = 1024 * 1024;
						} else if (typeof arg === "number") {
							initial_size = arg;
						} else if (arg instanceof Uint8Array) {
							this.buffer = arg;
							this.position = 0; // Overwrite
							return;
						} else {
							// typeof arg -> String
							throw typeof arg + " is invalid parameter type for ByteBuffer constructor";
						}
						// arg is null or number
						this.buffer = new Uint8Array(initial_size);
						this.position = 0;
					}

					ByteBuffer.prototype.size = function () {
						return this.buffer.length;
					};

					ByteBuffer.prototype.reallocate = function () {
						var new_array = new Uint8Array(this.buffer.length * 2);
						new_array.set(this.buffer);
						this.buffer = new_array;
					};

					ByteBuffer.prototype.shrink = function () {
						this.buffer = this.buffer.subarray(0, this.position);
						return this.buffer;
					};

					ByteBuffer.prototype.put = function (b) {
						if (this.buffer.length < this.position + 1) {
							this.reallocate();
						}
						this.buffer[this.position++] = b;
					};

					ByteBuffer.prototype.get = function (index) {
						if (index == null) {
							index = this.position;
							this.position += 1;
						}
						if (this.buffer.length < index + 1) {
							return 0;
						}
						return this.buffer[index];
					};

					// Write short to buffer by little endian
					ByteBuffer.prototype.putShort = function (num) {
						if (0xffff < num) {
							throw num + " is over short value";
						}
						var lower = 0x00ff & num;
						var upper = (0xff00 & num) >> 8;
						this.put(lower);
						this.put(upper);
					};

					// Read short from buffer by little endian
					ByteBuffer.prototype.getShort = function (index) {
						if (index == null) {
							index = this.position;
							this.position += 2;
						}
						if (this.buffer.length < index + 2) {
							return 0;
						}
						var lower = this.buffer[index];
						var upper = this.buffer[index + 1];
						var value = (upper << 8) + lower;
						if (value & 0x8000) {
							value = -((value - 1) ^ 0xffff);
						}
						return value;
					};

					// Write integer to buffer by little endian
					ByteBuffer.prototype.putInt = function (num) {
						if (0xffffffff < num) {
							throw num + " is over integer value";
						}
						var b0 = 0x000000ff & num;
						var b1 = (0x0000ff00 & num) >> 8;
						var b2 = (0x00ff0000 & num) >> 16;
						var b3 = (0xff000000 & num) >> 24;
						this.put(b0);
						this.put(b1);
						this.put(b2);
						this.put(b3);
					};

					// Read integer from buffer by little endian
					ByteBuffer.prototype.getInt = function (index) {
						if (index == null) {
							index = this.position;
							this.position += 4;
						}
						if (this.buffer.length < index + 4) {
							return 0;
						}
						var b0 = this.buffer[index];
						var b1 = this.buffer[index + 1];
						var b2 = this.buffer[index + 2];
						var b3 = this.buffer[index + 3];

						return (b3 << 24) + (b2 << 16) + (b1 << 8) + b0;
					};

					ByteBuffer.prototype.readInt = function () {
						var pos = this.position;
						this.position += 4;
						return this.getInt(pos);
					};

					ByteBuffer.prototype.putString = function (str) {
						var bytes = stringToUtf8Bytes(str);
						for (var i = 0; i < bytes.length; i++) {
							this.put(bytes[i]);
						}
						// put null character as terminal character
						this.put(0);
					};

					ByteBuffer.prototype.getString = function (index) {
						var buf = [],
							ch;
						if (index == null) {
							index = this.position;
						}
						while (true) {
							if (this.buffer.length < index + 1) {
								break;
							}
							ch = this.get(index++);
							if (ch === 0) {
								break;
							} else {
								buf.push(ch);
							}
						}
						this.position = index;
						return utf8BytesToString(buf);
					};

					module.exports = ByteBuffer;
				},
				{}
			],
			19: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * Mappings between IPADIC dictionary features and tokenized results
					 * @constructor
					 */
					function IpadicFormatter() {}

					IpadicFormatter.prototype.formatEntry = function (word_id, position, type, features) {
						var token = {};
						token.word_id = word_id;
						token.word_type = type;
						token.word_position = position;

						token.surface_form = features[0];
						token.pos = features[1];
						token.pos_detail_1 = features[2];
						token.pos_detail_2 = features[3];
						token.pos_detail_3 = features[4];
						token.conjugated_type = features[5];
						token.conjugated_form = features[6];
						token.basic_form = features[7];
						token.reading = features[8];
						token.pronunciation = features[9];

						return token;
					};

					IpadicFormatter.prototype.formatUnknownEntry = function (word_id, position, type, features, surface_form) {
						var token = {};
						token.word_id = word_id;
						token.word_type = type;
						token.word_position = position;

						token.surface_form = surface_form;
						token.pos = features[1];
						token.pos_detail_1 = features[2];
						token.pos_detail_2 = features[3];
						token.pos_detail_3 = features[4];
						token.conjugated_type = features[5];
						token.conjugated_form = features[6];
						token.basic_form = features[7];
						// token.reading = features[8];
						// token.pronunciation = features[9];

						return token;
					};

					module.exports = IpadicFormatter;
				},
				{}
			],
			20: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * String wrapper for UTF-16 surrogate pair (4 bytes)
					 * @param {string} str String to wrap
					 * @constructor
					 */
					function SurrogateAwareString(str) {
						this.str = str;
						this.index_mapping = [];

						for (var pos = 0; pos < str.length; pos++) {
							var ch = str.charAt(pos);
							this.index_mapping.push(pos);
							if (SurrogateAwareString.isSurrogatePair(ch)) {
								pos++;
							}
						}
						// Surrogate aware length
						this.length = this.index_mapping.length;
					}

					SurrogateAwareString.prototype.slice = function (index) {
						if (this.index_mapping.length <= index) {
							return "";
						}
						var surrogate_aware_index = this.index_mapping[index];
						return this.str.slice(surrogate_aware_index);
					};

					SurrogateAwareString.prototype.charAt = function (index) {
						if (this.str.length <= index) {
							return "";
						}
						var surrogate_aware_start_index = this.index_mapping[index];
						var surrogate_aware_end_index = this.index_mapping[index + 1];

						if (surrogate_aware_end_index == null) {
							return this.str.slice(surrogate_aware_start_index);
						}
						return this.str.slice(surrogate_aware_start_index, surrogate_aware_end_index);
					};

					SurrogateAwareString.prototype.charCodeAt = function (index) {
						if (this.index_mapping.length <= index) {
							return NaN;
						}
						var surrogate_aware_index = this.index_mapping[index];
						var upper = this.str.charCodeAt(surrogate_aware_index);
						var lower;
						if (upper >= 0xd800 && upper <= 0xdbff && surrogate_aware_index < this.str.length) {
							lower = this.str.charCodeAt(surrogate_aware_index + 1);
							if (lower >= 0xdc00 && lower <= 0xdfff) {
								return (upper - 0xd800) * 0x400 + lower - 0xdc00 + 0x10000;
							}
						}
						return upper;
					};

					SurrogateAwareString.prototype.toString = function () {
						return this.str;
					};

					SurrogateAwareString.isSurrogatePair = function (ch) {
						var utf16_code = ch.charCodeAt(0);
						if (utf16_code >= 0xd800 && utf16_code <= 0xdbff) {
							// surrogate pair
							return true;
						} else {
							return false;
						}
					};

					module.exports = SurrogateAwareString;
				},
				{}
			],
			21: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var ViterbiNode = require("./ViterbiNode");
					var ViterbiLattice = require("./ViterbiLattice");
					var SurrogateAwareString = require("../util/SurrogateAwareString");

					/**
					 * ViterbiBuilder builds word lattice (ViterbiLattice)
					 * @param {DynamicDictionaries} dic dictionary
					 * @constructor
					 */
					function ViterbiBuilder(dic) {
						this.trie = dic.trie;
						this.token_info_dictionary = dic.token_info_dictionary;
						this.unknown_dictionary = dic.unknown_dictionary;
					}

					/**
					 * Build word lattice
					 * @param {string} sentence_str Input text
					 * @returns {ViterbiLattice} Word lattice
					 */
					ViterbiBuilder.prototype.build = function (sentence_str) {
						var lattice = new ViterbiLattice();
						var sentence = new SurrogateAwareString(sentence_str);

						var key, trie_id, left_id, right_id, word_cost;
						for (var pos = 0; pos < sentence.length; pos++) {
							var tail = sentence.slice(pos);
							var vocabulary = this.trie.commonPrefixSearch(tail);
							for (var n = 0; n < vocabulary.length; n++) {
								// Words in dictionary do not have surrogate pair (only UCS2 set)
								trie_id = vocabulary[n].v;
								key = vocabulary[n].k;

								var token_info_ids = this.token_info_dictionary.target_map[trie_id];
								for (var i = 0; i < token_info_ids.length; i++) {
									var token_info_id = parseInt(token_info_ids[i]);

									left_id = this.token_info_dictionary.dictionary.getShort(token_info_id);
									right_id = this.token_info_dictionary.dictionary.getShort(token_info_id + 2);
									word_cost = this.token_info_dictionary.dictionary.getShort(token_info_id + 4);

									// node_name, cost, start_index, length, type, left_id, right_id, surface_form
									lattice.append(new ViterbiNode(token_info_id, word_cost, pos + 1, key.length, "KNOWN", left_id, right_id, key));
								}
							}

							// Unknown word processing
							var surrogate_aware_tail = new SurrogateAwareString(tail);
							var head_char = new SurrogateAwareString(surrogate_aware_tail.charAt(0));
							var head_char_class = this.unknown_dictionary.lookup(head_char.toString());
							if (vocabulary == null || vocabulary.length === 0 || head_char_class.is_always_invoke === 1) {
								// Process unknown word
								key = head_char;
								if (head_char_class.is_grouping === 1 && 1 < surrogate_aware_tail.length) {
									for (var k = 1; k < surrogate_aware_tail.length; k++) {
										var next_char = surrogate_aware_tail.charAt(k);
										var next_char_class = this.unknown_dictionary.lookup(next_char);
										if (head_char_class.class_name !== next_char_class.class_name) {
											break;
										}
										key += next_char;
									}
								}

								var unk_ids = this.unknown_dictionary.target_map[head_char_class.class_id];
								for (var j = 0; j < unk_ids.length; j++) {
									var unk_id = parseInt(unk_ids[j]);

									left_id = this.unknown_dictionary.dictionary.getShort(unk_id);
									right_id = this.unknown_dictionary.dictionary.getShort(unk_id + 2);
									word_cost = this.unknown_dictionary.dictionary.getShort(unk_id + 4);

									// node_name, cost, start_index, length, type, left_id, right_id, surface_form
									lattice.append(new ViterbiNode(unk_id, word_cost, pos + 1, key.length, "UNKNOWN", left_id, right_id, key.toString()));
								}
							}
						}
						lattice.appendEos();

						return lattice;
					};

					module.exports = ViterbiBuilder;
				},
				{ "../util/SurrogateAwareString": 20, "./ViterbiLattice": 22, "./ViterbiNode": 23 }
			],
			22: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					var ViterbiNode = require("./ViterbiNode");

					/**
					 * ViterbiLattice is a lattice in Viterbi algorithm
					 * @constructor
					 */
					function ViterbiLattice() {
						this.nodes_end_at = [];
						this.nodes_end_at[0] = [new ViterbiNode(-1, 0, 0, 0, "BOS", 0, 0, "")];
						this.eos_pos = 1;
					}

					/**
					 * Append node to ViterbiLattice
					 * @param {ViterbiNode} node
					 */
					ViterbiLattice.prototype.append = function (node) {
						var last_pos = node.start_pos + node.length - 1;
						if (this.eos_pos < last_pos) {
							this.eos_pos = last_pos;
						}

						var prev_nodes = this.nodes_end_at[last_pos];
						if (prev_nodes == null) {
							prev_nodes = [];
						}
						prev_nodes.push(node);

						this.nodes_end_at[last_pos] = prev_nodes;
					};

					/**
					 * Set ends with EOS (End of Statement)
					 */
					ViterbiLattice.prototype.appendEos = function () {
						var last_index = this.nodes_end_at.length;
						this.eos_pos++;
						this.nodes_end_at[last_index] = [new ViterbiNode(-1, 0, this.eos_pos, 0, "EOS", 0, 0, "")];
					};

					module.exports = ViterbiLattice;
				},
				{ "./ViterbiNode": 23 }
			],
			23: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * ViterbiNode is a node of ViterbiLattice
					 * @param {number} node_name Word ID
					 * @param {number} node_cost Word cost to generate
					 * @param {number} start_pos Start position from 1
					 * @param {number} length Word length
					 * @param {string} type Node type (KNOWN, UNKNOWN, BOS, EOS, ...)
					 * @param {number} left_id Left context ID
					 * @param {number} right_id Right context ID
					 * @param {string} surface_form Surface form of this word
					 * @constructor
					 */
					function ViterbiNode(node_name, node_cost, start_pos, length, type, left_id, right_id, surface_form) {
						this.name = node_name;
						this.cost = node_cost;
						this.start_pos = start_pos;
						this.length = length;
						this.left_id = left_id;
						this.right_id = right_id;
						this.prev = null;
						this.surface_form = surface_form;
						if (type === "BOS") {
							this.shortest_cost = 0;
						} else {
							this.shortest_cost = Number.MAX_VALUE;
						}
						this.type = type;
					}

					module.exports = ViterbiNode;
				},
				{}
			],
			24: [
				function (require, module, exports) {
					/*
					 * Copyright 2014 Takuya Asano
					 * Copyright 2010-2014 Atilika Inc. and contributors
					 *
					 * Licensed under the Apache License, Version 2.0 (the "License");
					 * you may not use this file except in compliance with the License.
					 * You may obtain a copy of the License at
					 *
					 *     http://www.apache.org/licenses/LICENSE-2.0
					 *
					 * Unless required by applicable law or agreed to in writing, software
					 * distributed under the License is distributed on an "AS IS" BASIS,
					 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
					 * See the License for the specific language governing permissions and
					 * limitations under the License.
					 */

					"use strict";

					/**
					 * ViterbiSearcher is for searching best Viterbi path
					 * @param {ConnectionCosts} connection_costs Connection costs matrix
					 * @constructor
					 */
					function ViterbiSearcher(connection_costs) {
						this.connection_costs = connection_costs;
					}

					/**
					 * Search best path by forward-backward algorithm
					 * @param {ViterbiLattice} lattice Viterbi lattice to search
					 * @returns {Array} Shortest path
					 */
					ViterbiSearcher.prototype.search = function (lattice) {
						lattice = this.forward(lattice);
						return this.backward(lattice);
					};

					ViterbiSearcher.prototype.forward = function (lattice) {
						var i, j, k;
						for (i = 1; i <= lattice.eos_pos; i++) {
							var nodes = lattice.nodes_end_at[i];
							if (nodes == null) {
								continue;
							}
							for (j = 0; j < nodes.length; j++) {
								var node = nodes[j];
								var cost = Number.MAX_VALUE;
								var shortest_prev_node;

								var prev_nodes = lattice.nodes_end_at[node.start_pos - 1];
								if (prev_nodes == null) {
									// TODO process unknown words (repair word lattice)
									continue;
								}
								for (k = 0; k < prev_nodes.length; k++) {
									var prev_node = prev_nodes[k];

									var edge_cost;
									if (node.left_id == null || prev_node.right_id == null) {
										// TODO assert
										console.log("Left or right is null");
										edge_cost = 0;
									} else {
										edge_cost = this.connection_costs.get(prev_node.right_id, node.left_id);
									}

									var _cost = prev_node.shortest_cost + edge_cost + node.cost;
									if (_cost < cost) {
										shortest_prev_node = prev_node;
										cost = _cost;
									}
								}

								node.prev = shortest_prev_node;
								node.shortest_cost = cost;
							}
						}
						return lattice;
					};

					ViterbiSearcher.prototype.backward = function (lattice) {
						var shortest_path = [];
						var eos = lattice.nodes_end_at[lattice.nodes_end_at.length - 1][0];

						var node_back = eos.prev;
						if (node_back == null) {
							return [];
						}
						while (node_back.type !== "BOS") {
							shortest_path.push(node_back);
							if (node_back.prev == null) {
								// TODO Failed to back. Process unknown words?
								return [];
							}
							node_back = node_back.prev;
						}

						return shortest_path.reverse();
					};

					module.exports = ViterbiSearcher;
				},
				{}
			],
			25: [
				function (require, module, exports) {
					(function (process) {
						// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
						// backported and transplited with Babel, with backwards-compat fixes

						// Copyright Joyent, Inc. and other Node contributors.
						//
						// Permission is hereby granted, free of charge, to any person obtaining a
						// copy of this software and associated documentation files (the
						// "Software"), to deal in the Software without restriction, including
						// without limitation the rights to use, copy, modify, merge, publish,
						// distribute, sublicense, and/or sell copies of the Software, and to permit
						// persons to whom the Software is furnished to do so, subject to the
						// following conditions:
						//
						// The above copyright notice and this permission notice shall be included
						// in all copies or substantial portions of the Software.
						//
						// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
						// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
						// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
						// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
						// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
						// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
						// USE OR OTHER DEALINGS IN THE SOFTWARE.

						// resolves . and .. elements in a path array with directory names there
						// must be no slashes, empty elements, or device names (c:\) in the array
						// (so also no leading and trailing slashes - it does not distinguish
						// relative and absolute paths)
						function normalizeArray(parts, allowAboveRoot) {
							// if the path tries to go above the root, `up` ends up > 0
							var up = 0;
							for (var i = parts.length - 1; i >= 0; i--) {
								var last = parts[i];
								if (last === ".") {
									parts.splice(i, 1);
								} else if (last === "..") {
									parts.splice(i, 1);
									up++;
								} else if (up) {
									parts.splice(i, 1);
									up--;
								}
							}

							// if the path is allowed to go above the root, restore leading ..s
							if (allowAboveRoot) {
								for (; up--; up) {
									parts.unshift("..");
								}
							}

							return parts;
						}

						// path.resolve([from ...], to)
						// posix version
						exports.resolve = function () {
							var resolvedPath = "",
								resolvedAbsolute = false;

							for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
								var path = i >= 0 ? arguments[i] : process.cwd();

								// Skip empty and invalid entries
								if (typeof path !== "string") {
									throw new TypeError("Arguments to path.resolve must be strings");
								} else if (!path) {
									continue;
								}

								resolvedPath = path + "/" + resolvedPath;
								resolvedAbsolute = path.charAt(0) === "/";
							}

							// At this point the path should be resolved to a full absolute path, but
							// handle relative paths to be safe (might happen when process.cwd() fails)

							// Normalize the path
							resolvedPath = normalizeArray(
								filter(resolvedPath.split("/"), function (p) {
									return !!p;
								}),
								!resolvedAbsolute
							).join("/");

							return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
						};

						// path.normalize(path)
						// posix version
						exports.normalize = function (path) {
							var isAbsolute = exports.isAbsolute(path),
								trailingSlash = substr(path, -1) === "/";

							// Normalize the path
							path = normalizeArray(
								filter(path.split("/"), function (p) {
									return !!p;
								}),
								!isAbsolute
							).join("/");

							if (!path && !isAbsolute) {
								path = ".";
							}
							if (path && trailingSlash) {
								path += "/";
							}

							return (isAbsolute ? "/" : "") + path;
						};

						// posix version
						exports.isAbsolute = function (path) {
							return path.charAt(0) === "/";
						};

						// posix version
						exports.join = function () {
							var paths = Array.prototype.slice.call(arguments, 0);
							return exports.normalize(
								filter(paths, function (p, index) {
									if (typeof p !== "string") {
										throw new TypeError("Arguments to path.join must be strings");
									}
									return p;
								}).join("/")
							);
						};

						// path.relative(from, to)
						// posix version
						exports.relative = function (from, to) {
							from = exports.resolve(from).substr(1);
							to = exports.resolve(to).substr(1);

							function trim(arr) {
								var start = 0;
								for (; start < arr.length; start++) {
									if (arr[start] !== "") break;
								}

								var end = arr.length - 1;
								for (; end >= 0; end--) {
									if (arr[end] !== "") break;
								}

								if (start > end) return [];
								return arr.slice(start, end - start + 1);
							}

							var fromParts = trim(from.split("/"));
							var toParts = trim(to.split("/"));

							var length = Math.min(fromParts.length, toParts.length);
							var samePartsLength = length;
							for (var i = 0; i < length; i++) {
								if (fromParts[i] !== toParts[i]) {
									samePartsLength = i;
									break;
								}
							}

							var outputParts = [];
							for (var i = samePartsLength; i < fromParts.length; i++) {
								outputParts.push("..");
							}

							outputParts = outputParts.concat(toParts.slice(samePartsLength));

							return outputParts.join("/");
						};

						exports.sep = "/";
						exports.delimiter = ":";

						exports.dirname = function (path) {
							if (typeof path !== "string") path = path + "";
							if (path.length === 0) return ".";
							var code = path.charCodeAt(0);
							var hasRoot = code === 47; /*/*/
							var end = -1;
							var matchedSlash = true;
							for (var i = path.length - 1; i >= 1; --i) {
								code = path.charCodeAt(i);
								if (code === 47 /*/*/) {
									if (!matchedSlash) {
										end = i;
										break;
									}
								} else {
									// We saw the first non-path separator
									matchedSlash = false;
								}
							}

							if (end === -1) return hasRoot ? "/" : ".";
							if (hasRoot && end === 1) {
								// return '//';
								// Backwards-compat fix:
								return "/";
							}
							return path.slice(0, end);
						};

						function basename(path) {
							if (typeof path !== "string") path = path + "";

							var start = 0;
							var end = -1;
							var matchedSlash = true;
							var i;

							for (i = path.length - 1; i >= 0; --i) {
								if (path.charCodeAt(i) === 47 /*/*/) {
									// If we reached a path separator that was not part of a set of path
									// separators at the end of the string, stop now
									if (!matchedSlash) {
										start = i + 1;
										break;
									}
								} else if (end === -1) {
									// We saw the first non-path separator, mark this as the end of our
									// path component
									matchedSlash = false;
									end = i + 1;
								}
							}

							if (end === -1) return "";
							return path.slice(start, end);
						}

						// Uses a mixed approach for backwards-compatibility, as ext behavior changed
						// in new Node.js versions, so only basename() above is backported here
						exports.basename = function (path, ext) {
							var f = basename(path);
							if (ext && f.substr(-1 * ext.length) === ext) {
								f = f.substr(0, f.length - ext.length);
							}
							return f;
						};

						exports.extname = function (path) {
							if (typeof path !== "string") path = path + "";
							var startDot = -1;
							var startPart = 0;
							var end = -1;
							var matchedSlash = true;
							// Track the state of characters (if any) we see before our first dot and
							// after any path separator we find
							var preDotState = 0;
							for (var i = path.length - 1; i >= 0; --i) {
								var code = path.charCodeAt(i);
								if (code === 47 /*/*/) {
									// If we reached a path separator that was not part of a set of path
									// separators at the end of the string, stop now
									if (!matchedSlash) {
										startPart = i + 1;
										break;
									}
									continue;
								}
								if (end === -1) {
									// We saw the first non-path separator, mark this as the end of our
									// extension
									matchedSlash = false;
									end = i + 1;
								}
								if (code === 46 /*.*/) {
									// If this is our first dot, mark it as the start of our extension
									if (startDot === -1) startDot = i;
									else if (preDotState !== 1) preDotState = 1;
								} else if (startDot !== -1) {
									// We saw a non-dot and non-path separator before our dot, so we should
									// have a good chance at having a non-empty extension
									preDotState = -1;
								}
							}

							if (
								startDot === -1 ||
								end === -1 ||
								// We saw a non-dot character immediately before the dot
								preDotState === 0 ||
								// The (right-most) trimmed path component is exactly '..'
								(preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
							) {
								return "";
							}
							return path.slice(startDot, end);
						};

						function filter(xs, f) {
							if (xs.filter) return xs.filter(f);
							var res = [];
							for (var i = 0; i < xs.length; i++) {
								if (f(xs[i], i, xs)) res.push(xs[i]);
							}
							return res;
						}

						// String.prototype.substr - negative index don't work in IE8
						var substr =
							"ab".substr(-1) === "b"
								? function (str, start, len) {
										return str.substr(start, len);
								  }
								: function (str, start, len) {
										if (start < 0) start = str.length + start;
										return str.substr(start, len);
								  };
					}.call(this, require("_process")));
				},
				{ _process: 26 }
			],
			26: [
				function (require, module, exports) {
					// shim for using process in browser
					var process = (module.exports = {});

					// cached from whatever global is present so that test runners that stub it
					// don't break things.  But we need to wrap it in a try catch in case it is
					// wrapped in strict mode code which doesn't define any globals.  It's inside a
					// function because try/catches deoptimize in certain engines.

					var cachedSetTimeout;
					var cachedClearTimeout;

					function defaultSetTimout() {
						throw new Error("setTimeout has not been defined");
					}
					function defaultClearTimeout() {
						throw new Error("clearTimeout has not been defined");
					}
					(function () {
						try {
							if (typeof setTimeout === "function") {
								cachedSetTimeout = setTimeout;
							} else {
								cachedSetTimeout = defaultSetTimout;
							}
						} catch (e) {
							cachedSetTimeout = defaultSetTimout;
						}
						try {
							if (typeof clearTimeout === "function") {
								cachedClearTimeout = clearTimeout;
							} else {
								cachedClearTimeout = defaultClearTimeout;
							}
						} catch (e) {
							cachedClearTimeout = defaultClearTimeout;
						}
					})();
					function runTimeout(fun) {
						if (cachedSetTimeout === setTimeout) {
							//normal enviroments in sane situations
							return setTimeout(fun, 0);
						}
						// if setTimeout wasn't available but was latter defined
						if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
							cachedSetTimeout = setTimeout;
							return setTimeout(fun, 0);
						}
						try {
							// when when somebody has screwed with setTimeout but no I.E. maddness
							return cachedSetTimeout(fun, 0);
						} catch (e) {
							try {
								// When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
								return cachedSetTimeout.call(null, fun, 0);
							} catch (e) {
								// same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
								return cachedSetTimeout.call(this, fun, 0);
							}
						}
					}
					function runClearTimeout(marker) {
						if (cachedClearTimeout === clearTimeout) {
							//normal enviroments in sane situations
							return clearTimeout(marker);
						}
						// if clearTimeout wasn't available but was latter defined
						if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
							cachedClearTimeout = clearTimeout;
							return clearTimeout(marker);
						}
						try {
							// when when somebody has screwed with setTimeout but no I.E. maddness
							return cachedClearTimeout(marker);
						} catch (e) {
							try {
								// When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
								return cachedClearTimeout.call(null, marker);
							} catch (e) {
								// same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
								// Some versions of I.E. have different rules for clearTimeout vs setTimeout
								return cachedClearTimeout.call(this, marker);
							}
						}
					}
					var queue = [];
					var draining = false;
					var currentQueue;
					var queueIndex = -1;

					function cleanUpNextTick() {
						if (!draining || !currentQueue) {
							return;
						}
						draining = false;
						if (currentQueue.length) {
							queue = currentQueue.concat(queue);
						} else {
							queueIndex = -1;
						}
						if (queue.length) {
							drainQueue();
						}
					}

					function drainQueue() {
						if (draining) {
							return;
						}
						var timeout = runTimeout(cleanUpNextTick);
						draining = true;

						var len = queue.length;
						while (len) {
							currentQueue = queue;
							queue = [];
							while (++queueIndex < len) {
								if (currentQueue) {
									currentQueue[queueIndex].run();
								}
							}
							queueIndex = -1;
							len = queue.length;
						}
						currentQueue = null;
						draining = false;
						runClearTimeout(timeout);
					}

					process.nextTick = function (fun) {
						var args = new Array(arguments.length - 1);
						if (arguments.length > 1) {
							for (var i = 1; i < arguments.length; i++) {
								args[i - 1] = arguments[i];
							}
						}
						queue.push(new Item(fun, args));
						if (queue.length === 1 && !draining) {
							runTimeout(drainQueue);
						}
					};

					// v8 likes predictible objects
					function Item(fun, array) {
						this.fun = fun;
						this.array = array;
					}
					Item.prototype.run = function () {
						this.fun.apply(null, this.array);
					};
					process.title = "browser";
					process.browser = true;
					process.env = {};
					process.argv = [];
					process.version = ""; // empty string to avoid regexp issues
					process.versions = {};

					function noop() {}

					process.on = noop;
					process.addListener = noop;
					process.once = noop;
					process.off = noop;
					process.removeListener = noop;
					process.removeAllListeners = noop;
					process.emit = noop;
					process.prependListener = noop;
					process.prependOnceListener = noop;

					process.listeners = function (name) {
						return [];
					};

					process.binding = function (name) {
						throw new Error("process.binding is not supported");
					};

					process.cwd = function () {
						return "/";
					};
					process.chdir = function (dir) {
						throw new Error("process.chdir is not supported");
					};
					process.umask = function () {
						return 0;
					};
				},
				{}
			],
			27: [
				function (require, module, exports) {
					(function (setImmediate, clearImmediate) {
						var nextTick = require("process/browser.js").nextTick;
						var apply = Function.prototype.apply;
						var slice = Array.prototype.slice;
						var immediateIds = {};
						var nextImmediateId = 0;

						// DOM APIs, for completeness

						exports.setTimeout = function () {
							return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
						};
						exports.setInterval = function () {
							return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
						};
						exports.clearTimeout = exports.clearInterval = function (timeout) {
							timeout.close();
						};

						function Timeout(id, clearFn) {
							this._id = id;
							this._clearFn = clearFn;
						}
						Timeout.prototype.unref = Timeout.prototype.ref = function () {};
						Timeout.prototype.close = function () {
							this._clearFn.call(window, this._id);
						};

						// Does not start the time, just sets up the members needed.
						exports.enroll = function (item, msecs) {
							clearTimeout(item._idleTimeoutId);
							item._idleTimeout = msecs;
						};

						exports.unenroll = function (item) {
							clearTimeout(item._idleTimeoutId);
							item._idleTimeout = -1;
						};

						exports._unrefActive = exports.active = function (item) {
							clearTimeout(item._idleTimeoutId);

							var msecs = item._idleTimeout;
							if (msecs >= 0) {
								item._idleTimeoutId = setTimeout(function onTimeout() {
									if (item._onTimeout) item._onTimeout();
								}, msecs);
							}
						};

						// That's not how node.js implements it but the exposed api is the same.
						exports.setImmediate =
							typeof setImmediate === "function"
								? setImmediate
								: function (fn) {
										var id = nextImmediateId++;
										var args = arguments.length < 2 ? false : slice.call(arguments, 1);

										immediateIds[id] = true;

										nextTick(function onNextTick() {
											if (immediateIds[id]) {
												// fn.call() is faster so we optimize for the common use-case
												// @see http://jsperf.com/call-apply-segu
												if (args) {
													fn.apply(null, args);
												} else {
													fn.call(null);
												}
												// Prevent ids from leaking
												exports.clearImmediate(id);
											}
										});

										return id;
								  };

						exports.clearImmediate =
							typeof clearImmediate === "function"
								? clearImmediate
								: function (id) {
										delete immediateIds[id];
								  };
					}.call(this, require("timers").setImmediate, require("timers").clearImmediate));
				},
				{ "process/browser.js": 26, timers: 27 }
			],
			28: [
				function (require, module, exports) {
					/** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */ (function () {
						"use strict";
						function n(e) {
							throw e;
						}
						var p = void 0,
							aa = this;
						function t(e, b) {
							var d = e.split("."),
								c = aa;
							!(d[0] in c) && c.execScript && c.execScript("var " + d[0]);
							for (var a; d.length && (a = d.shift()); ) !d.length && b !== p ? (c[a] = b) : (c = c[a] ? c[a] : (c[a] = {}));
						}
						var x =
							"undefined" !== typeof Uint8Array &&
							"undefined" !== typeof Uint16Array &&
							"undefined" !== typeof Uint32Array &&
							"undefined" !== typeof DataView;
						new (x ? Uint8Array : Array)(256);
						var y;
						for (y = 0; 256 > y; ++y) for (var A = y, ba = 7, A = A >>> 1; A; A >>>= 1) --ba;
						function B(e, b, d) {
							var c,
								a = "number" === typeof b ? b : (b = 0),
								f = "number" === typeof d ? d : e.length;
							c = -1;
							for (a = f & 7; a--; ++b) c = (c >>> 8) ^ C[(c ^ e[b]) & 255];
							for (a = f >> 3; a--; b += 8)
								(c = (c >>> 8) ^ C[(c ^ e[b]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 1]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 2]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 3]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 4]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 5]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 6]) & 255]),
									(c = (c >>> 8) ^ C[(c ^ e[b + 7]) & 255]);
							return (c ^ 4294967295) >>> 0;
						}
						var D = [
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
							C = x ? new Uint32Array(D) : D;
						function E() {}
						E.prototype.getName = function () {
							return this.name;
						};
						E.prototype.getData = function () {
							return this.data;
						};
						E.prototype.G = function () {
							return this.H;
						};
						function G(e) {
							var b = e.length,
								d = 0,
								c = Number.POSITIVE_INFINITY,
								a,
								f,
								k,
								l,
								m,
								r,
								q,
								g,
								h,
								v;
							for (g = 0; g < b; ++g) e[g] > d && (d = e[g]), e[g] < c && (c = e[g]);
							a = 1 << d;
							f = new (x ? Uint32Array : Array)(a);
							k = 1;
							l = 0;
							for (m = 2; k <= d; ) {
								for (g = 0; g < b; ++g)
									if (e[g] === k) {
										r = 0;
										q = l;
										for (h = 0; h < k; ++h) (r = (r << 1) | (q & 1)), (q >>= 1);
										v = (k << 16) | g;
										for (h = r; h < a; h += m) f[h] = v;
										++l;
									}
								++k;
								l <<= 1;
								m <<= 1;
							}
							return [f, d, c];
						}
						var J = [],
							K;
						for (K = 0; 288 > K; K++)
							switch (!0) {
								case 143 >= K:
									J.push([K + 48, 8]);
									break;
								case 255 >= K:
									J.push([K - 144 + 400, 9]);
									break;
								case 279 >= K:
									J.push([K - 256 + 0, 7]);
									break;
								case 287 >= K:
									J.push([K - 280 + 192, 8]);
									break;
								default:
									n("invalid literal: " + K);
							}
						var ca = (function () {
							function e(a) {
								switch (!0) {
									case 3 === a:
										return [257, a - 3, 0];
									case 4 === a:
										return [258, a - 4, 0];
									case 5 === a:
										return [259, a - 5, 0];
									case 6 === a:
										return [260, a - 6, 0];
									case 7 === a:
										return [261, a - 7, 0];
									case 8 === a:
										return [262, a - 8, 0];
									case 9 === a:
										return [263, a - 9, 0];
									case 10 === a:
										return [264, a - 10, 0];
									case 12 >= a:
										return [265, a - 11, 1];
									case 14 >= a:
										return [266, a - 13, 1];
									case 16 >= a:
										return [267, a - 15, 1];
									case 18 >= a:
										return [268, a - 17, 1];
									case 22 >= a:
										return [269, a - 19, 2];
									case 26 >= a:
										return [270, a - 23, 2];
									case 30 >= a:
										return [271, a - 27, 2];
									case 34 >= a:
										return [272, a - 31, 2];
									case 42 >= a:
										return [273, a - 35, 3];
									case 50 >= a:
										return [274, a - 43, 3];
									case 58 >= a:
										return [275, a - 51, 3];
									case 66 >= a:
										return [276, a - 59, 3];
									case 82 >= a:
										return [277, a - 67, 4];
									case 98 >= a:
										return [278, a - 83, 4];
									case 114 >= a:
										return [279, a - 99, 4];
									case 130 >= a:
										return [280, a - 115, 4];
									case 162 >= a:
										return [281, a - 131, 5];
									case 194 >= a:
										return [282, a - 163, 5];
									case 226 >= a:
										return [283, a - 195, 5];
									case 257 >= a:
										return [284, a - 227, 5];
									case 258 === a:
										return [285, a - 258, 0];
									default:
										n("invalid length: " + a);
								}
							}
							var b = [],
								d,
								c;
							for (d = 3; 258 >= d; d++) (c = e(d)), (b[d] = (c[2] << 24) | (c[1] << 16) | c[0]);
							return b;
						})();
						x && new Uint32Array(ca);
						function L(e, b) {
							this.i = [];
							this.j = 32768;
							this.d = this.f = this.c = this.n = 0;
							this.input = x ? new Uint8Array(e) : e;
							this.o = !1;
							this.k = M;
							this.w = !1;
							if (b || !(b = {}))
								b.index && (this.c = b.index),
									b.bufferSize && (this.j = b.bufferSize),
									b.bufferType && (this.k = b.bufferType),
									b.resize && (this.w = b.resize);
							switch (this.k) {
								case N:
									this.a = 32768;
									this.b = new (x ? Uint8Array : Array)(32768 + this.j + 258);
									break;
								case M:
									this.a = 0;
									this.b = new (x ? Uint8Array : Array)(this.j);
									this.e = this.D;
									this.q = this.A;
									this.l = this.C;
									break;
								default:
									n(Error("invalid inflate mode"));
							}
						}
						var N = 0,
							M = 1;
						L.prototype.g = function () {
							for (; !this.o; ) {
								var e = P(this, 3);
								e & 1 && (this.o = !0);
								e >>>= 1;
								switch (e) {
									case 0:
										var b = this.input,
											d = this.c,
											c = this.b,
											a = this.a,
											f = b.length,
											k = p,
											l = p,
											m = c.length,
											r = p;
										this.d = this.f = 0;
										d + 1 >= f && n(Error("invalid uncompressed block header: LEN"));
										k = b[d++] | (b[d++] << 8);
										d + 1 >= f && n(Error("invalid uncompressed block header: NLEN"));
										l = b[d++] | (b[d++] << 8);
										k === ~l && n(Error("invalid uncompressed block header: length verify"));
										d + k > b.length && n(Error("input buffer is broken"));
										switch (this.k) {
											case N:
												for (; a + k > c.length; ) {
													r = m - a;
													k -= r;
													if (x) c.set(b.subarray(d, d + r), a), (a += r), (d += r);
													else for (; r--; ) c[a++] = b[d++];
													this.a = a;
													c = this.e();
													a = this.a;
												}
												break;
											case M:
												for (; a + k > c.length; ) c = this.e({ t: 2 });
												break;
											default:
												n(Error("invalid inflate mode"));
										}
										if (x) c.set(b.subarray(d, d + k), a), (a += k), (d += k);
										else for (; k--; ) c[a++] = b[d++];
										this.c = d;
										this.a = a;
										this.b = c;
										break;
									case 1:
										this.l(da, ea);
										break;
									case 2:
										for (
											var q = P(this, 5) + 257,
												g = P(this, 5) + 1,
												h = P(this, 4) + 4,
												v = new (x ? Uint8Array : Array)(Q.length),
												s = p,
												F = p,
												H = p,
												w = p,
												z = p,
												O = p,
												I = p,
												u = p,
												Z = p,
												u = 0;
											u < h;
											++u
										)
											v[Q[u]] = P(this, 3);
										if (!x) {
											u = h;
											for (h = v.length; u < h; ++u) v[Q[u]] = 0;
										}
										s = G(v);
										w = new (x ? Uint8Array : Array)(q + g);
										u = 0;
										for (Z = q + g; u < Z; )
											switch (((z = R(this, s)), z)) {
												case 16:
													for (I = 3 + P(this, 2); I--; ) w[u++] = O;
													break;
												case 17:
													for (I = 3 + P(this, 3); I--; ) w[u++] = 0;
													O = 0;
													break;
												case 18:
													for (I = 11 + P(this, 7); I--; ) w[u++] = 0;
													O = 0;
													break;
												default:
													O = w[u++] = z;
											}
										F = x ? G(w.subarray(0, q)) : G(w.slice(0, q));
										H = x ? G(w.subarray(q)) : G(w.slice(q));
										this.l(F, H);
										break;
									default:
										n(Error("unknown BTYPE: " + e));
								}
							}
							return this.q();
						};
						var S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
							Q = x ? new Uint16Array(S) : S,
							fa = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 258, 258],
							ga = x ? new Uint16Array(fa) : fa,
							ha = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0],
							T = x ? new Uint8Array(ha) : ha,
							ia = [
								1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385,
								24577
							],
							ja = x ? new Uint16Array(ia) : ia,
							ka = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13],
							U = x ? new Uint8Array(ka) : ka,
							V = new (x ? Uint8Array : Array)(288),
							W,
							la;
						W = 0;
						for (la = V.length; W < la; ++W) V[W] = 143 >= W ? 8 : 255 >= W ? 9 : 279 >= W ? 7 : 8;
						var da = G(V),
							X = new (x ? Uint8Array : Array)(30),
							Y,
							ma;
						Y = 0;
						for (ma = X.length; Y < ma; ++Y) X[Y] = 5;
						var ea = G(X);
						function P(e, b) {
							for (var d = e.f, c = e.d, a = e.input, f = e.c, k = a.length, l; c < b; )
								f >= k && n(Error("input buffer is broken")), (d |= a[f++] << c), (c += 8);
							l = d & ((1 << b) - 1);
							e.f = d >>> b;
							e.d = c - b;
							e.c = f;
							return l;
						}
						function R(e, b) {
							for (var d = e.f, c = e.d, a = e.input, f = e.c, k = a.length, l = b[0], m = b[1], r, q; c < m && !(f >= k); )
								(d |= a[f++] << c), (c += 8);
							r = l[d & ((1 << m) - 1)];
							q = r >>> 16;
							q > c && n(Error("invalid code length: " + q));
							e.f = d >> q;
							e.d = c - q;
							e.c = f;
							return r & 65535;
						}
						L.prototype.l = function (e, b) {
							var d = this.b,
								c = this.a;
							this.r = e;
							for (var a = d.length - 258, f, k, l, m; 256 !== (f = R(this, e)); )
								if (256 > f) c >= a && ((this.a = c), (d = this.e()), (c = this.a)), (d[c++] = f);
								else {
									k = f - 257;
									m = ga[k];
									0 < T[k] && (m += P(this, T[k]));
									f = R(this, b);
									l = ja[f];
									0 < U[f] && (l += P(this, U[f]));
									c >= a && ((this.a = c), (d = this.e()), (c = this.a));
									for (; m--; ) d[c] = d[c++ - l];
								}
							for (; 8 <= this.d; ) (this.d -= 8), this.c--;
							this.a = c;
						};
						L.prototype.C = function (e, b) {
							var d = this.b,
								c = this.a;
							this.r = e;
							for (var a = d.length, f, k, l, m; 256 !== (f = R(this, e)); )
								if (256 > f) c >= a && ((d = this.e()), (a = d.length)), (d[c++] = f);
								else {
									k = f - 257;
									m = ga[k];
									0 < T[k] && (m += P(this, T[k]));
									f = R(this, b);
									l = ja[f];
									0 < U[f] && (l += P(this, U[f]));
									c + m > a && ((d = this.e()), (a = d.length));
									for (; m--; ) d[c] = d[c++ - l];
								}
							for (; 8 <= this.d; ) (this.d -= 8), this.c--;
							this.a = c;
						};
						L.prototype.e = function () {
							var e = new (x ? Uint8Array : Array)(this.a - 32768),
								b = this.a - 32768,
								d,
								c,
								a = this.b;
							if (x) e.set(a.subarray(32768, e.length));
							else {
								d = 0;
								for (c = e.length; d < c; ++d) e[d] = a[d + 32768];
							}
							this.i.push(e);
							this.n += e.length;
							if (x) a.set(a.subarray(b, b + 32768));
							else for (d = 0; 32768 > d; ++d) a[d] = a[b + d];
							this.a = 32768;
							return a;
						};
						L.prototype.D = function (e) {
							var b,
								d = (this.input.length / this.c + 1) | 0,
								c,
								a,
								f,
								k = this.input,
								l = this.b;
							e && ("number" === typeof e.t && (d = e.t), "number" === typeof e.z && (d += e.z));
							2 > d
								? ((c = (k.length - this.c) / this.r[2]), (f = (258 * (c / 2)) | 0), (a = f < l.length ? l.length + f : l.length << 1))
								: (a = l.length * d);
							x ? ((b = new Uint8Array(a)), b.set(l)) : (b = l);
							return (this.b = b);
						};
						L.prototype.q = function () {
							var e = 0,
								b = this.b,
								d = this.i,
								c,
								a = new (x ? Uint8Array : Array)(this.n + (this.a - 32768)),
								f,
								k,
								l,
								m;
							if (0 === d.length) return x ? this.b.subarray(32768, this.a) : this.b.slice(32768, this.a);
							f = 0;
							for (k = d.length; f < k; ++f) {
								c = d[f];
								l = 0;
								for (m = c.length; l < m; ++l) a[e++] = c[l];
							}
							f = 32768;
							for (k = this.a; f < k; ++f) a[e++] = b[f];
							this.i = [];
							return (this.buffer = a);
						};
						L.prototype.A = function () {
							var e,
								b = this.a;
							x
								? this.w
									? ((e = new Uint8Array(b)), e.set(this.b.subarray(0, b)))
									: (e = this.b.subarray(0, b))
								: (this.b.length > b && (this.b.length = b), (e = this.b));
							return (this.buffer = e);
						};
						function $(e) {
							this.input = e;
							this.c = 0;
							this.m = [];
							this.s = !1;
						}
						$.prototype.F = function () {
							this.s || this.g();
							return this.m.slice();
						};
						$.prototype.g = function () {
							for (var e = this.input.length; this.c < e; ) {
								var b = new E(),
									d = p,
									c = p,
									a = p,
									f = p,
									k = p,
									l = p,
									m = p,
									r = p,
									q = p,
									g = this.input,
									h = this.c;
								b.u = g[h++];
								b.v = g[h++];
								(31 !== b.u || 139 !== b.v) && n(Error("invalid file signature:" + b.u + "," + b.v));
								b.p = g[h++];
								switch (b.p) {
									case 8:
										break;
									default:
										n(Error("unknown compression method: " + b.p));
								}
								b.h = g[h++];
								r = g[h++] | (g[h++] << 8) | (g[h++] << 16) | (g[h++] << 24);
								b.H = new Date(1e3 * r);
								b.N = g[h++];
								b.M = g[h++];
								0 < (b.h & 4) && ((b.I = g[h++] | (g[h++] << 8)), (h += b.I));
								if (0 < (b.h & 8)) {
									m = [];
									for (l = 0; 0 < (k = g[h++]); ) m[l++] = String.fromCharCode(k);
									b.name = m.join("");
								}
								if (0 < (b.h & 16)) {
									m = [];
									for (l = 0; 0 < (k = g[h++]); ) m[l++] = String.fromCharCode(k);
									b.J = m.join("");
								}
								0 < (b.h & 2) && ((b.B = B(g, 0, h) & 65535), b.B !== (g[h++] | (g[h++] << 8)) && n(Error("invalid header crc16")));
								d = g[g.length - 4] | (g[g.length - 3] << 8) | (g[g.length - 2] << 16) | (g[g.length - 1] << 24);
								g.length - h - 4 - 4 < 512 * d && (f = d);
								c = new L(g, { index: h, bufferSize: f });
								b.data = a = c.g();
								h = c.c;
								b.K = q = (g[h++] | (g[h++] << 8) | (g[h++] << 16) | (g[h++] << 24)) >>> 0;
								B(a, p, p) !== q && n(Error("invalid CRC-32 checksum: 0x" + B(a, p, p).toString(16) + " / 0x" + q.toString(16)));
								b.L = d = (g[h++] | (g[h++] << 8) | (g[h++] << 16) | (g[h++] << 24)) >>> 0;
								(a.length & 4294967295) !== d && n(Error("invalid input size: " + (a.length & 4294967295) + " / " + d));
								this.m.push(b);
								this.c = h;
							}
							this.s = !0;
							var v = this.m,
								s,
								F,
								H = 0,
								w = 0,
								z;
							s = 0;
							for (F = v.length; s < F; ++s) w += v[s].data.length;
							if (x) {
								z = new Uint8Array(w);
								for (s = 0; s < F; ++s) z.set(v[s].data, H), (H += v[s].data.length);
							} else {
								z = [];
								for (s = 0; s < F; ++s) z[s] = v[s].data;
								z = Array.prototype.concat.apply([], z);
							}
							return z;
						};
						t("Zlib.Gunzip", $);
						t("Zlib.Gunzip.prototype.decompress", $.prototype.g);
						t("Zlib.Gunzip.prototype.getMembers", $.prototype.F);
						t("Zlib.GunzipMember", E);
						t("Zlib.GunzipMember.prototype.getName", E.prototype.getName);
						t("Zlib.GunzipMember.prototype.getData", E.prototype.getData);
						t("Zlib.GunzipMember.prototype.getMtime", E.prototype.G);
					}.call(this));
				},
				{}
			],
			29: [
				function (require, module, exports) {
					"use strict";

					Object.defineProperty(exports, "__esModule", {
						value: true
					});

					var _createClass = (function () {
						function defineProperties(target, props) {
							for (var i = 0; i < props.length; i++) {
								var descriptor = props[i];
								descriptor.enumerable = descriptor.enumerable || false;
								descriptor.configurable = true;
								if ("value" in descriptor) descriptor.writable = true;
								Object.defineProperty(target, descriptor.key, descriptor);
							}
						}
						return function (Constructor, protoProps, staticProps) {
							if (protoProps) defineProperties(Constructor.prototype, protoProps);
							if (staticProps) defineProperties(Constructor, staticProps);
							return Constructor;
						};
					})();

					var _kuromoji = require("kuromoji");

					var _kuromoji2 = _interopRequireDefault(_kuromoji);

					function _interopRequireDefault(obj) {
						return obj && obj.__esModule ? obj : { default: obj };
					}

					function _classCallCheck(instance, Constructor) {
						if (!(instance instanceof Constructor)) {
							throw new TypeError("Cannot call a class as a function");
						}
					}

					// Check where we are
					var isNode = false;
					var isBrowser = typeof window !== "undefined";
					if (!isBrowser && typeof module !== "undefined" && module.exports) {
						isNode = true;
					}

					/**
					 * Kuromoji based morphological analyzer for kuroshiro
					 */

					var Analyzer = (function () {
						/**
						 * Constructor
						 * @param {Object} [options] JSON object which have key-value pairs settings
						 * @param {string} [options.dictPath] Path of the dictionary files
						 */
						function Analyzer() {
							var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
								dictPath = _ref.dictPath;

							_classCallCheck(this, Analyzer);

							this._analyzer = null;

							if (!dictPath) {
								if (isNode) this._dictPath = require.resolve("kuromoji").replace(/src(?!.*src).*/, "dict/");
								else this._dictPath = "node_modules/kuromoji/dict/";
							} else {
								this._dictPath = dictPath;
							}
						}

						/**
						 * Initialize the analyzer
						 * @returns {Promise} Promise object represents the result of initialization
						 */

						_createClass(Analyzer, [
							{
								key: "init",
								value: function init() {
									var _this = this;

									return new Promise(function (resolve, reject) {
										var self = _this;
										if (_this._analyzer == null) {
											_kuromoji2.default.builder({ dicPath: _this._dictPath }).build(function (err, newAnalyzer) {
												if (err) {
													return reject(err);
												}
												self._analyzer = newAnalyzer;
												resolve();
											});
										} else {
											reject(new Error("This analyzer has already been initialized."));
										}
									});
								}

								/**
								 * Parse the given string
								 * @param {string} str input string
								 * @returns {Promise} Promise object represents the result of parsing
								 * @example The result of parsing
								 * [{
								 *     "surface_form": "黒白",    // 表層形
								 *     "pos": "名詞",               // 品詞 (part of speech)
								 *     "pos_detail_1": "一般",      // 品詞細分類1
								 *     "pos_detail_2": "*",        // 品詞細分類2
								 *     "pos_detail_3": "*",        // 品詞細分類3
								 *     "conjugated_type": "*",     // 活用型
								 *     "conjugated_form": "*",     // 活用形
								 *     "basic_form": "黒白",      // 基本形
								 *     "reading": "クロシロ",       // 読み
								 *     "pronunciation": "クロシロ",  // 発音
								 *     "verbose": {                 // Other properties
								 *         "word_id": 413560,
								 *         "word_type": "KNOWN",
								 *         "word_position": 1
								 *     }
								 * }]
								 */
							},
							{
								key: "parse",
								value: function parse() {
									var _this2 = this;

									var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";

									return new Promise(function (resolve, reject) {
										if (str.trim() === "") return resolve([]);
										var result = _this2._analyzer.tokenize(str);
										for (var i = 0; i < result.length; i++) {
											result[i].verbose = {};
											result[i].verbose.word_id = result[i].word_id;
											result[i].verbose.word_type = result[i].word_type;
											result[i].verbose.word_position = result[i].word_position;
											delete result[i].word_id;
											delete result[i].word_type;
											delete result[i].word_position;
										}
										resolve(result);
									});
								}
							}
						]);

						return Analyzer;
					})();

					exports.default = Analyzer;
					module.exports = exports["default"];
				},
				{ kuromoji: 15 }
			]
		},
		{},
		[29]
	)(29);
});
