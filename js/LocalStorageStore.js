/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global AbstractStore */

if (typeof module !== "undefined")
    var AbstractStore = require("./AbstractStore");

/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore(params) {
    "use strict";

    AbstractStore.call(this, params);
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

/**
 * @implements AbstractStore
 */
LocalStorageStore.prototype.read = function (path) {
    "use strict";

    path = path.replace(/^\/+/, "");
    return new Promise((resolve, reject) => {
        console.debug("LocalStorageStore: Reading " + path);
        try {
            var str = localStorage.getItem(path);
            if (str === null) {
                reject(AbstractStore.NODATA);
            } else {
                resolve(str);
            }
        } catch (e) {
            reject(e);
        }
    });
};

/**
 * @implements AbstractStore
 */
LocalStorageStore.prototype.write = function (path, data) {
    "use strict";

    path = path.replace(/^\/+/, "");
    return new Promise((resolve, reject) => {
        console.debug("LocalStorageStore: Writing " + path);
        try {
            localStorage.setItem(path, data);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
};

if (typeof module !== "undefined")
    module.exports = LocalStorageStore;
