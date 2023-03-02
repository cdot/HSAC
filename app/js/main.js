/*@preserve Copyright (C) 2019-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/* global requirejs */

/* Configure requirejs for the browser application */

const params = {};
const url_params = window.location.search.substring(1);
if (url_params) {
  for (const setting of url_params.split(/[;&]/)) {
    const set = setting.split("=", 2);
    if (set.length == 1)
      params[setting] = true;
    else
      params[set[0]] = set[1];
  }
}

requirejs.config({
  baseUrl: ".",
  urlArgs: "t=" + Date.now(), // cache suppression
  text: {
    useXhr: () => true
  },
  paths: {
		jquery: "app/node_modules/jquery/dist/jquery",
		"jquery-ui": "app/node_modules/jquery-ui/dist/jquery-ui",
    "touch-punch" :	"app/node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch",
    "js-cookie" : "app/node_modules/js-cookie/dist/js.cookie",
    "jquery-validate" : "app/node_modules/jquery-validation/dist/jquery.validate",
    "additional-methods" : "app/node_modules/jquery-validation/dist/additional-methods",
    "jquery-csv" : "app/node_modules/jquery-csv/src/jquery.csv",
    "jquery-confirm" : "app/node_modules/jquery-confirm/dist/jquery-confirm.min",
    "tablesorter" : "app/node_modules/tablesorter/dist/js/jquery.tablesorter.combined",
    "markdown-it" : "app/node_modules/markdown-it/dist/markdown-it"
  }
});

requirejs(["app/js/Sheds"], Sheds => new Sheds(params).begin());
