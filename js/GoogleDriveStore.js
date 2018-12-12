/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* global AbstractStore */
/* global GAPI */

/**
 * A store using Google Drive, only works in the browser
 * @implements AbstractStore
 * @require GAPI
 */

/**
 */
function GoogleDriveStore(params) {
    "use strict";
    AbstractStore.call(self, params);
}

// By granting full drive access, we open up the whole drive for possible
// places to put files.
const SCOPES = [ "https://www.googleapis.com/auth/drive" ];

GoogleDriveStore.prototype = Object.create(AbstractStore.prototype);

/**
 * @private
 * Analyse an error returned by a promise
 */
GoogleDriveStore._analyse_error = function (r, context) {
    "use strict";
    var mess = context + " failed: ";
    if (typeof r === "string")
        return mess + r;
    else if (r.status === 401) {
        mess +=
            "Your access token has expired, or you are not logged in." +
            " " +
            "Please refresh the page in order to save in Google Drive";
    } else if (r.result) {
        mess += r.result.error.message;
    } else if (r.message) {
        mess += r.message;
    } else {
        mess += r.body;
    }
    return mess;
};

/**
 * Promise to load the drive API if not already loaded, and establish
 * the identity of the logged-in user. The promise returns gapi.
 */
GoogleDriveStore.prototype.GAPI = function() {
    return GAPI(SCOPES, { drive: "v2" })
        .then((gapi) => {
            if (self.user)
                return Promise.resolve(gapi);
            
            // Get the logged-in user
            return gapi.client.drive.about.get("name")
                .then(
                    function (result) {
                        if (result.status === 200) {
                            self.user = result.result.user.displayName;
                            console.debug("GoogleDriveStore: ", self.user,
                                          "is logged in");
                            return Promise.resolve(gapi);
                        } else {
                            return Promise.reject(result);
                        }
                    })
                .catch((result) => {
                    debugger;
                    reject(GoogleDriveStore._analyse_error(
                        r, "Google Drive load"));
                });
        });
};

var BOUNDARY = "-------314159265358979323846";
var DELIMITER = "\r\n--" + BOUNDARY + "\r\n";
var RETIMILED = "\r\n--" + BOUNDARY + "--";

/**
 * @private
 * Promise to retrieve a file
 * @param url url to GET
 * @param ok callback on ok, passed the data
 * @param fail callback on fail
 */
GoogleDriveStore.prototype._getfile = function (url, ok, fail) {
    "use strict";

    return this.GAPI("drive.readonly")
        .then((gapi) => {
            var oauthToken = gapi.auth.getToken();

            console.debug("GoogleDriveStore: GET " + url);

            // no client API to get file content from Drive
            return $.ajax(
                {
                    url: url,
                    method: "GET",
                    beforeSend: function (jqXHR) {
                        jqXHR.setRequestHeader(
                            "Authorization",
                            "Bearer " + oauthToken.access_token);
                    }
                })
        })
        .then(
            function (data) {
                console.debug("GoogleDriveStore: _getfile OK");
                return Promise.resolve(data);
            },
            function (jqXHR, textStatus, errorThrown) {
                var reason = textStatus + " " + errorThrown;
                console.debug("_getfile failed", reason);
                return Promise.reject(reason);
            });
};

/**
 * Return a Promise to get the id of the folder at the end of the given
 * path, optionally creating the folders if they don't exist.
 */
GoogleDriveStore.prototype._follow_path = function (parentid, path, create) {
    "use strict";

    if (path.length === 0)
        return Promise.resolve(parentid);

    var p = path.slice();
    var pathel = p.shift();
    var self = this;
    
    var create_folder = function () {
        var metadata = {
            title: pathel,
            mimeType: "application/vnd.google-apps.folder"
        };
        if (parentid !== "root")
            // Don't think we want this for a root file?
            metadata.parents = [{
                id: parentid
            }];

        console.debug("Creating folder " + pathel + " under " + parentid);
        return this.GAPI(SCOPES)
            .then((gapi) => {
                return gapi.client.drive.files.insert(metadata);
            })
            .then(
                function (response) {
                    var id = response.result.id;
                    return self._follow_path(id, p, true);
                },
                function (err) {
                    // create failed
                    throw GoogleDriveStore._analyse_error(r, "Create folder");
                });
    };
        
    var query = "title='" + pathel + "'" +
        " and '" + parentid + "' in parents" +
        " and mimeType='application/vnd.google-apps.folder'" +
        " and trashed=false";

    return this.GAPI(SCOPES)
        .then((gapi) => {
            return gapi.client.drive.files
                .list({
                    q: query
                })
        })
        .then(
            function (response) {
                var items = response.result.items;
                if (items.length > 0) {
                    var id = items[0].id;
                    console.debug("GoogleDriveStore: found " + query + " at " + id);
                    return self._follow_path(id, p, create);
                } else {
                    console.debug("GoogleDriveStore: could not find " + query);
                    if (create) {
                        return create_folder();
                    } else {
                        throw AbstractStore.NODATA;
                    }
                }
            },
            function (r) {
                throw GoogleDriveStore._analyse_error(r, "Follow path");
            });
};

// id is a (string) id or a { parentid: name: structure }
GoogleDriveStore.prototype._putfile = function (parentid, name, data, ok, fail, id) {
    "use strict";

    var self = this;
    var url = "/upload/drive/v2/files";
    var method = "POST";
    var params = {
        uploadType: "multipart",
        visibility: "PRIVATE"
    };
    var metadata = {
        title: name,
        mimeType: "application/octet-stream"
    };

    if (typeof parentid !== "undefined") {
        metadata.parents = [{
            id: parentid
        }];
    }

    if (typeof id !== "undefined") {
        // Known fileId, we're updating an existing file
        url += "/" + id;
        method = "PUT";
    }

    var multipartRequestBody =
        DELIMITER +
        "Content-Type: application/json\r\n\r\n" +
        JSON.stringify(metadata) +
        DELIMITER +
        "Content-Type: text/plain\r\n" +
        "\r\n" +
        data +
        RETIMILED;

    return this.GAPI(SCOPES)
        .then((gapi) => {
            return gapi.client.request({
                path: url,
                method: method,
                params: params,
                headers: {
                    "Content-Type": "multipart/related; boundary=\""
                        + BOUNDARY + "\""
                },
                body: multipartRequestBody
            })
        })
        .then(
            function(response) {
                return Promise.resolve(response.result);
            },
            function (err) {
                return Promise.reject(
                    GoogleDriveStore._analyse_error(err, "Put"));
            });
};

GoogleDriveStore.prototype.options = function () {
    "use strict";

    return $.extend(AbstractStore.prototype.options(), {
        needs_path: true,
        identifier: "Google Drive"
    });
};

GoogleDriveStore.prototype.write = function (path, data) {
    "use strict";

    var p = path.replace(/^\/+/, '').split("/");
    var name = p.pop();
    var self = this;

    return this.GAPI(SCOPES)
        .then((gapi) => {
            console.debug("GoogleDriveStore: following " + path);
            return self
                ._follow_path("root", p, true)
                .then(function (parentid) {
                    // See if the file already exists, if it does then use it's id
                    var query = "title='" + name + "'" +
                        " and '" + parentid + "' in parents" +
                        " and trashed=false";
                    console.debug("GoogleDriveStore: checking existance of", name,
                                  "under", parentid, gapi.client);
                    return gapi.client.drive.files
                        .list({
                            q: query
                        })
                        .then(function (response) {
                            var items = response.result.items;
                            var id;
                            if (items.length > 0) {
                                id = items[0].id;
                                console.debug("GoogleDriveStore: updating", name,
                                              "id", id);
                            } else
                                console.debug("GoogleDriveStore: creating", name,
                                              "in", parentid);
                            return self._putfile(parentid, name, data, id);
                        })
                });
        })
        .catch(function (err) {
            debugger;
            throw GoogleDriveStore._analyse_error(err, "Write");
        });
};

GoogleDriveStore.prototype.read = function (path) {
    "use strict";

    var p = path.replace(/^\/+/, '').split("/");
    var name = p.pop();
    var self = this;

    return this.GAPI(SCOPES)
        .then(() => {
            console.debug("GoogleDriveStore: Reading " + path);

            return self._follow_path("root", p, false)
                .then((parentid) => {
                    var query = "title='" + name + "'" +
                        " and '" + parentid + "' in parents" +
                        " and trashed=false";
                    
                    return gapi.client.drive.files
                        .list({
                            q: query
                        });
                })
                .then((response) => {
                    var items = response.result.items;
                    if (items.length > 0) {
                        var url = items[0].downloadUrl;
                        console.debug(
                            "GoogleDriveStore:", name, "found at", url);
                        return self._getfile(url);
                    } else {
                        console.debug("GoogleDriveStore: could not find", name);
                        return Promise.reject(AbstractStore.NODATA);
                    }
                })
        })
        .catch((r) => {
            return Promise.reject(GoogleDriveStore._analyse_error(r, "Read"));
        });
}

if (typeof module !== "undefined")
    module.exports = GoogleDriveStore;
