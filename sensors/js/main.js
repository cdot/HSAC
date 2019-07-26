let requirejs = require('requirejs');

requirejs.config({
    baseUrl: "../.."
});

/**
 * Loads config from ../config.js
 */
requirejs(['sensors/js/DHTxx', 'sensors/js/DS18x20', 'fs-extra'], function(DHTxx, DS18x20, Fs) {
    const config = JSON.parse(Fs.readFileSync("config.json"));

    const { createClient } = require("webdav");
    const DAV = createClient(
        config.URL,
        {
            username: config.USER,
            password: config.PASS
        });

    const dht = new DHTxx(config.DHT_type, config.DHT_GPIO);
    const ds18 = new DS18x20(config.DS18_ID);

    let samples = {};

    function update_records(samples) {
        return DAV.getFileContents(config.PATH)
        .then((res) => {
            let records;
            if (res) {
                let lines = res.toString().split("\n");
                while (lines.length > config.RECORD_LIMIT - samples.length)
                    lines.shift();
                records = lines.map(s => s.split(","));
            } else
                records = [];
            for (let sensor in samples)
                records.push([sensor, Date.now(), samples[sensor]]);
            let body = records.map(r => r.join(",")).join("\n");
            return DAV.putFileContents(config.PATH,  body);
        });
    }

    setInterval(() => {
        let p = [
            dht.read()
            .then((r) => {
                samples.DHT11_t = r.t;
                samples.DHT11_h = r.h;
            }),
            ds18.read()
            .then((r) => {
                samples[ds18.sensor_id] = r;
            })];
	return Promise.all(p)
        .then(() => update_records(samples));
    }, 2000);
});
