global = this;
(function (modules) {

    // Bundle allows the run-time to extract already-loaded modules from the
    // boot bundle.
    var bundle = {};
    var main;

    // Unpack module tuples into module objects.
    for (var i = 0; i < modules.length; i++) {
        var module = modules[i];
        module = modules[i] = new Module(
            module[0],
            module[1],
            module[2],
            module[3],
            module[4]
        );
        bundle[module.filename] = module;
    }

    function Module(id, dirname, basename, dependencies, factory) {
        this.id = id;
        this.dirname = dirname;
        this.filename = dirname + "/" + basename;
        // Dependency map and factory are used to instantiate bundled modules.
        this.dependencies = dependencies;
        this.factory = factory;
    }

    Module.prototype._require = function () {
        var module = this;
        if (module.exports === void 0) {
            module.exports = {};
            var require = function (id) {
                var index = module.dependencies[id];
                var dependency = modules[index];
                if (!dependency)
                    throw new Error("Bundle is missing a dependency: " + id);
                return dependency._require();
            };
            require.main = main;
            module.exports = module.factory(
                require,
                module.exports,
                module,
                module.filename,
                module.dirname
            ) || module.exports;
        }
        return module.exports;
    };

    // Communicate the bundle to all bundled modules
    Module.prototype.modules = bundle;

    return function require(filename) {
        main = bundle[filename];
        main._require();
    }
})([["animator.js","blick","animator.js",{"raf":72},function (require, exports, module, __filename, __dirname){

// blick/animator.js
// -----------------

"use strict";

var defaultRequestAnimation = require("raf");

module.exports = Animator;

function Animator(requestAnimation) {
    var self = this;
    self._requestAnimation = requestAnimation || defaultRequestAnimation;
    self.controllers = [];
    // This thunk is doomed to deoptimization for multiple reasons, but passes
    // off as quickly as possible to the unrolled animation loop.
    self._animate = function () {
        try {
            self.animate(Date.now());
        } catch (error) {
            self.requestAnimation();
            throw error;
        }
    };
}

Animator.prototype.requestAnimation = function () {
    if (!this.requested) {
        this._requestAnimation(this._animate);
    }
    this.requested = true;
};

Animator.prototype.animate = function (now) {
    var node, temp;

    this.requested = false;

    // Measure
    for (var index = 0; index < this.controllers.length; index++) {
        var controller = this.controllers[index];
        if (controller.measure) {
            controller.component.measure(now);
            controller.measure = false;
        }
    }

    // Transition
    for (var index = 0; index < this.controllers.length; index++) {
        var controller = this.controllers[index];
        // Unlke others, skipped if draw or redraw are scheduled and left on
        // the schedule for the next animation frame.
        if (controller.transition) {
            if (!controller.draw && !controller.redraw) {
                controller.component.transition(now);
                controller.transition = false;
            } else {
                this.requestAnimation();
            }
        }
    }

    // Animate
    // If any components have animation set, continue animation.
    for (var index = 0; index < this.controllers.length; index++) {
        var controller = this.controllers[index];
        if (controller.animate) {
            controller.component.animate(now);
            this.requestAnimation();
            // Unlike others, not reset implicitly.
        }
    }

    // Draw
    for (var index = 0; index < this.controllers.length; index++) {
        var controller = this.controllers[index];
        if (controller.draw) {
            controller.component.draw(now);
            controller.draw = false;
        }
    }

    // Redraw
    for (var index = 0; index < this.controllers.length; index++) {
        var controller = this.controllers[index];
        if (controller.redraw) {
            controller.component.redraw(now);
            controller.redraw = false;
        }
    }
};

Animator.prototype.add = function (component) {
    var controller = new AnimationController(component, this);
    this.controllers.push(controller);
    return controller;
};

function AnimationController(component, controller) {
    this.component = component;
    this.controller = controller;

    this.measure = false;
    this.transition = false;
    this.animate = false;
    this.draw = false;
    this.redraw = false;
}

AnimationController.prototype.destroy = function () {
};

AnimationController.prototype.requestMeasure = function () {
    if (!this.component.measure) {
        throw new Error("Can't requestMeasure because component does not implement measure");
    }
    this.measure = true;
    this.controller.requestAnimation();
};

AnimationController.prototype.cancelMeasure = function () {
    this.measure = false;
};

AnimationController.prototype.requestTransition = function () {
    if (!this.component.transition) {
        throw new Error("Can't requestTransition because component does not implement transition");
    }
    this.transition = true;
    this.controller.requestAnimation();
};

AnimationController.prototype.cancelTransition = function () {
    this.transition = false;
};

AnimationController.prototype.requestAnimation = function () {
    if (!this.component.animate) {
        throw new Error("Can't requestAnimation because component does not implement animate");
    }
    this.animate = true;
    this.controller.requestAnimation();
};

AnimationController.prototype.cancelAnimation = function () {
    this.animate = false;
};

AnimationController.prototype.requestDraw = function () {
    if (!this.component.draw) {
        throw new Error("Can't requestDraw because component does not implement draw");
    }
    this.draw = true;
    this.controller.requestAnimation();
};

AnimationController.prototype.cancelDraw = function () {
    this.draw = false;
};

AnimationController.prototype.requestRedraw = function () {
    if (!this.component.redraw) {
        throw new Error("Can't requestRedraw because component does not implement redraw");
    }
    this.redraw = true;
    this.controller.requestAnimation();
};

AnimationController.prototype.cancelRedraw = function () {
    this.redraw = false;
};

}],["copy.js","collections","copy.js",{},function (require, exports, module, __filename, __dirname){

// collections/copy.js
// -------------------

"use strict";

var hasOwnProperty = Object.prototype.hasOwnProperty;

module.exports = copy;
function copy(target, source) {
    for (var name in source) {
        if (hasOwnProperty.call(source, name)) {
            target[name] = source[name];
        }
    }
}

}],["dict.js","collections","dict.js",{"./generic-collection":5,"./generic-map":6,"pop-observe/observable-object":66,"./iterator":9,"./copy":1},function (require, exports, module, __filename, __dirname){

// collections/dict.js
// -------------------

"use strict";

var GenericCollection = require("./generic-collection");
var GenericMap = require("./generic-map");
var ObservableObject = require("pop-observe/observable-object");
var Iterator = require("./iterator");
var copy = require("./copy");

// Burgled from https://github.com/domenic/dict

module.exports = Dict;
function Dict(values, getDefault) {
    if (!(this instanceof Dict)) {
        return new Dict(values, getDefault);
    }
    getDefault = getDefault || this.getDefault;
    this.getDefault = getDefault;
    this.store = {};
    this.length = 0;
    this.addEach(values);
}

Dict.Dict = Dict; // hack for MontageJS

function mangle(key) {
    return "$" + key;
}

function unmangle(mangled) {
    return mangled.slice(1);
}

copy(Dict.prototype, GenericCollection.prototype);
copy(Dict.prototype, GenericMap.prototype);
copy(Dict.prototype, ObservableObject.prototype);

Dict.prototype.isDict = true;

Dict.prototype.constructClone = function (values) {
    return new this.constructor(values, this.mangle, this.getDefault);
};

Dict.prototype.get = function (key, defaultValue) {
    var mangled = mangle(key);
    if (mangled in this.store) {
        return this.store[mangled];
    } else if (arguments.length > 1) {
        return defaultValue;
    } else {
        return this.getDefault(key);
    }
};

Dict.prototype.set = function (key, value) {
    var mangled = mangle(key);
    var from;
    if (mangled in this.store) { // update
        if (this.dispatchesMapChanges) {
            from = this.store[mangled];
            this.dispatchMapWillChange("update", key, value, from);
        }
        this.store[mangled] = value;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("update", key, value, from);
        }
        return false;
    } else { // create
        if (this.dispatchesMapChanges) {
            this.dispatchMapWillChange("create", key, value);
        }
        this.length++;
        this.store[mangled] = value;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("create", key, value);
        }
        return true;
    }
};

Dict.prototype.has = function (key) {
    var mangled = mangle(key);
    return mangled in this.store;
};

Dict.prototype["delete"] = function (key) {
    var mangled = mangle(key);
    var from;
    if (mangled in this.store) {
        if (this.dispatchesMapChanges) {
            from = this.store[mangled];
            this.dispatchMapWillChange("delete", key, void 0, from);
        }
        delete this.store[mangle(key)];
        this.length--;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("delete", key, void 0, from);
        }
        return true;
    }
    return false;
};

Dict.prototype.clear = function () {
    var key, mangled, from;
    for (mangled in this.store) {
        key = unmangle(mangled);
        if (this.dispatchesMapChanges) {
            from = this.store[mangled];
            this.dispatchMapWillChange("delete", key, void 0, from);
        }
        delete this.store[mangled];
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("delete", key, void 0, from);
        }
    }
    this.length = 0;
};

Dict.prototype.reduce = function (callback, basis, thisp) {
    for (var mangled in this.store) {
        basis = callback.call(thisp, basis, this.store[mangled], unmangle(mangled), this);
    }
    return basis;
};

Dict.prototype.reduceRight = function (callback, basis, thisp) {
    var self = this;
    var store = this.store;
    return Object.keys(this.store).reduceRight(function (basis, mangled) {
        return callback.call(thisp, basis, store[mangled], unmangle(mangled), self);
    }, basis);
};

Dict.prototype.one = function () {
    var key;
    for (key in this.store) {
        return this.store[key];
    }
};

Dict.prototype.iterate = function () {
    return new this.Iterator(new Iterator(this.store));
};

Dict.prototype.Iterator = DictIterator;

function DictIterator(storeIterator) {
    this.storeIterator = storeIterator;
}

DictIterator.prototype.next = function () {
    var iteration = this.storeIterator.next();
    if (iteration.done) {
        return iteration;
    } else {
        return new Iterator.Iteration(
            iteration.value,
            unmangle(iteration.index)
        );
    }
};


}],["fast-map.js","collections","fast-map.js",{"./fast-set":4,"./generic-collection":5,"./generic-map":6,"pop-observe/observable-object":66,"pop-equals":55,"pop-hash":58,"./copy":1},function (require, exports, module, __filename, __dirname){

// collections/fast-map.js
// -----------------------

"use strict";

var Set = require("./fast-set");
var GenericCollection = require("./generic-collection");
var GenericMap = require("./generic-map");
var ObservableObject = require("pop-observe/observable-object");
var equalsOperator = require("pop-equals");
var hashOperator = require("pop-hash");
var copy = require("./copy");

module.exports = FastMap;

function FastMap(values, equals, hash, getDefault) {
    if (!(this instanceof FastMap)) {
        return new FastMap(values, equals, hash, getDefault);
    }
    equals = equals || equalsOperator;
    hash = hash || hashOperator;
    getDefault = getDefault || this.getDefault;
    this.contentEquals = equals;
    this.contentHash = hash;
    this.getDefault = getDefault;
    this.store = new Set(
        undefined,
        function keysEqual(a, b) {
            return equals(a.key, b.key);
        },
        function keyHash(item) {
            return hash(item.key);
        }
    );
    this.length = 0;
    this.addEach(values);
}

FastMap.FastMap = FastMap; // hack for MontageJS

copy(FastMap.prototype, GenericCollection.prototype);
copy(FastMap.prototype, GenericMap.prototype);
copy(FastMap.prototype, ObservableObject.prototype);

FastMap.prototype.constructClone = function (values) {
    return new this.constructor(
        values,
        this.contentEquals,
        this.contentHash,
        this.getDefault
    );
};

FastMap.prototype.log = function (charmap, stringify) {
    stringify = stringify || this.stringify;
    this.store.log(charmap, stringify);
};

FastMap.prototype.stringify = function (item, leader) {
    return leader + JSON.stringify(item.key) + ": " + JSON.stringify(item.value);
}


}],["fast-set.js","collections","fast-set.js",{"./dict":2,"./list":10,"./generic-collection":5,"./generic-set":8,"./tree-log":11,"pop-observe/observable-object":66,"pop-hash":58,"pop-equals":55,"pop-iterate":62,"pop-arrayify":52,"./copy":1},function (require, exports, module, __filename, __dirname){

// collections/fast-set.js
// -----------------------

"use strict";

var Dict = require("./dict");
var List = require("./list");
var GenericCollection = require("./generic-collection");
var GenericSet = require("./generic-set");
var TreeLog = require("./tree-log");
var ObservableObject = require("pop-observe/observable-object");
var hashOperator = require("pop-hash");
var equalsOperator = require("pop-equals");
var iterate = require("pop-iterate");
var arrayify = require("pop-arrayify");
var copy = require("./copy");

var object_has = Object.prototype.hasOwnProperty;

module.exports = FastSet;

function FastSet(values, equals, hash, getDefault) {
    if (!(this instanceof FastSet)) {
        return new FastSet(values, equals, hash, getDefault);
    }
    equals = equals || equalsOperator;
    hash = hash || hashOperator;
    getDefault = getDefault || noop;
    this.contentEquals = equals;
    this.contentHash = hash;
    this.getDefault = getDefault;
    this.buckets = new this.Buckets(null, this.Bucket);
    this.length = 0;
    this.addEach(values);
}

FastSet.FastSet = FastSet; // hack for MontageJS

copy(FastSet.prototype, GenericCollection.prototype);
copy(FastSet.prototype, GenericSet.prototype);
copy(FastSet.prototype, ObservableObject.prototype);

FastSet.prototype.Buckets = Dict;
FastSet.prototype.Bucket = List;

FastSet.prototype.constructClone = function (values) {
    return new this.constructor(
        values,
        this.contentEquals,
        this.contentHash,
        this.getDefault
    );
};

FastSet.prototype.has = function (value) {
    var hash = this.contentHash(value);
    return this.buckets.get(hash).has(value);
};

FastSet.prototype.get = function (value) {
    var hash = this.contentHash(value);
    var buckets = this.buckets;
    if (buckets.has(hash)) {
        return buckets.get(hash).get(value);
    } else {
        return this.getDefault(value);
    }
};

FastSet.prototype['delete'] = function (value) {
    var hash = this.contentHash(value);
    var buckets = this.buckets;
    if (buckets.has(hash)) {
        var bucket = buckets.get(hash);
        if (bucket["delete"](value)) {
            this.length--;
            if (bucket.length === 0) {
                buckets["delete"](hash);
            }
            return true;
        }
    }
    return false;
};

FastSet.prototype.clear = function () {
    this.buckets.clear();
    this.length = 0;
};

FastSet.prototype.add = function (value) {
    var hash = this.contentHash(value);
    var buckets = this.buckets;
    if (!buckets.has(hash)) {
        buckets.set(hash, new this.Bucket(null, this.contentEquals));
    }
    if (!buckets.get(hash).has(value)) {
        buckets.get(hash).add(value);
        this.length++;
        return true;
    }
    return false;
};

FastSet.prototype.reduce = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var buckets = this.buckets;
    var index = 0;
    return buckets.reduce(function (basis, bucket) {
        return bucket.reduce(function (basis, value) {
            return callback.call(thisp, basis, value, index++, this);
        }, basis, this);
    }, basis, this);
};

FastSet.prototype.one = function () {
    if (this.length > 0) {
        return this.buckets.one().one();
    }
};

FastSet.prototype.toArray = function () {
    return flatten(this.buckets.map(arrayify));
};

FastSet.prototype.iterate = function () {
    return iterate(this.toArray());
};

FastSet.prototype.log = function (charmap, logNode, callback, thisp) {
    charmap = charmap || TreeLog.unicodeSharp;
    logNode = logNode || this.logNode;
    if (!callback) {
        callback = console.log;
        thisp = console;
    }

    // Bind is unavailable in PhantomJS, the only environment of consequence
    // that does not implement it yet.
    var originalCallback = callback;
    callback = function () {
        return originalCallback.apply(thisp, arguments);
    };

    var buckets = this.buckets;
    var hashes = buckets.keys();
    hashes.forEach(function (hash, index) {
        var branch;
        var leader;
        if (index === hashes.length - 1) {
            branch = charmap.fromAbove;
            leader = ' ';
        } else if (index === 0) {
            branch = charmap.branchDown;
            leader = charmap.strafe;
        } else {
            branch = charmap.fromBoth;
            leader = charmap.strafe;
        }
        var bucket = buckets.get(hash);
        callback.call(thisp, branch + charmap.through + charmap.branchDown + ' ' + hash);
        bucket.forEach(function (value, node) {
            var branch, below;
            if (node === bucket.head.prev) {
                branch = charmap.fromAbove;
                below = ' ';
            } else {
                branch = charmap.fromBoth;
                below = charmap.strafe;
            }
            var written;
            logNode(
                node,
                function (line) {
                    if (!written) {
                        callback.call(thisp, leader + ' ' + branch + charmap.through + charmap.through + line);
                        written = true;
                    } else {
                        callback.call(thisp, leader + ' ' + below + '  ' + line);
                    }
                },
                function (line) {
                    callback.call(thisp, leader + ' ' + charmap.strafe + '  ' + line);
                }
            );
        });
    });
};

FastSet.prototype.logNode = function (node, write) {
    var value = node.value;
    if (Object(value) === value) {
        JSON.stringify(value, null, 4).split("\n").forEach(function (line) {
            write(" " + line);
        });
    } else {
        write(" " + value);
    }
};

function flatten(arrays) {
    return Array.prototype.concat.apply([], arrays);
}

function noop() {}

}],["generic-collection.js","collections","generic-collection.js",{"pop-equals":55,"pop-compare":54,"pop-clone":53,"pop-zip/pop-unzip":70},function (require, exports, module, __filename, __dirname){

// collections/generic-collection.js
// ---------------------------------

"use strict";

var equalsOperator = require("pop-equals");
var compareOperator = require("pop-compare");
var cloneOperator = require("pop-clone");
var unzipOperator = require("pop-zip/pop-unzip");

module.exports = GenericCollection;
function GenericCollection() {
    throw new Error("Can't construct. GenericCollection is a mixin.");
}

GenericCollection.prototype.addEach = function (values) {
    if (values && Object(values) === values) {
        if (typeof values.forEach === "function") {
            values.forEach(this.add, this);
        } else if (typeof values.length === "number") {
            // Array-like objects that do not implement forEach, ergo,
            // Arguments
            for (var i = 0; i < values.length; i++) {
                this.add(values[i], i);
            }
        } else {
            Object.keys(values).forEach(function (key) {
                this.add(values[key], key);
            }, this);
        }
    }
    return this;
};

// This is sufficiently generic for Map (since the value may be a key)
// and ordered collections (since it forwards the equals argument)
GenericCollection.prototype.deleteEach = function (values, equals) {
    values.forEach(function (value) {
        this["delete"](value, equals);
    }, this);
    return this;
};

// all of the following functions are implemented in terms of "reduce".
// some need "constructClone".

GenericCollection.prototype.forEach = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    return this.reduce(function (undefined, value, key, object, depth) {
        callback.call(thisp, value, key, object, depth);
    }, undefined);
};

GenericCollection.prototype.map = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    var result = [];
    this.reduce(function (undefined, value, key, object, depth) {
        result.push(callback.call(thisp, value, key, object, depth));
    }, undefined);
    return result;
};

GenericCollection.prototype.enumerate = function (start) {
    if (start == null) {
        start = 0;
    }
    var result = [];
    this.reduce(function (undefined, value) {
        result.push([start++, value]);
    }, undefined);
    return result;
};

GenericCollection.prototype.group = function (callback, thisp, equals) {
    equals = equals || equalsOperator;
    var groups = [];
    var keys = [];
    this.forEach(function (value, key, object) {
        var key = callback.call(thisp, value, key, object);
        var index = keys.indexOf(key, equals);
        var group;
        if (index === -1) {
            group = [];
            groups.push([key, group]);
            keys.push(key);
        } else {
            group = groups[index][1];
        }
        group.push(value);
    });
    return groups;
};

GenericCollection.prototype.toArray = function () {
    return this.map(identity);
};

// this depends on stringable keys, which apply to Array and Iterator
// because they have numeric keys and all Maps since they may use
// strings as keys.  List, Set, and SortedSet have nodes for keys, so
// toObject would not be meaningful.
GenericCollection.prototype.toObject = function () {
    var object = {};
    this.reduce(function (undefined, value, key) {
        object[key] = value;
    }, undefined);
    return object;
};

GenericCollection.prototype.filter = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    var result = this.constructClone();
    this.reduce(function (undefined, value, key, object, depth) {
        if (callback.call(thisp, value, key, object, depth)) {
            result.add(value, key);
        }
    }, undefined);
    return result;
};

GenericCollection.prototype.every = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    var iterator = this.iterate();
    while (true) {
        var iteration = iterator.next();
        if (iteration.done) {
            return true;
        } else if (!callback.call(thisp, iteration.value, iteration.index, this)) {
            return false;
        }
    }
};

GenericCollection.prototype.some = function (callback /*, thisp*/) {
    var thisp = arguments[1];
    var iterator = this.iterate();
    while (true) {
        var iteration = iterator.next();
        if (iteration.done) {
            return false;
        } else if (callback.call(thisp, iteration.value, iteration.index, this)) {
            return true;
        }
    }
};

GenericCollection.prototype.min = function (compare) {
    compare = compare || this.contentCompare || compareOperator;
    var first = true;
    return this.reduce(function (result, value) {
        if (first) {
            first = false;
            return value;
        } else {
            return compare(value, result) < 0 ? value : result;
        }
    }, undefined);
};

GenericCollection.prototype.max = function (compare) {
    compare = compare || this.contentCompare || compareOperator;
    var first = true;
    return this.reduce(function (result, value) {
        if (first) {
            first = false;
            return value;
        } else {
            return compare(value, result) > 0 ? value : result;
        }
    }, undefined);
};

GenericCollection.prototype.sum = function (zero) {
    zero = zero === undefined ? 0 : zero;
    return this.reduce(function (a, b) {
        return a + b;
    }, zero);
};

GenericCollection.prototype.average = function (zero) {
    var sum = zero === undefined ? 0 : zero;
    var count = zero === undefined ? 0 : zero;
    this.reduce(function (undefined, value) {
        sum += value;
        count += 1;
    }, undefined);
    return sum / count;
};

GenericCollection.prototype.concat = function () {
    var result = this.constructClone(this);
    for (var i = 0; i < arguments.length; i++) {
        result.addEach(arguments[i]);
    }
    return result;
};

GenericCollection.prototype.flatten = function () {
    var self = this;
    return this.reduce(function (result, array) {
        array.forEach(function (value) {
            this.push(value);
        }, result, self);
        return result;
    }, []);
};

GenericCollection.prototype.zip = function () {
    var table = Array.prototype.slice.call(arguments);
    table.unshift(this);
    return unzipOperator(table);
}

GenericCollection.prototype.join = function (delimiter) {
    return this.reduce(function (result, string) {
        return result + delimiter + string;
    });
};

GenericCollection.prototype.sorted = function (compare, by, order) {
    compare = compare || this.contentCompare || compareOperator;
    // account for comparators generated by Function.by
    if (compare.by) {
        by = compare.by;
        compare = compare.compare || this.contentCompare || compareOperator;
    } else {
        by = by || identity;
    }
    if (order === undefined)
        order = 1;
    return this.map(function (item) {
        return {
            by: by(item),
            value: item
        };
    })
    .sort(function (a, b) {
        return compare(a.by, b.by) * order;
    })
    .map(function (pair) {
        return pair.value;
    });
};

GenericCollection.prototype.reversed = function () {
    return this.constructClone(this).reverse();
};

GenericCollection.prototype.clone = function (depth, memo, clone) {
    if (depth === undefined) {
        depth = Infinity;
    } else if (depth === 0) {
        return this;
    }
    clone = clone || cloneOperator;
    var collection = this.constructClone();
    this.forEach(function (value, key) {
        collection.add(clone(value, depth - 1, memo), key);
    }, this);
    return collection;
};

GenericCollection.prototype.only = function () {
    if (this.length === 1) {
        return this.one();
    }
};

function identity(value) { return value; }

}],["generic-map.js","collections","generic-map.js",{"pop-observe/observable-map":65,"pop-observe/observable-object":66,"./iterator":9,"pop-equals":55,"pop-compare":54,"./copy":1},function (require, exports, module, __filename, __dirname){

// collections/generic-map.js
// --------------------------

"use strict";

var ObservableMap = require("pop-observe/observable-map");
var ObservableObject = require("pop-observe/observable-object");
var Iterator = require("./iterator");
var equalsOperator = require("pop-equals");
var compareOperator = require("pop-compare");
var copy = require("./copy");

module.exports = GenericMap;
function GenericMap() {
    throw new Error("Can't construct. GenericMap is a mixin.");
}

copy(GenericMap.prototype, ObservableMap.prototype);
copy(GenericMap.prototype, ObservableObject.prototype);

// all of these methods depend on the constructor providing a `store` set

GenericMap.prototype.isMap = true;

GenericMap.prototype.addEach = function (values) {
    if (values && Object(values) === values) {
        if (typeof values.forEach === "function") {
            // copy map-alikes
            if (values.isMap === true) {
                values.forEach(function (value, key) {
                    this.set(key, value);
                }, this);
            // iterate key value pairs of other iterables
            } else {
                values.forEach(function (pair) {
                    this.set(pair[0], pair[1]);
                }, this);
            }
        } else {
            // copy other objects as map-alikes
            Object.keys(values).forEach(function (key) {
                this.set(key, values[key]);
            }, this);
        }
    }
    return this;
}

GenericMap.prototype.get = function (key, defaultValue) {
    var item = this.store.get(new this.Item(key));
    if (item) {
        return item.value;
    } else if (arguments.length > 1) {
        return defaultValue;
    } else {
        return this.getDefault(key);
    }
};

GenericMap.prototype.getDefault = function () {
};

GenericMap.prototype.set = function (key, value) {
    var item = new this.Item(key, value);
    var found = this.store.get(item);
    var grew = false;
    if (found) { // update
        var from;
        if (this.dispatchesMapChanges) {
            from = found.value;
            this.dispatchMapWillChange("update", key, value, from);
        }
        found.value = value;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("update", key, value, from);
        }
    } else { // create
        if (this.dispatchesMapChanges) {
            this.dispatchMapWillChange("create", key, value);
        }
        if (this.store.add(item)) {
            this.length++;
            grew = true;
        }
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("create", key, value);
        }
    }
    return grew;
};

GenericMap.prototype.add = function (value, key) {
    return this.set(key, value);
};

GenericMap.prototype.has = function (key) {
    return this.store.has(new this.Item(key));
};

GenericMap.prototype['delete'] = function (key) {
    var item = new this.Item(key);
    if (this.store.has(item)) {
        var from;
        if (this.dispatchesMapChanges) {
            from = this.store.get(item).value;
            this.dispatchMapWillChange("delete", key, void 0, from);
        }
        this.store["delete"](item);
        this.length--;
        if (this.dispatchesMapChanges) {
            this.dispatchMapChange("delete", key, void 0, from);
        }
        return true;
    }
    return false;
};

GenericMap.prototype.clear = function () {
    var from;
    if (this.dispatchesMapChanges) {
        this.forEach(function (value, key) {
            this.dispatchMapWillChange("delete", key, void 0, value);
        }, this);
        from = this.constructClone(this);
    }
    this.store.clear();
    this.length = 0;
    if (this.dispatchesMapChanges) {
        from.forEach(function (value, key) {
            this.dispatchMapChange("delete", key, void 0, value);
        }, this);
    }
};

GenericMap.prototype.iterate = function () {
    return new this.Iterator(this);
};

GenericMap.prototype.reduce = function (callback, basis, thisp) {
    return this.store.reduce(function (basis, item) {
        return callback.call(thisp, basis, item.value, item.key, this);
    }, basis, this);
};

GenericMap.prototype.reduceRight = function (callback, basis, thisp) {
    return this.store.reduceRight(function (basis, item) {
        return callback.call(thisp, basis, item.value, item.key, this);
    }, basis, this);
};

GenericMap.prototype.keys = function () {
    return this.map(function (value, key) {
        return key;
    });
};

GenericMap.prototype.values = function () {
    return this.map(identity);
};

GenericMap.prototype.entries = function () {
    return this.map(function (value, key) {
        return [key, value];
    });
};

GenericMap.prototype.equals = function (that, equals) {
    equals = equals || equalsOperator;
    if (this === that) {
        return true;
    } else if (that && typeof that.every === "function") {
        return that.length === this.length && that.every(function (value, key) {
            return equals(this.get(key), value);
        }, this);
    } else {
        var keys = Object.keys(that);
        return keys.length === this.length && Object.keys(that).every(function (key) {
            return equals(this.get(key), that[key]);
        }, this);
    }
};

GenericMap.prototype.Item = Item;
GenericMap.prototype.Iterator = GenericMapIterator;

function Item(key, value) {
    this.key = key;
    this.value = value;
}

Item.prototype.equals = function (that) {
    return equalsOperator(this.key, that.key) && equalsOperator(this.value, that.value);
};

Item.prototype.compare = function (that) {
    return compareOperator(this.key, that.key);
};

function GenericMapIterator(map) {
    this.storeIterator = new Iterator(map.store);
}

GenericMapIterator.prototype = Object.create(Iterator.prototype);
GenericMapIterator.prototype.constructor = GenericMapIterator;

GenericMapIterator.prototype.next = function () {
    var iteration = this.storeIterator.next();
    if (iteration.done) {
        return iteration;
    } else {
        return new Iterator.Iteration(
            iteration.value.value,
            iteration.value.key
        );
    }
};

function identity(value) { return value; }

}],["generic-order.js","collections","generic-order.js",{"pop-equals":55,"pop-compare":54},function (require, exports, module, __filename, __dirname){

// collections/generic-order.js
// ----------------------------


var equalsOperator = require("pop-equals");
var compareOperator = require("pop-compare");

module.exports = GenericOrder;
function GenericOrder() {
    throw new Error("Can't construct. GenericOrder is a mixin.");
}

GenericOrder.prototype.equals = function (that, equals) {
    equals = equals || this.contentEquals || equalsOperator;

    if (this === that) {
        return true;
    }
    if (!that) {
        return false;
    }

    var self = this;
    return (
        this.length === that.length &&
        this.zip(that).every(function (pair) {
            return equals(pair[0], pair[1]);
        })
    );
};

GenericOrder.prototype.compare = function (that, compare) {
    compare = compare || this.contentCompare || compareOperator;

    if (this === that) {
        return 0;
    }
    if (!that) {
        return 1;
    }

    var length = Math.min(this.length, that.length);
    var comparison = this.zip(that).reduce(function (comparison, pair, index) {
        if (comparison === 0) {
            if (index >= length) {
                return comparison;
            } else {
                return compare(pair[0], pair[1]);
            }
        } else {
            return comparison;
        }
    }, 0);
    if (comparison === 0) {
        return this.length - that.length;
    }
    return comparison;
};


}],["generic-set.js","collections","generic-set.js",{"pop-has":57},function (require, exports, module, __filename, __dirname){

// collections/generic-set.js
// --------------------------


var has = require("pop-has");

module.exports = GenericSet;
function GenericSet() {
    throw new Error("Can't construct. GenericSet is a mixin.");
}

GenericSet.prototype.isSet = true;

GenericSet.prototype.union = function (that) {
    var union =  this.constructClone(this);
    union.addEach(that);
    return union;
};

GenericSet.prototype.intersection = function (that) {
    return this.constructClone(this.filter(function (value) {
        return has(that, value);
    }));
};

GenericSet.prototype.difference = function (that) {
    var union =  this.constructClone(this);
    union.deleteEach(that);
    return union;
};

GenericSet.prototype.symmetricDifference = function (that) {
    var union = this.union(that);
    var intersection = this.intersection(that);
    return union.difference(intersection);
};

GenericSet.prototype.equals = function (that, equals) {
    var self = this;
    return (
        that && typeof that.reduce === "function" &&
        this.length === that.length &&
        that.reduce(function (equal, value) {
            return equal && self.has(value, equals);
        }, true)
    );
};

// W3C DOMTokenList API overlap (does not handle variadic arguments)

GenericSet.prototype.contains = function (value) {
    return this.has(value);
};

GenericSet.prototype.remove = function (value) {
    return this["delete"](value);
};

GenericSet.prototype.toggle = function (value) {
    if (this.has(value)) {
        this["delete"](value);
    } else {
        this.add(value);
    }
};


}],["iterator.js","collections","iterator.js",{"weak-map":73,"./generic-collection":5},function (require, exports, module, __filename, __dirname){

// collections/iterator.js
// -----------------------

"use strict";

module.exports = Iterator;

var WeakMap = require("weak-map");
var GenericCollection = require("./generic-collection");

// upgrades an iterable to a Iterator
function Iterator(iterable, start, stop, step) {
    if (!iterable) {
        return Iterator.empty;
    } else if (iterable instanceof Iterator) {
        return iterable;
    } else if (!(this instanceof Iterator)) {
        return new Iterator(iterable, start, stop, step);
    } else if (Array.isArray(iterable) || typeof iterable === "string") {
        iterators.set(this, new IndexIterator(iterable, start, stop, step));
        return;
    }
    iterable = Object(iterable);
    if (iterable.next) {
        iterators.set(this, iterable);
    } else if (iterable.iterate) {
        iterators.set(this, iterable.iterate(start, stop, step));
    } else if (Object.prototype.toString.call(iterable) === "[object Function]") {
        this.next = iterable;
    } else if (Object.getPrototypeOf(iterable) === Object.prototype) {
        iterators.set(this, new ObjectIterator(iterable));
    } else {
        throw new TypeError("Can't iterate " + iterable);
    }
}

// Using iterators as a hidden table associating a full-fledged Iterator with
// an underlying, usually merely "nextable", iterator.
var iterators = new WeakMap();

// Selectively apply generic methods of GenericCollection
Iterator.prototype.forEach = GenericCollection.prototype.forEach;
Iterator.prototype.map = GenericCollection.prototype.map;
Iterator.prototype.filter = GenericCollection.prototype.filter;
Iterator.prototype.every = GenericCollection.prototype.every;
Iterator.prototype.some = GenericCollection.prototype.some;
Iterator.prototype.min = GenericCollection.prototype.min;
Iterator.prototype.max = GenericCollection.prototype.max;
Iterator.prototype.sum = GenericCollection.prototype.sum;
Iterator.prototype.average = GenericCollection.prototype.average;
Iterator.prototype.flatten = GenericCollection.prototype.flatten;
Iterator.prototype.zip = GenericCollection.prototype.zip;
Iterator.prototype.enumerate = GenericCollection.prototype.enumerate;
Iterator.prototype.sorted = GenericCollection.prototype.sorted;
Iterator.prototype.group = GenericCollection.prototype.group;
Iterator.prototype.reversed = GenericCollection.prototype.reversed;
Iterator.prototype.toArray = GenericCollection.prototype.toArray;
Iterator.prototype.toObject = GenericCollection.prototype.toObject;

// This is a bit of a cheat so flatten and such work with the generic reducible
Iterator.prototype.constructClone = function (values) {
    var clone = [];
    clone.addEach(values);
    return clone;
};

// A level of indirection so a full-interface iterator can proxy for a simple
// nextable iterator.
Iterator.prototype.next = function () {
    var nextable = iterators.get(this);
    if (nextable) {
        return nextable.next();
    } else {
        return Iterator.done;
    }
};

Iterator.prototype.iterateMap = function (callback /*, thisp*/) {
    var self = Iterator(this),
        thisp = arguments[1];
    return new MapIterator(self, callback, thisp);
};

function MapIterator(iterator, callback, thisp) {
    this.iterator = iterator;
    this.callback = callback;
    this.thisp = thisp;
}

MapIterator.prototype = Object.create(Iterator.prototype);
MapIterator.prototype.constructor = MapIterator;

MapIterator.prototype.next = function () {
    var iteration = this.iterator.next();
    if (iteration.done) {
        return iteration;
    } else {
        return new Iteration(
            this.callback.call(
                this.thisp,
                iteration.value,
                iteration.index,
                this.iteration
            ),
            iteration.index
        );
    }
};

Iterator.prototype.iterateFilter = function (callback /*, thisp*/) {
    var self = Iterator(this),
        thisp = arguments[1],
        index = 0;

    return new FilterIterator(self, callback, thisp);
};

function FilterIterator(iterator, callback, thisp) {
    this.iterator = iterator;
    this.callback = callback;
    this.thisp = thisp;
}

FilterIterator.prototype = Object.create(Iterator.prototype);
FilterIterator.prototype.constructor = FilterIterator;

FilterIterator.prototype.next = function () {
    var iteration;
    while (true) {
        iteration = this.iterator.next();
        if (iteration.done || this.callback.call(
            this.thisp,
            iteration.value,
            iteration.index,
            this.iteration
        )) {
            return iteration;
        }
    }
};

Iterator.prototype.reduce = function (callback /*, initial, thisp*/) {
    var self = Iterator(this),
        result = arguments[1],
        thisp = arguments[2],
        iteration;

    // First iteration unrolled
    iteration = self.next();
    if (iteration.done) {
        if (arguments.length > 1) {
            return arguments[1];
        } else {
            throw TypeError("Reduce of empty iterator with no initial value");
        }
    } else if (arguments.length > 1) {
        result = callback.call(
            thisp,
            result,
            iteration.value,
            iteration.index,
            self
        );
    } else {
        result = iteration.value;
    }

    // Remaining entries
    while (true) {
        iteration = self.next();
        if (iteration.done) {
            return result;
        } else {
            result = callback.call(
                thisp,
                result,
                iteration.value,
                iteration.index,
                self
            );
        }
    }
};

Iterator.prototype.dropWhile = function (callback /*, thisp */) {
    var self = Iterator(this),
        thisp = arguments[1],
        iteration;

    while (true) {
        iteration = self.next();
        if (iteration.done) {
            return Iterator.empty;
        } else if (!callback.call(thisp, iteration.value, iteration.index, self)) {
            return new DropWhileIterator(iteration, self);
        }
    }
};

function DropWhileIterator(iteration, iterator) {
    this.iteration = iteration;
    this.iterator = iterator;
    this.parent = null;
}

DropWhileIterator.prototype = Object.create(Iterator.prototype);
DropWhileIterator.prototype.constructor = DropWhileIterator;

DropWhileIterator.prototype.next = function () {
    var result = this.iteration;
    if (result) {
        this.iteration = null;
        return result;
    } else {
        return this.iterator.next();
    }
};

Iterator.prototype.takeWhile = function (callback /*, thisp*/) {
    var self = Iterator(this),
        thisp = arguments[1];
    return new TakeWhileIterator(self, callback, thisp);
};

function TakeWhileIterator(iterator, callback, thisp) {
    this.iterator = iterator;
    this.callback = callback;
    this.thisp = thisp;
}

TakeWhileIterator.prototype = Object.create(Iterator.prototype);
TakeWhileIterator.prototype.constructor = TakeWhileIterator;

TakeWhileIterator.prototype.next = function () {
    var iteration = this.iterator.next();
    if (iteration.done) {
        return iteration;
    } else if (this.callback.call(
        this.thisp,
        iteration.value,
        iteration.index,
        this.iterator
    )) {
        return iteration;
    } else {
        return Iterator.done;
    }
};

Iterator.prototype.iterateZip = function () {
    return Iterator.unzip(Array.prototype.concat.apply(this, arguments));
};

Iterator.prototype.iterateUnzip = function () {
    return Iterator.unzip(this);
};

Iterator.prototype.iterateEnumerate = function (start) {
    return Iterator.count(start).iterateZip(this);
};

Iterator.prototype.iterateConcat = function () {
    return Iterator.flatten(Array.prototype.concat.apply(this, arguments));
};

Iterator.prototype.iterateFlatten = function () {
    return Iterator.flatten(this);
};

Iterator.prototype.recount = function (start) {
    return new RecountIterator(this, start);
};

function RecountIterator(iterator, start) {
    this.iterator = iterator;
    this.index = start || 0;
}

RecountIterator.prototype = Object.create(Iterator.prototype);
RecountIterator.prototype.constructor = RecountIterator;

RecountIterator.prototype.next = function () {
    var iteration = this.iterator.next();
    if (iteration.done) {
        return iteration;
    } else {
        return new Iteration(
            iteration.value,
            this.index++
        );
    }
};

// creates an iterator for Array and String
function IndexIterator(iterable, start, stop, step) {
    if (step == null) {
        step = 1;
    }
    if (stop == null) {
        stop = start;
        start = 0;
    }
    if (start == null) {
        start = 0;
    }
    if (step == null) {
        step = 1;
    }
    if (stop == null) {
        stop = iterable.length;
    }
    this.iterable = iterable;
    this.start = start;
    this.stop = stop;
    this.step = step;
}

IndexIterator.prototype.next = function () {
    // Advance to next owned entry
    if (typeof this.iterable === "object") { // as opposed to string
        while (!(this.start in this.iterable)) {
            if (this.start >= this.stop) {
                return Iterator.done;
            } else {
                this.start += this.step;
            }
        }
    }
    if (this.start >= this.stop) { // end of string
        return Iterator.done;
    }
    var iteration = new Iteration(
        this.iterable[this.start],
        this.start
    );
    this.start += this.step;
    return iteration;
};

function ObjectIterator(object) {
    this.object = object;
    this.iterator = new Iterator(Object.keys(object));
}

ObjectIterator.prototype.next = function () {
    var iteration = this.iterator.next();
    if (iteration.done) {
        return iteration;
    } else {
        var key = iteration.value;
        return new Iteration(this.object[key], key);
    }
};

Iterator.cycle = function (cycle, times) {
    if (arguments.length < 2) {
        times = Infinity;
    }
    return new CycleIterator(cycle, times);
};

function CycleIterator(cycle, times) {
    this.cycle = cycle;
    this.times = times;
    this.iterator = Iterator.empty;
}

CycleIterator.prototype = Object.create(Iterator.prototype);
CycleIterator.prototype.constructor = CycleIterator;

CycleIterator.prototype.next = function () {
    var iteration = this.iterator.next();
    if (iteration.done) {
        if (this.times > 0) {
            this.times--;
            this.iterator = new Iterator(this.cycle);
            return this.iterator.next();
        } else {
            return iteration;
        }
    } else {
        return iteration;
    }
};

Iterator.concat = function (/* ...iterators */) {
    return Iterator.flatten(Array.prototype.slice.call(arguments));
};

Iterator.flatten = function (iterators) {
    iterators = Iterator(iterators);
    return new ChainIterator(iterators);
};

function ChainIterator(iterators) {
    this.iterators = iterators;
    this.iterator = Iterator.empty;
}

ChainIterator.prototype = Object.create(Iterator.prototype);
ChainIterator.prototype.constructor = ChainIterator;

ChainIterator.prototype.next = function () {
    var iteration = this.iterator.next();
    if (iteration.done) {
        var iteratorIteration = this.iterators.next();
        if (iteratorIteration.done) {
            return Iterator.done;
        } else {
            this.iterator = new Iterator(iteratorIteration.value);
            return this.iterator.next();
        }
    } else {
        return iteration;
    }
};

Iterator.unzip = function (iterators) {
    iterators = Iterator(iterators).map(Iterator);
    if (iterators.length === 0)
        return new Iterator.empty;
    return new UnzipIterator(iterators);
};

function UnzipIterator(iterators) {
    this.iterators = iterators;
    this.index = 0;
}

UnzipIterator.prototype = Object.create(Iterator.prototype);
UnzipIterator.prototype.constructor = UnzipIterator;

UnzipIterator.prototype.next = function () {
    var done = false
    var result = this.iterators.map(function (iterator) {
        var iteration = iterator.next();
        if (iteration.done) {
            done = true;
        } else {
            return iteration.value;
        }
    });
    if (done) {
        return Iterator.done;
    } else {
        return new Iteration(result, this.index++);
    }
};

Iterator.zip = function () {
    return Iterator.unzip(Array.prototype.slice.call(arguments));
};

Iterator.range = function (start, stop, step) {
    if (arguments.length < 3) {
        step = 1;
    }
    if (arguments.length < 2) {
        stop = start;
        start = 0;
    }
    start = start || 0;
    step = step || 1;
    return new RangeIterator(start, stop, step);
};

Iterator.count = function (start, step) {
    return Iterator.range(start, Infinity, step);
};

function RangeIterator(start, stop, step) {
    this.start = start;
    this.stop = stop;
    this.step = step;
    this.index = 0;
}

RangeIterator.prototype = Object.create(Iterator.prototype);
RangeIterator.prototype.constructor = RangeIterator;

RangeIterator.prototype.next = function () {
    if (this.start >= this.stop) {
        return Iterator.done;
    } else {
        var result = this.start;
        this.start += this.step;
        return new Iteration(result, this.index++);
    }
};

Iterator.repeat = function (value, times) {
    if (times == null) {
        times = Infinity;
    }
    return new RepeatIterator(value, times);
};

function RepeatIterator(value, times) {
    this.value = value;
    this.times = times;
    this.index = 0;
}

RepeatIterator.prototype = Object.create(Iterator.prototype);
RepeatIterator.prototype.constructor = RepeatIterator;

RepeatIterator.prototype.next = function () {
    if (this.index < this.times) {
        return new Iteration(this.value, this.index++);
    } else {
        return Iterator.done;
    }
};

Iterator.enumerate = function (values, start) {
    return Iterator.count(start).iterateZip(new Iterator(values));
};

function EmptyIterator() {}

EmptyIterator.prototype = Object.create(Iterator.prototype);
EmptyIterator.prototype.constructor = EmptyIterator;

EmptyIterator.prototype.next = function () {
    return Iterator.done;
};

Iterator.empty = new EmptyIterator();

// Iteration and DoneIteration exist here only to encourage hidden classes.
// Otherwise, iterations are merely duck-types.

function Iteration(value, index) {
    this.value = value;
    this.index = index;
}

Iteration.prototype.done = false;

Iteration.prototype.equals = function (that, equals, memo) {
    if (!that) return false;
    return (
        equals(this.value, that.value, equals, memo) &&
        this.index === that.index &&
        this.done === that.done
    );

};

function DoneIteration(value) {
    Iteration.call(this, value);
    this.done = true; // reflected on the instance to make it more obvious
}

DoneIteration.prototype = Object.create(Iteration.prototype);
DoneIteration.prototype.constructor = DoneIteration;
DoneIteration.prototype.done = true;

Iterator.Iteration = Iteration;
Iterator.DoneIteration = DoneIteration;
Iterator.done = new DoneIteration();


}],["list.js","collections","list.js",{"./generic-collection":5,"./generic-order":7,"pop-observe/observable-object":66,"pop-observe/observable-range":67,"./iterator":9,"pop-equals":55,"pop-arrayify":52,"./copy":1},function (require, exports, module, __filename, __dirname){

// collections/list.js
// -------------------

"use strict";

module.exports = List;

var GenericCollection = require("./generic-collection");
var GenericOrder = require("./generic-order");
var ObservableObject = require("pop-observe/observable-object");
var ObservableRange = require("pop-observe/observable-range");
var Iterator = require("./iterator");
var equalsOperator = require("pop-equals");
var arrayify = require("pop-arrayify");
var copy = require("./copy");

var emptyArray = [];

function List(values, equals, getDefault) {
    if (!(this instanceof List)) {
        return new List(values, equals, getDefault);
    }
    var head = this.head = new this.Node();
    head.next = head;
    head.prev = head;
    this.contentEquals = equals || equalsOperator;
    this.getDefault = getDefault || noop;
    this.length = 0;
    this.addEach(values);
}

List.List = List; // hack for MontageJS

copy(List.prototype, GenericCollection.prototype);
copy(List.prototype, GenericOrder.prototype);
copy(List.prototype, ObservableObject.prototype);
copy(List.prototype, ObservableRange.prototype);

List.prototype.constructClone = function (values) {
    return new this.constructor(values, this.contentEquals, this.getDefault);
};

List.prototype.findValue = function (value, equals) {
    equals = equals || this.contentEquals;
    var head = this.head;
    var at = head.next;
    while (at !== head) {
        // Note that the given value occurs first so that it can be a matcher
        // like an Any(Number) object.
        if (equals(value, at.value)) {
            return at;
        }
        at = at.next;
    }
};

List.prototype.findLastValue = function (value, equals) {
    equals = equals || this.contentEquals;
    var head = this.head;
    var at = head.prev;
    while (at !== head) {
        if (equals(value, at.value)) {
            return at;
        }
        at = at.prev;
    }
};

List.prototype.has = function (value, equals) {
    return !!this.findValue(value, equals);
};

List.prototype.get = function (value, equals) {
    var found = this.findValue(value, equals);
    if (found) {
        return found.value;
    }
    return this.getDefault(value);
};

// LIFO (delete removes the most recently added equivalent value)
List.prototype['delete'] = function (value, equals) {
    var found = this.findLastValue(value, equals);
    if (found) {
        if (this.dispatchesRangeChanges) {
            var plus = [];
            var minus = [value];
            this.dispatchRangeWillChange(plus, minus, found.index);
        }
        found['delete']();
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.dispatchRangeChange(plus, minus, found.index);
            this.updateIndexes(found.next, found.index);
        }
        return true;
    }
    return false;
};

List.prototype.clear = function () {
    var plus, minus;
    if (this.dispatchesRangeChanges) {
        minus = this.toArray();
        plus = [];
        this.dispatchRangeWillChange(plus, minus, 0);
    }
    this.head.next = this.head.prev = this.head;
    this.length = 0;
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange(plus, minus, 0);
    }
};

List.prototype.add = function (value) {
    var node = new this.Node(value)
    if (this.dispatchesRangeChanges) {
        node.index = this.length;
        this.dispatchRangeWillChange([value], [], node.index);
    }
    this.head.addBefore(node);
    this.length++;
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange([value], [], node.index);
    }
    return true;
};

List.prototype.push = function () {
    var head = this.head;
    if (this.dispatchesRangeChanges) {
        var plus = Array.prototype.slice.call(arguments);
        var minus = []
        var index = this.length;
        this.dispatchRangeWillChange(plus, minus, index);
        var start = this.head.prev;
    }
    for (var i = 0; i < arguments.length; i++) {
        var value = arguments[i];
        var node = new this.Node(value);
        head.addBefore(node);
    }
    this.length += arguments.length;
    if (this.dispatchesRangeChanges) {
        this.updateIndexes(start, start.index);
        this.dispatchRangeChange(plus, minus, index);
    }
};

List.prototype.unshift = function () {
    if (this.dispatchesRangeChanges) {
        var plus = Array.prototype.slice.call(arguments);
        var minus = [];
        this.dispatchRangeWillChange(plus, minus, 0);
    }
    var at = this.head;
    for (var i = 0; i < arguments.length; i++) {
        var value = arguments[i];
        var node = new this.Node(value);
        at.addAfter(node);
        at = node;
    }
    this.length += arguments.length;
    if (this.dispatchesRangeChanges) {
        this.updateIndexes(this.head, -1);
        this.dispatchRangeChange(plus, minus, 0);
    }
};

List.prototype.pop = function () {
    var value;
    var head = this.head;
    if (head.prev !== head) {
        value = head.prev.value;
        if (this.dispatchesRangeChanges) {
            var plus = [];
            var minus = [value];
            var index = this.length - 1;
            this.dispatchRangeWillChange(plus, minus, index);
        }
        head.prev['delete']();
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.dispatchRangeChange(plus, minus, index);
        }
    }
    return value;
};

List.prototype.shift = function () {
    var value;
    var head = this.head;
    if (head.prev !== head) {
        value = head.next.value;
        if (this.dispatchesRangeChanges) {
            var plus = [];
            var minus = [value];
            this.dispatchRangeWillChange(plus, minus, 0);
        }
        head.next['delete']();
        this.length--;
        if (this.dispatchesRangeChanges) {
            this.updateIndexes(this.head, -1);
            this.dispatchRangeChange(plus, minus, 0);
        }
    }
    return value;
};

List.prototype.peek = function () {
    if (this.head !== this.head.next) {
        return this.head.next.value;
    }
};

List.prototype.poke = function (value) {
    if (this.head !== this.head.next) {
        this.head.next.value = value;
    } else {
        this.push(value);
    }
};

List.prototype.one = function () {
    return this.peek();
};

// TODO
// List.prototype.indexOf = function (value) {
// };

// TODO
// List.prototype.lastIndexOf = function (value) {
// };

// an internal utility for coercing index offsets to nodes
List.prototype.scan = function (at, fallback) {
    var head = this.head;
    if (typeof at === "number") {
        var count = at;
        if (count >= 0) {
            at = head.next;
            while (count) {
                count--;
                at = at.next;
                if (at == head) {
                    break;
                }
            }
        } else {
            at = head;
            while (count < 0) {
                count++;
                at = at.prev;
                if (at == head) {
                    break;
                }
            }
        }
        return at;
    } else {
        return at || fallback;
    }
};

// at and end may both be positive or negative numbers (in which cases they
// correspond to numeric indicies, or nodes)
List.prototype.slice = function (at, end) {
    var sliced = [];
    var head = this.head;
    at = this.scan(at, head.next);
    end = this.scan(end, head);

    while (at !== end && at !== head) {
        sliced.push(at.value);
        at = at.next;
    }

    return sliced;
};

List.prototype.splice = function (at, length /*...plus*/) {
    return this.swap(at, length, Array.prototype.slice.call(arguments, 2));
};

List.prototype.swap = function (start, length, plus) {
    var initial = start;
    // start will be head if start is null or -1 (meaning from the end), but
    // will be head.next if start is 0 (meaning from the beginning)
    start = this.scan(start, this.head);
    if (length == null) {
        length = Infinity;
    }
    plus = arrayify(plus);

    // collect the minus array
    var minus = [];
    var at = start;
    while (length-- && length >= 0 && at !== this.head) {
        minus.push(at.value);
        at = at.next;
    }

    // before range change
    var index, startNode;
    if (this.dispatchesRangeChanges) {
        if (start === this.head) {
            index = this.length;
        } else if (start.prev === this.head) {
            index = 0;
        } else {
            index = start.index;
        }
        startNode = start.prev;
        this.dispatchRangeWillChange(plus, minus, index);
    }

    // delete minus
    var at = start;
    for (var i = 0, at = start; i < minus.length; i++, at = at.next) {
        at["delete"]();
    }
    // add plus
    if (initial == null && at === this.head) {
        at = this.head.next;
    }
    for (var i = 0; i < plus.length; i++) {
        var node = new this.Node(plus[i]);
        at.addBefore(node);
    }
    // adjust length
    this.length += plus.length - minus.length;

    // after range change
    if (this.dispatchesRangeChanges) {
        if (start === this.head) {
            this.updateIndexes(this.head, -1);
        } else {
            this.updateIndexes(startNode, startNode.index);
        }
        this.dispatchRangeChange(plus, minus, index);
    }

    return minus;
};

List.prototype.reverse = function () {
    if (this.dispatchesRangeChanges) {
        var minus = this.toArray();
        var plus = minus.reversed();
        this.dispatchRangeWillChange(plus, minus, 0);
    }
    var at = this.head;
    do {
        var temp = at.next;
        at.next = at.prev;
        at.prev = temp;
        at = at.next;
    } while (at !== this.head);
    if (this.dispatchesRangeChanges) {
        this.dispatchRangeChange(plus, minus, 0);
    }
    return this;
};

List.prototype.sort = function () {
    this.swap(0, this.length, this.sorted());
};

// TODO account for missing basis argument
List.prototype.reduce = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var head = this.head;
    var at = head.next;
    while (at !== head) {
        basis = callback.call(thisp, basis, at.value, at, this);
        at = at.next;
    }
    return basis;
};

List.prototype.reduceRight = function (callback, basis /*, thisp*/) {
    var thisp = arguments[2];
    var head = this.head;
    var at = head.prev;
    while (at !== head) {
        basis = callback.call(thisp, basis, at.value, at, this);
        at = at.prev;
    }
    return basis;
};

List.prototype.updateIndexes = function (node, index) {
    do {
        node.index = index++;
        node = node.next;
    } while (node !== this.head);
};

List.prototype.makeRangeChangesObservable = function () {
    this.updateIndexes(this.head, -1);
    this.dispatchesRangeChanges = true;
};

List.prototype.toArray = function () {
    return this.slice();
};

List.prototype.iterate = function () {
    return new ListIterator(this.head);
};

function ListIterator(head) {
    this.head = head;
    this.at = head.next;
    this.index = 0;
};

ListIterator.prototype = Object.create(Iterator.prototype);
ListIterator.prototype.constructor = ListIterator;

ListIterator.prototype.next = function () {
    if (this.at === this.head) {
        return Iterator.done;
    } else {
        var at = this.at;
        this.at = this.at.next;
        return new Iterator.Iteration(
            at.value,
            this.index++
        );
    }
};

List.prototype.Node = Node;

function Node(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
};

Node.prototype['delete'] = function () {
    this.prev.next = this.next;
    this.next.prev = this.prev;
};

Node.prototype.addBefore = function (node) {
    var prev = this.prev;
    this.prev = node;
    node.prev = prev;
    prev.next = node;
    node.next = this;
};

Node.prototype.addAfter = function (node) {
    var next = this.next;
    this.next = node;
    node.next = next;
    next.prev = node;
    node.prev = this;
};

function noop() {}


}],["tree-log.js","collections","tree-log.js",{},function (require, exports, module, __filename, __dirname){

// collections/tree-log.js
// -----------------------

"use strict";

module.exports = TreeLog;

function TreeLog() {
}

TreeLog.ascii = {
    intersection: "+",
    through: "-",
    branchUp: "+",
    branchDown: "+",
    fromBelow: ".",
    fromAbove: "'",
    fromBoth: "+",
    strafe: "|"
};

TreeLog.unicodeRound = {
    intersection: "\u254b",
    through: "\u2501",
    branchUp: "\u253b",
    branchDown: "\u2533",
    fromBelow: "\u256d", // round corner
    fromAbove: "\u2570", // round corner
    fromBoth: "\u2523",
    strafe: "\u2503"
};

TreeLog.unicodeSharp = {
    intersection: "\u254b",
    through: "\u2501",
    branchUp: "\u253b",
    branchDown: "\u2533",
    fromBelow: "\u250f", // sharp corner
    fromAbove: "\u2517", // sharp corner
    fromBoth: "\u2523",
    strafe: "\u2503"
};


}],["colorim.html","colorim.html","colorim.html",{"./colorim":13,"gutentag/repeat.html":38,"./spectrum.html":16,"./hue-spectrum.html":14},function (require, exports, module, __filename, __dirname){

// colorim.html/colorim.html
// -------------------------

"use strict";
var $SUPER = require("./colorim");
var $REPEAT = require("gutentag/repeat.html");
var $SPECTRUM = require("./spectrum.html");
var $HUE_SPECTRUM = require("./hue-spectrum.html");
var $THIS = function ColorimhtmlColorim(body, caller) {
    $SUPER.apply(this, arguments);
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("container", component);
    if (component.setAttribute) {
    component.setAttribute("class", "colorim");
    }
    if (component.setAttribute) {
        component.setAttribute("id", "container_ndybao");
    }
    if (scope.componentsFor["container"]) {
       scope.componentsFor["container"].setAttribute("for", "container_ndybao")
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createElement("DIV");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("center", component);
        if (component.setAttribute) {
        component.setAttribute("class", "center");
        }
        if (component.setAttribute) {
            component.setAttribute("id", "center_d1rz0y");
        }
        if (scope.componentsFor["center"]) {
           scope.componentsFor["center"].setAttribute("for", "center_d1rz0y")
        }
        parents[parents.length] = parent; parent = node;
        // DIV
            node = document.createElement("DIV");
            parent.appendChild(node);
            component = node.actualNode;
            if (component.setAttribute) {
            component.setAttribute("class", "hueCenter");
            }
            parents[parents.length] = parent; parent = node;
            // DIV
                node = document.createBody();
                parent.appendChild(node);
                parents[parents.length] = parent; parent = node;
                // HUE-SPECTRUM
                    node = {tagName: "hue-spectrum"};
                    node.component = $THIS$0;
                    callee = scope.nest();
                    callee.argument = node;
                    callee.id = "hueSpectrum";
                    component = new $HUE_SPECTRUM(parent, callee);
                node = parent; parent = parents[parents.length - 1]; parents.length--;
                scope.hookup("hueSpectrum", component);
                if (component.setAttribute) {
                    component.setAttribute("id", "hueSpectrum_nka6ym");
                }
                if (scope.componentsFor["hueSpectrum"]) {
                   scope.componentsFor["hueSpectrum"].setAttribute("for", "hueSpectrum_nka6ym")
                }
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            node = document.createElement("DIV");
            parent.appendChild(node);
            component = node.actualNode;
            if (component.setAttribute) {
            component.setAttribute("class", "saturationCenter");
            }
            parents[parents.length] = parent; parent = node;
            // DIV
                node = document.createBody();
                parent.appendChild(node);
                parents[parents.length] = parent; parent = node;
                // SPECTRUM
                    node = {tagName: "spectrum"};
                    node.component = $THIS$1;
                    callee = scope.nest();
                    callee.argument = node;
                    callee.id = "saturationSpectrum";
                    component = new $SPECTRUM(parent, callee);
                node = parent; parent = parents[parents.length - 1]; parents.length--;
                scope.hookup("saturationSpectrum", component);
                if (component.setAttribute) {
                    component.setAttribute("id", "saturationSpectrum_n8rv8q");
                }
                if (scope.componentsFor["saturationSpectrum"]) {
                   scope.componentsFor["saturationSpectrum"].setAttribute("for", "saturationSpectrum_n8rv8q")
                }
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            node = document.createElement("DIV");
            parent.appendChild(node);
            component = node.actualNode;
            if (component.setAttribute) {
            component.setAttribute("class", "lightnessCenter");
            }
            parents[parents.length] = parent; parent = node;
            // DIV
                node = document.createBody();
                parent.appendChild(node);
                parents[parents.length] = parent; parent = node;
                // SPECTRUM
                    node = {tagName: "spectrum"};
                    node.component = $THIS$2;
                    callee = scope.nest();
                    callee.argument = node;
                    callee.id = "lightnessSpectrum";
                    component = new $SPECTRUM(parent, callee);
                node = parent; parent = parents[parents.length - 1]; parents.length--;
                scope.hookup("lightnessSpectrum", component);
                if (component.setAttribute) {
                    component.setAttribute("id", "lightnessSpectrum_rwyb8");
                }
                if (scope.componentsFor["lightnessSpectrum"]) {
                   scope.componentsFor["lightnessSpectrum"].setAttribute("for", "lightnessSpectrum_rwyb8")
                }
            node = parent; parent = parents[parents.length - 1]; parents.length--;
        node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype = Object.create($SUPER.prototype);
$THIS.prototype.constructor = $THIS;
$THIS.prototype.exports = {};
module.exports = $THIS;
var $THIS$0 = function ColorimhtmlColorim$0(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$1 = function ColorimhtmlColorim$1(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$2 = function ColorimhtmlColorim$2(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};

}],["colorim.js","colorim.html","colorim.js",{"pop-observe":63,"./swatch":18},function (require, exports, module, __filename, __dirname){

// colorim.html/colorim.js
// -----------------------

"use strict";

var O = require("pop-observe");
var Swatch = require("./swatch");

module.exports = ColorField;
function ColorField(body, caller) {
    this._activeSpectrumIndex = null;
    this.activeSpectrum = null;
    this.spectra = null;
    this.hue = 0;
    this.saturation = 255;
    this.lightness = 255/2;
}

ColorField.prototype.focus = function () {
    this.activeSpectrumIndex = 0;
};

ColorField.prototype.blur = function () {
    this.activeSpectrumIndex = null;
};

Object.defineProperty(ColorField.prototype, "activeSpectrumIndex", {
    get: function () {
        return this._activeSpectrumIndex;
    },
    set: function (index) {
        if (index === this._activeSpectrumIndex) {
            return;
        }
        if (index != null && !this.spectra[index]) {
            return;
        }
        if (this.activeSpectrum) {
            this.activeSpectrum.active = false;
        }
        if (index == null) {
            this._activeSpectrumIndex = null;
            this.activeSpectrum = null;
            return;
        }
        this._activeSpectrumIndex = index;
        this.activeSpectrum = this.spectra[index];
        this.activeSpectrum.active = true;
    }
});

ColorField.prototype.hookup = function add(id, component, scope) {
    var self = this;
    var components = scope.components;
    if (id === "this") {
        this.spectra = [
            components.hueSpectrum,
            components.saturationSpectrum,
            components.lightnessSpectrum
        ];

        components.hueSpectrum.createSwatch = function (value, index) {
            return new Swatch(value, self.saturation, self.lightness, index);
        };
        components.hueSpectrum.assign = function (swatch) {
            self.value = swatch;
            self.hue = swatch.hue;
            self.update();
        };

        components.saturationSpectrum.index = 4;
        components.saturationSpectrum.createSwatch = function (value, index) {
            return new Swatch(self.hue, value, self.lightness, index);
        };
        components.saturationSpectrum.assign = function (swatch) {
            self.value = swatch;
            self.saturation = swatch.saturation;
            self.update();
        };

        components.lightnessSpectrum.index = 2;
        components.lightnessSpectrum.createSwatch = function (value, index) {
            return new Swatch(self.hue, self.saturation, value, index);
        };
        components.lightnessSpectrum.assign = function (swatch) {
            self.value = swatch;
            self.lightness = swatch.lightness;
            self.update();
        };

        this.update();

    } else if (id === "spectrum:iteration") {
        components.swatch.actualNode.style.backgroundColor = component.value.toStyle();
        components.swatch.actualNode.style.left = (component.value.index * 60) + 'px';
    }
};

ColorField.prototype.handleEvent = function handleEvent(event) {
    var key = event.key || String.fromCharCode(event.charCode);
    var keyCode = event.keyCode || event.charCode;
    if (this._activeSpectrumIndex !== null) {
        this.activeSpectrum.handleEvent(event);
    }
    if (event.type === "keypress") {
        if (key === "h") {
        //    return this.handleLeftCommand();
        } else if (key === "j") {
            return this.handleDownCommand();
        } else if (key === "k") {
            return this.handleUpCommand();
        } else if (key === "l") {
        //    return this.handleRightCommand();
        } else if (key === "H") {
        //    return this.handleShiftLeftCommand();
        } else if (key === "J") {
        //    return this.handleShiftDownCommand();
        } else if (key === "K") {
        //    return this.handleShiftUpCommand();
        } else if (key === "L") {
        //    return this.handleShiftRightCommand();
        }
    } else if (event.type === "keydown") {
        if (keyCode === 27) {
        //    this.value = null;
        } else if (keyCode === 37 && event.shiftKey) {
        //    return this.handleShiftLeftCommand();
        } else if (keyCode === 37) {
        //    return this.handleLeftCommand();
        } else if (keyCode === 38) {
            return this.handleUpCommand();
        } else if (keyCode === 39 && event.shiftKey) {
        //    return this.handleShiftRightCommand();
        } else if (keyCode === 39) {
        //    return this.handleRightCommand();
        } else if (keyCode === 40) {
            return this.handleDownCommand();
        }
    }
};

ColorField.prototype.update = function update() {
    if (this.updating) {
        return;
    }
    this.updating = true;
    var components = this.scope.components;
    components.hueSpectrum.update(this.value);
    components.saturationSpectrum.update(this.value);
    components.lightnessSpectrum.update(this.value);
    components.hueSpectrum.update(this.value);
    components.saturationSpectrum.update(this.value);
    components.lightnessSpectrum.update(this.value);
    this.updating = false;
};

ColorField.prototype.handleUpCommand = function handleUpCommand() {
    var index = null;
    if (this._activeSpectrumIndex === null) {
        index = 0;
    } else if (this.spectra[this._activeSpectrumIndex - 1]) {
        index = this._activeSpectrumIndex - 1;
    } else {
        return;
    }
    this.activeSpectrumIndex = index;
};

ColorField.prototype.handleDownCommand = function handleDownCommand() {
    var index = null;
    if (this._activeSpectrumIndex === null) {
        index = 0;
    } else if (this.spectra[this._activeSpectrumIndex + 1]) {
        index = this._activeSpectrumIndex + 1;
    } else {
        return;
    }
    this.activeSpectrumIndex = index;
};


}],["hue-spectrum.html","colorim.html","hue-spectrum.html",{"./hue-spectrum":15,"gutentag/repeat.html":38},function (require, exports, module, __filename, __dirname){

// colorim.html/hue-spectrum.html
// ------------------------------

"use strict";
var $SUPER = require("./hue-spectrum");
var $REPEAT = require("gutentag/repeat.html");
var $THIS = function ColorimhtmlHuespectrum(body, caller) {
    $SUPER.apply(this, arguments);
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    if (component.setAttribute) {
    component.setAttribute("class", "spectrum");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createBody();
        parent.appendChild(node);
        parents[parents.length] = parent; parent = node;
        // REPEAT
            node = {tagName: "repeat"};
            node.component = $THIS$0;
            callee = scope.nest();
            callee.argument = node;
            callee.id = "spectrum";
            component = new $REPEAT(parent, callee);
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        scope.hookup("spectrum", component);
        if (component.setAttribute) {
            component.setAttribute("id", "spectrum_2bsaue");
        }
        if (scope.componentsFor["spectrum"]) {
           scope.componentsFor["spectrum"].setAttribute("for", "spectrum_2bsaue")
        }
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("reticle", component);
    if (component.setAttribute) {
    component.setAttribute("class", "reticle");
    }
    if (component.setAttribute) {
        component.setAttribute("id", "reticle_kwowxj");
    }
    if (scope.componentsFor["reticle"]) {
       scope.componentsFor["reticle"].setAttribute("for", "reticle_kwowxj")
    }
    parents[parents.length] = parent; parent = node;
    // DIV
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype = Object.create($SUPER.prototype);
$THIS.prototype.constructor = $THIS;
$THIS.prototype.exports = {};
module.exports = $THIS;
var $THIS$0 = function ColorimhtmlHuespectrum$0(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("swatch", component);
    if (component.setAttribute) {
    component.setAttribute("class", "swatch");
    }
    if (component.setAttribute) {
        component.setAttribute("id", "swatch_axeu5d");
    }
    if (scope.componentsFor["swatch"]) {
       scope.componentsFor["swatch"].setAttribute("for", "swatch_axeu5d")
    }
    parents[parents.length] = parent; parent = node;
    // DIV
    node = parent; parent = parents[parents.length - 1]; parents.length--;
};

}],["hue-spectrum.js","colorim.html","hue-spectrum.js",{"pop-observe":63,"./swatch":18,"./spectrum":17},function (require, exports, module, __filename, __dirname){

// colorim.html/hue-spectrum.js
// ----------------------------

"use strict";

var O = require("pop-observe");
var Swatch = require("./swatch");
var Spectrum = require("./spectrum");

module.exports = HueSpectrum;
function HueSpectrum(body, caller) {
    this.resolution = 0;
    this.divisions = 3;
    this.index = 1;
    this.swatches = [];
    this.reticleColor = new Swatch(0, 1, 0);
    O.makeArrayObservable(this.swatches);
    this._active = false;
}

HueSpectrum.prototype = Object.create(Spectrum.prototype);
HueSpectrum.prototype.constructor = HueSpectrum;

HueSpectrum.prototype.resolutions = [
    3, // *2
    6, // *2
    12, // *2
    60, // *5
    120, // *2
    360 // *3
];

HueSpectrum.prototype.breadth = 360;

HueSpectrum.prototype.setResolution = function (resolution) {
    var divisions = this.resolutions[resolution];
    this.index = this.index * divisions / this.divisions;
    this.divisions = divisions;
    this.resolution = resolution;
    this.update();
};

HueSpectrum.prototype.handleLeftCommand = function handleLeftCommand() {
    this.index = (this.divisions + this.index - 1) % this.divisions;
    this.update();
};

HueSpectrum.prototype.handleRightCommand = function handleRightCommand() {
    this.index = (this.index + 1) % this.divisions;
    this.update();
};

HueSpectrum.prototype.update = function update(swatchValue) {
    this.value = this.breadth / this.divisions * this.index;
    this.swatches.clear();
    var offset = Math.floor(this.divisions / 2);
    var jndex = this.index - offset;
    for (var index = 0; index < this.divisions; index++, jndex++) {
        var value = (this.breadth / this.divisions * jndex) % this.breadth;
        this.swatches.push(this.createSwatch(value, index - offset));
    }
    this.value = this.swatches[offset];
    if (this.value == undefined) {
        throw new Error('This should not be ' + offset);
    }
    this.assign(this.value);
    this.updateReticle(swatchValue);
};


}],["spectrum.html","colorim.html","spectrum.html",{"./spectrum":17,"gutentag/repeat.html":38},function (require, exports, module, __filename, __dirname){

// colorim.html/spectrum.html
// --------------------------

"use strict";
var $SUPER = require("./spectrum");
var $REPEAT = require("gutentag/repeat.html");
var $THIS = function ColorimhtmlSpectrum(body, caller) {
    $SUPER.apply(this, arguments);
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    if (component.setAttribute) {
    component.setAttribute("class", "spectrum");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createBody();
        parent.appendChild(node);
        parents[parents.length] = parent; parent = node;
        // REPEAT
            node = {tagName: "repeat"};
            node.component = $THIS$0;
            callee = scope.nest();
            callee.argument = node;
            callee.id = "spectrum";
            component = new $REPEAT(parent, callee);
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        scope.hookup("spectrum", component);
        if (component.setAttribute) {
            component.setAttribute("id", "spectrum_s0ygjm");
        }
        if (scope.componentsFor["spectrum"]) {
           scope.componentsFor["spectrum"].setAttribute("for", "spectrum_s0ygjm")
        }
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("reticle", component);
    if (component.setAttribute) {
    component.setAttribute("class", "reticle");
    }
    if (component.setAttribute) {
        component.setAttribute("id", "reticle_as6nko");
    }
    if (scope.componentsFor["reticle"]) {
       scope.componentsFor["reticle"].setAttribute("for", "reticle_as6nko")
    }
    parents[parents.length] = parent; parent = node;
    // DIV
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype = Object.create($SUPER.prototype);
$THIS.prototype.constructor = $THIS;
$THIS.prototype.exports = {};
module.exports = $THIS;
var $THIS$0 = function ColorimhtmlSpectrum$0(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("swatch", component);
    if (component.setAttribute) {
    component.setAttribute("class", "swatch");
    }
    if (component.setAttribute) {
        component.setAttribute("id", "swatch_u0xlz6");
    }
    if (scope.componentsFor["swatch"]) {
       scope.componentsFor["swatch"].setAttribute("for", "swatch_u0xlz6")
    }
    parents[parents.length] = parent; parent = node;
    // DIV
    node = parent; parent = parents[parents.length - 1]; parents.length--;
};

}],["spectrum.js","colorim.html","spectrum.js",{"pop-observe":63,"./swatch":18},function (require, exports, module, __filename, __dirname){

// colorim.html/spectrum.js
// ------------------------

"use strict";

var O = require("pop-observe");
var Swatch = require("./swatch");

module.exports = Spectrum;
function Spectrum(body, caller) {
    this.resolution = 0;
    this.divisions = 5;
    this.index = 0;
    this.swatches = [];
    this.reticleColor = new Swatch(0, 1, 0);
    O.makeArrayObservable(this.swatches);
    this._active = false;
}

Spectrum.prototype.resolutions = [
    5,
    25,
    100
];

Spectrum.prototype.breadth = 1;

Object.defineProperty(Spectrum.prototype, "active", {
    get: function () {
        return this._active;
    },
    set: function (active) {
        this._active = active;
        if (active) {
            this.scope.components.reticle.classList.add("active");
        } else {
            this.scope.components.reticle.classList.remove("active");
        }
    }
});

Spectrum.prototype.hookup = function add(id, component, scope) {
    var components = scope.components;
    if (id === "spectrum:iteration") {
        components.swatch.style.backgroundColor = component.value.toStyle();
        components.swatch.style.left = (component.value.index * 60) + 'px';
    } else if (id === "this") {
        components.spectrum.value = this.swatches;
    }
};

Spectrum.prototype.handleEvent = function handleEvent(event) {
    var key = event.key || String.fromCharCode(event.charCode);
    var keyCode = event.keyCode || event.charCode;
    if (event.type === "keypress") {
        if (key === "h") {
            return this.handleLeftCommand();
        } else if (key === "l") {
            return this.handleRightCommand();
        } else if (key === "H") {
            return this.handleShiftLeftCommand();
        } else if (key === "L") {
            return this.handleShiftRightCommand();
        }
    } else if (event.type === "keydown") {
        if (keyCode === 27) {
        } else if (keyCode === 37 && event.shiftKey) {
            return this.handleShiftLeftCommand();
        } else if (keyCode === 37) {
            return this.handleLeftCommand();
        } else if (keyCode === 39 && event.shiftKey) {
            return this.handleShiftRightCommand();
        } else if (keyCode === 39) {
            return this.handleRightCommand();
        }
    }
};

Spectrum.prototype.handleShiftLeftCommand = function () {
    if (this.resolution <= 0) {
        return
    }
    this.setResolution(this.resolution - 1);
};

Spectrum.prototype.handleShiftRightCommand = function () {
    if (this.resolution >= this.resolutions.length - 1) {
        return;
    }
    this.setResolution(this.resolution + 1);
};

Spectrum.prototype.setResolution = function (resolution) {
    var divisions = this.resolutions[resolution];
    this.index = Math.round(this.index * (divisions - 1) / (this.divisions - 1));
    this.divisions = divisions;
    this.resolution = resolution;
    this.update();
};

Spectrum.prototype.handleLeftCommand = function handleLeftCommand() {
    this.index = Math.max(0, this.index - 1);
    this.update();
};

Spectrum.prototype.handleRightCommand = function handleRightCommand() {
    this.index = Math.min(this.index + 1, this.divisions - 1);
    this.update();
};

Spectrum.prototype.update = function update(swatchValue) {
    this.value = this.breadth / (this.divisions - 1) * this.index;
    this.swatches.clear();
    var offset = Math.floor(this.index);
    for (var index = 0; index < this.divisions; index++) {
        var value = (this.breadth / (this.divisions - 1) * index);
        this.swatches.push(this.createSwatch(value, index - offset));
    }
    this.value = this.swatches[offset];
    if (this.value == undefined) {
        throw new Error('This should not be ' + offset);
    }
    this.assign(this.value);
    this.updateReticle(swatchValue);
};

Spectrum.prototype.updateReticle = function updateReticle(swatchValue) {
    if (swatchValue) {
        this.reticleColor.lightness = (1 - Math.round(swatchValue.lightness));
        this.scope.components.reticle.style.borderColor = this.reticleColor.toStyle();
    }
};


}],["swatch.js","colorim.html","swatch.js",{},function (require, exports, module, __filename, __dirname){

// colorim.html/swatch.js
// ----------------------

"use strict";

module.exports = Swatch;
function Swatch(hue, saturation, lightness, index) {
    this.hue = hue; // 0..359 where 360==0
    this.saturation = saturation; // 0..1
    this.lightness = lightness; // 0..1
    this.index = index;
}

Swatch.prototype.clone = function () {
    return new this.constructor().assign(this);
};

Swatch.prototype.assign = function (swatch) {
    this.hue = swatch.hue;
    this.saturation = swatch.saturation;
    this.lightness = swatch.lightness;
    this.index = swatch.index;
    return this;
};

Swatch.prototype.toStyle = function () {
    return (
        'hsla(' +
        this.hue.toFixed() + ', ' +
        Math.round(this.saturation * 100).toFixed(2) + '%, ' +
        Math.round(this.lightness * 100).toFixed(2) + '%, ' +
        '1)'
    );
};

}],["essays/digger/area.js","delf/essays/digger","area.js",{"collections/fast-map":3,"ndim/point2":48},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/area.js
// --------------------------

"use strict";

var FastMap = require("collections/fast-map");
var Point2 = require("ndim/point2");

// shared temporary variable
var point = new Point2();

module.exports = Area;
function Area(size, position, tiles, tileViews) {
    this.size = size || new Point2();
    this.position = position || new Point2();
    this.tiles = tiles || new FastMap();
    this.tileViews = tileViews;
}

Area.prototype.get = function (offset) {
    point.become(this.position).addThis(offset);
    return this.tiles.get(point);
};

Area.prototype.touch = function (offset) {
    point.become(this.position).addThis(offset);
    this.tileViews.get(point).draw();
};

Area.prototype.sliceThis = function (position, size) {
    return new Area(size, this.position.add(position), this.tiles, this.tileViews);
};

Area.prototype.forEach = function (callback, thisp) {
    var width = this.size.x;
    var height = this.size.y;
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            point.x = this.position.x + x;
            point.y = this.position.y + y;
            var tileView = this.tileViews && this.tileViews.get(point);
            callback.call(thisp, this.tiles.get(point), x, y);
            if (tileView) {
                tileView.draw();
            }
        }
    }
};

Area.prototype.fill = function (value) {
    this.forEach(function (tile) {
        tile.value = value;
    });
};

Area.prototype.dig = function (value) {
    this.forEach(function (tile) {
        tile.value = 0;
    });
};

Area.prototype.flip = function () {
    this.forEach(function (tile) {
        tile.value = +!tile.value;
    });
};

Area.prototype.subThis = function (that) {
    this.forEach(function (tile, x, y) {
        point.x = x % that.size.x;
        point.y = y % that.size.y;
        if (that.get(point)) {
            tile.value = false;
        }
    });
};

Area.prototype.addThis = function (that) {
};

Area.prototype.transpose = function () {
};

Area.prototype.flipTranspose = function () {
};

Area.prototype.flipHorizontal = function () {
};

Area.prototype.flipVertical = function () {
};

}],["essays/digger/color-picker-mode.js","delf/essays/digger","color-picker-mode.js",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/color-picker-mode.js
// ---------------------------------------

'use strict';

module.exports = enterColorPickerMode;

function enterColorPickerMode(colorPicker, exit) {

    function colorPickerMode(event, key, keyCode) {
        if (event.type === "keyup") {
            if (keyCode === 27 || keyCode === 13) { // escape
                return exitColorPickerMode();
            }
        }
        colorPicker.handleEvent(event);
        return colorPickerMode;
    }

    function exitColorPickerMode() {
        colorPicker.blur();
        return exit();
    }

    colorPicker.focus();
    return colorPickerMode;
}

}],["essays/digger/common-mode.js","delf/essays/digger","common-mode.js",{"./color-picker-mode":20},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/common-mode.js
// ---------------------------------

"use strict";

var enterColorPickerMode = require('./color-picker-mode');

module.exports = enterCursorOrKnobMode;
function enterCursorOrKnobMode(delf, viewport) {

    function cursorOrKnobMode(event, key, keyCode, mode) {
        if (event.type === "keypress") {
            if (key === "d") {
                viewport.dig();
            } else if (key === "f") {
                viewport.fill(delf.fillValue);
            } else if (key === "c" || key === "y") {
                viewport.copy();
            } else if (key === "x") {
                viewport.cut();
                delf.draw();
            } else if (key === "v" || key === "p") {
                viewport.paste();
                delf.draw();
            } else if (key == "~") {
                viewport.flip();
                delf.draw();
            } else if (key === "-") {
                viewport.sub();
                delf.draw();
            } else if (key === "+") {
                viewport.add();
                delf.draw();
            } else if (key === "F") {
                delf.blur();
                delf.colorLine.style.visibility = 'visible';
                // TODO set colorLine delegate to fill cover
                return enterColorPickerMode(delf.colorPicker, exitColorPickerMode);
            } else if (key === "D") {
                delf.blur();
                delf.colorLine.style.visibility = 'visible';
                return enterColorPickerMode(delf.colorPicker, exitColorPickerMode);
            } else if (+key >= 1 && +key <= 9) {
                delf.fillValue = +key;
            }

            // enter - open inspector for commands to perform on the selected region
            // including the creation of a named region with triggers
            // set the cursor position to the origin
            // "(" begin macro end macro ")"
            // "." replay last command
            // "/" chat
            // "?" toggle help
            // number
            // save context (cursor etc)
            // restore context (cursor etc)
            // TODO
            // "D" set dig value (transparent background)
            // "F" set fill value (foreground value for current number)
            // "e" open inventory
            // "E" edit inventory?
            // ? color
            // "G" mark location
            // enter - open inspector for commands to perform on the selected region
            // including the creation of a named region with triggers
            // set the cursor position to the origin
            // "(" begin macro end macro ")"
            // "." replay last command
            // "/" chat
            // "?" toggle help
            // number
            // save context (cursor etc)
            // restore context (cursor etc)
        }

        function exitColorPickerMode() {
            delf.focus();
            delf.colorLine.style.visibility = 'hidden';
            return mode;
        }

        return mode;
    }

    return cursorOrKnobMode;
}


}],["essays/digger/cursor-mode.html","delf/essays/digger","cursor-mode.html",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/cursor-mode.html
// -----------------------------------

"use strict";
var $THIS = function DelfEssaysDiggerCursormode(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("element", component);
    if (component.setAttribute) {
        component.setAttribute("id", "element_de06xs");
    }
    if (scope.componentsFor["element"]) {
       scope.componentsFor["element"].setAttribute("for", "element_de06xs")
    }
    if (component.setAttribute) {
    component.setAttribute("class", "mode cursor-mode shown");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createElement("STRONG");
        parent.appendChild(node);
        component = node.actualNode;
        parents[parents.length] = parent; parent = node;
        // STRONG
            parent.appendChild(document.createTextNode("cursor mode:"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("digButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "digButton_id5arz");
        }
        if (scope.componentsFor["digButton"]) {
           scope.componentsFor["digButton"].setAttribute("for", "digButton_id5arz")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("d"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("ig"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("fillButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "fillButton_h3uzx7");
        }
        if (scope.componentsFor["fillButton"]) {
           scope.componentsFor["fillButton"].setAttribute("for", "fillButton_h3uzx7")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("f"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("ill"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("originButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "originButton_oikxxq");
        }
        if (scope.componentsFor["originButton"]) {
           scope.componentsFor["originButton"].setAttribute("for", "originButton_oikxxq")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("g"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("o (origin)"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("moveButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "moveButton_d5y2zo");
        }
        if (scope.componentsFor["moveButton"]) {
           scope.componentsFor["moveButton"].setAttribute("for", "moveButton_d5y2zo")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("hjkl"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" move"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("creepButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "creepButton_26zyqs");
        }
        if (scope.componentsFor["creepButton"]) {
           scope.componentsFor["creepButton"].setAttribute("for", "creepButton_26zyqs")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("I");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // I
                parent.appendChild(document.createTextNode("shift"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" creep"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("resizeButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "resizeButton_u9ezf8");
        }
        if (scope.componentsFor["resizeButton"]) {
           scope.componentsFor["resizeButton"].setAttribute("for", "resizeButton_u9ezf8")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("i"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("/"));
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("I"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" resize"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("resizeToButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "resizeToButton_3ccd44");
        }
        if (scope.componentsFor["resizeToButton"]) {
           scope.componentsFor["resizeToButton"].setAttribute("for", "resizeToButton_3ccd44")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            parent.appendChild(document.createTextNode("…to "));
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("0"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("selectModeButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "selectModeButton_bku8zj");
        }
        if (scope.componentsFor["selectModeButton"]) {
           scope.componentsFor["selectModeButton"].setAttribute("for", "selectModeButton_bku8zj")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("s"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("elect…"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("cutButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "cutButton_6z4r8j");
        }
        if (scope.componentsFor["cutButton"]) {
           scope.componentsFor["cutButton"].setAttribute("for", "cutButton_6z4r8j")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("x"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" cut"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("copyButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "copyButton_c8v49u");
        }
        if (scope.componentsFor["copyButton"]) {
           scope.componentsFor["copyButton"].setAttribute("for", "copyButton_c8v49u")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("c"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("opy / "));
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("y"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("ank"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("pasteButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "pasteButton_oileg9");
        }
        if (scope.componentsFor["pasteButton"]) {
           scope.componentsFor["pasteButton"].setAttribute("for", "pasteButton_oileg9")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("v"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" / "));
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("p"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("aste"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("toggleButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "toggleButton_60420e");
        }
        if (scope.componentsFor["toggleButton"]) {
           scope.componentsFor["toggleButton"].setAttribute("for", "toggleButton_60420e")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            parent.appendChild(document.createTextNode("~"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("addButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "addButton_t21kxf");
        }
        if (scope.componentsFor["addButton"]) {
           scope.componentsFor["addButton"].setAttribute("for", "addButton_t21kxf")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            parent.appendChild(document.createTextNode("+"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("subButton", component);
        if (component.setAttribute) {
            component.setAttribute("id", "subButton_i14814");
        }
        if (scope.componentsFor["subButton"]) {
           scope.componentsFor["subButton"].setAttribute("for", "subButton_i14814")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            parent.appendChild(document.createTextNode("-"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype.exports = {};
module.exports = $THIS;

}],["essays/digger/cursor-mode.js","delf/essays/digger","cursor-mode.js",{"./knob-mode":32,"./common-mode":21,"./inspector-mode":29,"./file-mode":27},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/cursor-mode.js
// ---------------------------------

"use strict";

var enterKnobMode = require("./knob-mode");
var enterCursorOrKnobMode = require("./common-mode");
var enterInspectorMode = require("./inspector-mode");
//var enterFileMode = require("./file-mode");

module.exports = enterCursorMode;
function enterCursorMode(delf, viewport) {
    var cursorOrKnobMode = enterCursorOrKnobMode(delf, viewport);

    function cursorMode(event, key, keyCode) {
        if (event.type === "keyup") {
            if (keyCode === 13) {
                viewport.bottomCurb = 0;
                delf.blur();
                delf.draw();
                return enterInspectorMode(delf, function () {
                    viewport.bottomCurb = 40;
                    delf.focus();
                    delf.draw();
                    return cursorMode;
                });
            }
        } else if (event.type === "keypress") {
            if (delf.directionKeys[key]) {
                // move by stride
                delf.viewport.moveCursor(delf.directionKeys[key]);
                delf.draw();
            } else if (delf.directionKeys[key.toLowerCase()]) {
                // move by one
                delf.viewport.creepCursor(delf.directionKeys[key.toLowerCase()]);
                delf.draw();
            // } else if (/[1-9]/.test(key)) {
            //     return makeIntegerMode(key, function (number) {
            //         if (number) {
            //             return makeRepeatMode(number, function () {
            //                 return cursorMode;
            //             });
            //         } else {
            //             return cursorMode;
            //         }
            //     });
            } else if (key === "s") {
                return enterKnobMode(delf, viewport, function () {
                    return cursorMode;
                });
            } else if (key === "0") {
                delf.viewport.collapseCursor();
                delf.draw();
            } else if (key === "I") {
                delf.viewport.growCursor();
                delf.draw();
            } else if (key === "i") {
                delf.viewport.shrinkCursor();
                delf.draw();
            //} else if (key === ":") {
            //    return enterFileMode(function () {
            //        return cursorMode;
            //    });
            } else if (key === "g") { // go
                delf.viewport.moveCursorToOrigin();
                delf.draw();
            }
            // TODO "gg" for origin, "gX" for other marked locations
            // TODO "G" mark a location
            // TODO "GG" move origin
        }
        return cursorOrKnobMode(event, key, keyCode, cursorMode);
    }

    return cursorMode;
}


}],["essays/digger/delf.html","delf/essays/digger","delf.html",{"./delf":25,"gutentag/reveal.html":40,"colorim.html":12,"./inventory.html":30,"./viewport.html":35,"./cursor-mode.html":22,"./knob-mode.html":31,"./file-mode.html":26},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/delf.html
// ----------------------------

"use strict";
var $SUPER = require("./delf");
var $REVEAL = require("gutentag/reveal.html");
var $COLORIM = require("colorim.html");
var $INVENTORY = require("./inventory.html");
var $VIEWPORT = require("./viewport.html");
var $CURSORMODE = require("./cursor-mode.html");
var $KNOBMODE = require("./knob-mode.html");
var $FILEMODE = require("./file-mode.html");
var $THIS = function DelfEssaysDiggerDelf(body, caller) {
    $SUPER.apply(this, arguments);
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("STYLE");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("styleSheet", component);
    if (component.setAttribute) {
        component.setAttribute("id", "styleSheet_2a11rr");
    }
    if (scope.componentsFor["styleSheet"]) {
       scope.componentsFor["styleSheet"].setAttribute("for", "styleSheet_2a11rr")
    }
    parents[parents.length] = parent; parent = node;
    // STYLE
        parent.appendChild(document.createTextNode("body {}\n            .tile1 {}\n            .tile2 {}\n            .tile3 {}\n            .tile4 {}\n            .tile5 {}\n            .tile6 {}\n            .tile7 {}\n            .tile8 {}\n            .tile9 {}"));
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("container", component);
    if (component.setAttribute) {
        component.setAttribute("id", "container_h7h181");
    }
    if (scope.componentsFor["container"]) {
       scope.componentsFor["container"].setAttribute("for", "container_h7h181")
    }
    if (component.setAttribute) {
    component.setAttribute("class", "container");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createBody();
        parent.appendChild(node);
        parents[parents.length] = parent; parent = node;
        // VIEWPORT
            node = {tagName: "viewport"};
            node.component = $THIS$0;
            callee = scope.nest();
            callee.argument = node;
            callee.id = "viewport";
            component = new $VIEWPORT(parent, callee);
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        scope.hookup("viewport", component);
        if (component.setAttribute) {
            component.setAttribute("id", "viewport_tyfm0z");
        }
        if (scope.componentsFor["viewport"]) {
           scope.componentsFor["viewport"].setAttribute("for", "viewport_tyfm0z")
        }
        node = document.createElement("DIV");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("colorLine", component);
        if (component.setAttribute) {
        component.setAttribute("class", "colorline");
        }
        if (component.setAttribute) {
            component.setAttribute("id", "colorLine_8be5ph");
        }
        if (scope.componentsFor["colorLine"]) {
           scope.componentsFor["colorLine"].setAttribute("for", "colorLine_8be5ph")
        }
        parents[parents.length] = parent; parent = node;
        // DIV
            node = document.createBody();
            parent.appendChild(node);
            parents[parents.length] = parent; parent = node;
            // COLORIM
                node = {tagName: "colorim"};
                node.component = $THIS$1;
                callee = scope.nest();
                callee.argument = node;
                callee.id = "colorPicker";
                component = new $COLORIM(parent, callee);
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            scope.hookup("colorPicker", component);
            if (component.setAttribute) {
                component.setAttribute("id", "colorPicker_5od1n0");
            }
            if (scope.componentsFor["colorPicker"]) {
               scope.componentsFor["colorPicker"].setAttribute("for", "colorPicker_5od1n0")
            }
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        node = document.createElement("DIV");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "inventoryline");
        }
        parents[parents.length] = parent; parent = node;
        // DIV
            node = document.createBody();
            parent.appendChild(node);
            parents[parents.length] = parent; parent = node;
            // INVENTORY
                node = {tagName: "inventory"};
                node.component = $THIS$2;
                callee = scope.nest();
                callee.argument = node;
                callee.id = "inventory";
                component = new $INVENTORY(parent, callee);
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            scope.hookup("inventory", component);
            if (component.setAttribute) {
                component.setAttribute("id", "inventory_ligl0v");
            }
            if (scope.componentsFor["inventory"]) {
               scope.componentsFor["inventory"].setAttribute("for", "inventory_ligl0v")
            }
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        node = document.createElement("DIV");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "modeline");
        }
        parents[parents.length] = parent; parent = node;
        // DIV
            node = document.createBody();
            parent.appendChild(node);
            parents[parents.length] = parent; parent = node;
            // CURSORMODE
                node = {tagName: "cursormode"};
                node.component = $THIS$3;
                callee = scope.nest();
                callee.argument = node;
                callee.id = "cursorMode";
                component = new $CURSORMODE(parent, callee);
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            scope.hookup("cursorMode", component);
            if (component.setAttribute) {
                component.setAttribute("id", "cursorMode_v3jgpx");
            }
            if (scope.componentsFor["cursorMode"]) {
               scope.componentsFor["cursorMode"].setAttribute("for", "cursorMode_v3jgpx")
            }
            node = document.createBody();
            parent.appendChild(node);
            parents[parents.length] = parent; parent = node;
            // KNOBMODE
                node = {tagName: "knobmode"};
                node.component = $THIS$4;
                callee = scope.nest();
                callee.argument = node;
                callee.id = "knobMode";
                component = new $KNOBMODE(parent, callee);
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            scope.hookup("knobMode", component);
            if (component.setAttribute) {
                component.setAttribute("id", "knobMode_ktl297");
            }
            if (scope.componentsFor["knobMode"]) {
               scope.componentsFor["knobMode"].setAttribute("for", "knobMode_ktl297")
            }
            node = document.createBody();
            parent.appendChild(node);
            parents[parents.length] = parent; parent = node;
            // FILEMODE
                node = {tagName: "filemode"};
                node.component = $THIS$5;
                callee = scope.nest();
                callee.argument = node;
                callee.id = "fileMode";
                component = new $FILEMODE(parent, callee);
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            scope.hookup("fileMode", component);
            if (component.setAttribute) {
                component.setAttribute("id", "fileMode_5k7ick");
            }
            if (scope.componentsFor["fileMode"]) {
               scope.componentsFor["fileMode"].setAttribute("for", "fileMode_5k7ick")
            }
        node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("inspector", component);
    if (component.setAttribute) {
        component.setAttribute("id", "inspector_tcqxjj");
    }
    if (scope.componentsFor["inspector"]) {
       scope.componentsFor["inspector"].setAttribute("for", "inspector_tcqxjj")
    }
    if (component.setAttribute) {
    component.setAttribute("class", "inspector");
    }
    if (component.setAttribute) {
    component.setAttribute("style", "visibility: hidden");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype = Object.create($SUPER.prototype);
$THIS.prototype.constructor = $THIS;
$THIS.prototype.exports = {};
module.exports = $THIS;
var $THIS$0 = function DelfEssaysDiggerDelf$0(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$1 = function DelfEssaysDiggerDelf$1(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$2 = function DelfEssaysDiggerDelf$2(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$3 = function DelfEssaysDiggerDelf$3(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$4 = function DelfEssaysDiggerDelf$4(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};
var $THIS$5 = function DelfEssaysDiggerDelf$5(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
};

}],["essays/digger/delf.js","delf/essays/digger","delf.js",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/delf.js
// --------------------------

'use strict';

module.exports = DelfView;
function DelfView(slot, scope) {
    this.isFileMenuMode = false;
    this.animator = scope.animator.add(this);
    this.fillValue = 1;
    this.pal = {};
}

DelfView.prototype.hookup = function hookup(id, component, scope) {
    if (id === 'this') {
        this.hookupThis(component, scope);
    }
};

DelfView.prototype.focus = function focus() {
    this.viewport.focus();
};

DelfView.prototype.blur = function blur() {
    this.viewport.blur();
};

DelfView.prototype.hookupThis = function hookupThis(component, scope) {
    var components = scope.components;
    this.viewport = components.viewport;
    this.viewport.bottomCurb = 40;

    this.cursorMode = components.cursorMode;
    this.knobMode = components.knobMode;
    this.fileMode = components.fileMode;
    this.colorPicker = components.colorPicker;
    this.colorLine = components.colorLine;
    this.styleSheet = components.styleSheet.sheet;
    this.inspector = components.inspector;

    this.colorLine.style.visibility = 'hidden';
    this.colorPicker.delegate = this;
};

Object.defineProperty(DelfView.prototype, 'isCursorMode', {
    get: function () {
        return this.viewport.isCursorMode;
    },
    set: function (value) {
        this.viewport.isCursorMode = value;
    }
});

Object.defineProperty(DelfView.prototype, 'isKnobMode', {
    get: function () {
        return this.viewport.isKnobMode;
    },
    set: function (value) {
        this.viewport.isKnobMode = value;
    }
});

DelfView.prototype.handleColorChange = function handleColorChange(color) {
    this.styleSheet.deleteRule(this.fillValue);
    this.styleSheet.insertRule(".tile" + this.fillValue + " { background-color: " + color.toStyle() + " }", this.fillValue);
};

DelfView.prototype.handleResize = function handleResize() {
    this.viewport.handleResize();
};

DelfView.prototype.draw = function draw() {

    if (this.isCursorMode) {
        this.cursorMode.scope.components.element.classList.add('shown');
    } else {
        this.cursorMode.scope.components.element.classList.remove('shown');
    }
    if (this.isKnobMode) {
        this.knobMode.scope.components.element.classList.add('shown');
    } else {
        this.knobMode.scope.components.element.classList.remove('shown');
    }
    if (this.isFileMenuMode) {
        this.fileMode.scope.components.element.classList.add('shown');
    } else {
        this.fileMode.scope.components.element.classList.remove('shown');
    }

    this.viewport.draw();
};

DelfView.prototype.directionKeys = {
    h: 'left',
    j: 'down',
    k: 'up',
    l: 'right'
};


}],["essays/digger/file-mode.html","delf/essays/digger","file-mode.html",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/file-mode.html
// ---------------------------------

"use strict";
var $THIS = function DelfEssaysDiggerFilemode(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("element", component);
    if (component.setAttribute) {
        component.setAttribute("id", "element_9hwd81");
    }
    if (scope.componentsFor["element"]) {
       scope.componentsFor["element"].setAttribute("for", "element_9hwd81")
    }
    if (component.setAttribute) {
    component.setAttribute("class", "mode file-menu-mode");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createElement("STRONG");
        parent.appendChild(node);
        component = node.actualNode;
        parents[parents.length] = parent; parent = node;
        // STRONG
            parent.appendChild(document.createTextNode("file mode:"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("s"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("ave"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("l"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("load"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype.exports = {};
module.exports = $THIS;

}],["essays/digger/file-mode.js","delf/essays/digger","file-mode.js",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/file-mode.js
// -------------------------------

"use strict";

module.exports = enterFileMode;
function enterFileMode() {
}


}],["essays/digger/index.js","delf/essays/digger","index.js",{"gutentag/document":37,"gutentag/scope":42,"blick":0,"./delf.html":24,"./cursor-mode":23,"ndim/point2":48},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/index.js
// ---------------------------

'use strict';

var Document = require('gutentag/document');
var Scope = require('gutentag/scope');
var Animator = require('blick');
var View = require('./delf.html');
var enterCursorMode = require("./cursor-mode");
var Fusion = window.require('Fusion');

var Point2 = require('ndim/point2');
var temp = new Point2();

function main() {
    var scope = new Scope();
    var document = new Document(window.document.body);
    scope.animator = new Animator();
    var view = new View(document.documentElement, scope);
    var mode = enterCursorMode(view, view.viewport);

    var fusion = new Fusion("gol01.aelf.land:8181", {secure: false});
    var model = fusion("delf_worlds");

    model.subscribe({
        onAdded: function onAdded(record) {
            temp.x = record.x;
            temp.y = record.y;
            var tile = view.viewport.tiles.get(temp);
            if (record.value !== tile.value) {
                tile.value = record.value;
                view.viewport.animator.requestDraw();
            }
        },
        onRemoved: function onRemoved(record) {
            temp.x = record.x;
            temp.y = record.y;
            var tile = view.viewport.tiles.get(temp);
            tile.value = 0;
            view.viewport.animator.requestDraw();
        },
        onChanged: function onChanged(delta) {
            temp.x = delta.new_val.x;
            temp.y = delta.new_val.y;
            var tile = view.viewport.tiles.get(temp);
            tile.value = delta.new_val.value;
            view.viewport.animator.requestDraw();
        },
        onConnected: function (e) {
            console.log('connected');
        },
        onDisconnected: function (e) {
            console.log('disconnected');
        },
        onError: function (err) {
            console.log('error', err);
        }
    });

    view.viewport.storage = {
        update: function update(point, value) {
            if (value) {
                model.upsert({
                    id: point.x + ',' + point.y,
                    x: point.x,
                    y: point.y,
                    value: value
                });
            } else {
                model.remove({
                    id: point.x + ',' + point.y
                });
            }
            view.viewport.animator.requestDraw();
        }
    };

    // Event listeners
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyChange);
    window.addEventListener("keyup", keyChange);
    window.addEventListener("keypress", keyChange);
    window.addEventListener("mousedown", keyChange);
    window.addEventListener("mouseup", keyChange);
    window.addEventListener("mousemove", keyChange);

    resize();
    view.focus();
    view.draw();

    function resize() {
        view.handleResize();
    }

    function keyChange(event) {
        var key = event.key || String.fromCharCode(event.charCode);
        var keyCode = event.keyCode || event.charCode;
        mode = mode(event, key, keyCode);
    }
}

main();

}],["essays/digger/inspector-mode.js","delf/essays/digger","inspector-mode.js",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/inspector-mode.js
// ------------------------------------

"use strict";

module.exports = enterInspectorMode;
function enterInspectorMode(delf, exit) {

    delf.viewport.rightCurb = window.innerWidth / 3;
    delf.inspector.style.visibility = "visible";
    delf.draw();

    function _exit() {
        delf.viewport.rightCurb = 0;
        delf.inspector.style.visibility = "hidden";
        delf.draw();
        return exit();
    }

    function inspectorMode(event, key, keyCode) {
        if (event.type === "keyup") {
            if (keyCode === 27) {
                return _exit();
            }
        }
        return inspectorMode;
    }

    return inspectorMode;
}


}],["essays/digger/inventory.html","delf/essays/digger","inventory.html",{"gutentag/repeat.html":38,"gutentag/text.html":43},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/inventory.html
// ---------------------------------

"use strict";
var $REPEAT = require("gutentag/repeat.html");
var $TEXT = require("gutentag/text.html");
var $THIS = function DelfEssaysDiggerInventory(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createBody();
    parent.appendChild(node);
    parents[parents.length] = parent; parent = node;
    // REPEAT
        node = {tagName: "repeat"};
        node.component = $THIS$0;
        callee = scope.nest();
        callee.argument = node;
        callee.id = "items";
        component = new $REPEAT(parent, callee);
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    scope.hookup("items", component);
    if (component.setAttribute) {
        component.setAttribute("id", "items_5au3bz");
    }
    if (scope.componentsFor["items"]) {
       scope.componentsFor["items"].setAttribute("for", "items_5au3bz")
    }
    this.scope.hookup("this", this);
};
$THIS.prototype.exports = {};
module.exports = $THIS;
var $THIS$0 = function DelfEssaysDiggerInventory$0(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    if (component.setAttribute) {
    component.setAttribute("class", "inventoryItem");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createBody();
        parent.appendChild(node);
        parents[parents.length] = parent; parent = node;
        // TEXT
            node = {tagName: "text"};
            node.innerText = "";
            callee = scope.nest();
            callee.argument = node;
            callee.id = "itemText";
            component = new $TEXT(parent, callee);
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        scope.hookup("itemText", component);
        if (component.setAttribute) {
            component.setAttribute("id", "itemText_pn0s9p");
        }
        if (scope.componentsFor["itemText"]) {
           scope.componentsFor["itemText"].setAttribute("for", "itemText_pn0s9p")
        }
    node = parent; parent = parents[parents.length - 1]; parents.length--;
};

}],["essays/digger/knob-mode.html","delf/essays/digger","knob-mode.html",{},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/knob-mode.html
// ---------------------------------

"use strict";
var $THIS = function DelfEssaysDiggerKnobmode(body, caller) {
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("element", component);
    if (component.setAttribute) {
        component.setAttribute("id", "element_x5ewbk");
    }
    if (scope.componentsFor["element"]) {
       scope.componentsFor["element"].setAttribute("for", "element_x5ewbk")
    }
    if (component.setAttribute) {
    component.setAttribute("class", "mode knob-mode");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createElement("STRONG");
        parent.appendChild(node);
        component = node.actualNode;
        parents[parents.length] = parent; parent = node;
        // STRONG
            parent.appendChild(document.createTextNode("knob mode:"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("hjkl"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" move"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("I");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // I
                parent.appendChild(document.createTextNode("shift"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" creep"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("o"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("rbit"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("r"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("otate"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            parent.appendChild(document.createTextNode("res"));
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("i"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("ze"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("I");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // I
                parent.appendChild(document.createTextNode("shift"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" reverse"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("t"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode("ranspose"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
        parent.appendChild(document.createTextNode(" "));
        node = document.createElement("SPAN");
        parent.appendChild(node);
        component = node.actualNode;
        if (component.setAttribute) {
        component.setAttribute("class", "button");
        }
        parents[parents.length] = parent; parent = node;
        // SPAN
            node = document.createElement("U");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // U
                parent.appendChild(document.createTextNode("s"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" or "));
            node = document.createElement("I");
            parent.appendChild(node);
            component = node.actualNode;
            parents[parents.length] = parent; parent = node;
            // I
                parent.appendChild(document.createTextNode("escape"));
            node = parent; parent = parents[parents.length - 1]; parents.length--;
            parent.appendChild(document.createTextNode(" back…"));
        node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype.exports = {};
module.exports = $THIS;

}],["essays/digger/knob-mode.js","delf/essays/digger","knob-mode.js",{"./common-mode":21},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/knob-mode.js
// -------------------------------

"use strict";

var enterCursorOrKnobMode = require("./common-mode");

module.exports = enterKnobMode;
function enterKnobMode(delf, viewport, exit) {
    var cursorOrKnobMode = enterCursorOrKnobMode(delf, viewport);

    function knobMode(event, key, keyCode) {
        if (event.type === "keyup") {
            if (keyCode === 27) {
                return _exit();
            }
        } else if (event.type === "keypress") {
            if (delf.directionKeys[key]) {
                // move
                viewport.moveKnob(delf.directionKeys[key]);
                delf.draw();
            } else if (delf.directionKeys[key.toLowerCase()]) {
                // creep
                viewport.creepKnob(delf.directionKeys[key.toLowerCase()]);
                delf.draw();
            } else if (key === "o") {
                viewport.rotateKnobClockwise();
                delf.draw();
            } else if (key === "O") {
                viewport.rotateKnobCounterClockwise();
                delf.draw();
            } else if (key === "g") { // center the knob on the origin
                // TODO "gg" for origin, "g." for other marked locations
                viewport.moveKnobToOrigin();
                delf.draw();
                // TODO "G" mark center of knob as location
            } else if (key === "r") {
                viewport.rotateCursorClockwise();
                delf.draw();
            } else if (key === "R") {
                viewport.rotateCursorCounterClockwise();
                delf.draw();
            } else if (key === "t") { // transpose
                viewport.transposeCursorAboutKnob();
                delf.draw();
            } else if (key === "I") { // push cursor stack
                viewport.growKnob();
                delf.draw();
            } else if (key === "i") { // pop cursor stack
                viewport.shrinkKnob();
                delf.draw();
            } else if (key === "0") {
                viewport.collapseCursor();
                return _exit();
            } else if (key === "s") {
                return _exit();
            }
        }
        return cursorOrKnobMode(event, key, keyCode, knobMode);
    }

    function _exit() {
        delf.isKnobMode = false;
        delf.draw();
        return exit();
    }

    delf.isKnobMode = true;
    delf.draw();
    return knobMode;
}


}],["essays/digger/tile-view.js","delf/essays/digger","tile-view.js",{"ndim/point2":48},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/tile-view.js
// -------------------------------

"use strict";

var Point2 = require("ndim/point2");

module.exports = TileView;
function TileView() {
    this.point = new Point2(); // map position
    this.pointPx = new Point2(); // 3d position in view in px
    this.tile = null; // model
    this.element = document.createElement("div");
    this.element.className = "tile";
    this.element.component = this;
    // For mark and sweep free list collection
    this.mark = null;
}

TileView.prototype.reset = function () {
};

TileView.prototype.draw = function () {
    var tile = this.tile;
    this.pointPx.become(this.point).scaleThis(this.constructor.size);
    this.element.style.left = this.pointPx.x + "px";
    this.element.style.top = this.pointPx.y + "px";
    this.element.className = "tile" + (this.tile.value > 0 ? " space" : "") + (this.tile.value > 0 ? " tile" + this.tile.value : "");
};

TileView.size = 24;


}],["essays/digger/tile.js","delf/essays/digger","tile.js",{"ndim/point2":48},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/tile.js
// --------------------------

"use strict";

var Point2 = require("ndim/point2");

module.exports = Tile;
function Tile(point) {
    this.point = new Point2();
    this.point.become(point);
    this._value = 0;
    this.delegate = null;
}

Object.defineProperty(Tile.prototype, "value", {
    get: function get() {
         return this._value;
    },
    set: function set(value) {
        this._value = value;
        this.delegate.update(this.point, value);
    }
});


}],["essays/digger/viewport.html","delf/essays/digger","viewport.html",{"./viewport":36},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/viewport.html
// --------------------------------

"use strict";
var $SUPER = require("./viewport");
var $THIS = function DelfEssaysDiggerViewport(body, caller) {
    $SUPER.apply(this, arguments);
    var document = body.ownerDocument;
    var scope = this.scope = caller.root.nestComponents();
    scope.caller = caller;
    scope.this = this;
    var parent = body, parents = [], node, component, callee, argument;
    node = document.createElement("DIV");
    parent.appendChild(node);
    component = node.actualNode;
    scope.hookup("element", component);
    if (component.setAttribute) {
        component.setAttribute("id", "element_h3sru0");
    }
    if (scope.componentsFor["element"]) {
       scope.componentsFor["element"].setAttribute("for", "element_h3sru0")
    }
    if (component.setAttribute) {
    component.setAttribute("class", "viewport");
    }
    parents[parents.length] = parent; parent = node;
    // DIV
        node = document.createElement("DIV");
        parent.appendChild(node);
        component = node.actualNode;
        scope.hookup("center", component);
        if (component.setAttribute) {
            component.setAttribute("id", "center_gxk1uy");
        }
        if (scope.componentsFor["center"]) {
           scope.componentsFor["center"].setAttribute("for", "center_gxk1uy")
        }
        if (component.setAttribute) {
        component.setAttribute("class", "center");
        }
        parents[parents.length] = parent; parent = node;
        // DIV
            node = document.createElement("DIV");
            parent.appendChild(node);
            component = node.actualNode;
            scope.hookup("origin", component);
            if (component.setAttribute) {
                component.setAttribute("id", "origin_jjzeel");
            }
            if (scope.componentsFor["origin"]) {
               scope.componentsFor["origin"].setAttribute("for", "origin_jjzeel")
            }
            if (component.setAttribute) {
            component.setAttribute("class", "origin");
            }
            parents[parents.length] = parent; parent = node;
            // DIV
                node = document.createElement("DIV");
                parent.appendChild(node);
                component = node.actualNode;
                scope.hookup("cursor", component);
                if (component.setAttribute) {
                    component.setAttribute("id", "cursor_v4hp7f");
                }
                if (scope.componentsFor["cursor"]) {
                   scope.componentsFor["cursor"].setAttribute("for", "cursor_v4hp7f")
                }
                if (component.setAttribute) {
                component.setAttribute("class", "cursor");
                }
                parents[parents.length] = parent; parent = node;
                // DIV
                    node = document.createElement("DIV");
                    parent.appendChild(node);
                    component = node.actualNode;
                    scope.hookup("knob", component);
                    if (component.setAttribute) {
                        component.setAttribute("id", "knob_lioi4y");
                    }
                    if (scope.componentsFor["knob"]) {
                       scope.componentsFor["knob"].setAttribute("for", "knob_lioi4y")
                    }
                    if (component.setAttribute) {
                    component.setAttribute("class", "knob");
                    }
                    parents[parents.length] = parent; parent = node;
                    // DIV
                    node = parent; parent = parents[parents.length - 1]; parents.length--;
                node = parent; parent = parents[parents.length - 1]; parents.length--;
            node = parent; parent = parents[parents.length - 1]; parents.length--;
        node = parent; parent = parents[parents.length - 1]; parents.length--;
    node = parent; parent = parents[parents.length - 1]; parents.length--;
    this.scope.hookup("this", this);
};
$THIS.prototype = Object.create($SUPER.prototype);
$THIS.prototype.constructor = $THIS;
$THIS.prototype.exports = {};
module.exports = $THIS;

}],["essays/digger/viewport.js","delf/essays/digger","viewport.js",{"collections/fast-map":3,"ndim/point2":48,"ndim/region2":50,"./area":19,"./tile-view":33,"./tile":34,"pop-observe":63},function (require, exports, module, __filename, __dirname){

// delf/essays/digger/viewport.js
// ------------------------------

"use strict";

var FastMap = require("collections/fast-map");
var Point2 = require("ndim/point2");
var Region2 = require("ndim/region2");
var Area = require("./area");
var TileView = require("./tile-view");
var Tile = require("./tile");
var makeArrayObservable = require('pop-observe').makeArrayObservable;

var point = new Point2();

module.exports = Viewport;
function Viewport(body, scope) {
    var self = this;
    this.tiles = new FastMap(); // point to tile model
    this.storage = null;
    this.tiles.getDefault = function (point) {
        var tile = new Tile(point);
        tile.delegate = self;
        this.set(point.clone(), tile);
        return tile;
    };
    this.tileViews = new FastMap(); // point to tile view
    this.knobRegion = new Region2(new Point2(0, 0), new Point2(1, 1));
    this.cursorRegion = new Region2(new Point2(0, 0), new Point2(1, 1));
    this.cursorArea = new Area(this.cursorRegion.size, this.cursorRegion.position, this.tiles, this.tileViews);
    this.cursorStack = [];
    this.cursorIndex = 0;
    this.isFocused = false;
    this.isCursorMode = true;
    this.isKnobMode = false;
    this.leftCurb = 0;
    this.topCurb = 0;
    this.bottomCurb = 0;
    this.rightCurb = 0;
    this.drawFrustumHandle = null;
    this.drawFrustum = this.drawFrustum.bind(this);
    this.animator = scope.animator.add(this);

    // TODO use a Bin abstraction that captures the data and dimensions and has the
    // methods for transpose etc
    this.buffer = new FastMap();
    this.bufferSize = new Point2();
    this.bufferArea = new Area(this.bufferSize);
}

Viewport.prototype.directions = {
    left: new Point2(-1, 0),
    right: new Point2(1, 0),
    up: new Point2(0, -1),
    down: new Point2(0, 1)
};

Viewport.prototype.nextCursorQuadrant = {
    "cc": "cc",
    "cw": "ce",
    "ce": "cw",
    "nc": "sc",
    "sc": "nc",
    "nw": "ne",
    "ne": "se",
    "se": "sw",
    "sw": "nw"
};

Viewport.prototype.prevCursorQuadrant = {
    "cc": "cc",
    "cw": "ce",
    "ce": "cw",
    "nc": "sc",
    "wc": "nc",
    "nw": "sw",
    "ne": "nw",
    "se": "ne",
    "sw": "se"
};

Viewport.prototype.update = function update(point, value) {
    var view = this.tileViews.get(point);
    if (view) {
        view.draw();
    }
    this.storage.update(point, value);
};

Viewport.prototype.hookup = function hookup(id, component, scope) {
    if (id === 'this') {
        this.hookupThis(component, scope);
    }
};

Viewport.prototype.hookupThis = function hookupThis(component, scope) {
    var components = scope.components;
    this.center = components.center;
    this.origin = components.origin;
    this.cursor = components.cursor;
    this.knob = components.knob;
};

var knobPx = new Region2(new Point2(), new Point2());
var cursorPx = new Region2(new Point2(), new Point2());
var halfCursorSizePx = new Point2();
var originPx = new Point2();
Viewport.prototype.draw = function draw() {
    var originElement = this.origin;
    var knobElement = this.knob;
    var cursorElement = this.cursor;

    knobPx.become(this.knobRegion).scaleThis(TileView.size);
    knobPx.size.x -= 12;
    knobPx.size.y -= 12;
    knobElement.style.opacity = this.isFocused && this.isKnobMode ? 1 : 0;
    knobElement.style.left = knobPx.position.x + "px";
    knobElement.style.top = knobPx.position.y + "px";
    knobElement.style.width = knobPx.size.x + "px";
    knobElement.style.height = knobPx.size.y + "px";

    cursorPx.become(this.cursorRegion).scaleThis(TileView.size);
    cursorElement.style.opacity = this.isFocused && this.isCursorMode ? 1 : 0;
    cursorElement.style.left = cursorPx.position.x + "px";
    cursorElement.style.top = cursorPx.position.y + "px";
    cursorElement.style.width = cursorPx.size.x + "px";
    cursorElement.style.height = cursorPx.size.y + "px";

    halfCursorSizePx.become(this.cursorRegion.size).scaleThis(TileView.size).scaleThis(.5);

    originPx.x = (this.leftCurb - this.rightCurb) / 2;
    originPx.y = (this.topCurb - this.bottomCurb) / 2;
    originPx.subThis(cursorPx.position).subThis(halfCursorSizePx);
    originElement.style.left = originPx.x + "px";
    originElement.style.top = originPx.y + "px";

    this.requestDrawFrustum();
};

Viewport.prototype.requestDrawFrustum = function () {
    if (this.drawFrustumHandle) {
        clearTimeout(this.drawFrustumHandle);
    }
    this.drawFrustumHandle = setTimeout(this.drawFrustum, 1000);
};

Viewport.prototype.freeTileViews = [];
makeArrayObservable(Viewport.prototype.freeTileViews);

var windowSize = new Point2();
var frustum = new Region2(new Point2(), new Point2());
var marginLength = 30;
var margin = new Point2(marginLength, marginLength);
var offset = new Point2();
offset.become(Point2.zero).subThis(margin).scaleThis(.5);
var tileViewsToFree = [];
Viewport.prototype.drawFrustum = function () {
    this.drawFrustumHandle = null;

    windowSize.x = window.innerWidth;
    windowSize.y = window.innerHeight;
    frustum.size.become(windowSize)
        .scaleThis(1/TileView.size)
        .floorThis()
        .addThis(margin);
    frustum.position.become(Point2.zero)
        .subThis(frustum.size)
        .scaleThis(.5)
        .floorThis()
        .addThis(this.cursorRegion.position);

    // Mark all visible tileViews as unused
    this.tileViews.forEach(function (tileView) {
        tileView.mark = false;
    });

    var created = 0;
    var recycled = 0;
    var reused = 0;

    var left = frustum.position.x;
    var top = frustum.position.y;
    var width = frustum.size.x;
    var height = frustum.size.y;
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            point.x = left + x;
            point.y = top + y;
            var tileView = this.tileViews.get(point);
            if (!tileView) {
                if (this.freeTileViews.length) {
                    tileView = this.freeTileViews.pop();
                    recycled++;
                } else {
                    tileView = new TileView();
                    created++;
                }
                tileView.reset();
                tileView.mark = true;
                tileView.point.become(point);
                tileView.tile = this.tiles.get(tileView.point);
                tileView.draw();
                this.origin.insertBefore(tileView.element, this.cursor);
                this.tileViews.set(tileView.point, tileView);
            } else {
                reused++;
            }
            // Mark the used tile to be retained
            tileView.mark = true;
        }
    }

    // Collect the garbage for recycling
    tileViewsToFree.length = 0;
    this.tileViews.forEach(function (tileView) {
        if (!tileView.mark) {
            tileViewsToFree.push(tileView);
        }
    }, this);
    this.freeTileViews.swap(this.freeTileViews.length, 0, tileViewsToFree);
    tileViewsToFree.forEach(function (tileView) {
        this.tileViews.delete(tileView.point);
        this.origin.removeChild(tileView.element);
    }, this);

    //console.log("CREATED", created, "UNCHANGED", reused, "RECYCLED", recycled, "DISPOSED", tileViewsToFree.length, "USED", this.tileViews.length, "FREE", this.freeTileViews.length);
};

// resize's reusable structure
var centerPx = new Point2();
Viewport.prototype.handleResize = function () {
    centerPx.x = window.innerWidth;
    centerPx.y = window.innerHeight;
    centerPx.scaleThis(.5);
    this.center.style.top = centerPx.y + "px";
    this.center.style.left = centerPx.x + "px";
    this.drawFrustum();
};

Viewport.prototype.moveCursor = function (direction, size) {
    size = size || this.cursorRegion.size;
    point.become(this.directions[direction]);
    point.x *= size.x;
    point.y *= size.y;
    this.cursorRegion.position.addThis(point);
};

Viewport.prototype.creepCursor = function (direction) {
    this.cursorRegion.position.addThis(this.directions[direction]);
};

Viewport.prototype.getCursorPosition = function () {
    point.become(this.cursorRegion.size)
        .subThis(Point2.one)
        .scaleThis(.5)
        .floorThis();
    this.cursorRegion.position.become(position)
        .subThis(point);
};

Viewport.prototype.moveCursorTo = function (position) {
    point.become(this.cursorRegion.size)
        .subThis(Point2.one)
        .scaleThis(.5)
        .floorThis();
    this.cursorRegion.position.become(position)
        .subThis(point);
};

Viewport.prototype.moveCursorToOrigin = function () {
    point.become(this.cursorRegion.size)
        .subThis(Point2.one)
        .scaleThis(.5)
        .floorThis();
    this.cursorRegion.position.become(Point2.zero)
        .subThis(point);
};

Viewport.prototype.moveKnobToOrigin = function () {
    point.become(this.knobRegion.size)
        .subThis(Point2.one)
        .scaleThis(.5)
        .floorThis();
    this.cursorRegion.position.become(Point2.zero)
        .subThis(this.knobRegion.position)
        .subThis(point);
};

Viewport.prototype.growCursor = function () {
    var quadrant = this.getKnobQuadrant();
    this.cursorRegion.size.addThis(Point2.one).addThis(Point2.one);
    this.cursorRegion.position.subThis(Point2.one);
    this.setKnobQuadrant(quadrant);
    this.animator.requestDraw();
};

Viewport.prototype.shrinkCursor = function () {
    var quadrant = this.getKnobQuadrant();
    var nx = Math.max(1, this.cursorRegion.size.x - 2);
    var ny = Math.max(1, this.cursorRegion.size.y - 2);
    this.cursorRegion.position.x -= Math.ceil((nx - this.cursorRegion.size.x) / 2);
    this.cursorRegion.position.y -= Math.ceil((ny - this.cursorRegion.size.y) / 2);
    this.cursorRegion.size.x = nx;
    this.cursorRegion.size.y = ny;
    this.knobRegion.size.x = Math.min(this.knobRegion.size.x, this.cursorRegion.size.x);
    this.knobRegion.size.y = Math.min(this.knobRegion.size.y, this.cursorRegion.size.y);
    this.setKnobQuadrant(quadrant);
    this.animator.requestDraw();
};

Viewport.prototype.collapseCursor = function () {
    point.become(this.cursorRegion.size).scaleThis(.5).floorThis();
    this.cursorRegion.size.become(Point2.one);
    this.cursorRegion.position.addThis(point);
    this.knobRegion.size.become(Point2.one);
    this.knobRegion.position.become(Point2.zero);
    this.animator.requestDraw();
};

var position = new Point2();
var newPosition = new Point2();
var change = new Point2();
Viewport.prototype.moveKnob = function (direction, size) {
    var knob = this.knobRegion;
    var cursor = this.cursorRegion;
    size = size || this.knobRegion.size;

    // directions: up, down, left, right
    // size: either 1x1 or knob size
    // absolute position of the knob
    change.become(this.directions[direction]).mulThis(size);
    position.become(cursor.position).addThis(knob.position);
    newPosition.become(position).addThis(change);
    var quadrant = this.getKnobQuadrant();
    // quadrant[0] === "n" or "c" means top adjacent
    // adjacent means that side must be pulled if moving away from it

    // push growing boundary
    cursor.size.x = Math.max(cursor.size.x, newPosition.x - cursor.position.x + knob.size.x);
    cursor.size.y = Math.max(cursor.size.y, newPosition.y - cursor.position.y + knob.size.y);
    if (newPosition.x < cursor.position.x) {
        var dx = newPosition.x - cursor.position.x;
        cursor.size.x -= dx;
        cursor.position.x += dx;
    }
    if (newPosition.y < cursor.position.y) {
        var dy = newPosition.y - cursor.position.y;
        cursor.size.y -= dy;
        cursor.position.y += dy;
    }

    // pull receding boundary
    if (direction === "down" && quadrant[0] === "n") {
        cursor.position.y += change.y;
        cursor.size.y -= change.y;
    }
    if (direction === "up" && quadrant[0] === "s") {
        cursor.size.y += change.y;
    }
    if (direction === "right" && quadrant[1] === "w") {
        cursor.position.x += change.x;
        cursor.size.x -= change.x;
    }
    if (direction === "left" && quadrant[1] === "e") {
        cursor.size.x += change.x;
    }

    knob.position.become(newPosition).subThis(cursor.position);
};

Viewport.prototype.creepKnob = function (direction) {
    this.moveKnob(direction, Point2.one);
};

Viewport.prototype.getKnobQuadrant = function () {
    var knob = this.knobRegion;
    var cursor = this.cursorRegion;

    var w = knob.position.x === 0;
    var e = knob.position.x === cursor.size.x - knob.size.x;
    var n = knob.position.y === 0;
    var s = knob.position.y === cursor.size.y - knob.size.y;
    return (n && s ? "c" : (n ? "n" : "s")) + (e && w ? "c" : (w ? "w" : "e"));
};

Viewport.prototype.setKnobQuadrant = function (quadrant) {
    var knob = this.knobRegion;
    var cursor = this.cursorRegion;

    if (quadrant[1] === "w") {
        knob.position.x = 0;
    } else {
        knob.position.x = cursor.size.x - knob.size.x;
    }
    if (quadrant[0] === "n") {
        knob.position.y = 0;
    } else {
        knob.position.y = cursor.size.y - knob.size.y;
    }
    this.animator.requestDraw();
};

Viewport.prototype.rotateKnobClockwise = function () {
    var quadrant = this.getKnobQuadrant();
    var nextQuadrant = this.nextCursorQuadrant[quadrant];
    this.setKnobQuadrant(nextQuadrant);
    this.flipBuffer(quadrant, nextQuadrant);
};

Viewport.prototype.rotateKnobCounterClockwise = function () {
    var quadrant = this.getKnobQuadrant();
    var prevQuadrant = this.prevCursorQuadrant[quadrant];
    this.setKnobQuadrant(prevQuadrant);
    this.flipBuffer(quadrant, prevQuadrant);
};

Viewport.prototype.rotateCursorClockwise = function () {
    var quadrant = this.getKnobQuadrant();
    var nextQuadrant = this.nextCursorQuadrant[quadrant];
    point.become(this.knobRegion.position);
    this.setKnobQuadrant(nextQuadrant);
    this.cursorRegion.position.subThis(this.knobRegion.position).addThis(point);
    this.flipBuffer(quadrant, nextQuadrant);
};

Viewport.prototype.rotateCursorCounterClockwise = function () {
    var quadrant = this.getKnobQuadrant();
    var prevQuadrant = this.prevCursorQuadrant[quadrant];
    point.become(this.knobRegion.position);
    this.setKnobQuadrant(prevQuadrant);
    this.cursorRegion.position.subThis(this.knobRegion.position).addThis(point);
    this.flipBuffer(quadrant, prevQuadrant);
};

Viewport.prototype.transposeCursorAboutKnob = function () {
    var quadrant = this.getKnobQuadrant();
    this.transposeBuffer(quadrant);
    point.become(this.knobRegion.position);
    var temp = this.cursorRegion.size.x;
    this.cursorRegion.size.x = this.cursorRegion.size.y;
    this.cursorRegion.size.y = temp;
    this.setKnobQuadrant(quadrant);
    point.subThis(this.knobRegion.position);
    this.cursorRegion.position.addThis(point);
};

Viewport.prototype.growKnob = function () {
    // TODO remember larger cursors if they still fit
    this.cursorStack[this.cursorIndex++] = this.knobRegion.size.clone();
    // grow the outer cursor if necessary
    if (this.knobRegion.size.equals(this.cursorRegion.size)) {
        this.cursorRegion.size.addThis(Point2.one).addThis(Point2.one);
        this.cursorRegion.position.subThis(Point2.one);
    }
    // grow knob to match cursor size
    this.knobRegion.size.become(this.cursorRegion.size);
    this.knobRegion.position.become(Point2.zero);
};

Viewport.prototype.shrinkKnob = function () {
    if (this.cursorIndex > 0) {
        // restore smaller remembered cursor
        var quadrant = this.getKnobQuadrant();
        this.knobRegion.size.become(this.cursorStack[--this.cursorIndex]);
        this.setKnobQuadrant(quadrant);
    } else {
        this.cursorRegion.position.addThis(this.knobRegion.position);
        this.cursorRegion.size.become(this.knobRegion.size);
        this.knobRegion.position.become(Point2.zero);
    }
};

Viewport.prototype.fill = function fill(value) {
    this.cursorArea.fill(value);
};

Viewport.prototype.dig = function dig() {
    this.cursorArea.dig();
};

Viewport.prototype.copy = function copy() {
    this.buffer.clear();
    this.bufferSize.become(this.cursorRegion.size);
    this.cursorArea.forEach(function (tile, x, y) {
        point.x = x;
        point.y = y;
        this.buffer.set(point.clone(), tile.value);
    }, this);
};

Viewport.prototype.cut = function cut() {
    this.buffer.clear();
    this.bufferSize.become(this.cursorRegion.size);
    this.cursorArea.forEach(function (tile, x, y) {
        point.x = x;
        point.y = y;
        this.buffer.set(point.clone(), tile.value);
        tile.value = 0;
    }, this);
};

Viewport.prototype.paste = function paste() {
    this.cursorArea.forEach(function (tile, x, y) {
        point.x = x % this.bufferSize.x;
        point.y = y % this.bufferSize.y;
        tile.value = this.buffer.get(point);
    }, this);
};

Viewport.prototype.flip = function flip() {
    this.cursorArea.flip();
};

Viewport.prototype.add = function add() {
    this.cursorArea.forEach(function (tile, x, y) {
        point.x = x % this.bufferSize.x;
        point.y = y % this.bufferSize.y;
        if (this.buffer.get(point)) {
            tile.value = 1;
        }
    }, this);
};

Viewport.prototype.sub = function sub() {
    this.cursorArea.forEach(function (tile, x, y) {
        point.x = x % this.bufferSize.x;
        point.y = y % this.bufferSize.y;
        if (this.buffer.get(point)) {
            tile.value = k;
        }
    }, this);
};

// for flipBuffer and transposeBuffer
var tempBuffer = new FastMap();
var tempBufferSize = new Point2();

Viewport.prototype.flipBuffer = function(prev, next) {
    var temp;
    tempBuffer.clear();
    tempBufferSize.become(this.bufferSize);
    var width = this.cursorRegion.size.x;
    var height = this.cursorRegion.size.y;
    if (prev[0] !== next[0]) { // vertical
        for (var x = 0; x < width; x++) {
            for (var y = 0; y < height; y++) {
                point.x = x;
                point.y = y;
                var value = this.buffer.get(point);
                point.x = x;
                point.y = height - y - 1;
                tempBuffer.set(point.clone(), value);
            }
        }
    } else { // horizontal
        for (var x = 0; x < width; x++) {
            for (var y = 0; y < height; y++) {
                point.x = x;
                point.y = y;
                var value = this.buffer.get(point);
                point.x = width - x - 1;
                point.y = y;
                tempBuffer.set(point.clone(), value);
            }
        }
    }
    // swap the buffers
    temp = this.buffer;
    this.buffer = tempBuffer;
    tempBuffer = temp;
    temp = this.bufferSize;
    this.bufferSize = tempBufferSize;
    tempBufferSize = temp;
};

Viewport.prototype.transposeBuffer = function (quadrant) {
    var temp;
    tempBuffer.clear();
    tempBufferSize.x = this.bufferSize.y;
    tempBufferSize.y = this.bufferSize.x;
    var width = this.bufferSize.x;
    var height = this.bufferSize.y;
    // nw, se
    if (quadrant === "nw" || quadrant === "se") {
        for (var x = 0; x < width; x++) {
            for (var y = 0; y < height; y++) {
                point.x = x;
                point.y = y;
                var value = this.buffer.get(point);
                point.x = y;
                point.y = x;
                tempBuffer.set(point.clone(), value);
            }
        }
    } else {
        for (var x = 0; x < width; x++) {
            for (var y = 0; y < height; y++) {
                point.x = x;
                point.y = y;
                var value = this.buffer.get(point);
                point.x = height - 1 - y;
                point.y = width - 1 - x;
                tempBuffer.set(point.clone(), value);
            }
        }
    }
    // swap the buffers
    temp = this.buffer;
    this.buffer = tempBuffer;
    tempBuffer = temp;
    temp = this.bufferSize;
    this.bufferSize = tempBufferSize;
    tempBufferSize = temp;
};

Viewport.prototype.focus = function focus() {
    this.isFocused = true;
    this.animator.requestDraw();
};

Viewport.prototype.blur = function blur() {
    this.isFocused = false;
    this.animator.requestDraw();
};

}],["document.js","gutentag","document.js",{"koerper":45},function (require, exports, module, __filename, __dirname){

// gutentag/document.js
// --------------------

"use strict";
module.exports = require("koerper");

}],["repeat.html","gutentag","repeat.html",{"./repeat":39},function (require, exports, module, __filename, __dirname){

// gutentag/repeat.html
// --------------------

"use strict";
module.exports = (require)("./repeat");

}],["repeat.js","gutentag","repeat.js",{"pop-observe":63,"pop-swap":68},function (require, exports, module, __filename, __dirname){

// gutentag/repeat.js
// ------------------


var O = require("pop-observe");
var swap = require("pop-swap");

var empty = [];

module.exports = Repetition;
function Repetition(body, scope) {
    this.body = body;
    this.scope = scope;
    this.iterations = [];
    this.Iteration = scope.argument.component;
    this.id = scope.id;
    this.observer = null;
    this._value = null;
    this.value = [];
}

Object.defineProperty(Repetition.prototype, "value", {
    get: function () {
        return this._value;
    },
    set: function (value) {
        if (!Array.isArray(value)) {
            throw new Error('Value of repetition must be an array');
        }
        if (this.observer) {
            this.observer.cancel();
            this.handleValueRangeChange(empty, this._value, 0);
        }
        this._value = value;
        this.handleValueRangeChange(this._value, empty, 0);
        this.observer = O.observeRangeChange(this._value, this, "value");
    }
});

Repetition.prototype.handleValueRangeChange = function (plus, minus, index) {
    var body = this.body;
    var document = this.body.ownerDocument;

    for (var offset = index; offset < index + minus.length; offset++) {
        var iteration = this.iterations[offset];
        body.removeChild(iteration.body);
        iteration.value = null;
        iteration.index = null;
        iteration.body = null;
        if (iteration.destroy) {
            iteration.destroy();
        }
    }

    var nextIteration = this.iterations[index + 1];
    var nextSibling = nextIteration && nextIteration.body;

    var add = [];
    for (var offset = 0; offset < plus.length; offset++) {
        var value = plus[offset];
        var iterationNode = document.createBody();
        var iterationScope = this.scope.nestComponents();

        var iteration = new this.Iteration(iterationNode, iterationScope);

        iteration.value = value;
        iteration.index = index + offset;
        iteration.body = iterationNode;

        iterationScope.hookup(this.scope.id + ":iteration", iteration);

        body.insertBefore(iterationNode, nextSibling);
        add.push(iteration);
    }

    swap(this.iterations, index, minus.length, add);

    // Update indexes
    for (var offset = index; offset < this.iterations.length; offset++) {
        this.iterations[offset].index = offset;
    }
};

Repetition.prototype.redraw = function (region) {
    for (var index = 0; index < this.iterations.length; index++) {
        var iteration = this.iterations[index];
        iteration.redraw(region);
    }
};

Repetition.prototype.destroy = function () {
    this.observer.cancel();
    this.handleValuesRangeChange([], this._value, 0);
};


}],["reveal.html","gutentag","reveal.html",{"./reveal":41},function (require, exports, module, __filename, __dirname){

// gutentag/reveal.html
// --------------------

"use strict";
module.exports = (require)("./reveal");

}],["reveal.js","gutentag","reveal.js",{"pop-observe":63},function (require, exports, module, __filename, __dirname){

// gutentag/reveal.js
// ------------------

"use strict";

// TODO create scope for revealed body and add to owner whenever it is created.
// Destroy when retracted, recreate when revealed.

var O = require("pop-observe");

module.exports = Reveal;
function Reveal(body, scope) {
    this.value = false;
    this.observer = O.observePropertyChange(this, "value", this);
    this.body = body;
    this.scope = scope;
    this.Component = scope.argument.component;
    this.component = null;
    this.componentBody = null;
    this.componentScope = null;
}

Reveal.prototype.handleValuePropertyChange = function (value) {
    this.clear();
    if (value) {
        this.componentScope = this.scope.nestComponents();
        this.componentBody = this.body.ownerDocument.createBody();
        this.component = new this.Component(this.componentBody, this.componentScope);
        this.componentScope.hookup(this.scope.id + ":revelation", this.component);
        this.body.appendChild(this.componentBody);
    }
};

Reveal.prototype.clear = function clear() {
    if (this.component) {
        if (this.component.destroy) {
            this.component.destroy();
        }
        this.body.removeChild(this.componentBody);
        this.component = null;
        this.componentBody = null;
    }
};

Reveal.prototype.destroy = function () {
    this.clear();
    this.observer.cancel();
};

}],["scope.js","gutentag","scope.js",{},function (require, exports, module, __filename, __dirname){

// gutentag/scope.js
// -----------------

"use strict";

module.exports = Scope;
function Scope() {
    this.root = this;
    this.components = Object.create(null);
    this.componentsFor = Object.create(null);
}

Scope.prototype.nest = function () {
    var child = Object.create(this);
    child.parent = this;
    child.caller = this.caller && this.caller.nest();
    return child;
};

Scope.prototype.nestComponents = function () {
    var child = this.nest();
    child.components = Object.create(this.components);
    child.componentsFor = Object.create(this.componentsFor);
    return child;
};

// TODO deprecated
Scope.prototype.set = function (id, component) {
    console.log(new Error().stack);
    this.hookup(id, component);
};

Scope.prototype.hookup = function (id, component) {
    var scope = this;
    scope.components[id] = component;

    if (scope.this.hookup) {
        scope.this.hookup(id, component, scope);
    } else if (scope.this.add) {
        // TODO deprecated
        scope.this.add(component, id, scope);
    }

    var exportId = scope.this.exports && scope.this.exports[id];
    if (exportId) {
        var callerId = scope.caller.id;
        scope.caller.hookup(callerId + ":" + exportId, component);
    }
};

}],["text.html","gutentag","text.html",{"./text":44},function (require, exports, module, __filename, __dirname){

// gutentag/text.html
// ------------------

"use strict";
module.exports = (require)("./text");

}],["text.js","gutentag","text.js",{},function (require, exports, module, __filename, __dirname){

// gutentag/text.js
// ----------------

"use strict";

module.exports = Text;
function Text(body, scope) {
    var node = body.ownerDocument.createTextNode("");
    body.appendChild(node);
    this.node = node;
    this.defaultText = scope.argument.innerText;
    this._value = null;
}

Object.defineProperty(Text.prototype, "value", {
    get: function () {
        return this._value;
    },
    set: function (value) {
        this._value = value;
        if (value == null) {
            this.node.data = this.defaultText;
        } else {
            this.node.data = "" + value;
        }
    }
});

}],["koerper.js","koerper","koerper.js",{"wizdom":74},function (require, exports, module, __filename, __dirname){

// koerper/koerper.js
// ------------------

"use strict";

var BaseDocument = require("wizdom");
var BaseNode = BaseDocument.prototype.Node;
var BaseElement = BaseDocument.prototype.Element;
var BaseTextNode = BaseDocument.prototype.TextNode;

module.exports = Document;
function Document(actualNode) {
    Node.call(this, this);
    this.actualNode = actualNode;
    this.actualDocument = actualNode.ownerDocument;

    this.documentElement = this.createBody();
    this.documentElement.parentNode = this;
    actualNode.appendChild(this.documentElement.actualNode);

    this.firstChild = this.documentElement;
    this.lastChild = this.documentElement;
}

Document.prototype = Object.create(BaseDocument.prototype);
Document.prototype.Node = Node;
Document.prototype.Element = Element;
Document.prototype.TextNode = TextNode;
Document.prototype.Body = Body;
Document.prototype.OpaqueHtml = OpaqueHtml;

Document.prototype.createBody = function (label) {
    return new this.Body(this, label);
};

Document.prototype.getActualParent = function () {
    return this.actualNode;
};

function Node(document) {
    BaseNode.call(this, document);
    this.actualNode = null;
}

Node.prototype = Object.create(BaseNode.prototype);
Node.prototype.constructor = Node;

Node.prototype.insertBefore = function insertBefore(childNode, nextSibling) {
    if (nextSibling && nextSibling.parentNode !== this) {
        throw new Error("Can't insert before node that is not a child of parent");
    }
    BaseNode.prototype.insertBefore.call(this, childNode, nextSibling);
    var actualParentNode = this.getActualParent();
    var actualNextSibling;
    if (nextSibling) {
        actualNextSibling = nextSibling.getActualFirstChild();
    }
    if (!actualNextSibling) {
        actualNextSibling = this.getActualNextSibling();
    }
    if (actualNextSibling && actualNextSibling.parentNode !== actualParentNode) {
        actualNextSibling = null;
    }
    actualParentNode.insertBefore(childNode.actualNode, actualNextSibling || null);
    childNode.inject();
    return childNode;
};

Node.prototype.removeChild = function removeChild(childNode) {
    if (!childNode) {
        throw new Error("Can't remove child " + childNode);
    }
    childNode.extract();
    this.getActualParent().removeChild(childNode.actualNode);
    BaseNode.prototype.removeChild.call(this, childNode);
};

Node.prototype.setAttribute = function setAttribute(key, value) {
    this.actualNode.setAttribute(key, value);
};

Node.prototype.getAttribute = function getAttribute(key) {
    this.actualNode.getAttribute(key);
};

Node.prototype.hasAttribute = function hasAttribute(key) {
    this.actualNode.hasAttribute(key);
};

Node.prototype.removeAttribute = function removeAttribute(key) {
    this.actualNode.removeAttribute(key);
};

Node.prototype.addEventListener = function addEventListener(name, handler, capture) {
    this.actualNode.addEventListener(name, handler, capture);
};

Node.prototype.removeEventListener = function removeEventListener(name, handler, capture) {
    this.actualNode.removeEventListener(name, handler, capture);
};

Node.prototype.inject = function injectNode() { };

Node.prototype.extract = function extractNode() { };

Node.prototype.getActualParent = function () {
    return this.actualNode;
};

Node.prototype.getActualFirstChild = function () {
    return this.actualNode;
};

Node.prototype.getActualNextSibling = function () {
    return null;
};

Object.defineProperty(Node.prototype, "innerHTML", {
    get: function () {
        return this.actualNode.innerHTML;
    }//,
    //set: function (html) {
    //    // TODO invalidate any subcontained child nodes
    //    this.actualNode.innerHTML = html;
    //}
});

function Element(document, type, namespace) {
    BaseNode.call(this, document, namespace);
    if (namespace) {
        this.actualNode = document.actualDocument.createElementNS(namespace, type);
    } else {
        this.actualNode = document.actualDocument.createElement(type);
    }
    this.attributes = this.actualNode.attributes;
}

Element.prototype = Object.create(Node.prototype);
Element.prototype.constructor = Element;
Element.prototype.nodeType = 1;

function TextNode(document, text) {
    Node.call(this, document);
    this.actualNode = document.actualDocument.createTextNode(text);
}

TextNode.prototype = Object.create(Node.prototype);
TextNode.prototype.constructor = TextNode;
TextNode.prototype.nodeType = 3;

Object.defineProperty(TextNode.prototype, "data", {
    set: function (data) {
        this.actualNode.data = data;
    },
    get: function () {
        return this.actualNode.data;
    }
});

// if parentNode is null, the body is extracted
// if parentNode is non-null, the body is inserted
function Body(document, label) {
    Node.call(this, document);
    this.actualNode = document.actualDocument.createTextNode("");
    //this.actualNode = document.actualDocument.createComment(label || "");
    this.actualFirstChild = null;
    this.actualBody = document.actualDocument.createElement("BODY");
}

Body.prototype = Object.create(Node.prototype);
Body.prototype.constructor = Body;
Body.prototype.nodeType = 13;

Body.prototype.extract = function extract() {
    var body = this.actualBody;
    var lastChild = this.actualNode;
    var parentNode = this.parentNode.getActualParent();
    var at = this.getActualFirstChild();
    var next;
    while (at && at !== lastChild) {
        next = at.nextSibling;
        if (body) {
            body.appendChild(at);
        } else {
            parentNode.removeChild(at);
        }
        at = next;
    }
};

Body.prototype.inject = function inject() {
    if (!this.parentNode) {
        throw new Error("Can't inject without a parent node");
    }
    var body = this.actualBody;
    var lastChild = this.actualNode;
    var parentNode = this.parentNode.getActualParent();
    var at = body.firstChild;
    var next;
    while (at) {
        next = at.nextSibling;
        parentNode.insertBefore(at, lastChild);
        at = next;
    }
};

Body.prototype.getActualParent = function () {
    if (this.parentNode) {
        return this.parentNode.getActualParent();
    } else {
        return this.actualBody;
    }
};

Body.prototype.getActualFirstChild = function () {
    if (this.firstChild) {
        return this.firstChild.getActualFirstChild();
    } else {
        return this.actualNode;
    }
};

Body.prototype.getActualNextSibling = function () {
    return this.actualNode;
};

Object.defineProperty(Body.prototype, "innerHTML", {
    get: function () {
        if (this.parentNode) {
            this.extract();
            var html = this.actualBody.innerHTML;
            this.inject();
            return html;
        } else {
            return this.actualBody.innerHTML;
        }
    },
    set: function (html) {
        if (this.parentNode) {
            this.extract();
            this.actualBody.innerHTML = html;
            this.firstChild = this.lastChild = new OpaqueHtml(
                this.ownerDocument,
                this.actualBody
            );
            this.inject();
        } else {
            this.actualBody.innerHTML = html;
            this.firstChild = this.lastChild = new OpaqueHtml(
                this.ownerDocument,
                this.actualBody
            );
        }
        return html;
    }
});

function OpaqueHtml(ownerDocument, body) {
    Node.call(this, ownerDocument);
    this.actualFirstChild = body.firstChild;
}

OpaqueHtml.prototype = Object.create(Node.prototype);
OpaqueHtml.prototype.constructor = OpaqueHtml;

OpaqueHtml.prototype.getActualFirstChild = function getActualFirstChild() {
    return this.actualFirstChild;
};

}],["mini-map.js","mini-map","mini-map.js",{},function (require, exports, module, __filename, __dirname){

// mini-map/mini-map.js
// --------------------

"use strict";

module.exports = MiniMap;
function MiniMap() {
    this.keys = [];
    this.values = [];
}

MiniMap.prototype.has = function (key) {
    var index = this.keys.indexOf(key);
    return index >= 0;
};

MiniMap.prototype.get = function (key) {
    var index = this.keys.indexOf(key);
    if (index >= 0) {
        return this.values[index];
    }
};

MiniMap.prototype.set = function (key, value) {
    var index = this.keys.indexOf(key);
    if (index < 0) {
        index = this.keys.length;
    }
    this.keys[index] = key;
    this.values[index] = value;
};

MiniMap.prototype["delete"] = function (key) {
    var index = this.keys.indexOf(key);
    if (index >= 0) {
        this.keys.splice(index, 1);
        this.values.splice(index, 1);
    }
};

MiniMap.prototype.clear = function () {
    this.keys.length = 0;
    this.values.length = 0;
};


}],["point.js","ndim","point.js",{},function (require, exports, module, __filename, __dirname){

// ndim/point.js
// -------------

"use strict";

module.exports = Point;
function Point() {
}

Point.prototype.add = function (that) {
    return this.clone().addThis(that);
};

Point.prototype.sub = function (that) {
    return this.clone().addThis(that);
};

// not dot or cross, just elementwise multiplication
Point.prototype.mul = function (that) {
    return this.clone().mulThis(that);
};

Point.prototype.div = function (that) {
    return this.clone().divThis(that);
};

Point.prototype.scale = function (n) {
    return this.clone().scaleThis(n);
};

Point.prototype.bitwiseAnd = function (n) {
    return this.clone().bitwiseAndThis(n);
};

Point.prototype.bitwiseOr = function (n) {
    return this.clone().bitwiseOrThis(n);
};

Point.prototype.round = function () {
    return this.clone().roundThis();
};

Point.prototype.floor = function () {
    return this.clone().floorThis();
};

Point.prototype.ceil = function () {
    return this.clone().ceilThis();
};

Point.prototype.abs = function () {
    return this.clone().absThis();
};

Point.prototype.min = function () {
    return this.clone().minThis();
};

Point.prototype.max = function () {
    return this.clone().maxThis();
};

}],["point2.js","ndim","point2.js",{"./point":47},function (require, exports, module, __filename, __dirname){

// ndim/point2.js
// --------------

"use strict";

var Point = require("./point");

module.exports = Point2;
function Point2(x, y) {
    this.x = x;
    this.y = y;
}

Point2.prototype = Object.create(Point.prototype);
Point2.prototype.constructor = Point2;

Point2.zero = new Point2(0, 0);
Point2.one = new Point2(1, 1);

Point2.prototype.addThis = function (that) {
    this.x = this.x + that.x;
    this.y = this.y + that.y;
    return this;
};

Point2.prototype.subThis = function (that) {
    this.x = this.x - that.x;
    this.y = this.y - that.y;
    return this;
};

Point2.prototype.mulThis = function (that) {
    this.x = this.x * that.x;
    this.y = this.y * that.y;
    return this;
};

Point2.prototype.divThis = function (that) {
    this.x = this.x / that.x;
    this.y = this.y / that.y;
    return this;
};

Point2.prototype.scaleThis = function (n) {
    this.x = this.x * n;
    this.y = this.y * n;
    return this;
};

Point2.prototype.bitwiseAndThis = function (n) {
    this.x = this.x & n;
    this.y = this.y & n;
    return this;
};

Point2.prototype.bitwiseOrThis = function (n) {
    this.x = this.x | n;
    this.y = this.y | n;
    return this;
};

Point2.prototype.dot = function (that) {
    return this.x * that.x + this.y * that.y;
};

Point2.prototype.roundThis = function () {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
};

Point2.prototype.floorThis = function () {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
};

Point2.prototype.ceilThis = function () {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
};

Point2.prototype.absThis = function () {
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
};

Point2.prototype.minThis = function (that) {
    this.x = Math.min(this.x, that.x);
    this.y = Math.min(this.y, that.y);
};

Point2.prototype.maxThis = function (that) {
    this.x = Math.max(this.x, that.x);
    this.y = Math.max(this.y, that.y);
};

Point2.prototype.transpose = function () {
    return this.clone().transposeThis();
};

Point2.prototype.transposeThis = function () {
    var temp = this.x;
    this.x = this.y;
    this.y = temp;
    return this;
};

Point2.prototype.distance = function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
};

Point2.prototype.clone = function () {
    return new Point2(this.x, this.y);
};

Point2.prototype.copyFrom = function (that) {
    this.x = that.x;
    this.y = that.y;
    return this;
};

// TODO deprecated for copyFrom
Point2.prototype.become = function (that) {
    this.x = that.x;
    this.y = that.y;
    return this;
};

Point2.prototype.toString = function () {
    return "[x=" + this.x + " y=" + this.y + "]";
};

Point2.prototype.hash = function () {
    return this.x + "," + this.y;
};

Point2.prototype.equals = function (that) {
    return this.x === that.x && this.y === that.y;
};

Point2.prototype.lessThan = function (that) {
    return this.x < that.x && this.y < that.y;
};

}],["region.js","ndim","region.js",{},function (require, exports, module, __filename, __dirname){

// ndim/region.js
// --------------

"use strict";

module.exports = Region;
function Region(position, size) {
    this.position = position;
    this.size = size;
}

Region.prototype.copyFrom = function (that) {
    this.position.copyFrom(that.position);
    this.size.copyFrom(that.size);
    return this;
};

// TODO deprecated for copyFrom
Region.prototype.become = function (that) {
    this.position.become(that.position);
    this.size.become(that.size);
    return this;
};

Region.prototype.scaleThis = function (n) {
    this.position.scaleThis(n);
    this.size.scaleThis(n);
    return this;
};

Region.prototype.scale = function (n) {
    return this.clone().scaleThis(n);
};

Region.prototype.roundThis = function () {
    this.temp1.become(this.position).addThis(this.size).roundThis();
    this.position.roundThis();
    this.size.become(this.temp1).subThis(this.position);
    return this;
};

Region.prototype.round = function (n) {
    return this.clone().roundThis(n);
};

Region.prototype.roundInwardThis = function () {
    this.temp1.become(this.position).addThis(this.size).floorThis();
    this.position.ceilThis().minThis(this.temp1);
    this.size.become(this.temp1).subThis(this.position);
    return this;
};

Region.prototype.roundInward = function (n) {
    return this.clone().roundInwardThis(n);
};

Region.prototype.roundOutwardThis = function () {
    this.temp1.become(this.position).addThis(this.size).ceilThis();
    this.position.floorThis();
    this.size.become(this.temp1).subThis(this.position);
    return this;
};

Region.prototype.roundOutward = function (n) {
    return this.clone().roundOutwardThis(n);
};

Region.prototype.annex = function (that) {
    return this.clone().annexThis(that);
};

Region.prototype.annexThis = function (that) {
    this.temp1.become(this.position).addThis(this.size);
    this.temp2.become(that.position).addThis(that.size);
    this.position.minThis(that.position);
    this.temp1.maxThis(this.temp2);
    this.size.become(this.temp1).subThis(this.position);
    return this;
};

Region.prototype.equals = function (that) {
    return that && this.position.equals(that.position) && this.size.equals(that.size);
};

Region.prototype.toString = function () {
    return "[position:" + this.position.toString() + " size:" + this.size.toString() + "]";
};

}],["region2.js","ndim","region2.js",{"./region":49,"./point2":48},function (require, exports, module, __filename, __dirname){

// ndim/region2.js
// ---------------

"use strict";

var Region = require("./region");
var Point2 = require("./point2");

module.exports = Region2;
function Region2() {
    Region.apply(this, arguments);
}

Region2.prototype = Object.create(Region.prototype);
Region2.prototype.constructor = Region2;
Region2.prototype.temp1 = new Point2();
Region2.prototype.temp2 = new Point2();

Region2.prototype.contains = function (that) {
    return (
        this.position.x <= that.position.x &&
        this.position.x + this.size.x >= that.position.x + that.size.x &&
        this.position.y <= that.position.y &&
        this.position.y + this.size.y >= that.position.y + that.size.y
    );
};

Region2.prototype.clone = function () {
    return new Region2(this.position.clone(), this.size.clone());
};


}],["lib/performance-now.js","performance-now/lib","performance-now.js",{},function (require, exports, module, __filename, __dirname){

// performance-now/lib/performance-now.js
// --------------------------------------

// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*
//@ sourceMappingURL=performance-now.map
*/

}],["index.js","pop-arrayify","index.js",{},function (require, exports, module, __filename, __dirname){

// pop-arrayify/index.js
// ---------------------

"use strict";

module.exports = arrayify;
function arrayify(object) {
    var result, index, length;
    if (!object) {
        return [];
    } else if (Array.isArray(object)) {
        return object.slice();
    } else if (typeof object.toArray === "function") {
        return object.toArray();
    } else if (typeof object.forEach === "function") {
        result = [];
        object.forEach(result.push, result);
        return result;
    } else if (typeof object.length === "number") {
        result = [];
        for (index = 0, length = object.length; index < length; index++) {
            result[index] = object[index];
        }
        return result;
    } else {
        throw new Error("Can't convert to an array " + object);
    }
}

}],["pop-clone.js","pop-clone","pop-clone.js",{"mini-map":46},function (require, exports, module, __filename, __dirname){

// pop-clone/pop-clone.js
// ----------------------


var MiniMap = require("mini-map");
var getPrototypeOf = Object.getPrototypeOf;
var objectPrototype = Object.prototype;

/**
 * Creates a deep copy of any value.  Values, being immutable, are returned
 * without alternation.  Forwards to <code>clone</code> on objects and arrays.
 *
 * @function clone
 * @param {Any} value a value to clone
 * @param {Number} depth an optional traversal depth, defaults to infinity.  A
 * value of <code>0</code> means to make no clone and return the value
 * directly.
 * @param {Map} memo an optional memo of already visited objects to preserve
 * reference cycles.  The cloned object will have the exact same shape as the
 * original, but no identical objects.  Te map may be later used to associate
 * all objects in the original object graph with their corresponding member of
 * the cloned graph.
 * @returns a copy of the value
 */
module.exports = cloneOperator;
function cloneOperator(value, depth, memo) {
    if (value && value.valueOf) {
        value = value.valueOf();
    }
    if (depth == null) { // null or undefined
        depth = Infinity;
    } else if (depth === 0) {
        return value;
    }
    if (value && typeof value === "object") {
        memo = memo || new MiniMap();
        if (!memo.has(value)) {
            if (value && typeof value.clone === "function") {
                memo.set(value, value.clone(depth, memo));
            } else {
                var isArray = Array.isArray(value);
                var prototype = getPrototypeOf(value);
                if (
                    isArray ||
                    prototype === null ||
                    prototype === objectPrototype
                ) {
                    var clone = isArray ? [] : {};
                    memo.set(value, clone);
                    for (var key in value) {
                        clone[key] = cloneOperator(
                            value[key],
                            depth - 1,
                            memo
                        );
                    }
                } else {
                    throw new Error("Can't clone " + value);
                }
            }
        }
        return memo.get(value);
    }
    return value;
}


}],["pop-compare.js","pop-compare","pop-compare.js",{},function (require, exports, module, __filename, __dirname){

// pop-compare/pop-compare.js
// --------------------------


/**
    Determines the order in which any two objects should be sorted by returning
    a number that has an analogous relationship to zero as the left value to
    the right.  That is, if the left is "less than" the right, the returned
    value will be "less than" zero, where "less than" may be any other
    transitive relationship.

    <p>Arrays are compared by the first diverging values, or by length.

    <p>Any two values that are incomparable return zero.  As such,
    <code>equals</code> should not be implemented with <code>compare</code>
    since incomparability is indistinguishable from equality.

    <p>Sorts strings lexicographically.  This is not suitable for any
    particular international setting.  Different locales sort their phone books
    in very different ways, particularly regarding diacritics and ligatures.

    <p>If the given object is an instance of a type that implements a method
    named "compare", this function defers to the instance.  The method does not
    need to be an owned property to distinguish it from an object literal since
    object literals are incomparable.  Unlike <code>Object</code> however,
    <code>Array</code> implements <code>compare</code>.

    @param {Any} left
    @param {Any} right
    @returns {Number} a value having the same transitive relationship to zero
    as the left and right values.
*/
module.exports = compare;
function compare(a, b, compare) {
    var difference;
    // unbox objects
    // mercifully handles the Date case
    if (a && typeof a.valueOf === "function") {
        a = a.valueOf();
    }
    if (b && typeof b.valueOf === "function") {
        b = b.valueOf();
    }
    // x !== x is only true if x is NaN. NaN is "incomparable" and both
    // equivalent and incomparable values always return 0.
    if (a === b || a !== a || b !== b)
        return 0;
    var aType = typeof a;
    var bType = typeof b;
    if (aType === "number" && bType === "number")
        return a - b;
    if (aType === "string" && bType === "string")
        return a < b ? -Infinity : Infinity;
        // the possibility of equality elimiated above
    compare = compare || module.exports;
    if (Array.isArray(a) && Array.isArray(b)) {
        for (var index in a) {
            if (!(index in b)) {
                return Infinity;
            } else {
                difference = compare(a[index], b[index], compare);
                if (difference) {
                    return difference;
                }
            }
        }
        for (var index in b) {
            if (!(index in a)) {
                return -Infinity;
            }
        }
        return a.length - b.length;
    }
    if (a && typeof a.compare === "function")
        return a.compare(b, compare);
    // not commutative, the relationship is reversed
    if (b && typeof b.compare === "function")
        return -b.compare(a, compare);
    return 0;
}


}],["pop-equals.js","pop-equals","pop-equals.js",{"mini-map":46},function (require, exports, module, __filename, __dirname){

// pop-equals/pop-equals.js
// ------------------------

"use strict";

var MiniMap = require("mini-map");
var getPrototypeOf = Object.getPrototypeOf;
var objectPrototype = Object.prototype;

/**
    Performs a polymorphic, type-sensitive deep equivalence comparison of any
    two values.

    <p>As a basic principle, any value is equivalent to itself (as in
    identity), any boxed version of itself (as a <code>new Number(10)</code> is
    to 10), and any deep clone of itself.

    <p>Equivalence has the following properties:

    <ul>
        <li><strong>polymorphic:</strong>
            If the given object is an instance of a type that implements a
            methods named "equals", this function defers to the method.  So,
            this function can safely compare any values regardless of type,
            including undefined, null, numbers, strings, any pair of objects
            where either implements "equals", or object literals that may even
            contain an "equals" key.
        <li><strong>type-sensitive:</strong>
            Incomparable types are not equal.  No object is equivalent to any
            array.  No string is equal to any other number.
        <li><strong>deep:</strong>
            Collections with equivalent content are equivalent, recursively.
        <li><strong>equivalence:</strong>
            Identical values and objects are equivalent, but so are collections
            that contain equivalent content.  Whether order is important varies
            by type.  For Arrays and lists, order is important.  For Objects,
            maps, and sets, order is not important.  Boxed objects are mutally
            equivalent with their unboxed values, by virtue of the standard
            <code>valueOf</code> method.
    </ul>
    @param this
    @param that
    @returns {Boolean} whether the values are deeply equivalent
*/
module.exports = equals;
function equals(a, b, equals, memo) {
    equals = equals || module.exports;
    // unbox objects
    if (a && typeof a.valueOf === "function") {
        a = a.valueOf();
    }
    if (b && typeof b.valueOf === "function") {
        b = b.valueOf();
    }
    if (a === b)
        return true;
    // NaN !== NaN, but they are equal.
    // NaNs are the only non-reflexive value, i.e., if x !== x,
    // then x is a NaN.
    // isNaN is broken: it converts its argument to number, so
    // isNaN("foo") => true
    // We have established that a !== b, but if a !== a && b !== b, they are
    // both NaN.
    if (a !== a && b !== b)
        return true;
    if (!a || !b)
        return false;
    if (typeof a === "object") {
        memo = memo || new MiniMap();
        if (memo.has(a)) {
            return true;
        }
        memo.set(a, true);
    }
    if (typeof a.equals === "function") {
        return a.equals(b, equals, memo);
    }
    // commutative
    if (typeof b.equals === "function") {
        return b.equals(a, equals, memo);
    }
    if ((Array.isArray(a) || Array.isArray(b)) && a.length !== b.length) {
        return false;
    }
    if (typeof a === "object" && typeof b === "object") {
        if (
            getPrototypeOf(a) === objectPrototype &&
            getPrototypeOf(b) === objectPrototype ||
            Array.isArray(a) ||
            Array.isArray(b)
        ) {
            for (var name in a) {
                if (!equals(a[name], b[name], equals, memo)) {
                    return false;
                }
            }
            for (var name in b) {
                if (!(name in a)) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}

// Because a return value of 0 from a `compare` function  may mean either
// "equals" or "is incomparable", `equals` cannot be defined in terms of
// `compare`.  However, `compare` *can* be defined in terms of `equals` and
// `lessThan`.  Again however, more often it would be desirable to implement
// all of the comparison functions in terms of compare rather than the other
// way around.


}],["has.js","pop-has","has.js",{"pop-equals":55},function (require, exports, module, __filename, __dirname){

// pop-has/has.js
// --------------

"use strict";

var equalsOperator = require("pop-equals");
var hasOwnProperty = Object.prototype.hasOwnProperty;

module.exports = has;
function has(object, soughtValue, equals) {
    equals = equals || equalsOperator;
    for (var key in object) {
        if (hasOwnProperty.call(object, key)) {
            var value = object[key];
            if (equals(soughtValue, value)) {
                return true;
            }
        }
    }
    return false;
}

}],["pop-has.js","pop-has","pop-has.js",{"./has":56},function (require, exports, module, __filename, __dirname){

// pop-has/pop-has.js
// ------------------

"use strict";

var objectHas = require("./has");

module.exports = has;
function has(object, soughtValue, equals) {
    if (object && typeof object.has === "function") {
        return object.has(soughtValue, equals);
    } else {
        return objectHas(object, soughtValue, equals);
    }
}

}],["pop-hash.js","pop-hash","pop-hash.js",{"weak-map":73},function (require, exports, module, __filename, __dirname){

// pop-hash/pop-hash.js
// --------------------

"use strict";

var WeakMap = require("weak-map");

var hashes = new WeakMap();

module.exports = hash;
function hash(value) {
    if (value && typeof value.hash === "function") {
        return value.hash();
    } else if (value && typeof value === "object") {
        var hash = hashes.get(value);
        if (!hash) {
            hash = (Math.random() * 0xFFFFFFFF) >>> 0;
            hashes.set(value, hash);
        }
        return hash;
    } else {
        return value;
    }
}


}],["array-iterator.js","pop-iterate","array-iterator.js",{"./iteration":60},function (require, exports, module, __filename, __dirname){

// pop-iterate/array-iterator.js
// -----------------------------

"use strict";

var Iteration = require("./iteration");

module.exports = ArrayIterator;
function ArrayIterator(iterable, start, stop, step) {
    this.array = iterable;
    this.start = start || 0;
    this.stop = stop || Infinity;
    this.step = step || 1;
}

ArrayIterator.prototype.next = function () {
    var iteration;
    if (this.start < Math.min(this.array.length, this.stop)) {
        iteration = new Iteration(this.array[this.start], false, this.start);
        this.start += this.step;
    } else {
        iteration =  new Iteration(undefined, true);
    }
    return iteration;
};


}],["iteration.js","pop-iterate","iteration.js",{},function (require, exports, module, __filename, __dirname){

// pop-iterate/iteration.js
// ------------------------

"use strict";

module.exports = Iteration;
function Iteration(value, done, index) {
    this.value = value;
    this.done = done;
    this.index = index;
}

Iteration.prototype.equals = function (other) {
    return (
        typeof other == 'object' &&
        other.value === this.value &&
        other.done === this.done &&
        other.index === this.index
    );
};


}],["object-iterator.js","pop-iterate","object-iterator.js",{"./iteration":60,"./array-iterator":59},function (require, exports, module, __filename, __dirname){

// pop-iterate/object-iterator.js
// ------------------------------

"use strict";

var Iteration = require("./iteration");
var ArrayIterator = require("./array-iterator");

module.exports = ObjectIterator;
function ObjectIterator(iterable, start, stop, step) {
    this.object = iterable;
    this.keysIterator = new ArrayIterator(Object.keys(iterable), start, stop, step);
}

ObjectIterator.prototype.next = function () {
    var iteration = this.keysIterator.next();
    if (iteration.done) {
        return iteration;
    }
    var key = iteration.value;
    return new Iteration(this.object[key], false, key);
};


}],["pop-iterate.js","pop-iterate","pop-iterate.js",{"./array-iterator":59,"./object-iterator":61},function (require, exports, module, __filename, __dirname){

// pop-iterate/pop-iterate.js
// --------------------------

"use strict";

var ArrayIterator = require("./array-iterator");
var ObjectIterator = require("./object-iterator");

module.exports = iterate;
function iterate(iterable, start, stop, step) {
    if (!iterable) {
        return empty;
    } else if (Array.isArray(iterable)) {
        return new ArrayIterator(iterable, start, stop, step);
    } else if (typeof iterable.next === "function") {
        return iterable;
    } else if (typeof iterable.iterate === "function") {
        return iterable.iterate(start, stop, step);
    } else if (typeof iterable === "object") {
        return new ObjectIterator(iterable);
    } else {
        throw new TypeError("Can't iterate " + iterable);
    }
}


}],["index.js","pop-observe","index.js",{"./observable-array":64,"./observable-object":66,"./observable-range":67,"./observable-map":65},function (require, exports, module, __filename, __dirname){

// pop-observe/index.js
// --------------------

"use strict";

require("./observable-array");
var Oa = require("./observable-array");
var Oo = require("./observable-object");
var Or = require("./observable-range");
var Om = require("./observable-map");

exports.makeArrayObservable = Oa.makeArrayObservable;

for (var name in Oo) {
    exports[name] = Oo[name];
}
for (var name in Or) {
    exports[name] = Or[name];
}
for (var name in Om) {
    exports[name] = Om[name];
}


}],["observable-array.js","pop-observe","observable-array.js",{"./observable-object":66,"./observable-range":67,"./observable-map":65,"pop-swap/swap":69},function (require, exports, module, __filename, __dirname){

// pop-observe/observable-array.js
// -------------------------------

/*
 * Based in part on observable arrays from Motorola Mobility’s Montage
 * Copyright (c) 2012, Motorola Mobility LLC. All Rights Reserved.
 *
 * 3-Clause BSD License
 * https://github.com/motorola-mobility/montage/blob/master/LICENSE.md
 */

/**
 * This module is responsible for observing changes to owned properties of
 * objects and changes to the content of arrays caused by method calls. The
 * interface for observing array content changes establishes the methods
 * necessary for any collection with observable content.
 */

var Oo = require("./observable-object");
var Or = require("./observable-range");
var Om = require("./observable-map");

var array_swap = require("pop-swap/swap");
var array_splice = Array.prototype.splice;
var array_slice = Array.prototype.slice;
var array_reverse = Array.prototype.reverse;
var array_sort = Array.prototype.sort;
var array_empty = [];

var observableArrayProperties = {

    swap: {
        value: function swap(start, minusLength, plus) {
            if (plus) {
                if (!Array.isArray(plus)) {
                    plus = array_slice.call(plus);
                }
            } else {
                plus = array_empty;
            }

            if (start < 0) {
                start = this.length + start;
            } else if (start > this.length) {
                var holes = start - this.length;
                var newPlus = Array(holes + plus.length);
                for (var i = 0, j = holes; i < plus.length; i++, j++) {
                    if (i in plus) {
                        newPlus[j] = plus[i];
                    }
                }
                plus = newPlus;
                start = this.length;
            }

            if (start + minusLength > this.length) {
                // Truncate minus length if it extends beyond the length
                minusLength = this.length - start;
            } else if (minusLength < 0) {
                // It is the JavaScript way.
                minusLength = 0;
            }

            var minus;
            if (minusLength === 0) {
                // minus will be empty
                if (plus.length === 0) {
                    // at this point if plus is empty there is nothing to do.
                    return []; // [], but spare us an instantiation
                }
                minus = array_empty;
            } else {
                minus = array_slice.call(this, start, start + minusLength);
            }

            var diff = plus.length - minus.length;
            var oldLength = this.length;
            var newLength = Math.max(this.length + diff, start + plus.length);
            var longest = Math.max(oldLength, newLength);
            var observedLength = Math.min(longest, this.observedLength);

            // dispatch before change events
            if (diff) {
                Oo.dispatchPropertyWillChange(this, "length", newLength, oldLength);
            }
            Or.dispatchRangeWillChange(this, plus, minus, start);
            if (diff === 0) {
                // Substring replacement
                for (var i = start, j = 0; i < start + plus.length; i++, j++) {
                    if (plus[j] !== minus[j]) {
                        Oo.dispatchPropertyWillChange(this, i, plus[j], minus[j]);
                        Om.dispatchMapWillChange(this, "update", i, plus[j], minus[j]);
                    }
                }
            } else {
                // All subsequent values changed or shifted.
                // Avoid (observedLength - start) long walks if there are no
                // registered descriptors.
                for (var i = start, j = 0; i < observedLength; i++, j++) {
                    if (i < oldLength && i < newLength) { // update
                        if (j < plus.length) {
                            if (plus[j] !== this[i]) {
                                Oo.dispatchPropertyWillChange(this, i, plus[j], this[i]);
                                Om.dispatchMapWillChange(this, "update", i, plus[j], this[i]);
                            }
                        } else {
                            if (this[i - diff] !== this[i]) {
                                Oo.dispatchPropertyWillChange(this, i, this[i - diff], this[i]);
                                Om.dispatchMapWillChange(this, "update", i, this[i - diff], this[i]);
                            }
                        }
                    } else if (i < newLength) { // but i >= oldLength, create
                        if (j < plus.length) {
                            if (plus[j] !== void 0) {
                                Oo.dispatchPropertyWillChange(this, i, plus[j]);
                            }
                            Om.dispatchMapWillChange(this, "create", i, plus[j]);
                        } else {
                            if (this[i - diff] !== void 0) {
                                Oo.dispatchPropertyWillChange(this, i, this[i - diff]);
                            }
                            Om.dispatchMapWillChange(this, "create", i, this[i - diff]);
                        }
                    } else if (i < oldLength) { // but i >= newLength, delete
                        if (this[i] !== void 0) {
                            Oo.dispatchPropertyWillChange(this, i, void 0, this[i]);
                        }
                        Om.dispatchMapWillChange(this, "delete", i, void 0, this[i]);
                    } else {
                        throw new Error("assertion error");
                    }
                }
            }

            // actual work
            array_swap(this, start, minusLength, plus);

            // dispatch after change events
            if (diff === 0) { // substring replacement
                for (var i = start, j = 0; i < start + plus.length; i++, j++) {
                    if (plus[j] !== minus[j]) {
                        Oo.dispatchPropertyChange(this, i, plus[j], minus[j]);
                        Om.dispatchMapChange(this, "update", i, plus[j], minus[j]);
                    }
                }
            } else {
                // All subsequent values changed or shifted.
                // Avoid (observedLength - start) long walks if there are no
                // registered descriptors.
                for (var i = start, j = 0; i < observedLength; i++, j++) {
                    if (i < oldLength && i < newLength) { // update
                        if (j < minus.length) {
                            if (this[i] !== minus[j]) {
                                Oo.dispatchPropertyChange(this, i, this[i], minus[j]);
                                Om.dispatchMapChange(this, "update", i, this[i], minus[j]);
                            }
                        } else {
                            if (this[i] !== this[i + diff]) {
                                Oo.dispatchPropertyChange(this, i, this[i], this[i + diff]);
                                Om.dispatchMapChange(this, "update", i, this[i], this[i + diff]);
                            }
                        }
                    } else if (i < newLength) { // but i >= oldLength, create
                        if (j < minus.length) {
                            if (this[i] !== minus[j]) {
                                Oo.dispatchPropertyChange(this, i, this[i], minus[j]);
                            }
                            Om.dispatchMapChange(this, "create", i, this[i], minus[j]);
                        } else {
                            if (this[i] !== this[i + diff]) {
                                Oo.dispatchPropertyChange(this, i, this[i], this[i + diff]);
                            }
                            Om.dispatchMapChange(this, "create", i, this[i], this[i + diff]);
                        }
                    } else if (i < oldLength) { // but i >= newLength, delete
                        if (j < minus.length) {
                            if (minus[j] !== void 0) {
                                Oo.dispatchPropertyChange(this, i, void 0, minus[j]);
                            }
                            Om.dispatchMapChange(this, "delete", i, void 0, minus[j]);
                        } else {
                            if (this[i + diff] !== void 0) {
                                Oo.dispatchPropertyChange(this, i, void 0, this[i + diff]);
                            }
                            Om.dispatchMapChange(this, "delete", i, void 0, this[i + diff]);
                        }
                    } else {
                        throw new Error("assertion error");
                    }
                }
            }

            Or.dispatchRangeChange(this, plus, minus, start);
            if (diff) {
                Oo.dispatchPropertyChange(this, "length", newLength, oldLength);
            }
        },
        writable: true,
        configurable: true
    },

    splice: {
        value: function splice(start, minusLength) {
            if (start > this.length) {
                start = this.length;
            }
            var result = this.slice(start, start + minusLength);
            this.swap.call(this, start, minusLength, array_slice.call(arguments, 2));
            return result;
        },
        writable: true,
        configurable: true
    },

    // splice is the array content change utility belt.  forward all other
    // content changes to splice so we only have to write observer code in one
    // place

    reverse: {
        value: function reverse() {
            var reversed = this.slice();
            reversed.reverse();
            this.swap(0, this.length, reversed);
            return this;
        },
        writable: true,
        configurable: true
    },

    sort: {
        value: function sort() {
            var sorted = this.slice();
            array_sort.apply(sorted, arguments);
            this.swap(0, this.length, sorted);
            return this;
        },
        writable: true,
        configurable: true
    },

    set: {
        value: function set(index, value) {
            this.swap(index, index >= this.length ? 0 : 1, [value]);
            return true;
        },
        writable: true,
        configurable: true
    },

    shift: {
        value: function shift() {
            if (this.length) {
                var result = this[0];
                this.swap(0, 1);
                return result;
            }
        },
        writable: true,
        configurable: true
    },

    pop: {
        value: function pop() {
            if (this.length) {
                var result = this[this.length - 1];
                this.swap(this.length - 1, 1);
                return result;
            }
        },
        writable: true,
        configurable: true
    },

    push: {
        value: function push(value) {
            this.swap(this.length, 0, arguments);
            return this.length;
        },
        writable: true,
        configurable: true
    },

    unshift: {
        value: function unshift(value) {
            this.swap(0, 0, arguments);
            return this.length;
        },
        writable: true,
        configurable: true
    },

    clear: {
        value: function clear() {
            this.swap(0, this.length);
        },
        writable: true,
        configurable: true
    }

};

var hiddenProperty = {
    value: null,
    enumerable: false,
    writable: true,
    configurable: true
};

var observableArrayOwnProperties = {
    observed: hiddenProperty,
    observedLength: hiddenProperty,

    propertyObservers: hiddenProperty,
    wrappedPropertyDescriptors: hiddenProperty,

    rangeChangeObservers: hiddenProperty,
    rangeWillChangeObservers: hiddenProperty,
    dispatchesRangeChanges: hiddenProperty,

    mapChangeObservers: hiddenProperty,
    mapWillChangeObservers: hiddenProperty,
    dispatchesMapChanges: hiddenProperty
};

// use different strategies for making arrays observable between Internet
// Explorer and other browsers.
var protoIsSupported = {}.__proto__ === Object.prototype;
var bestowObservableArrayProperties;
if (protoIsSupported) {
    var observableArrayPrototype = Object.create(Array.prototype, observableArrayProperties);
    bestowObservableArrayProperties = function (array) {
        array.__proto__ = observableArrayPrototype;
    };
} else {
    bestowObservableArrayProperties = function (array) {
        Object.defineProperties(array, observableArrayProperties);
    };
}

exports.makeArrayObservable = makeArrayObservable;
function makeArrayObservable(array) {
    if (array.observed) {
        return;
    }
    bestowObservableArrayProperties(array);
    Object.defineProperties(array, observableArrayOwnProperties);
    array.observedLength = 0;
    array.observed = true;
}

// For ObservableObject
exports.makePropertyObservable = makePropertyObservable;
function makePropertyObservable(array, index) {
    makeArrayObservable(array);
    if (~~index === index && index >= 0) { // Note: NaN !== NaN, ~~"foo" !== "foo"
        makeIndexObservable(array, index);
    }
}

// For ObservableRange
exports.makeRangeChangesObservable = makeRangeChangesObservable;
function makeRangeChangesObservable(array) {
    makeArrayObservable(array);
}

// For ObservableMap
exports.makeMapChangesObservable = makeMapChangesObservable;
function makeMapChangesObservable(array) {
    makeArrayObservable(array);
    makeIndexObservable(array, Infinity);
}

function makeIndexObservable(array, index) {
    if (index >= array.observedLength) {
        array.observedLength = index + 1;
    }
}


}],["observable-map.js","pop-observe","observable-map.js",{"./observable-array":64},function (require, exports, module, __filename, __dirname){

// pop-observe/observable-map.js
// -----------------------------

"use strict";

var observerFreeList = [];
var observerToFreeList = [];
var dispatching = false;

module.exports = ObservableMap;
function ObservableMap() {
    throw new Error("Can't construct. ObservableMap is a mixin.");
}

ObservableMap.prototype.observeMapChange = function (handler, name, note, capture) {
    return observeMapChange(this, handler, name, note, capture);
};

ObservableMap.prototype.observeMapWillChange = function (handler, name, note) {
    return observeMapChange(this, handler, name, note, true);
};

ObservableMap.prototype.dispatchMapChange = function (type, key, plus, minus, capture) {
    return dispatchMapChange(this, type, key, plus, minus, capture);
};

ObservableMap.prototype.dispatchMapWillChange = function (type, key, plus, minus) {
    return dispatchMapWillChange(this, type, key, plus, minus, true);
};

ObservableMap.prototype.getMapChangeObservers = function (capture) {
    return getMapChangeObservers(this, capture);
};

ObservableMap.prototype.getMapWillChangeObservers = function () {
    return getMapChangeObservers(this, true);
};

ObservableMap.observeMapChange = observeMapChange;
function observeMapChange(object, handler, name, note, capture) {
    makeMapChangesObservable(object);
    var observers = getMapChangeObservers(object, capture);

    var observer;
    if (observerFreeList.length) { // TODO !debug?
        observer = observerFreeList.pop();
    } else {
        observer = new MapChangeObserver();
    }

    observer.object = object;
    observer.name = name;
    observer.capture = capture;
    observer.observers = observers;
    observer.handler = handler;
    observer.note = note;

    // Precompute dispatch method name

    var stringName = "" + name; // Array indicides must be coerced to string.
    var propertyName = stringName.slice(0, 1).toUpperCase() + stringName.slice(1);

    if (!capture) {
        var methodName = "handle" + propertyName + "MapChange";
        if (handler[methodName]) {
            observer.handlerMethodName = methodName;
        } else if (handler.handleMapChange) {
            observer.handlerMethodName = "handleMapChange";
        } else if (handler.call) {
            observer.handlerMethodName = null;
        } else {
            throw new Error("Can't arrange to dispatch map changes to " + handler);
        }
    } else {
        var methodName = "handle" + propertyName + "MapWillChange";
        if (handler[methodName]) {
            observer.handlerMethodName = methodName;
        } else if (handler.handleMapWillChange) {
            observer.handlerMethodName = "handleMapWillChange";
        } else if (handler.call) {
            observer.handlerMethodName = null;
        } else {
            throw new Error("Can't arrange to dispatch map changes to " + handler);
        }
    }

    observers.push(observer);

    // TODO issue warning if the number of handler records is worrisome
    return observer;
}

ObservableMap.observeMapWillChange = observeMapWillChange;
function observeMapWillChange(object, handler, name, note) {
    return observeMapChange(object, handler, name, note, true);
}

ObservableMap.dispatchMapChange = dispatchMapChange;
function dispatchMapChange(object, type, key, plus, minus, capture) {
    if (plus === minus) {
        return;
    }
    if (!dispatching) { // TODO && !debug?
        return startMapChangeDispatchContext(object, type, key, plus, minus, capture);
    }
    var observers = getMapChangeObservers(object, capture);
    for (var index = 0; index < observers.length; index++) {
        var observer = observers[index];
        observer.dispatch(type, key, plus, minus);
    }
}

ObservableMap.dispatchMapWillChange = dispatchMapWillChange;
function dispatchMapWillChange(object, type, key, plus, minus) {
    return dispatchMapChange(object, type, key, plus, minus, true);
}

function startMapChangeDispatchContext(object, type, key, plus, minus, capture) {
    dispatching = true;
    try {
        dispatchMapChange(object, type, key, plus, minus, capture);
    } catch (error) {
        if (typeof error === "object" && typeof error.message === "string") {
            error.message = "Map change dispatch possibly corrupted by error: " + error.message;
            throw error;
        } else {
            throw new Error("Map change dispatch possibly corrupted by error: " + error);
        }
    } finally {
        dispatching = false;
        if (observerToFreeList.length) {
            // Using push.apply instead of addEach because push will definitely
            // be much faster than the generic addEach, which also handles
            // non-array collections.
            observerFreeList.push.apply(
                observerFreeList,
                observerToFreeList
            );
            // Using clear because it is observable. The handler record array
            // is obtainable by getPropertyChangeObservers, and is observable.
            observerToFreeList.clear();
        }
    }
}

function getMapChangeObservers(object, capture) {
    if (capture) {
        if (!object.mapWillChangeObservers) {
            object.mapWillChangeObservers = [];
        }
        return object.mapWillChangeObservers;
    } else {
        if (!object.mapChangeObservers) {
            object.mapChangeObservers = [];
        }
        return object.mapChangeObservers;
    }
}

function getMapWillChangeObservers(object) {
    return getMapChangeObservers(object, true);
}

function makeMapChangesObservable(object) {
    if (Array.isArray(object)) {
        Oa.makeMapChangesObservable(object);
    }
    if (object.makeMapChangesObservable) {
        object.makeMapChangesObservable();
    }
    object.dispatchesMapChanges = true;
}

function MapChangeObserver() {
    this.init();
}

MapChangeObserver.prototype.init = function () {
    this.object = null;
    this.name = null;
    this.observers = null;
    this.handler = null;
    this.handlerMethodName = null;
    this.childObserver = null;
    this.note = null;
    this.capture = null;
};

MapChangeObserver.prototype.cancel = function () {
    var observers = this.observers;
    var index = observers.indexOf(this);
    // Unfortunately, if this observer was reused, this would not be sufficient
    // to detect a duplicate cancel. Do not cancel more than once.
    if (index < 0) {
        throw new Error(
            "Can't cancel observer for " +
            JSON.stringify(this.name) + " map changes" +
            " because it has already been canceled"
        );
    }
    var childObserver = this.childObserver;
    observers.splice(index, 1);
    this.init();
    // If this observer is canceled while dispatching a change
    // notification for the same property...
    // 1. We cannot put the handler record onto the free list because
    // it may have been captured in the array of records to which
    // the change notification would be sent. We must mark it as
    // canceled by nulling out the handler property so the dispatcher
    // passes over it.
    // 2. We also cannot put the handler record onto the free list
    // until all change dispatches have been completed because it could
    // conceivably be reused, confusing the current dispatcher.
    if (dispatching) {
        // All handlers added to this list will be moved over to the
        // actual free list when there are no longer any property
        // change dispatchers on the stack.
        observerToFreeList.push(this);
    } else {
        observerFreeList.push(this);
    }
    if (childObserver) {
        // Calling user code on our stack.
        // Done in tail position to avoid a plan interference hazard.
        childObserver.cancel();
    }
};

MapChangeObserver.prototype.dispatch = function (type, key, plus, minus) {
    var handler = this.handler;
    // A null handler implies that an observer was canceled during the dispatch
    // of a change. The observer is pending addition to the free list.
    if (!handler) {
        return;
    }

    var childObserver = this.childObserver;
    this.childObserver = null;
    // XXX plan interference hazards calling cancel and handler methods:
    if (childObserver) {
        childObserver.cancel();
    }

    var handlerMethodName = this.handlerMethodName;
    if (handlerMethodName && typeof handler[handlerMethodName] === "function") {
        childObserver = handler[handlerMethodName](plus, minus, key, type, this.object);
    } else if (handler.call) {
        childObserver = handler.call(void 0, plus, minus, key, type, this.object);
    } else {
        throw new Error(
            "Can't dispatch map change for " + JSON.stringify(this.name) + " to " + handler +
            " because there is no handler method"
        );
    }

    this.childObserver = childObserver;
    return this;
};

var Oa = require("./observable-array");

}],["observable-object.js","pop-observe","observable-object.js",{"./observable-array":64},function (require, exports, module, __filename, __dirname){

// pop-observe/observable-object.js
// --------------------------------

/*jshint node: true*/
"use strict";

// XXX Note: exceptions thrown from handlers and handler cancelers may
// interfere with dispatching to subsequent handlers of any change in progress.
// It is unlikely that plans are recoverable once an exception interferes with
// change dispatch. The internal records should not be corrupt, but observers
// might miss an intermediate property change.

var owns = Object.prototype.hasOwnProperty;

var observerFreeList = [];
var observerToFreeList = [];
var dispatching = false;

// Reusable property descriptor
var hiddenValueProperty = {
    value: null,
    writable: true,
    enumerable: false,
    configurable: true
};

module.exports = ObservableObject;
function ObservableObject() {
    throw new Error("Can't construct. ObservableObject is a mixin.");
}

ObservableObject.prototype.observePropertyChange = function (name, handler, note, capture) {
    return observePropertyChange(this, name, handler, note, capture);
};

ObservableObject.prototype.observePropertyWillChange = function (name, handler, note) {
    return observePropertyWillChange(this, name, handler, note);
};

ObservableObject.prototype.dispatchPropertyChange = function (name, plus, minus, capture) {
    return dispatchPropertyChange(this, name, plus, minus, capture);
};

ObservableObject.prototype.dispatchPropertyWillChange = function (name, plus, minus) {
    return dispatchPropertyWillChange(this, name, plus, minus);
};

ObservableObject.prototype.getPropertyChangeObservers = function (name, capture) {
    return getPropertyChangeObservers(this, name, capture);
};

ObservableObject.prototype.getPropertyWillChangeObservers = function (name) {
    return getPropertyWillChangeObservers(this, name);
};

ObservableObject.prototype.makePropertyObservable = function (name) {
    return makePropertyObservable(this, name);
};

ObservableObject.prototype.preventPropertyObserver = function (name) {
    return preventPropertyObserver(this, name);
};

ObservableObject.prototype.PropertyChangeObserver = PropertyChangeObserver;

// Constructor interface with polymorphic delegation if available

ObservableObject.observePropertyChange = function (object, name, handler, note, capture) {
    if (object.observePropertyChange) {
        return object.observePropertyChange(name, handler, note, capture);
    } else {
        return observePropertyChange(object, name, handler, note, capture);
    }
};

ObservableObject.observePropertyWillChange = function (object, name, handler, note) {
    if (object.observePropertyWillChange) {
        return object.observePropertyWillChange(name, handler, note);
    } else {
        return observePropertyWillChange(object, name, handler, note);
    }
};

ObservableObject.dispatchPropertyChange = function (object, name, plus, minus, capture) {
    if (object.dispatchPropertyChange) {
        return object.dispatchPropertyChange(name, plus, minus, capture);
    } else {
        return dispatchPropertyChange(object, name, plus, minus, capture);
    }
};

ObservableObject.dispatchPropertyWillChange = function (object, name, plus, minus) {
    if (object.dispatchPropertyWillChange) {
        return object.dispatchPropertyWillChange(name, plus, minus);
    } else {
        return dispatchPropertyWillChange(object, name, plus, minus);
    }
};

ObservableObject.makePropertyObservable = function (object, name) {
    if (object.makePropertyObservable) {
        return object.makePropertyObservable(name);
    } else {
        return makePropertyObservable(object, name);
    }
};

ObservableObject.preventPropertyObserver = function (object, name) {
    if (object.preventPropertyObserver) {
        return object.preventPropertyObserver(name);
    } else {
        return preventPropertyObserver(object, name);
    }
};

// Implementation

function observePropertyChange(object, name, handler, note, capture) {
    ObservableObject.makePropertyObservable(object, name);
    var observers = getPropertyChangeObservers(object, name, capture);

    var observer;
    if (observerFreeList.length) { // TODO && !debug?
        observer = observerFreeList.pop();
    } else {
        observer = new PropertyChangeObserver();
    }

    observer.object = object;
    observer.propertyName = name;
    observer.capture = capture;
    observer.observers = observers;
    observer.handler = handler;
    observer.note = note;
    observer.value = object[name];

    // Precompute dispatch method names.

    var stringName = "" + name; // Array indicides must be coerced to string.
    var propertyName = stringName.slice(0, 1).toUpperCase() + stringName.slice(1);

    if (!capture) {
        var specificChangeMethodName = "handle" + propertyName + "PropertyChange";
        var genericChangeMethodName = "handlePropertyChange";
        if (handler[specificChangeMethodName]) {
            observer.handlerMethodName = specificChangeMethodName;
        } else if (handler[genericChangeMethodName]) {
            observer.handlerMethodName = genericChangeMethodName;
        } else if (handler.call) {
            observer.handlerMethodName = null;
        } else {
            throw new Error("Can't arrange to dispatch " + JSON.stringify(name) + " property changes on " + object);
        }
    } else {
        var specificWillChangeMethodName = "handle" + propertyName + "PropertyWillChange";
        var genericWillChangeMethodName = "handlePropertyWillChange";
        if (handler[specificWillChangeMethodName]) {
            observer.handlerMethodName = specificWillChangeMethodName;
        } else if (handler[genericWillChangeMethodName]) {
            observer.handlerMethodName = genericWillChangeMethodName;
        } else if (handler.call) {
            observer.handlerMethodName = null;
        } else {
            throw new Error("Can't arrange to dispatch " + JSON.stringify(name) + " property changes on " + object);
        }
    }

    observers.push(observer);

    // TODO issue warnings if the number of handler records exceeds some
    // concerning quantity as a harbinger of a memory leak.
    // TODO Note that if this is garbage collected without ever being called,
    // it probably indicates a programming error.
    return observer;
}

function observePropertyWillChange(object, name, handler, note) {
    return observePropertyChange(object, name, handler, note, true);
}

function dispatchPropertyChange(object, name, plus, minus, capture) {
    if (!dispatching) { // TODO && !debug?
        return startPropertyChangeDispatchContext(object, name, plus, minus, capture);
    }
    var observers = getPropertyChangeObservers(object, name, capture).slice();
    for (var index = 0; index < observers.length; index++) {
        var observer = observers[index];
        observer.dispatch(plus, minus);
    }
}

function dispatchPropertyWillChange(object, name, plus, minus) {
    dispatchPropertyChange(object, name, plus, minus, true);
}

function startPropertyChangeDispatchContext(object, name, plus, minus, capture) {
    dispatching = true;
    try {
        dispatchPropertyChange(object, name, plus, minus, capture);
    } catch (error) {
        if (typeof error === "object" && typeof error.message === "string") {
            error.message = "Property change dispatch possibly corrupted by error: " + error.message;
            throw error;
        } else {
            throw new Error("Property change dispatch possibly corrupted by error: " + error);
        }
    } finally {
        dispatching = false;
        if (observerToFreeList.length) {
            // Using push.apply instead of addEach because push will definitely
            // be much faster than the generic addEach, which also handles
            // non-array collections.
            observerFreeList.push.apply(
                observerFreeList,
                observerToFreeList
            );
            // Using clear because it is observable. The handler record array
            // is obtainable by getPropertyChangeObservers, and is observable.
            observerToFreeList.length = 0;
        }
    }
}

function getPropertyChangeObservers(object, name, capture) {
    if (!object.propertyObservers) {
        hiddenValueProperty.value = Object.create(null);
        Object.defineProperty(object, "propertyObservers", hiddenValueProperty);
    }
    var observersByKey = object.propertyObservers;
    var phase = capture ? "WillChange" : "Change";
    var key = name + phase;
    if (!Object.prototype.hasOwnProperty.call(observersByKey, key)) {
        observersByKey[key] = [];
    }
    return observersByKey[key];
}

function getPropertyWillChangeObservers(object, name) {
    return getPropertyChangeObservers(object, name, true);
}

function PropertyChangeObserver() {
    this.init();
    // Object.seal(this); // Maybe one day, this won't deoptimize.
}

PropertyChangeObserver.prototype.init = function () {
    this.object = null;
    this.propertyName = null;
    // Peer observers, from which to pluck itself upon cancelation.
    this.observers = null;
    // On which to dispatch property change notifications.
    this.handler = null;
    // Precomputed handler method name for change dispatch
    this.handlerMethodName = null;
    // Returned by the last property change notification, which must be
    // canceled before the next change notification, or when this observer is
    // finally canceled.
    this.childObserver = null;
    // For the discretionary use of the user, perhaps to track why this
    // observer has been created, or whether this observer should be
    // serialized.
    this.note = null;
    // Whether this observer dispatches before a change occurs, or after
    this.capture = null;
    // The last known value
    this.value = null;
};

PropertyChangeObserver.prototype.cancel = function () {
    var observers = this.observers;
    var index = observers.indexOf(this);
    // Unfortunately, if this observer was reused, this would not be sufficient
    // to detect a duplicate cancel. Do not cancel more than once.
    if (index < 0) {
        throw new Error(
            "Can't cancel observer for " +
            JSON.stringify(this.propertyName) + " on " + this.object +
            " because it has already been canceled"
        );
    }
    var childObserver = this.childObserver;
    observers.splice(index, 1);
    this.init();
    // If this observer is canceled while dispatching a change
    // notification for the same property...
    // 1. We cannot put the handler record onto the free list because
    // it may have been captured in the array of records to which
    // the change notification would be sent. We must mark it as
    // canceled by nulling out the handler property so the dispatcher
    // passes over it.
    // 2. We also cannot put the handler record onto the free list
    // until all change dispatches have been completed because it could
    // conceivably be reused, confusing the current dispatcher.
    if (dispatching) {
        // All handlers added to this list will be moved over to the
        // actual free list when there are no longer any property
        // change dispatchers on the stack.
        observerToFreeList.push(this);
    } else {
        observerFreeList.push(this);
    }
    if (childObserver) {
        // Calling user code on our stack.
        // Done in tail position to avoid a plan interference hazard.
        childObserver.cancel();
    }
};

PropertyChangeObserver.prototype.dispatch = function (plus, minus) {
    var handler = this.handler;
    // A null handler implies that an observer was canceled during the dispatch
    // of a change. The observer is pending addition to the free list.
    if (!handler) {
        return;
    }

    if (minus === void 0) {
        minus = this.value;
    }
    this.value = plus;

    var childObserver = this.childObserver;
    this.childObserver = null;
    // XXX plan interference hazards calling cancel and handler methods:
    if (childObserver) {
        childObserver.cancel();
    }
    var handlerMethodName = this.handlerMethodName;
    if (handlerMethodName && typeof handler[handlerMethodName] === "function") {
        childObserver = handler[handlerMethodName](plus, minus, this.propertyName, this.object);
    } else if (handler.call) {
        childObserver = handler.call(void 0, plus, minus, this.propertyName, this.object);
    } else {
        throw new Error(
            "Can't dispatch " + JSON.stringify(handlerMethodName) + " property change on " + object +
            " because there is no handler method"
        );
    }

    this.childObserver = childObserver;
    return this;
};

function makePropertyObservable(object, name) {
    if (Array.isArray(object)) {
        return Oa.makePropertyObservable(object, name);
    }

    var wrappedDescriptor = wrapPropertyDescriptor(object, name);

    if (!wrappedDescriptor) {
        return;
    }

    var thunk;
    // in both of these new descriptor variants, we reuse the wrapped
    // descriptor to either store the current value or apply getters
    // and setters. this is handy since we can reuse the wrapped
    // descriptor if we uninstall the observer. We even preserve the
    // assignment semantics, where we get the value from up the
    // prototype chain, and set as an owned property.
    if ("value" in wrappedDescriptor) {
        thunk = makeValuePropertyThunk(name, wrappedDescriptor);
    } else { // "get" or "set", but not necessarily both
        thunk = makeGetSetPropertyThunk(name, wrappedDescriptor);
    }

    Object.defineProperty(object, name, thunk);
}

/**
 * Prevents a thunk from being installed on a property, assuming that the
 * underlying type will dispatch the change manually, or intends the property
 * to stick on all instances.
 */
function preventPropertyObserver(object, name) {
    var wrappedDescriptor = wrapPropertyDescriptor(object, name);
    Object.defineProperty(object, name, wrappedDescriptor);
}

function wrapPropertyDescriptor(object, name) {
    // Arrays are special. We do not support direct setting of properties
    // on an array. instead, call .set(index, value). This is observable.
    // "length" property is observable for all mutating methods because
    // our overrides explicitly dispatch that change.
    if (Array.isArray(object)) {
        return;
    }

    if (!Object.isExtensible(object, name)) {
        return;
    }

    var wrappedDescriptor = getPropertyDescriptor(object, name);
    var wrappedPrototype = wrappedDescriptor.prototype;

    var existingWrappedDescriptors = wrappedPrototype.wrappedPropertyDescriptors;
    if (existingWrappedDescriptors && owns.call(existingWrappedDescriptors, name)) {
        return;
    }

    var wrappedPropertyDescriptors = object.wrappedPropertyDescriptors;
    if (!wrappedPropertyDescriptors) {
        wrappedPropertyDescriptors = {};
        hiddenValueProperty.value = wrappedPropertyDescriptors;
        Object.defineProperty(object, "wrappedPropertyDescriptors", hiddenValueProperty);
    }

    if (owns.call(wrappedPropertyDescriptors, name)) {
        // If we have already recorded a wrapped property descriptor,
        // we have already installed the observer, so short-here.
        return;
    }

    if (!wrappedDescriptor.configurable) {
        return;
    }

    // Memoize the descriptor so we know not to install another layer. We
    // could use it to uninstall the observer, but we do not to avoid GC
    // thrashing.
    wrappedPropertyDescriptors[name] = wrappedDescriptor;

    // Give up *after* storing the wrapped property descriptor so it
    // can be restored by uninstall. Unwritable properties are
    // silently not overriden. Since success is indistinguishable from
    // failure, we let it pass but don't waste time on intercepting
    // get/set.
    if (!wrappedDescriptor.writable && !wrappedDescriptor.set) {
        return;
    }

    // If there is no setter, it is not mutable, and observing is moot.
    // Manual dispatch may still apply.
    if (wrappedDescriptor.get && !wrappedDescriptor.set) {
        return;
    }

    return wrappedDescriptor;
}

function getPropertyDescriptor(object, name) {
    // walk up the prototype chain to find a property descriptor for the
    // property name.
    var descriptor;
    var prototype = object;
    do {
        descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (descriptor) {
            break;
        }
        prototype = Object.getPrototypeOf(prototype);
    } while (prototype);
    if (descriptor) {
        descriptor.prototype = prototype;
        return descriptor;
    } else {
        // or default to an undefined value
        return {
            prototype: object,
            value: undefined,
            enumerable: false,
            writable: true,
            configurable: true
        };
    }
}

function makeValuePropertyThunk(name, wrappedDescriptor) {
    return {
        get: function () {
            // Uses __this__ to quickly distinguish __state__ properties from
            // upward in the prototype chain.
            if (this.__state__ === void 0 || this.__state__.__this__ !== this) {
                initState(this);
            }
            var state = this.__state__;

            if (!(name in state)) {
                // Get the initial value from up the prototype chain
                state[name] = wrappedDescriptor.value;
            }

            return state[name];
        },
        set: function (plus) {
            // Uses __this__ to quickly distinguish __state__ properties from
            // upward in the prototype chain.
            if (this.__state__ === void 0 || this.__state__.__this__ !== this) {
                initState(this);
                this.__state__[name] = this[name];
            }
            var state = this.__state__;

            if (!(name in state)) {
                // Get the initial value from up the prototype chain
                state[name] = wrappedDescriptor.value;
            }

            if (plus === state[name]) {
                return plus;
            }

            // XXX plan interference hazard:
            dispatchPropertyWillChange(this, name, plus);

            wrappedDescriptor.value = plus;
            state[name] = plus;

            // XXX plan interference hazard:
            dispatchPropertyChange(this, name, plus);

            return plus;
        },
        enumerable: wrappedDescriptor.enumerable,
        configurable: true
    };
}

function makeGetSetPropertyThunk(name, wrappedDescriptor) {
    return {
        get: function () {
            if (wrappedDescriptor.get) {
                return wrappedDescriptor.get.apply(this, arguments);
            }
        },
        set: function (plus) {
            // Uses __this__ to quickly distinguish __state__ properties from
            // upward in the prototype chain.
            if (this.__state__ === void 0 || this.__state__.__this__ !== this) {
                initState(this);
                this.__state__[name] = this[name];
            }
            var state = this.__state__;

            if (state[name] === plus) {
                return plus;
            }

            // XXX plan interference hazard:
            dispatchPropertyWillChange(this, name, plus);

            // call through to actual setter
            if (wrappedDescriptor.set) {
                wrappedDescriptor.set.apply(this, arguments);
                state[name] = plus;
            }

            // use getter, if possible, to adjust the plus value if the setter
            // adjusted it, for example a setter for an array property that
            // retains the original array and replaces its content, or a setter
            // that coerces the value to an expected type.
            if (wrappedDescriptor.get) {
                plus = wrappedDescriptor.get.apply(this, arguments);
            }

            // dispatch the new value: the given value if there is
            // no getter, or the actual value if there is one
            // TODO spec
            // XXX plan interference hazard:
            dispatchPropertyChange(this, name, plus);

            return plus;
        },
        enumerable: wrappedDescriptor.enumerable,
        configurable: true
    };
}

function initState(object) {
    Object.defineProperty(object, "__state__", {
        value: {
            __this__: object
        },
        writable: true,
        enumerable: false,
        configurable: true
    });
}

var Oa = require("./observable-array");

}],["observable-range.js","pop-observe","observable-range.js",{"./observable-array":64},function (require, exports, module, __filename, __dirname){

// pop-observe/observable-range.js
// -------------------------------

/*global -WeakMap*/
"use strict";

// TODO review all error messages for consistency and helpfulness across observables

var observerFreeList = [];
var observerToFreeList = [];
var dispatching = false;

module.exports = ObservableRange;
function ObservableRange() {
    throw new Error("Can't construct. ObservableRange is a mixin.");
}

ObservableRange.prototype.observeRangeChange = function (handler, name, note, capture) {
    return observeRangeChange(this, handler, name, note, capture);
};

ObservableRange.prototype.observeRangeWillChange = function (handler, name, note) {
    return observeRangeChange(this, handler, name, note, true);
};

ObservableRange.prototype.dispatchRangeChange = function (plus, minus, index, capture) {
    return dispatchRangeChange(this, plus, minus, index, capture);
};

ObservableRange.prototype.dispatchRangeWillChange = function (plus, minus, index) {
    return dispatchRangeChange(this, plus, minus, index, true);
};

ObservableRange.prototype.getRangeChangeObservers = function (capture) {
};

ObservableRange.prototype.getRangeWillChangeObservers = function () {
    return getRangeChangeObservers(this, true);
};

ObservableRange.observeRangeChange = observeRangeChange;
function observeRangeChange(object, handler, name, note, capture) {
    makeRangeChangesObservable(object);
    var observers = getRangeChangeObservers(object, capture);

    var observer;
    if (observerFreeList.length) { // TODO !debug?
        observer = observerFreeList.pop();
    } else {
        observer = new RangeChangeObserver();
    }

    observer.object = object;
    observer.name = name;
    observer.capture = capture;
    observer.observers = observers;
    observer.handler = handler;
    observer.note = note;

    // Precompute dispatch method name

    var stringName = "" + name; // Array indicides must be coerced to string.
    var propertyName = stringName.slice(0, 1).toUpperCase() + stringName.slice(1);

    if (!capture) {
        var methodName = "handle" + propertyName + "RangeChange";
        if (handler[methodName]) {
            observer.handlerMethodName = methodName;
        } else if (handler.handleRangeChange) {
            observer.handlerMethodName = "handleRangeChange";
        } else if (handler.call) {
            observer.handlerMethodName = null;
        } else {
            throw new Error("Can't arrange to dispatch " + JSON.stringify(name) + " map changes");
        }
    } else {
        var methodName = "handle" + propertyName + "RangeWillChange";
        if (handler[methodName]) {
            observer.handlerMethodName = methodName;
        } else if (handler.handleRangeWillChange) {
            observer.handlerMethodName = "handleRangeWillChange";
        } else if (handler.call) {
            observer.handlerMethodName = null;
        } else {
            throw new Error("Can't arrange to dispatch " + JSON.stringify(name) + " map changes");
        }
    }

    observers.push(observer);

    // TODO issue warning if the number of handler records is worrisome
    return observer;
}

ObservableRange.observeRangeWillChange = observeRangeWillChange;
function observeRangeWillChange(object, handler, name, note) {
    return observeRangeChange(object, handler, name, note, true);
}

ObservableRange.dispatchRangeChange = dispatchRangeChange;
function dispatchRangeChange(object, plus, minus, index, capture) {
    if (!dispatching) { // TODO && !debug?
        return startRangeChangeDispatchContext(object, plus, minus, index, capture);
    }
    var observers = getRangeChangeObservers(object, capture);
    for (var observerIndex = 0; observerIndex < observers.length; observerIndex++) {
        var observer = observers[observerIndex];
        // The slicing ensures that handlers cannot interfere with another by
        // altering these arguments.
        observer.dispatch(plus.slice(), minus.slice(), index);
    }
}

ObservableRange.dispatchRangeWillChange = dispatchRangeWillChange;
function dispatchRangeWillChange(object, plus, minus, index) {
    return dispatchRangeChange(object, plus, minus, index, true);
}

function startRangeChangeDispatchContext(object, plus, minus, index, capture) {
    dispatching = true;
    try {
        dispatchRangeChange(object, plus, minus, index, capture);
    } catch (error) {
        if (typeof error === "object" && typeof error.message === "string") {
            error.message = "Range change dispatch possibly corrupted by error: " + error.message;
            throw error;
        } else {
            throw new Error("Range change dispatch possibly corrupted by error: " + error);
        }
    } finally {
        dispatching = false;
        if (observerToFreeList.length) {
            // Using push.apply instead of addEach because push will definitely
            // be much faster than the generic addEach, which also handles
            // non-array collections.
            observerFreeList.push.apply(
                observerFreeList,
                observerToFreeList
            );
            // Using clear because it is observable. The handler record array
            // is obtainable by getPropertyChangeObservers, and is observable.
            if (observerToFreeList.clear) {
                observerToFreeList.clear();
            } else {
                observerToFreeList.length = 0;
            }
        }
    }
}

function makeRangeChangesObservable(object) {
    if (Array.isArray(object)) {
        Oa.makeRangeChangesObservable(object);
    }
    if (object.makeRangeChangesObservable) {
        object.makeRangeChangesObservable();
    }
    object.dispatchesRangeChanges = true;
}

function getRangeChangeObservers(object, capture) {
    if (capture) {
        if (!object.rangeWillChangeObservers) {
            object.rangeWillChangeObservers = [];
        }
        return object.rangeWillChangeObservers;
    } else {
        if (!object.rangeChangeObservers) {
            object.rangeChangeObservers = [];
        }
        return object.rangeChangeObservers;
    }
}

/*
    if (object.preventPropertyObserver) {
        return object.preventPropertyObserver(name);
    } else {
        return preventPropertyObserver(object, name);
    }
*/

function RangeChangeObserver() {
    this.init();
}

RangeChangeObserver.prototype.init = function () {
    this.object = null;
    this.name = null;
    this.observers = null;
    this.handler = null;
    this.handlerMethodName = null;
    this.childObserver = null;
    this.note = null;
    this.capture = null;
};

RangeChangeObserver.prototype.cancel = function () {
    var observers = this.observers;
    var index = observers.indexOf(this);
    // Unfortunately, if this observer was reused, this would not be sufficient
    // to detect a duplicate cancel. Do not cancel more than once.
    if (index < 0) {
        throw new Error(
            "Can't cancel observer for " +
            JSON.stringify(this.name) + " range changes" +
            " because it has already been canceled"
        );
    }
    var childObserver = this.childObserver;
    observers.splice(index, 1);
    this.init();
    // If this observer is canceled while dispatching a change
    // notification for the same property...
    // 1. We cannot put the handler record onto the free list because
    // it may have been captured in the array of records to which
    // the change notification would be sent. We must mark it as
    // canceled by nulling out the handler property so the dispatcher
    // passes over it.
    // 2. We also cannot put the handler record onto the free list
    // until all change dispatches have been completed because it could
    // conceivably be reused, confusing the current dispatcher.
    if (dispatching) {
        // All handlers added to this list will be moved over to the
        // actual free list when there are no longer any property
        // change dispatchers on the stack.
        observerToFreeList.push(this);
    } else {
        observerFreeList.push(this);
    }
    if (childObserver) {
        // Calling user code on our stack.
        // Done in tail position to avoid a plan interference hazard.
        childObserver.cancel();
    }
};

RangeChangeObserver.prototype.dispatch = function (plus, minus, index) {
    var handler = this.handler;
    // A null handler implies that an observer was canceled during the dispatch
    // of a change. The observer is pending addition to the free list.
    if (!handler) {
        return;
    }

    var childObserver = this.childObserver;
    this.childObserver = null;
    // XXX plan interference hazards calling cancel and handler methods:
    if (childObserver) {
        childObserver.cancel();
    }

    var handlerMethodName = this.handlerMethodName;
    if (handlerMethodName && typeof handler[handlerMethodName] === "function") {
        childObserver = handler[handlerMethodName](plus, minus, index, this.object);
    } else if (handler.call) {
        childObserver = handler.call(void 0, plus, minus, index, this.object);
    } else {
        throw new Error(
            "Can't dispatch range change to " + handler
        );
    }

    this.childObserver = childObserver;

    return this;
};

var Oa = require("./observable-array");

}],["pop-swap.js","pop-swap","pop-swap.js",{"./swap":69},function (require, exports, module, __filename, __dirname){

// pop-swap/pop-swap.js
// --------------------

"use strict";

var swap = require("./swap");

module.exports = polymorphicSwap;
function polymorphicSwap(array, start, minusLength, plus) {
    if (typeof array.swap === "function") {
        array.swap(start, minusLength, plus);
    } else {
        swap(array, start, minusLength, plus);
    }
}


}],["swap.js","pop-swap","swap.js",{},function (require, exports, module, __filename, __dirname){

// pop-swap/swap.js
// ----------------

"use strict";

// Copyright (C) 2014 Montage Studio
// https://github.com/montagejs/collections/blob/7c674d49c04955f01bbd2839f90936e15aceea2f/operators/swap.js

var array_slice = Array.prototype.slice;

module.exports = swap;
function swap(array, start, minusLength, plus) {
    // Unrolled implementation into JavaScript for a couple reasons.
    // Calling splice can cause large stack sizes for large swaps. Also,
    // splice cannot handle array holes.
    if (plus) {
        if (!Array.isArray(plus)) {
            plus = array_slice.call(plus);
        }
    } else {
        plus = Array.empty;
    }

    if (start < 0) {
        start = array.length + start;
    } else if (start > array.length) {
        array.length = start;
    }

    if (start + minusLength > array.length) {
        // Truncate minus length if it extends beyond the length
        minusLength = array.length - start;
    } else if (minusLength < 0) {
        // It is the JavaScript way.
        minusLength = 0;
    }

    var diff = plus.length - minusLength;
    var oldLength = array.length;
    var newLength = array.length + diff;

    if (diff > 0) {
        // Head Tail Plus Minus
        // H H H H M M T T T T
        // H H H H P P P P T T T T
        //         ^ start
        //         ^-^ minus.length
        //           ^ --> diff
        //         ^-----^ plus.length
        //             ^------^ tail before
        //                 ^------^ tail after
        //                   ^ start iteration
        //                       ^ start iteration offset
        //             ^ end iteration
        //                 ^ end iteration offset
        //             ^ start + minus.length
        //                     ^ length
        //                   ^ length - 1
        for (var index = oldLength - 1; index >= start + minusLength; index--) {
            var offset = index + diff;
            if (index in array) {
                array[offset] = array[index];
            } else {
                // Oddly, PhantomJS complains about deleting array
                // properties, unless you assign undefined first.
                array[offset] = void 0;
                delete array[offset];
            }
        }
    }
    for (var index = 0; index < plus.length; index++) {
        if (index in plus) {
            array[start + index] = plus[index];
        } else {
            array[start + index] = void 0;
            delete array[start + index];
        }
    }
    if (diff < 0) {
        // Head Tail Plus Minus
        // H H H H M M M M T T T T
        // H H H H P P T T T T
        //         ^ start
        //         ^-----^ length
        //         ^-^ plus.length
        //             ^ start iteration
        //                 ^ offset start iteration
        //                     ^ end
        //                         ^ offset end
        //             ^ start + minus.length - plus.length
        //             ^ start - diff
        //                 ^------^ tail before
        //             ^------^ tail after
        //                     ^ length - diff
        //                     ^ newLength
        for (var index = start + plus.length; index < oldLength - diff; index++) {
            var offset = index - diff;
            if (offset in array) {
                array[index] = array[offset];
            } else {
                array[index] = void 0;
                delete array[index];
            }
        }
    }
    array.length = newLength;
}


}],["pop-unzip.js","pop-zip","pop-unzip.js",{"./unzip":71},function (require, exports, module, __filename, __dirname){

// pop-zip/pop-unzip.js
// --------------------

'use strict';

var unzip = require('./unzip');

// Polymorphic unzip uses collection.toArray() (for non-array collection
// implementations) to convert the table or any of its rows into array before
// passing them along to the non-polymorphic unzip.

module.exports = popUnzip;
function popUnzip(table) {
    if (typeof table.unzip === 'function') {
        return table.unzip();
    }
    // Ensure that the table we pass to the non-polymorphic unzip is an array
    // of arrays.
    // However, only construct a new table if necessary.
    var arrayTable;
    if (!Array.isArray(table)) {
        table = arrayTable = table.toArray();
    }
    for (var index = 0, length = table.length; index < length; index++) {
        var row = table[index];
        if (!Array.isArray(row)) {
            // Construct a copy of the table in which to replace non-array
            // values.
            if (!arrayTable) {
                // Table is known to be an array because we would have replaced
                // it already otherwise.
                arrayTable = table.slice();
            }
            arrayTable[index] = row.toArray();
        }
    }
    return unzip(arrayTable || table);
}

}],["unzip.js","pop-zip","unzip.js",{},function (require, exports, module, __filename, __dirname){

// pop-zip/unzip.js
// ----------------

'use strict';

// Unzip is also known as a matrix transpose, operating exclusively on arrays.

module.exports = unzip;
function unzip(table) {
    var transpose = [];
    var rows = table.length;
    var row, columns, length;
    var index, jndex;

    // Mathematically, the degenerate case is an empty array where each inner
    // value would be of infinite length.
    if (!rows) {
        // Within this array, the nothingness is infinite.
        return [];
    }

    columns = table[0].length;
    length = Infinity;

    // Find the shortest row, this will be the length of the transpose.
    for (index = 0; index < rows; index++) {
        row = table[index];
        if (row.length < length) {
            length = row.length;
        }
    }

    // Populate the transpose.
    for (index = 0; index < length; index++) {
        row = transpose[index] = [];
        for (jndex = 0; jndex < rows; jndex++) {
            row[jndex] = table[jndex][index];
        }
    }

    return transpose;
}

}],["index.js","raf","index.js",{"performance-now":51},function (require, exports, module, __filename, __dirname){

// raf/index.js
// ------------

var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

}],["weak-map.js","weak-map","weak-map.js",{},function (require, exports, module, __filename, __dirname){

// weak-map/weak-map.js
// --------------------

// Copyright (C) 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Install a leaky WeakMap emulation on platforms that
 * don't provide a built-in one.
 *
 * <p>Assumes that an ES5 platform where, if {@code WeakMap} is
 * already present, then it conforms to the anticipated ES6
 * specification. To run this file on an ES5 or almost ES5
 * implementation where the {@code WeakMap} specification does not
 * quite conform, run <code>repairES5.js</code> first.
 *
 * <p>Even though WeakMapModule is not global, the linter thinks it
 * is, which is why it is in the overrides list below.
 *
 * <p>NOTE: Before using this WeakMap emulation in a non-SES
 * environment, see the note below about hiddenRecord.
 *
 * @author Mark S. Miller
 * @requires crypto, ArrayBuffer, Uint8Array, navigator, console
 * @overrides WeakMap, ses, Proxy
 * @overrides WeakMapModule
 */

/**
 * This {@code WeakMap} emulation is observably equivalent to the
 * ES-Harmony WeakMap, but with leakier garbage collection properties.
 *
 * <p>As with true WeakMaps, in this emulation, a key does not
 * retain maps indexed by that key and (crucially) a map does not
 * retain the keys it indexes. A map by itself also does not retain
 * the values associated with that map.
 *
 * <p>However, the values associated with a key in some map are
 * retained so long as that key is retained and those associations are
 * not overridden. For example, when used to support membranes, all
 * values exported from a given membrane will live for the lifetime
 * they would have had in the absence of an interposed membrane. Even
 * when the membrane is revoked, all objects that would have been
 * reachable in the absence of revocation will still be reachable, as
 * far as the GC can tell, even though they will no longer be relevant
 * to ongoing computation.
 *
 * <p>The API implemented here is approximately the API as implemented
 * in FF6.0a1 and agreed to by MarkM, Andreas Gal, and Dave Herman,
 * rather than the offially approved proposal page. TODO(erights):
 * upgrade the ecmascript WeakMap proposal page to explain this API
 * change and present to EcmaScript committee for their approval.
 *
 * <p>The first difference between the emulation here and that in
 * FF6.0a1 is the presence of non enumerable {@code get___, has___,
 * set___, and delete___} methods on WeakMap instances to represent
 * what would be the hidden internal properties of a primitive
 * implementation. Whereas the FF6.0a1 WeakMap.prototype methods
 * require their {@code this} to be a genuine WeakMap instance (i.e.,
 * an object of {@code [[Class]]} "WeakMap}), since there is nothing
 * unforgeable about the pseudo-internal method names used here,
 * nothing prevents these emulated prototype methods from being
 * applied to non-WeakMaps with pseudo-internal methods of the same
 * names.
 *
 * <p>Another difference is that our emulated {@code
 * WeakMap.prototype} is not itself a WeakMap. A problem with the
 * current FF6.0a1 API is that WeakMap.prototype is itself a WeakMap
 * providing ambient mutability and an ambient communications
 * channel. Thus, if a WeakMap is already present and has this
 * problem, repairES5.js wraps it in a safe wrappper in order to
 * prevent access to this channel. (See
 * PATCH_MUTABLE_FROZEN_WEAKMAP_PROTO in repairES5.js).
 */

/**
 * If this is a full <a href=
 * "http://code.google.com/p/es-lab/wiki/SecureableES5"
 * >secureable ES5</a> platform and the ES-Harmony {@code WeakMap} is
 * absent, install an approximate emulation.
 *
 * <p>If WeakMap is present but cannot store some objects, use our approximate
 * emulation as a wrapper.
 *
 * <p>If this is almost a secureable ES5 platform, then WeakMap.js
 * should be run after repairES5.js.
 *
 * <p>See {@code WeakMap} for documentation of the garbage collection
 * properties of this WeakMap emulation.
 */
(function WeakMapModule() {
  "use strict";

  if (typeof ses !== 'undefined' && ses.ok && !ses.ok()) {
    // already too broken, so give up
    return;
  }

  /**
   * In some cases (current Firefox), we must make a choice betweeen a
   * WeakMap which is capable of using all varieties of host objects as
   * keys and one which is capable of safely using proxies as keys. See
   * comments below about HostWeakMap and DoubleWeakMap for details.
   *
   * This function (which is a global, not exposed to guests) marks a
   * WeakMap as permitted to do what is necessary to index all host
   * objects, at the cost of making it unsafe for proxies.
   *
   * Do not apply this function to anything which is not a genuine
   * fresh WeakMap.
   */
  function weakMapPermitHostObjects(map) {
    // identity of function used as a secret -- good enough and cheap
    if (map.permitHostObjects___) {
      map.permitHostObjects___(weakMapPermitHostObjects);
    }
  }
  if (typeof ses !== 'undefined') {
    ses.weakMapPermitHostObjects = weakMapPermitHostObjects;
  }

  // IE 11 has no Proxy but has a broken WeakMap such that we need to patch
  // it using DoubleWeakMap; this flag tells DoubleWeakMap so.
  var doubleWeakMapCheckSilentFailure = false;

  // Check if there is already a good-enough WeakMap implementation, and if so
  // exit without replacing it.
  if (typeof WeakMap === 'function') {
    var HostWeakMap = WeakMap;
    // There is a WeakMap -- is it good enough?
    if (typeof navigator !== 'undefined' &&
        /Firefox/.test(navigator.userAgent)) {
      // We're now *assuming not*, because as of this writing (2013-05-06)
      // Firefox's WeakMaps have a miscellany of objects they won't accept, and
      // we don't want to make an exhaustive list, and testing for just one
      // will be a problem if that one is fixed alone (as they did for Event).

      // If there is a platform that we *can* reliably test on, here's how to
      // do it:
      //  var problematic = ... ;
      //  var testHostMap = new HostWeakMap();
      //  try {
      //    testHostMap.set(problematic, 1);  // Firefox 20 will throw here
      //    if (testHostMap.get(problematic) === 1) {
      //      return;
      //    }
      //  } catch (e) {}

    } else {
      // IE 11 bug: WeakMaps silently fail to store frozen objects.
      var testMap = new HostWeakMap();
      var testObject = Object.freeze({});
      testMap.set(testObject, 1);
      if (testMap.get(testObject) !== 1) {
        doubleWeakMapCheckSilentFailure = true;
        // Fall through to installing our WeakMap.
      } else {
        module.exports = WeakMap;
        return;
      }
    }
  }

  var hop = Object.prototype.hasOwnProperty;
  var gopn = Object.getOwnPropertyNames;
  var defProp = Object.defineProperty;
  var isExtensible = Object.isExtensible;

  /**
   * Security depends on HIDDEN_NAME being both <i>unguessable</i> and
   * <i>undiscoverable</i> by untrusted code.
   *
   * <p>Given the known weaknesses of Math.random() on existing
   * browsers, it does not generate unguessability we can be confident
   * of.
   *
   * <p>It is the monkey patching logic in this file that is intended
   * to ensure undiscoverability. The basic idea is that there are
   * three fundamental means of discovering properties of an object:
   * The for/in loop, Object.keys(), and Object.getOwnPropertyNames(),
   * as well as some proposed ES6 extensions that appear on our
   * whitelist. The first two only discover enumerable properties, and
   * we only use HIDDEN_NAME to name a non-enumerable property, so the
   * only remaining threat should be getOwnPropertyNames and some
   * proposed ES6 extensions that appear on our whitelist. We monkey
   * patch them to remove HIDDEN_NAME from the list of properties they
   * returns.
   *
   * <p>TODO(erights): On a platform with built-in Proxies, proxies
   * could be used to trap and thereby discover the HIDDEN_NAME, so we
   * need to monkey patch Proxy.create, Proxy.createFunction, etc, in
   * order to wrap the provided handler with the real handler which
   * filters out all traps using HIDDEN_NAME.
   *
   * <p>TODO(erights): Revisit Mike Stay's suggestion that we use an
   * encapsulated function at a not-necessarily-secret name, which
   * uses the Stiegler shared-state rights amplification pattern to
   * reveal the associated value only to the WeakMap in which this key
   * is associated with that value. Since only the key retains the
   * function, the function can also remember the key without causing
   * leakage of the key, so this doesn't violate our general gc
   * goals. In addition, because the name need not be a guarded
   * secret, we could efficiently handle cross-frame frozen keys.
   */
  var HIDDEN_NAME_PREFIX = 'weakmap:';
  var HIDDEN_NAME = HIDDEN_NAME_PREFIX + 'ident:' + Math.random() + '___';

  if (typeof crypto !== 'undefined' &&
      typeof crypto.getRandomValues === 'function' &&
      typeof ArrayBuffer === 'function' &&
      typeof Uint8Array === 'function') {
    var ab = new ArrayBuffer(25);
    var u8s = new Uint8Array(ab);
    crypto.getRandomValues(u8s);
    HIDDEN_NAME = HIDDEN_NAME_PREFIX + 'rand:' +
      Array.prototype.map.call(u8s, function(u8) {
        return (u8 % 36).toString(36);
      }).join('') + '___';
  }

  function isNotHiddenName(name) {
    return !(
        name.substr(0, HIDDEN_NAME_PREFIX.length) == HIDDEN_NAME_PREFIX &&
        name.substr(name.length - 3) === '___');
  }

  /**
   * Monkey patch getOwnPropertyNames to avoid revealing the
   * HIDDEN_NAME.
   *
   * <p>The ES5.1 spec requires each name to appear only once, but as
   * of this writing, this requirement is controversial for ES6, so we
   * made this code robust against this case. If the resulting extra
   * search turns out to be expensive, we can probably relax this once
   * ES6 is adequately supported on all major browsers, iff no browser
   * versions we support at that time have relaxed this constraint
   * without providing built-in ES6 WeakMaps.
   */
  defProp(Object, 'getOwnPropertyNames', {
    value: function fakeGetOwnPropertyNames(obj) {
      return gopn(obj).filter(isNotHiddenName);
    }
  });

  /**
   * getPropertyNames is not in ES5 but it is proposed for ES6 and
   * does appear in our whitelist, so we need to clean it too.
   */
  if ('getPropertyNames' in Object) {
    var originalGetPropertyNames = Object.getPropertyNames;
    defProp(Object, 'getPropertyNames', {
      value: function fakeGetPropertyNames(obj) {
        return originalGetPropertyNames(obj).filter(isNotHiddenName);
      }
    });
  }

  /**
   * <p>To treat objects as identity-keys with reasonable efficiency
   * on ES5 by itself (i.e., without any object-keyed collections), we
   * need to add a hidden property to such key objects when we
   * can. This raises several issues:
   * <ul>
   * <li>Arranging to add this property to objects before we lose the
   *     chance, and
   * <li>Hiding the existence of this new property from most
   *     JavaScript code.
   * <li>Preventing <i>certification theft</i>, where one object is
   *     created falsely claiming to be the key of an association
   *     actually keyed by another object.
   * <li>Preventing <i>value theft</i>, where untrusted code with
   *     access to a key object but not a weak map nevertheless
   *     obtains access to the value associated with that key in that
   *     weak map.
   * </ul>
   * We do so by
   * <ul>
   * <li>Making the name of the hidden property unguessable, so "[]"
   *     indexing, which we cannot intercept, cannot be used to access
   *     a property without knowing the name.
   * <li>Making the hidden property non-enumerable, so we need not
   *     worry about for-in loops or {@code Object.keys},
   * <li>monkey patching those reflective methods that would
   *     prevent extensions, to add this hidden property first,
   * <li>monkey patching those methods that would reveal this
   *     hidden property.
   * </ul>
   * Unfortunately, because of same-origin iframes, we cannot reliably
   * add this hidden property before an object becomes
   * non-extensible. Instead, if we encounter a non-extensible object
   * without a hidden record that we can detect (whether or not it has
   * a hidden record stored under a name secret to us), then we just
   * use the key object itself to represent its identity in a brute
   * force leaky map stored in the weak map, losing all the advantages
   * of weakness for these.
   */
  function getHiddenRecord(key) {
    if (key !== Object(key)) {
      throw new TypeError('Not an object: ' + key);
    }
    var hiddenRecord = key[HIDDEN_NAME];
    if (hiddenRecord && hiddenRecord.key === key) { return hiddenRecord; }
    if (!isExtensible(key)) {
      // Weak map must brute force, as explained in doc-comment above.
      return void 0;
    }

    // The hiddenRecord and the key point directly at each other, via
    // the "key" and HIDDEN_NAME properties respectively. The key
    // field is for quickly verifying that this hidden record is an
    // own property, not a hidden record from up the prototype chain.
    //
    // NOTE: Because this WeakMap emulation is meant only for systems like
    // SES where Object.prototype is frozen without any numeric
    // properties, it is ok to use an object literal for the hiddenRecord.
    // This has two advantages:
    // * It is much faster in a performance critical place
    // * It avoids relying on Object.create(null), which had been
    //   problematic on Chrome 28.0.1480.0. See
    //   https://code.google.com/p/google-caja/issues/detail?id=1687
    hiddenRecord = { key: key };

    // When using this WeakMap emulation on platforms where
    // Object.prototype might not be frozen and Object.create(null) is
    // reliable, use the following two commented out lines instead.
    // hiddenRecord = Object.create(null);
    // hiddenRecord.key = key;

    // Please contact us if you need this to work on platforms where
    // Object.prototype might not be frozen and
    // Object.create(null) might not be reliable.

    try {
      defProp(key, HIDDEN_NAME, {
        value: hiddenRecord,
        writable: false,
        enumerable: false,
        configurable: false
      });
      return hiddenRecord;
    } catch (error) {
      // Under some circumstances, isExtensible seems to misreport whether
      // the HIDDEN_NAME can be defined.
      // The circumstances have not been isolated, but at least affect
      // Node.js v0.10.26 on TravisCI / Linux, but not the same version of
      // Node.js on OS X.
      return void 0;
    }
  }

  /**
   * Monkey patch operations that would make their argument
   * non-extensible.
   *
   * <p>The monkey patched versions throw a TypeError if their
   * argument is not an object, so it should only be done to functions
   * that should throw a TypeError anyway if their argument is not an
   * object.
   */
  (function(){
    var oldFreeze = Object.freeze;
    defProp(Object, 'freeze', {
      value: function identifyingFreeze(obj) {
        getHiddenRecord(obj);
        return oldFreeze(obj);
      }
    });
    var oldSeal = Object.seal;
    defProp(Object, 'seal', {
      value: function identifyingSeal(obj) {
        getHiddenRecord(obj);
        return oldSeal(obj);
      }
    });
    var oldPreventExtensions = Object.preventExtensions;
    defProp(Object, 'preventExtensions', {
      value: function identifyingPreventExtensions(obj) {
        getHiddenRecord(obj);
        return oldPreventExtensions(obj);
      }
    });
  })();

  function constFunc(func) {
    func.prototype = null;
    return Object.freeze(func);
  }

  var calledAsFunctionWarningDone = false;
  function calledAsFunctionWarning() {
    // Future ES6 WeakMap is currently (2013-09-10) expected to reject WeakMap()
    // but we used to permit it and do it ourselves, so warn only.
    if (!calledAsFunctionWarningDone && typeof console !== 'undefined') {
      calledAsFunctionWarningDone = true;
      console.warn('WeakMap should be invoked as new WeakMap(), not ' +
          'WeakMap(). This will be an error in the future.');
    }
  }

  var nextId = 0;

  var OurWeakMap = function() {
    if (!(this instanceof OurWeakMap)) {  // approximate test for new ...()
      calledAsFunctionWarning();
    }

    // We are currently (12/25/2012) never encountering any prematurely
    // non-extensible keys.
    var keys = []; // brute force for prematurely non-extensible keys.
    var values = []; // brute force for corresponding values.
    var id = nextId++;

    function get___(key, opt_default) {
      var index;
      var hiddenRecord = getHiddenRecord(key);
      if (hiddenRecord) {
        return id in hiddenRecord ? hiddenRecord[id] : opt_default;
      } else {
        index = keys.indexOf(key);
        return index >= 0 ? values[index] : opt_default;
      }
    }

    function has___(key) {
      var hiddenRecord = getHiddenRecord(key);
      if (hiddenRecord) {
        return id in hiddenRecord;
      } else {
        return keys.indexOf(key) >= 0;
      }
    }

    function set___(key, value) {
      var index;
      var hiddenRecord = getHiddenRecord(key);
      if (hiddenRecord) {
        hiddenRecord[id] = value;
      } else {
        index = keys.indexOf(key);
        if (index >= 0) {
          values[index] = value;
        } else {
          // Since some browsers preemptively terminate slow turns but
          // then continue computing with presumably corrupted heap
          // state, we here defensively get keys.length first and then
          // use it to update both the values and keys arrays, keeping
          // them in sync.
          index = keys.length;
          values[index] = value;
          // If we crash here, values will be one longer than keys.
          keys[index] = key;
        }
      }
      return this;
    }

    function delete___(key) {
      var hiddenRecord = getHiddenRecord(key);
      var index, lastIndex;
      if (hiddenRecord) {
        return id in hiddenRecord && delete hiddenRecord[id];
      } else {
        index = keys.indexOf(key);
        if (index < 0) {
          return false;
        }
        // Since some browsers preemptively terminate slow turns but
        // then continue computing with potentially corrupted heap
        // state, we here defensively get keys.length first and then use
        // it to update both the keys and the values array, keeping
        // them in sync. We update the two with an order of assignments,
        // such that any prefix of these assignments will preserve the
        // key/value correspondence, either before or after the delete.
        // Note that this needs to work correctly when index === lastIndex.
        lastIndex = keys.length - 1;
        keys[index] = void 0;
        // If we crash here, there's a void 0 in the keys array, but
        // no operation will cause a "keys.indexOf(void 0)", since
        // getHiddenRecord(void 0) will always throw an error first.
        values[index] = values[lastIndex];
        // If we crash here, values[index] cannot be found here,
        // because keys[index] is void 0.
        keys[index] = keys[lastIndex];
        // If index === lastIndex and we crash here, then keys[index]
        // is still void 0, since the aliasing killed the previous key.
        keys.length = lastIndex;
        // If we crash here, keys will be one shorter than values.
        values.length = lastIndex;
        return true;
      }
    }

    return Object.create(OurWeakMap.prototype, {
      get___:    { value: constFunc(get___) },
      has___:    { value: constFunc(has___) },
      set___:    { value: constFunc(set___) },
      delete___: { value: constFunc(delete___) }
    });
  };

  OurWeakMap.prototype = Object.create(Object.prototype, {
    get: {
      /**
       * Return the value most recently associated with key, or
       * opt_default if none.
       */
      value: function get(key, opt_default) {
        return this.get___(key, opt_default);
      },
      writable: true,
      configurable: true
    },

    has: {
      /**
       * Is there a value associated with key in this WeakMap?
       */
      value: function has(key) {
        return this.has___(key);
      },
      writable: true,
      configurable: true
    },

    set: {
      /**
       * Associate value with key in this WeakMap, overwriting any
       * previous association if present.
       */
      value: function set(key, value) {
        return this.set___(key, value);
      },
      writable: true,
      configurable: true
    },

    'delete': {
      /**
       * Remove any association for key in this WeakMap, returning
       * whether there was one.
       *
       * <p>Note that the boolean return here does not work like the
       * {@code delete} operator. The {@code delete} operator returns
       * whether the deletion succeeds at bringing about a state in
       * which the deleted property is absent. The {@code delete}
       * operator therefore returns true if the property was already
       * absent, whereas this {@code delete} method returns false if
       * the association was already absent.
       */
      value: function remove(key) {
        return this.delete___(key);
      },
      writable: true,
      configurable: true
    }
  });

  if (typeof HostWeakMap === 'function') {
    (function() {
      // If we got here, then the platform has a WeakMap but we are concerned
      // that it may refuse to store some key types. Therefore, make a map
      // implementation which makes use of both as possible.

      // In this mode we are always using double maps, so we are not proxy-safe.
      // This combination does not occur in any known browser, but we had best
      // be safe.
      if (doubleWeakMapCheckSilentFailure && typeof Proxy !== 'undefined') {
        Proxy = undefined;
      }

      function DoubleWeakMap() {
        if (!(this instanceof OurWeakMap)) {  // approximate test for new ...()
          calledAsFunctionWarning();
        }

        // Preferable, truly weak map.
        var hmap = new HostWeakMap();

        // Our hidden-property-based pseudo-weak-map. Lazily initialized in the
        // 'set' implementation; thus we can avoid performing extra lookups if
        // we know all entries actually stored are entered in 'hmap'.
        var omap = undefined;

        // Hidden-property maps are not compatible with proxies because proxies
        // can observe the hidden name and either accidentally expose it or fail
        // to allow the hidden property to be set. Therefore, we do not allow
        // arbitrary WeakMaps to switch to using hidden properties, but only
        // those which need the ability, and unprivileged code is not allowed
        // to set the flag.
        //
        // (Except in doubleWeakMapCheckSilentFailure mode in which case we
        // disable proxies.)
        var enableSwitching = false;

        function dget(key, opt_default) {
          if (omap) {
            return hmap.has(key) ? hmap.get(key)
                : omap.get___(key, opt_default);
          } else {
            return hmap.get(key, opt_default);
          }
        }

        function dhas(key) {
          return hmap.has(key) || (omap ? omap.has___(key) : false);
        }

        var dset;
        if (doubleWeakMapCheckSilentFailure) {
          dset = function(key, value) {
            hmap.set(key, value);
            if (!hmap.has(key)) {
              if (!omap) { omap = new OurWeakMap(); }
              omap.set(key, value);
            }
            return this;
          };
        } else {
          dset = function(key, value) {
            if (enableSwitching) {
              try {
                hmap.set(key, value);
              } catch (e) {
                if (!omap) { omap = new OurWeakMap(); }
                omap.set___(key, value);
              }
            } else {
              hmap.set(key, value);
            }
            return this;
          };
        }

        function ddelete(key) {
          var result = !!hmap['delete'](key);
          if (omap) { return omap.delete___(key) || result; }
          return result;
        }

        return Object.create(OurWeakMap.prototype, {
          get___:    { value: constFunc(dget) },
          has___:    { value: constFunc(dhas) },
          set___:    { value: constFunc(dset) },
          delete___: { value: constFunc(ddelete) },
          permitHostObjects___: { value: constFunc(function(token) {
            if (token === weakMapPermitHostObjects) {
              enableSwitching = true;
            } else {
              throw new Error('bogus call to permitHostObjects___');
            }
          })}
        });
      }
      DoubleWeakMap.prototype = OurWeakMap.prototype;
      module.exports = DoubleWeakMap;

      // define .constructor to hide OurWeakMap ctor
      Object.defineProperty(WeakMap.prototype, 'constructor', {
        value: WeakMap,
        enumerable: false,  // as default .constructor is
        configurable: true,
        writable: true
      });
    })();
  } else {
    // There is no host WeakMap, so we must use the emulation.

    // Emulated WeakMaps are incompatible with native proxies (because proxies
    // can observe the hidden name), so we must disable Proxy usage (in
    // ArrayLike and Domado, currently).
    if (typeof Proxy !== 'undefined') {
      Proxy = undefined;
    }

    module.exports = OurWeakMap;
  }
})();

}],["dom.js","wizdom","dom.js",{},function (require, exports, module, __filename, __dirname){

// wizdom/dom.js
// -------------

"use strict";

module.exports = Document;
function Document(namespace) {
    this.doctype = null;
    this.documentElement = null;
    this.namespaceURI = namespace || "";
}

Document.prototype.nodeType = 9;
Document.prototype.Node = Node;
Document.prototype.Element = Element;
Document.prototype.TextNode = TextNode;
Document.prototype.Comment = Comment;
Document.prototype.Attr = Attr;
Document.prototype.NamedNodeMap = NamedNodeMap;

Document.prototype.createTextNode = function (text) {
    return new this.TextNode(this, text);
};

Document.prototype.createComment = function (text) {
    return new this.Comment(this, text);
};

Document.prototype.createElement = function (type, namespace) {
    return new this.Element(this, type, namespace || this.namespaceURI);
};

Document.prototype.createElementNS = function (namespace, type) {
    return new this.Element(this, type, namespace || this.namespaceURI);
};

Document.prototype.createAttribute = function (name, namespace) {
    return new this.Attr(this, name, namespace || this.namespaceURI);
};

Document.prototype.createAttributeNS = function (namespace, name) {
    return new this.Attr(this, name, namespace || this.namespaceURI);
};

function Node(document) {
    this.ownerDocument = document;
    this.parentNode = null;
    this.firstChild = null;
    this.lastChild = null;
    this.previousSibling = null;
    this.nextSibling = null;
}

Node.prototype.appendChild = function appendChild(childNode) {
    return this.insertBefore(childNode, null);
};

Node.prototype.insertBefore = function insertBefore(childNode, nextSibling) {
    if (!childNode) {
        throw new Error("Can't insert null child");
    }
    if (childNode.ownerDocument !== this.ownerDocument) {
        throw new Error("Can't insert child from foreign document");
    }
    if (childNode.parentNode) {
        childNode.parentNode.removeChild(childNode);
    }
    var previousSibling;
    if (nextSibling) {
        previousSibling = nextSibling.previousSibling;
    } else {
        previousSibling = this.lastChild;
    }
    if (previousSibling) {
        previousSibling.nextSibling = childNode;
    }
    if (nextSibling) {
        nextSibling.previousSibling = childNode;
    }
    childNode.nextSibling = nextSibling;
    childNode.previousSibling = previousSibling;
    childNode.parentNode = this;
    if (!nextSibling) {
        this.lastChild = childNode;
    }
    if (!previousSibling) {
        this.firstChild = childNode;
    }
};

Node.prototype.removeChild = function removeChild(childNode) {
    if (!childNode) {
        throw new Error("Can't remove null child");
    }
    var parentNode = childNode.parentNode;
    if (parentNode !== this) {
        throw new Error("Can't remove node that is not a child of parent");
    }
    if (childNode === parentNode.firstChild) {
        parentNode.firstChild = childNode.nextSibling;
    }
    if (childNode === parentNode.lastChild) {
        parentNode.lastChild = childNode.previousSibling;
    }
    if (childNode.previousSibling) {
        childNode.previousSibling.nextSibling = childNode.nextSibling;
    }
    if (childNode.nextSibling) {
        childNode.nextSibling.previousSibling = childNode.previousSibling;
    }
    childNode.previousSibling = null;
    childNode.parentNode = null;
    childNode.nextSibling = null;
    return childNode;
};

function TextNode(document, text) {
    Node.call(this, document);
    this.data = text;
}

TextNode.prototype = Object.create(Node.prototype);
TextNode.prototype.constructor = TextNode;
TextNode.prototype.nodeType = 3;

function Comment(document, text) {
    Node.call(this, document);
    this.data = text;
}

Comment.prototype = Object.create(Node.prototype);
Comment.prototype.constructor = Comment;
Comment.prototype.nodeType = 8;

function Element(document, type, namespace) {
    Node.call(this, document);
    this.tagName = type;
    this.namespaceURI = namespace;
    this.attributes = new this.ownerDocument.NamedNodeMap();
}

Element.prototype = Object.create(Node.prototype);
Element.prototype.constructor = Element;
Element.prototype.nodeType = 1;

Element.prototype.hasAttribute = function (name, namespace) {
    var attr = this.attributes.getNamedItem(name, namespace);
    return !!attr;
};

Element.prototype.getAttribute = function (name, namespace) {
    var attr = this.attributes.getNamedItem(name, namespace);
    return attr ? attr.value : null;
};

Element.prototype.setAttribute = function (name, value, namespace) {
    var attr = this.ownerDocument.createAttribute(name, namespace);
    attr.value = value;
    this.attributes.setNamedItem(attr, namespace);
};

Element.prototype.removeAttribute = function (name, namespace) {
    this.attributes.removeNamedItem(name, namespace);
};

Element.prototype.hasAttributeNS = function (namespace, name) {
    return this.hasAttribute(name, namespace);
};

Element.prototype.getAttributeNS = function (namespace, name) {
    return this.getAttribute(name, namespace);
};

Element.prototype.setAttributeNS = function (namespace, name, value) {
    this.setAttribute(name, value, namespace);
};

Element.prototype.removeAttributeNS = function (namespace, name) {
    this.removeAttribute(name, namespace);
};

function Attr(ownerDocument, name, namespace) {
    this.ownerDocument = ownerDocument;
    this.name = name;
    this.value = null;
    this.namespaceURI = namespace;
}

Attr.prototype.nodeType = 2;

function NamedNodeMap() {
    this.length = 0;
}

NamedNodeMap.prototype.getNamedItem = function (name, namespace) {
    namespace = namespace || "";
    var key = encodeURIComponent(namespace) + ":" + encodeURIComponent(name);
    return this[key];
};

NamedNodeMap.prototype.setNamedItem = function (attr) {
    var namespace = attr.namespaceURI || "";
    var name = attr.name;
    var key = encodeURIComponent(namespace) + ":" + encodeURIComponent(name);
    var previousAttr = this[key];
    if (!previousAttr) {
        this[this.length] = attr;
        this.length++;
        previousAttr = null;
    }
    this[key] = attr;
    return previousAttr;
};

NamedNodeMap.prototype.removeNamedItem = function (name, namespace) {
    namespace = namespace || "";
    var key = encodeURIComponent(namespace) + ":" + encodeURIComponent(name);
    var attr = this[key];
    if (!attr) {
        throw new Error("Not found");
    }
    var index = Array.prototype.indexOf.call(this, attr);
    delete this[key];
    delete this[index];
    this.length--;
};

NamedNodeMap.prototype.item = function (index) {
    return this[index];
};

NamedNodeMap.prototype.getNamedItemNS = function (namespace, name) {
    return this.getNamedItem(name, namespace);
};

NamedNodeMap.prototype.setNamedItemNS = function (attr) {
    return this.setNamedItem(attr);
};

NamedNodeMap.prototype.removeNamedItemNS = function (namespace, name) {
    return this.removeNamedItem(name, namespace);
};

}]])("delf/essays/digger/index.js")
