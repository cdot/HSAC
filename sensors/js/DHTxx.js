define("sensors/js/DHTxx", ['node-dht-sensor', "sensors/js/Sensor"], function(DHT, Sensor) {

    /**
     * Interface to DHTxx temperature and humidity sensors on 
     * Raspberry Pi gpio pins
     */
    class DHTxx extends Sensor {

        /**
         * @param dht_type 11 or 22
         * @param gpio pin
         * @param prefix prefix for sample names e.g. "DHT_"
         * @param age_limit maximum sample age, in seconds
         * @param delay ideal delay between samples, in milliseconds
         * @param store SampleStore
         */
        constructor(dht_type, gpio, prefix, age_limit, delay, store) {
            super(age_limit, delay, store);

            this.mDevice = dht_type;
            this.mGpio = gpio;
            this.mPrefix = prefix;
        }

        /**
         * @Override
         */
	sample() {
            return new Promise((resolve, reject) => {
                DHT.read(this.mDevice, this.mGpio,
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
        }
    }
    return DHTxx;
});
