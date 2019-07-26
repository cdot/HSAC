/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("app/js/WebDAVStore", ["app/js/AbstractStore", "app/js/DAVClient"], (AbstractStore, DAVClient) => {

    /**
     * Store on a remote webdav server
     */
    class WebDAVStore extends AbstractStore {

        constructor(debug) {
            super();
            this.debug = debug;
        }
        
        setCredentials(user, pass) {
            this.user = user;
            this.pass = pass;
        };

        _error(res) {
            if (typeof res.body === "string" && res.body.length > 0)
                return new Error(res.body.replace(/^.*<body>(.*)<\/body>.*$/i, "$1"));
            return new Error("WebDAV Error " + res.status);
        };

        connect(url) {

            if (url && url.lastIndexOf('/') !== url.length - 1)
                url += '/';

            var getUrl = window.location;
            var baseUrl = getUrl.protocol + "//" + getUrl.host + "/"
                + getUrl.pathname.split('/')[1];
            if (this.debug) this.debug("Base", baseUrl);
            if (typeof URL !== "undefined") {
                try {
                    url = new URL(url, baseUrl);
                } catch (e) {
                    if (this.debug)
                        this.debug("WebDAVStore.connect to " + url + " failed: " + e);
                    return Promise.reject(new Error(
                        "Invalid URL, cannot start WebDAVStore"));
                }
            }

            if (this.debug) this.debug("WebDAVStore: connecting to " + url);
            var opts = {
                baseUrl: url
            };
            if (this.user) {
                opts.userName = this.user;
                opts.password = this.pass;
            }
            this.DAV = new DAVClient(opts);
            return this.read('/');
        };

        disconnect() {
            "use strict";

            this.DAV = null;
            return Promise.resolve();
        };

        read(path) {
            "use strict";
            
            const self = this;
            path = path.replace(/^\/+/, "");
            if (this.debug) this.debug("WebDAVStore: Reading " + path);
            if (!this.DAV)
                return Promise.reject(new Error("WebDAVStore not connected"));
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
        _mkpath(path) {
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

        write(path, data) {
            "use strict";

            const self = this;

            if (this.debug) this.debug("WebDAVStore: Writing " + path);

            path = path.replace(/^\/+/, "").split('/');
            var folder = path.slice();
            folder.pop();

            if (!this.DAV)
                return Promise.reject(self._error(new Error("WebDAVStore not connected")));

            return self._mkpath(folder)
            .then(() => {
                return self.DAV.request('PUT', path.join('/'), {}, data)
                .then((res) => {
                    if (200 <= res.status && res.status < 300)
                        return Promise.resolve(res.body);
                    return Promise.reject(self._error(res));
                });
            })
        }
    }
    return WebDAVStore;
});
