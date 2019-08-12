/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
let requirejs = require('requirejs');
requirejs.config({
    baseUrl: __dirname.replace(/\/[^\/]*$/, "")
});

requirejs(['node-dht-sensor'], function(DHT) {

    DHT.read(11, 14, function(e, t, h) {
        console.log(e,t,h);
    })
});
