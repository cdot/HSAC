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
    let sensors = [];
    for (let cfg of config.sensors) {
        let clss = cfg["class"];
        //console.debug("Load", clss);
        requirejs(["js/" + clss], function(Sensor) {
            cfg.store = store;
            sensors.push(new Sensor(cfg));
        });
    }

    if (!config.delay || config.delay <= 1000)
        config.delay = 1000;

    // Did have this as independent polling loops for each sensor, but
    // it kept losing sensors :-(
    function start() {
        for (let sensor of sensors) {
            sensor.sample()
            .catch((e) => {
                console.error(sensor.name, "sampling error:", e);
            })
            .then(() => {
                console.log("Sampled", sensor.name);
            });
        }

        setTimeout(start, config.delay);
    }

    start();
});
