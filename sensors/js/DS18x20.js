define("sensors/js/DS18x20", ['ds18b20-raspi'], function(DS18B20_raspi) {

    /**
     * Interface to DS18x20 device on one-wire bus connected to
     * GPIO on Raspberry PI
     */
   class DS18x20 {
        constructor(id) {
            this.sensor_id = id;
        }

        read() {
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
           });
        }
   }

    return DS18x20;
});

