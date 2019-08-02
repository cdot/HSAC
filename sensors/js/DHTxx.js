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

            if (!config.type || config.type != 11 && config.type != 22)
                throw "DHTxx bad type";
            if (!config.temperature_id)
                throw "DHTxx no temperature_id";
            if (!config.humidity_id)
                throw "DHTxx no humidity_id";
            if (!config.gpio)
                throw "DHTxx no gpio";

            this.mDevice = config.type;
            this.mGpio = (config.gpio || 14);
            this.mTempID = config.temperature_id;
            this.mHumID = config.humidity_id;

            let self = this;
            Fs.stat("/dev/gpiomem")
            .catch((err) => {
                console.error("GPIO not found for DHT. Faking it!");

                DHT.initialize({
                    test: {
                        fake: {
                            temperature: 20,
                            humidity: 60
                        }
                    }
                });
            });
        }

        /**
         * @Override
         */
	sample() {
            let self = this;
            return DHT.promises.read(this.mDevice, this.mGpio)
            .then((res) => {
                return Promise.all([
                    self.addSample(self.mTempID, res.temperature),
                    self.addSample(self.mHumID, res.humidity)
                ]);
            });
        }
    }
    return DHTxx;
});
