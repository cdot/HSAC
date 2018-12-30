/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Pure virtual base class of store providers.
 *
 * Store providers provide a simple file system interface to data in the
 * store. Data is passed back and forth in ArrayBuffer.
 *
 * This module provides two store provider virtual base classes,
 * AbstractStore (which is the base class of all stores) and LayeredStore
 * (which is an AbstractStore in which an underlying "engine" store provides
 * the actual storage services)
 */

/**
 * @class
 */
function AbstractStore() {
    "use strict";
}

// Special error message, must be used when a store is otherwise OK but
// data being read is missing.
AbstractStore.NODATA = "not found";

/**
 * Promise to connect to this store using the given parameters.
 * Pure virtual.
 * @param params
 */
AbstractStore.prototype.connect = function (params) {
    return Promise.reject(new Error("Store has no connect method"));
};

/**
 * Promise to disconnect from this store. Virtual.
 * This method should clear all caches and log out from the store,
 * if appropriate.
 */
AbstractStore.prototype.connect = function () {
    return Promise.resolve();
};

/**
 * Return a Promise to write data. Pure virtual.
 * @param path pathname to store the data under, a / separated path string
 * @param data a string to store
 * @param ok called on success with this=self, no parameters
 * @param fail called on failure with this=self
 */
AbstractStore.prototype.write = function (path, data) {
    "use strict";

    return Promise.reject(new Error("Store has no write method"));
};

/**
 * Return a Promise tp read a string.
 * @param path pathname the data is stored under, a / separated path string
 * @param ok called on success with this=self, passed String
 * @param fail called on failure
 */
AbstractStore.prototype.read = function (path, ok, fail) {
    "use strict";

    return Promise.reject(new Error("Store has no read method"));
};