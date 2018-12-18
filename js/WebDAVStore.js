/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global AbstractStore:true */
/* global require */
/* global dav */
/* global module */

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

/** url, username and password */
WebDAVStore.prototype.connect = function (params) {
    "use strict";

    if (!params || !params.url)
        return Promise.reject(new Error(
            "No configuration defined, cannot start WebDAVStore"));

    if (params.url.lastIndexOf('/') !== params.url.length - 1)
        params.url += '/';
    var self = this;
    self.params = {
        url: params.url,
        userName: params.username,
        password: params.password
    };
    console.debug("WebDAVStore: connecting to", params.url);
    self.DAV = new dav.Client({
        baseUrl: self.params.url,
        userName: self.params.username,
        password: self.params.password
    });
    return Promise.resolve();
};

WebDAVStore.prototype.disconnect = function () {
    "use strict";

    this.params = {};
    this.DAV = null;
};

WebDAVStore.prototype.read = function (path) {
    "use strict";

    path = path.replace(/^\/+/, "");
    console.debug("WebDAVStore: Reading", path);
    return this.DAV.request('GET', path, {})
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
