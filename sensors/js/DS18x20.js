define("js/DS18x20", ['ds18b20-raspi', "js/Sensor"], function(DS18B20_raspi, Sensor) {

    /**
     * Interface to DS18x20 device on one-wire bus connected to
     * GPIO on Raspberry PI
     */
    class DS18x20 extends Sensor {

        /**
         * @param config { id: } id: one-wire sensor ID for DS18x20
         * Plus config for Sensor
         */
        constructor(config) {
            super(config);

            if (!config.sensor_id)
                throw "DS18x20 no sensor_id";
            if (!config.sample_id)
                throw "DS18x20 no sample_id";

            this.mSensorId = config.sensor_id;
            this.mID = config.sample_id;
        }

        /**
         * @Override
         */
        sample() {
            return new Promise((resolve, reject) => {
                DS18B20_raspi.readSimpleC((err, temp) => {
                    if (err) {
                        reject(err);
                    } else if (typeof temp !== "number") {
                        // At least once this has been "boolean"!
                        console.error("Unexpected result from ds18x20.get");
                        resolve();
                    } else {
                        this.addSample(this.mID, temp)
                        .then(() => resolve);
                    }
                });
            });
        }
    }

    return DS18x20;
});

