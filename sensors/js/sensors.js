/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
/* global __dirname */
/* global process */

/**
 * Server giving access to sensors attached to Raspberry Pi
 *
 * See sensors/README.md for information
 */
import { promises as Fs } from "fs";
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
import Path from "path";
const __dirname = Path.dirname(__filename);
import Getopt from "posix-getopt";
import Cors from "cors";
import Express from "express";
import HTTP from "http";
import { Time } from "./Time.js";

const DEFAULT_PORT = 8000;

const DESCRIPTION = [
  "DESCRIPTION\nA Raspberry PI sensors ajax server.",
  "See sensors/README.md for details",
  "", "OPTIONS",
  "\t-h, --help -Show this help",
  "\t-c, config=ARG - Configuration file (default ~/sensors.cfg)",
  `\t-p, port=ARG - What port to run the server on (default ${DEFAULT_PORT})`,
  "\t-s, simulate - Use a simulation for any missing hardware, instead of backing off and retrying",
  "\t-v, verbose - Verbose debugging messages"
].join("\n");

const go_parser = new Getopt.BasicParser(
  "h(help)c:(config)p:(port)sv", process.argv);

const options = {
  config : `${process.env.HOME}/sensors.cfg`,
  simulate: false,
  log: () => {}
};
let option;
while ((option = go_parser.getopt())) {
  switch (option.option) {
  case "p": options.port = option.optarg; break;
  case "c": options.config = option.optarg; break;
  case 's': options.simulate = true; break;
  case "h": console.log(DESCRIPTION); process.exit();
  case 'v': options.log = console.log; break;
  default: throw Error(`Unknown option -${option.option}\n${DESCRIPTION}`);
  }
}

function start_connect(cfg) {
	cfg.sensor.connect()
	.then(() => {
		console.log(`connect: ${cfg.sensor.name} connected`);
	})
	.catch(error => {
		console.error(`connect error: ${error}`);
		// If simulation is requested, make a simulated sensor if the
		// connect failed
		if (options.simulate) {
			console.log(`connect: Using simulation for '${cfg.name}'`);
			cfg.sensor.simulate();
		} else {
			// Back off and re-try
			setTimeout(() => start_connect(cfg), 2000);
		}
	});
}
	
Fs.readFile(options.config)
.then(config => {
  return JSON.parse(config);
})
.catch(e => {
  console.error("Configuration error", e);
  return Promise.reject(e.message);
})
.then(config => {
  const server = new Express();

  server.use(Cors());

  // Error handling
  server.use(function (err, req, res, next) {
    res.status(500).send(err);
  });

  // Make sensors
  const promises = [];
  for (const cfg of config.sensors) {
    cfg.log = options.log;
    const clss = cfg.class;

    promises.push(
      import(`./${clss}.js`)
      .then(mods => {
        const SensorClass = mods[clss];
        cfg.sensor = new SensorClass(cfg);
      })
      .catch(e => {
        options.log(clss, `import(${clss}) : ${e}`);
        cfg.error = `Could not import ${clss}: ${e}`;
 			})
      .then(() => {
			  // Start trying to connect
			  options.log(`Connect ${cfg.name}`);
			  start_connect(cfg);
		  })
      // Add routes
      .then(() => {
        server.get(`/${cfg.sensor.name}`, (req, res) => {
          if (typeof req.query.t !== "undefined")
            Time.sync(req.query.t);
					options.log(`Got ${cfg.name} request`);
          cfg.sensor.sample()
          .then(sample => {
            res.send(sample);
          })
					.catch(e => {
					});
        });
        options.log("Registered /" + cfg.sensor.name);
        return "registered /" + cfg.sensor.name;
      })
      .catch(cfg => {
        options.log(cfg.name, "could not be registered", cfg);
        server.get(`/${cfg.name}`, (req, res, next) => {
          next();
        });
        return Promise.resolve(`failed /${cfg.name}`);
      }));
  }

  Promise.all(promises)
  .then(ps => {
    options.log(ps);
    const port = options.port || config.port || DEFAULT_PORT;
    server.listen(port);
    console.log("Server started on port", port);
  });
})
.catch(e => {
  console.error("Error", e);
});
