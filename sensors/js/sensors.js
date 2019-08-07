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
        ["s", "simulate", "Use a simulation for any missing hardware"],
        ["v", "verbose", "Verbose debugging messages"]
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem()
        .options;

    if (typeof cliopt.config === "undefined")
        cliopt.config = process.env["HOME"] + "/sensors.cfg";

    let log = (cliopt.verbose) ? console.log : (() => {});

    let simulation = (cliopt.simulate) ? Fallback : null;

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

        // Error handling
        server.use(function (err, req, res, next) {
            res.status(500).send(err)
        })

        // Make sensors
        let promises = [];
        for (let cfg of config) {
            cfg.log = log;
            cfg.simulation = simulation;
            let clss = cfg["class"];
            promises.push(new Promise((resolve) => {
                log("Requiring ", clss);
                requirejs(["js/" + clss], function(SensorClass) {
                    resolve(new SensorClass(cfg).register(server));
                });
            }));
        }

        Promise.all(promises)
        .then(() => {
            server.listen(cliopt.port);
            console.log("Server started on port", port);
        });
    })
    .catch((e) => {
        console.error("Error", e);
    })
});
