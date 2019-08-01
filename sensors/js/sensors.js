let requirejs = require('requirejs');
let ROOT = __dirname.replace(/\/[^\/]*$/, "");
console.log("Starting in", ROOT);

requirejs.config({
    baseUrl: ROOT
});

/**
 * See sensors/README.md for information
 */
requirejs(["js/SampleStore", "fs-extra"], function(SampleStore, Fs) {
    // Load config
    const config = JSON.parse(Fs.readFileSync(ROOT + "/config.json"));

    // Make webdav interface
    const store = new SampleStore(config.url, config.user, config.pass);

    // Make sensors
    for (let cfg of config.sensors) {
        let clss = cfg["class"];
        //console.debug("Load", clss);
        requirejs(["js/" + clss], function(Sensor) {
            cfg.store = store;
            let sensor = new Sensor(cfg);
            sensor.start();
        });
    }
});
