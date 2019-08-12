/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/DHTxx", ['node-dht-sensor', "fs-extra", "js/Sensor", "js/Time"], function(DHT, Fs, Sensor, Time) {

    const BACK_OFF = 5000; // 5s in ms

    class DHTPin {
        constructor(type, gpio) {
            this.mType = type;
            this.mGpio = gpio;
            this.mLastSample = { temperature: 0, humidity: 0,
                                 time: 0, error: "Uninitialised" };
            this.mSamplingPromise = null;
            this.mUnusable = false;
        }

        /**
         * Promise to read a sample from the pin. If the sample is requested
         * during the backoff period, or while we are waiting for the last
         * read to return, then the last sample is returned.
         */
        sample() {
            if (this.mUnusable) {
                return Promise.reject("Unusable");
            }

            if (this.mSamplingPromise)
                return this.mSamplingPromise;

            if (typeof this.mLastSample.error === "undefined" // Force resampling if there was an error
                && Time.now() - this.mLastSample.time < BACK_OFF) {
                return Promise.resolve(this.mLastSample);
            }

            let self = this;
            this.mSamplingPromise = new Promise((resolve, reject) => {
                self.mTimeout = setTimeout(() => {
                    self.mIsSampling = false;
                    self.mTimeout = null;
                    reject("Timed out");
                }, BACK_OFF);
                DHT.read(this.mType, this.mGpio, function(e, t, h) {
                    clearTimeout(self.mTimeout); // clear it ASAP
                    self.mTimeout = null;
                    if (e) {
                        this.mUnusable = true;
                        console.error("DHT error", e);
                        reject("DHT error " + e);
                        return;
                    }
                    let sample = { time: Time.now(), temperature: t, humidity: h };
                    self.mLastSample = sample;
                    resolve(sample);
                });
            })
            .catch((e) => {
                this.mLastSample.error = e;
                return Promise.resolve(this.mLastSample);
            })
            .finally((f) => {
                if (this.mTimeout)
                    clearTimeout(this.mTimeout);
                this.mTimeout = null;
                this.mSamplingPromise = null;
            });
            return this.mSamplingPromise;
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
            this.mField = config.field;
        }

        /**
         * @Override
         */
        connect() {
            if (!this.mDevice || this.mDevice != 11 && this.mDevice != 22)
                return Promise.reject(
                    this.name + " has bad type" + this.mDevice);

            if (!this.mGpio)
                return Promise.reject(this.name + " has no gpio");

            if (!DHTPins[this.mGpio])
                DHTPins[this.mGpio] = new DHTPin(this.mDevice, this.mGpio);

            // Make sure we have GPIO available, and we can read a sample
            return Fs.stat("/dev/gpiomem")
            .catch((e) => {
                console.error(this.mField, "DHT connect failed: ", e.message);
                return Promise.reject(e.message);
            })
            .then((s) => {
                return DHTPins[this.mGpio].sample()
                .then((s) => {
                    if (s.error) {
                        console.error(this.mField, "DHT connect sample failed: ", e.message);
                        return Promise.reject("sample failed: " + s.error)
                    }
                });
            });
        }

        /**
         * @Override
         */
	sample() {
            return DHTPins[this.mGpio]
            .sample()
            .then((sam) => {
                return { sample: sam[this.mField], time: sam.time };
            });
        }
    }
    return DHTxx;
});
