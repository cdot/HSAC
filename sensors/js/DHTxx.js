define("js/DHTxx", ['node-dht-sensor', "fs-extra", "js/Sensor"], function(DHT, Fs, Sensor) {

    /**
     * Interface to DHTxx temperature and humidity sensors on 
     * Raspberry Pi gpio pins
     */
    class DHTxx extends Sensor {

        /**
         * @param config {type, gpio, prefix} type 11 or 22,
         * gpio pin, prefix for sample names e.g. "DHT_". Plus
         * config for Sensor.
         */
        constructor(config) {
            super(config);

            this.mDevice = (config.type || 11);
            this.mGpio = (config.gpio || 14);
            this.mPrefix = (config.prefix || "DHT_");
        }

        /**
         * @Override
         */
	sample() {
            return Fs.stat("/dev/gpiomem")
            .catch((err) => {
                return Promise.reject("GPIO not found for DHT");
            })
            .then(() => {
                return new Promise((resolve, reject) => {
                    DHT.read(
                        this.mDevice, this.mGpio,
                        (err, temperature, humidity) => {
                            if (err)
                                reject(err);
                            else
                                resolve({t: temperature, h: humidity});
                        });
                }).then((r) => {
                    return Promise.all([
                        this.addSample(this.mPrefix + "_temperature", r.t),
                        this.addSample(this.mPrefix + "_humidity", r.h)
                    ]);
                });
            });
        }
    }
    return DHTxx;
});
