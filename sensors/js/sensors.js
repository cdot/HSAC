/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
/* global __dirname */
/* global process */

/**
 * Server giving access to sensors attached to Raspberry Pi
 *
 * See sensors/README.md for information
 */
requirejs = require('requirejs');
requirejs.config({
    baseUrl: __dirname.replace(/\/[^/]*$/, "")
});

requirejs(["fs-extra", "node-getopt", "express", "cors", "js/Time"], function(Fs, Getopt, Express, CORS, Time) {
    const DESCRIPTION =
          "DESCRIPTION\nA Raspberry PI sensors ajax server.\n" +
          "See sensors/README.md for details\n\nOPTIONS\n";
    const DEFAULT_PORT = 8000;

    const cliopt = Getopt.create([
        ["h", "help", "Show this help"],
        ["c", "config=ARG", "Configuration file (default ~/sensors.cfg)"],
        ["p", "port=ARG", "What port to run the server on (default " + DEFAULT_PORT + ")"],
        ["s", "simulate", "Use a simulation for any missing hardware, instead of backing off and retrying"],
        ["v", "verbose", "Verbose debugging messages"]
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem()
        .options;

    if (typeof cliopt.config === "undefined")
        cliopt.config = process.env.HOME + "/sensors.cfg";

    const log = (cliopt.verbose) ? console.log : (() => {});

    const simulation = cliopt.simulate;

	function connect(cfg) {
		cfg.sensor.connect()
		.then(() => {
			console.log(`connect: ${cfg.sensor.name} connected`);
		})
		.catch(error => {
			//console.log(`connect: ${error}`);
			// If simulation is requested, make a simulated sensor if the
			// connect failed
			if (simulation) {
				console.log(`connect: Using simulation for '${cfg.name}`);
				cfg.sensor.simulate();
			} else {
				// Back off and re-try
				setTimeout(() => connect(cfg), 2000);
			}
		});
	}
	
    Fs.readFile(cliopt.config)
    .then(config => {
        return JSON.parse(config);
    })
    .catch(e => {
        console.error("Configuration error", e);
        return Promise.reject(e.message);
    })
    .then(config => {
        const server = Express();

        server.use(CORS());

        // Error handling
        server.use(function (err, req, res, next) {
            res.status(500).send(err);
        });

        // Make sensors
        const promises = [];
        for (const cfg of config.sensors) {
            cfg.log = log;
            const clss = cfg.class;

            const promise = new Promise((resolve, reject) => {
                requirejs([`js/${clss}`], SensorClass => {
                    cfg.sensor = new SensorClass(cfg);
					resolve();
                }, e => {
                    log(clss, `require(${clss}) : ${e}`);
                    cfg.error = `Could not require ${clss}: ${e}`;
 					reject();
                });
            }).then(() => {
				// Start trying to connect
				log(`Connect ${cfg.name}`);
				connect(cfg);
			});
			
            // Add routes
            promises.push(
                promise
                .then(() => {
                    server.get(`/${cfg.sensor.name}`, (req, res) => {
                        if (typeof req.query.t !== "undefined")
                            Time.sync(req.query.t);
						log(`Got ${cfg.name} request`);
                        cfg.sensor.sample()
                        .then(sample => {
                            res.send(sample);
                        })
						.catch(e => {
						});
                    });
                    log("Registered /" + cfg.sensor.name);
                    return Promise.resolve("registered /" + cfg.sensor.name);
                })
                .catch(cfg => {
                    log(cfg.name, "could not be registered", cfg);
                    server.get(`/${cfg.name}`, (req, res, next) => {
                        next();
                    });
                    return Promise.resolve(`failed /${cfg.name}`);
                }));
        }

        Promise.all(promises)
        .then(ps => {
            log(ps);
            const port = cliopt.port || config.port || DEFAULT_PORT;
            server.listen(port);
            console.log("Server started on port", port);
        });
    })
    .catch(e => {
        console.error("Error", e);
    });
});
