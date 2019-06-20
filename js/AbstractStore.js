/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Pure virtual base class of store providers.
 *
 * Store providers provide a simple file system interface to text data in the
 * store.
 */
/* global AbstractStore: true */

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
 * Set credentials for this store
 * @param user username
 * @param pass password
 */
AbstractStore.prototype.setCredentials = function (user, pass) {
    throw new Error("Store has no setCredentials method");
};

/**
 * Promise to disconnect from this store. Virtual.
 * This method should clear all caches and log out from the store,
 * if appropriate.
 */
AbstractStore.prototype.disconnect = function () {
    return Promise.resolve();
};

/**
 * Return a Promise to write data. Pure virtual. Note that the store is
 * expected to create intermediate directory levels on the fly.
 * @param path pathname to store the data under, a / separated path string
 * @param data a string to store
 */
AbstractStore.prototype.write = function (path, data) {
    "use strict";

    return Promise.reject(new Error("Store has no write method"));
};

/**
 * Return a Promise to read data.
 * @param path pathname the data is stored under, a / separated path string
 * @param ok called on success with this=self, passed String
 * @param fail called on failure
 */
AbstractStore.prototype.read = function (path, ok, fail) {
    "use strict";

    return Promise.reject(new Error("Store has no read method"));
};
