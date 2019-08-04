/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */

/**
 * Server giving access to sensors attached to Raspberry Pi
 *
 * See sensors/README.md for information
 */
let requirejs = require('requirejs');
requirejs.config({
    baseUrl: __dirname.replace(/\/[^\/]*$/, "")
});

requirejs(["fs-extra", "node-getopt", "express", "cors", "js/Fallback"], function(Fs, Getopt, Express, CORS, Fallback) {
    const DESCRIPTION =
          "DESCRIPTION\nA Raspberry PI sensors ajax server.\n" +
          "See sensors/README.md for details\n\nOPTIONS\n";

    let cliopt = Getopt.create([
        ["h", "help", "Show this help"],
        ["c", "config=ARG", "Configuration file (default ~/sensors.cfg)"],
        ["p", "port=ARG", "What port to run the server on (default 3000)"],
        ["d", "debug", "Run in debug mode, using simulations for missing hardware"]
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem()
        .options;

    if (typeof cliopt.config === "undefined")
        cliopt.config = process.env["HOME"] + "/sensors.cfg";

    // Enable fallback to simulated sensors if server is started debug
    let fallback = null;
    if (typeof cliopt.debug !== null)
        fallback = Fallback;

    // Default port is 3000
    let port = cliopt.port || 3000;
    
    Fs.readFile(cliopt.config)
    .then((config) => {
        return JSON.parse(config);
    })
    .catch((e) => {
        console.error("Configuration error", e);
        return Promise.reject(e.message);
    })
    .then((config) => {
        let server = Express();

        server.use(CORS());

        // Error handling fallback
        server.use(function (err, req, res, next) {
            console.log("Handling error");
            res.status(500).send(err)
        })
        
        // Make sensors
        let sensors = [];
        for (let cfg of config) {
            let clss = cfg["class"];
            console.debug("Load", clss);
            requirejs(["js/" + clss], function(SensorClass) {
                console.debug("Loaded", clss);
                new SensorClass(cfg).register(server, Fallback);
            });
        }

        server.listen(cliopt.port);
    })
    .catch((e) => {
        console.error("Error", e);
    })
});
