define("sensors/js/DS18x20", ['ds18b20-raspi', "sensors/js/Sensor"], function(DS18B20_raspi, Sensor) {
    
    /**
     * Interface to DS18x20 device on one-wire bus connected to
     * GPIO on Raspberry PI
     */
    class DS18x20 extends Sensor {
        
        /**
         * @param id one-wire sensor ID for DS18x20
         * @param age_limit maximum sample age, in seconds
         * @param delay ideal delay between samples, in milliseconds
         * @param store SampleStore
         */
        constructor(id, age_limit, delay, store) {
            super(age_limit, delay, store);

            this.mId = id;
        }

        /**
         * @Override
         */
        sample() {
            return new Promise((resolve, reject) => {
                DS18B20_raspi.readSimpleC((err, temp) => {
                    if (err) {
                        reject(err);
                    } else {
                        if (typeof temp !== "number")
                            // At least once this has been "boolean"!
                            reject("Unexpected result from ds18x20.get");
                        resolve(temp);
                    }
                });
            }).then((temp) => {
                return this.addSample(this.mId, temp);
            });
        }
    }

    return DS18x20;
});

