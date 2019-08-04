define("js/DS18x20", ['ds18b20-raspi', "js/Sensor"], function(DS18B20_raspi, Sensor) {

    /**
     * Interface to DS18x20 device on one-wire bus connected to
     * GPIO on Raspberry PI
     */
    class DS18x20 extends Sensor {

        /**
         * @param config { sensor_id: } id: one-wire sensor ID for DS18x20
         * Plus config for Sensor
         */
        constructor(config) {
            super(config);
            this.mSensorId = config.sensor_id;
        }

        check() {
            if (typeof this.mSensorId !== "string")
                return Promise.reject(this.name + " has no sensor_id");
            
            // Make sure we can read from the config
            return new Promise((resolve, reject) => {
                DS18B20_raspi.readSimpleC((err, temp) => {
                    if (err) { reject(err); return; }
                    resolve();
                });
            });
        }
        
        /**
         * @Override
         */
        sample() {
            return new Promise((resolve, reject) => {
                DS18B20_raspi.readSimpleC((err, temp) => {
                    if (err) { reject(err); return; }
                    resolve({temperature: temp});
                });
            });
        }
    }

    return DS18x20;
});

