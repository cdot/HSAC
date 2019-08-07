define("js/DHTxx", ['node-dht-sensor', "fs-extra", "js/Sensor"], function(DHT, Fs, Sensor) {

    const BACK_OFF = 2500; // 2.5s in ms

    class DHTPin {
        constructor() {
            this.mLastSample = { temperature: 0, humidity: 0, time: 0 };
            this.mIsSampling = false;
        }

        /**
         * Promise to read a sample from the pin. If the sample is requested
         * during the backoff period, or while we are waiting for the last
         * read to return, then the last sample is returned.
         */
        sample(type, gpio) {
            if (this.mIsSampling || Date.now() - this.mLastSample.time < BACK_OFF) {
                return Promise.resolve(this.mLastSample);
            }

            // TODO: do we have to time out this read?
            this.mIsSampling = true; // don't try to sample again yet
            let self = this;
            return new Promise((resolve, reject) => {
                self.mTimeout = setTimeout(() => {
                    self.mIsSampling = false;
                    self.mTimeout = null;
                    reject("Timed out");
                }, BACK_OFF);

                DHT.read(type, gpio, function(e, t, h) {
                    clearTimeout(self.mTimeout); // clear it ASAP
                    self.mTimeout = null;
                    if (e) {
                        reject("DHT error: " + e);
                        return;
                    }
                    let sample = { time: Date.now(), temperature: t, humidity: h };
                    self.mLastSample = sample;
                    resolve(sample);
                });
            })
            .catch((e) => {
                console.error("DHT:", e);
                return Promise.resolve(this.mLastSample);
            })
            .finally(() => {
                if (this.mTimeout)
                    clearTimeout(this.mTimeout);
                this.mTimeout = null;
                this.mIsSampling = false;
            });
        }
    }

    let DHTPins = {};

    /**
     * A single GPIO pin may have up to two DHTxx objects on it, for sensing
     * temperature and humidity. However they will both use the same DHTPin object.
     */
    class DHTxx extends Sensor {

        /**
         * @param config {type, gpio} type 11 or 22,
         */
        constructor(config) {
            super(config);

            this.mDevice = config.type;
            this.mGpio = config.gpio;

            if (!DHTPins[config.gpio])
                DHTPins[config.gpio] = new DHTPin();

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
            return DHTPins[this.mGpio]
            .sample(this.mDevice, this.mGpio)
            .then((sam) => {
                return { sample: sam[this.mField], time: sam.time };
            });
        }
    }
    return DHTxx;
});
