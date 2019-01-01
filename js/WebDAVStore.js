/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global AbstractStore:true */
/* global require */
/* global dav */
/* global module */
/* global WebDAVStore: true */

/**
 * Store on a remote webdav server
 * Requires libs/davclient.js
 */
if (typeof module !== "undefined") {
    AbstractStore = require("./AbstractStore");
}

function WebDAVStore() {
    "use strict";

    AbstractStore.call(self);
}

WebDAVStore.prototype = Object.create(AbstractStore.prototype);

WebDAVStore.prototype.connect = function (params) {
    "use strict";

    if (!params || !params.url)
        return Promise.reject(new Error(
            "No configuration defined, cannot start WebDAVStore"));

    if (params.url.lastIndexOf('/') !== params.url.length - 1)
        params.url += '/';
    this.params = {
        url: params.url
    };
    console.debug("WebDAVStore: connecting to", params.url);
    this.DAV = new dav.Client({
        baseUrl: this.params.url
    });
    return Promise.resolve(this);
};

WebDAVStore.prototype.disconnect = function () {
    "use strict";

    this.params = {};
    this.DAV = null;
    return Promise.resolve();
};

WebDAVStore.prototype.read = function (path) {
    "use strict";

    path = path.replace(/^\/+/, "");
    console.debug("WebDAVStore: Reading", path);
    return this.DAV
        .request('GET', path, {
            "Cache-Control": "no-cache"
        })
        .then((res) => {
            if (200 <= res.status && res.status < 300)
                return Promise.resolve(res.body);
            return Promise.reject(res.status);
        });
};

/**
 * Return a Promise to make the folder given by a path array.
 */
WebDAVStore.prototype._mkpath = function (path) {
    "use strict";

    if (path.length === 0)
        return Promise.resolve(); // at the root, always exists

    var self = this;

    return this.DAV
        .request('PROPFIND', path.join('/'), {
            Depth: 1
        })
        .then(
            (res) => {
                if (200 <= res.status && res.status < 300) {
                    return Promise.resolve();
                } else if (res.status === 404) {
                    var p = path.slice();
                    p.pop();
                    return self._mkpath(p).then(() => {
                        return self.DAV.request('MKCOL', path.join('/'));
                    });
                }
                return Promise.reject(
                    new Error("_mkpath failed on " + path.join('.') +
                        ": " + res.status));
            });
};

WebDAVStore.prototype.write = function (path, data) {
    "use strict";

    var self = this;

    console.debug("WebDAVStore: Writing", path);

    path = path.replace(/^\/+/, "").split('/');
    var folder = path.slice();
    folder.pop();

    return self._mkpath(folder)
        .then(() => {
            return self.DAV.request('PUT', path.join('/'), {}, data)
                .then((res) => {
                    if (200 <= res.status && res.status < 300)
                        return Promise.resolve(res.body);
                    return Promise.reject(res.status);
                });
        })
};

if (typeof module !== "undefined")
    module.exports = WebDAVStore;