define("js/DHTxx", ['node-dht-sensor', "fs-extra", "js/Sensor"], function(DHT, Fs, Sensor) {

    /**
     * Interface to DHTxx temperature and humidity sensors on 
     * Raspberry Pi gpio pins
     */
    class DHTxx extends Sensor {

        /**
         * @param config {type, gpio} type 11 or 22,
         */
        constructor(config) {
            super(config);

            this.mDevice = config.type;
            this.mGpio = config.gpio;
            this.mField = config.field;
        }

        /**
         * @Override
         */
        check() {
            if (!this.mDevice || this.mDevice != 11 && this.mDevice != 22)
                return Promise.reject(
                    this.name + " has bad type" + this.mDevice);

            if (!this.mGpio)
                return Promise.reject(this.name + " has no gpio");

            // Make sure we have GPIO available
            return Fs.stat("/dev/gpiomem");
        }

        /**
         * @Override
         */
	sample() {
            return DHT.promises.read(this.mDevice, this.mGpio)
            .then((sample) => {
                return sample[this.mField];
            });
        }
    }
    return DHTxx;
});
