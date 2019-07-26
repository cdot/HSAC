let requirejs = require('requirejs');

requirejs.config({
    baseUrl: "../.."
});

requirejs(['sensors/js/DHTxx', 'sensors/js/DS18x20', "app/js/DAVClient"], function(DHTxx, DS18x20) {

    const config = {
        DHT_type: 11, // 11 or 22
        DHT_GPIO: 14,
        RECORD_LIMIT: 5000,
    
        // GPIO pin for DS18 is set up in /boot/config.txt
        // list available 1-wire devices in /sys/bus/w1/devices
        DS18_ID: '28-0316010ca0ff',

        URL: "http://192.168.1.11/webdav/HSAC",
        PATH: "sensors.csv",
        USER: "test",
        PASS: "test"
    };
    
    let dht = new DHT(config.DHT_type, config.DHT_GPIO);
    let ds18 = new DS18B20(config.DS18_ID);

    const opts = {
        baseUrl: config.URL,
        userName: config.USER,
        password: config.PASS
    }
    const DAV = new DAVClient(opts);
          
    function update_record(samples) {
        return DAV.request('GET', config.PATH, {
            "Cache-Control": "no-cache"
        })
        .then((res) => {
            if (res.status === 404)
                return [];
            if (200 <= res.status && res.status < 300) {
                let lines = res.body.toString().split("\n");
                let records = lines.map((s) => { return s.split(","); });
                return records;
            }
            console.debug(res.body);
            throw new Error("Could not get " + config.PATH + ": " + res.status);
        })
        .then((records) => {
            for (sample of samples) {
                records.push([sample[0], Date.now(), sample[1]]);
            }
            while (records.length > RECORD_LIMIT)
                records.shift();
            let body = records.map((r) => r.join(",")).join("\n");
            return DAV.request('PUT', config.PATH, {}, body)
            .then((res) => {
                if (200 <= res.status && res.status < 300)
                    return;
                throw new Error("Could not put " + config.PATH + ": " + res.status);
            });
        });
    }

    setInterval(() => {
        let p = [
            dht.read()
            .then((r) => {
                return update_records([["DHT11_t", r.t],
                                       ["DHT11_h", r.h]]);
            }),
            ds18.read()
            .then((r) => {
                return update_records([[ds18.sensor_id, r]]);
            })];
	return Promise.all(p);
    }, 2000);
});
