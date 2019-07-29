let requirejs = require('requirejs');

requirejs.config({
    baseUrl: "../.."
});

/**
 * See sensors/README.md for information
 */
requirejs(["sensors/js/SampleStore", "fs-extra"], function(SampleStore, Fs) {
    // Load config
    const config = JSON.parse(Fs.readFileSync("config.json"));

    // Make webdav interface
    const store = new SampleStore(config.url, config.user, config.pass);

    // Make sensors
    for (let cfg in config.sensors) {
        let clss = cfg["class"];
        requirejs(["sensors/js/" + clss], function(Sensor) {
            let sensor = new Sensor(cfg, store);
            sensor.start();
        });
    }
});
