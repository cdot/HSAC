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

requirejs(["fs-extra", "node-getopt", "express", "cors", "js/Time", "js/SimulatedSensor"], function(Fs, Getopt, Express, CORS, Time, SimulatedSensor) {
    const DESCRIPTION =
          "DESCRIPTION\nA Raspberry PI sensors ajax server.\n" +
          "See sensors/README.md for details\n\nOPTIONS\n";
    const DEFAULT_PORT = 8000;

    let cliopt = Getopt.create([
        ["h", "help", "Show this help"],
        ["c", "config=ARG", "Configuration file (default ~/sensors.cfg)"],
        ["p", "port=ARG", "What port to run the server on (default " + DEFAULT_PORT + ")"],
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

    let simulation = (cliopt.simulate) ? SimulatedSensor : null;

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
        for (let cfg of config.sensors) {
            cfg.log = log;
            let clss = cfg["class"];

            let promise = new Promise((resolve, reject) => {
                requirejs(["js/" + clss], (SensorClass) => {
                    let sensor = new SensorClass(cfg);
                    log("Connecting", cfg.name);
                    sensor
                    .connect()
                    .then(() => { resolve(sensor); })
                    .catch((e) => {
                        log(cfg.name, "connect()",e);
                        cfg.error = "Could not connect: " + e;
                        return reject(cfg);
                    });
                }, (e) => {
                    log(clss, "require()",e);
                    cfg.error = "Could not require: " + e;
                    reject(cfg);
                });
            });

            // If simulation is requested, make a simulated sensor if the
            // construction or connect failed
            if (simulation) {
                promise = promise
                .catch((cfg) => {
                    log(cfg.name, cfg.error);
                    console.log("Using simulation for", cfg.name);
                    return Promise.resolve(new simulation(cfg));
                });
            }

            // Add routes
            promises.push(
                promise
                .then((sensor) => {
                    server.get("/" + sensor.name, (req, res) => {
                        if (typeof req.query.t !== "undefined")
                            Time.sync(req.query.t);
                        sensor.sample()
                        .then((sample) => {
                            res.send(sample);
                        });
                    });
                    log("Registered /" + sensor.name);
                    return Promise.resolve("registered /" + sensor.name);
                })
                .catch((cfg) => {
                    log(cfg.name, "could not be registered", cfg);
                    server.get("/" + cfg.name, (req, res, next) => {
                        next();
                    });
                    return Promise.resolve("failed /" + cfg.name);
                }));
        }

        Promise.all(promises)
        .then((ps) => {
            log(ps);
            // Make sure at least one sensor is registered
            for (let tf of ps) {
                if (/^registered/.test(tf)) {
                    let port = cliopt.port || config.port || DEFAULT_PORT;
                    server.listen(port);
                    console.log("Server started on port", port);
                    return;
                }
            }
            console.error("No sensors, so no server");
        });
    })
    .catch((e) => {
        console.error("Error", e);
    })
});
