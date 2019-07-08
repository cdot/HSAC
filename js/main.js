/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

requirejs.config({
    baseUrl: ".",
    urlArgs: "nocache=" + Date.now(), // suppress cache
    text: {
        useXhr: function (url, protocol, hostname, port) {
            console.log("PUSSY");
            return true;
        }
    },
    paths: {
        // text! plugin, used for importing css
        "text" : "node_modules/text/text",

        // from //cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1
        "jquery" :"node_modules/jquery/dist/jquery.min",
        
        // from //cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1
        "jquery-ui" : "node_modules/jquery-ui-dist/jquery-ui",

        // from //cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.0
        "js-cookie" : "node_modules/js-cookie/src/js.cookie",

        // from https://cdnjs.cloudflare.com/ajax/libs/jquery-validate/1.19.0
        "jquery-validate" : "libs/jquery-validate/jquery.validate",
        "additional-methods" : "libs/jquery-validate/additional-methods",

        // from https://github.com/evanplaice/jquery-csv/tree/master/src 
        "jquery-csv" : "libs/jquery.csv.min",

        // From https://github.com/craftpip/jquery-confirm 
        "jquery-confirm" : "node_modules/jquery-confirm/js/jquery-confirm",

        // from https://github.com/Mottie/tablesorter 
        "tablesorter" : "node_modules/tablesorter/dist/js/jquery.tablesorter.combined"
    }
});

requirejs(["jquery", "jquery-ui", "js/Sheds"], function (jq, jqui, Sheds) {
    $(function() {
        new Sheds().begin();
    });
});
