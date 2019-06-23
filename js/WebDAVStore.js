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
if (typeof AbstractStore === "undefined")
    AbstractStore = require("./AbstractStore");

function WebDAVStore() {
    "use strict";
    
    AbstractStore.call(self);
}

WebDAVStore.prototype = Object.create(AbstractStore.prototype);

WebDAVStore.prototype.setCredentials = function (user, pass) {
    this.user = user;
    this.pass = pass;
};

WebDAVStore.prototype._error = function(res) {
    if (typeof res.body === "string" && res.body.length > 0)
        return new Error(res.body.replace(/^.*<body>(.*)<\/body>.*$/i, "$1"));
    return new Error("WebDAV Error " + res.status);
};

WebDAVStore.prototype.connect = function (url) {
    "use strict";

    if (url && url.lastIndexOf('/') !== url.length - 1)
        url += '/';

    var getUrl = window.location;
    var baseUrl = getUrl.protocol + "//" + getUrl.host + "/"
        + getUrl.pathname.split('/')[1];
    console.debug("Base", baseUrl);
    if (typeof URL !== "undefined") {
        try {
            url = new URL(url, baseUrl);
        } catch (e) {
            console.debug("WebDAVStore.connect to " + url + " failed: " + e);
            return Promise.reject(new Error(
                "Invalid URL, cannot start WebDAVStore"));
        }
    }

    console.debug("WebDAVStore: connecting to " + url);
    var opts = {
        baseUrl: url
    };
    if (this.user) {
        opts.userName = this.user;
        opts.password = this.pass;
    }
    this.DAV = new dav.Client(opts);
    return this.read('/');
};

WebDAVStore.prototype.disconnect = function () {
    "use strict";

    this.DAV = null;
    return Promise.resolve();
};

WebDAVStore.prototype.read = function (path) {
    "use strict";
    
    const self = this;
    path = path.replace(/^\/+/, "");
    console.debug("WebDAVStore: Reading " + path);
    return this.DAV
        .request('GET', path, {
            "Cache-Control": "no-cache"
        })
        .then((res) => {
            if (200 <= res.status && res.status < 300)
                return Promise.resolve(res.body);
            return Promise.reject(self._error(res));
        });
};

/**
 * Return a Promise to make the folder given by a path array.
 */
WebDAVStore.prototype._mkpath = function (path) {
    "use strict";

    if (path.length === 0)
        return Promise.resolve(); // at the root, always exists

    const self = this;

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
                return Promise.reject(self._error(res));
            });
};

WebDAVStore.prototype.write = function (path, data) {
    "use strict";

    const self = this;

    console.debug("WebDAVStore: Writing " + path);

    path = path.replace(/^\/+/, "").split('/');
    var folder = path.slice();
    folder.pop();

    return self._mkpath(folder)
        .then(() => {
            return self.DAV.request('PUT', path.join('/'), {}, data)
                .then((res) => {
                    if (200 <= res.status && res.status < 300)
                        return Promise.resolve(res.body);
                    return Promise.reject(self._error(res));
                });
        })
};

if (typeof module !== "undefined")
    module.exports = WebDAVStore;
