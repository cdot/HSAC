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
		jquery: 'app/node_modules/jquery/dist/jquery' + min,
		"jquery-ui": 'app/node_modules/jquery-ui-dist/jquery-ui' + min,
        "touch-punch" :
		'app/node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch' + min,

        "js-cookie" : "app/node_modules/js-cookie/dist/js.cookie" + min,

        "jquery-validate" : "app/node_modules/jquery-validation/dist/jquery.validate" + min,
        "additional-methods" : "app/node_modules/jquery-validation/dist/additional-methods" + min,
        "jquery-csv" : "app/node_modules/jquery-csv/src/jquery.csv" + min,
        "jquery-confirm" : "app/node_modules/jquery-confirm/dist/jquery-confirm.min", // only min available
        "tablesorter" : "app/node_modules/tablesorter/dist/js/jquery.tablesorter.combined" + min,
        "markdown-it" : "app/node_modules/markdown-it/dist/markdown-it" + min
    }
});

requirejs(["app/js/Sheds"], Sheds => new Sheds(params).begin());
