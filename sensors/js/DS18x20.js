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
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(this.addSample(this.mID, temp));
                    }
                });
            });
        }
    }

    return DS18x20;
});

