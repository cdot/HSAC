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

            this.mId = config.id;
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
                        this.addSample(this.mId, temp)
                        .then(() => resolve);
                    }
                });
            });
        }
    }

    return DS18x20;
});

