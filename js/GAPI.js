var gapi_loader;

/**
 * Callback invoked when api.js is loaded
 */
function gapi_on_load() {
    "use strict";

    if (gapi_loader)
        gapi_loader();
}

/**
 * Set up GAPI with the given parameters
 */
GAPI.setup = function(params) {
    if (!params.client_id)
        throw "GoogleDriveStore: requires client_id";
    GAPI.client_id = params.client_id;
    // List of scopes for which authorisation has already bee sought
    GAPI.authScopes = {};
}

/**
 * Return a promise to authorise the given scopes and laod the given APIs
 */
function GAPI(scopes, apis) {
    var promise = Promise.resolve();

    if (GAPI.ready)
        return GAPI._auth(scopes, apis);

    return new Promise((resolve, reject) => {
        // Don't resolve until global gapi_loader has finished
        gapi_loader = async function () {
            function subLoader() {
                gapi.client
                    .init({
                        apiKey: GAPI.apiKey,
                        clientId: GAPI.clientId,
                        scope: 'profile'
                    })
                    .then(() => {
                        // GoogleAuth not ready....
                        var GoogleAuth = gapi.auth2.getAuthInstance();
                        if (GoogleAuth.isSignedIn.get())
                            resolve();
                        else
                            GoogleAuth.isSignedIn.listen(
                                (isSignedIn) => {
                                    if (isSignedIn) {
                                        resolve();
                                    }
                                });
                    });
            };
            gapi.load('client:auth2', subLoader);
        };
        $.getScript("https://apis.google.com/js/api.js?onload=gapi_on_load")
            .fail(function (jqxhr, settings, exception) {
                reject("Failed to load Google APIs: " + 
                       exception + " " + jqxhr.status);
            });
    }).then(GAPI._auth(scopes, apis));
}

/**
 * Return a Promise to authorise the requested scopes and load
 * the given Google APIs
 */
GAPI._auth = function (scopes, apis) {
    "use strict";

    if (!scopes instanceof Array)
        scopes = [ scopes ];
    
    var rescope = [];
    for (var i = 0; i < scopes.length; i++) {
        if (scopes[i] in GAPI.authScopes) {
            rescope.push(scopes[i]);
            GAPI.authScopes[scopes[i]] = true;
        }
    }

    var self = this;
    var promise = Promise.resolve(gapi);
    
    if (rescope.length > 0) {
        console.debug("GAPI: authorising", rescope);

        promise = promise.then(new Promise((resolve, reject) => {
            
            // Timeout after 20 seconds of waiting for auth
            var tid = window.setTimeout(function () {
                window.clearTimeout(tid);
                reject("Timeout trying to authorise access to Google Drive." +
                       " Are popups blocked in your browser?");
            }, 20000);

            var options = new gapi.auth2.SigninOptionsBuilder({});
            var user = gapi.auth2.getAuthInstance().currentUser().get();
            return user.grant(options)
                .then((authResult) => {
                    debugger;
                    window.clearTimeout(tid);
                    if (authResult && !authResult.fail) {
                        console.debug("GAPI: access token OK");
                        GAPI.loggedIn = true;
                        resolve(gapi);
                    } else {
                        if (authResult === null) {
                            debugger;
                            reject("Could not authorise " + rescope.join(" "));
                        } else
                            reject(authResult.fail);
                    }
                })
        }));
    }

    if (apis)
        Object.keys(apis).forEach((api) => {
            promise = promise.then(gapi.client.load(
                "https://www.googleapis.com/discovery/v1/apis/" + api + "/"
                    + apis[api] + "/rest"));

            return promise;
        });
};
