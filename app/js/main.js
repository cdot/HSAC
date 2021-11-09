/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

let suppression = "";
let min = ".min";

let params = {};
let url_params = window.location.search.substring(1);
if (url_params) {
    for (let setting of url_params.split(/[;&]/)) {
        let set = setting.split("=", 2);
        if (set.length == 1)
            params[setting] = true;
        else
            params[set[0]] = set[1];
    }
}

if (params.debug) {
    min = "";
}

requirejs.config({
    baseUrl: ".",
    urlArgs: "t=" + Date.now(), // cache suppression
    text: {
        useXhr: function (url, protocol, hostname, port) {
            return true;
        }
    },
    paths: {
        // text! plugin, used for importing css
        //"text" : "app/libs/text" + min,

        "jquery" :"app/libs/jquery" + min,
        "jquery-ui" : "app/libs/jquery-ui" + min,
        "js-cookie" : "app/libs/js.cookie" + min,
        "jquery-validate" : "app/libs/jquery.validate" + min,
        "additional-methods" : "app/libs/additional-methods" + min,
        "jquery-csv" : "app/libs/jquery.csv" + min,
        "touch-punch" : "app/libs/jquery.ui.touch-punch" + min,
        "jquery-confirm" : "app/libs/jquery-confirm.min", // only min available
        "tablesorter" : "app/libs/jquery.tablesorter.combined" + min,
        "markdown-it" : "app/libs/markdown-it" + min
    }
});

requirejs(["jquery", "jquery-ui"], function () {
    $(() => {
        requirejs(["app/js/Sheds"], function(Sheds) {
            new Sheds(params).begin();
        });
    });
});
