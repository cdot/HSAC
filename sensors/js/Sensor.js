define("sensors/js/Sensor", function(Fs) {

    /**
     * Common base class for sensors. Controls polling.
     * Each sensor stores samples under one or more ID names; a
     * single sensor may generate samples for multiple IDs. Subclasses
     * must implement sample() which is called to poll the sensor; the
     * results of the poll are recorded using addSample().
     */
    class Sensor {

        /**
         * @param age_limit maximum sample age, in seconds
         * @param delay ideal delay between samples, in milliseconds
         * @param store SampleStore
         */
        constructor(age_limit, delay, store) {
            this.mStore = store;
            this.mAgeLimit = age_limit * 1000;
            if (delay <= 100)
                delay = 100;
            this.mDelay = delay;
            this.mAgeLimit = age_limit;
        }

        /**
         * @protected
         * Used by subclasses to add a sample to the store
         * @param data sample data
         * @return {Promise} to add the sample to the store
         */
        addSample(id, data) {
            return this.mStore.addSample(data, this.mAgeLimit, id);
        }
        
        /**
         * Pure virtual method to sample the sensor and pass the sample(s)
         * to the sample store by calling addSample()
         * @return {Promise} to sample the sensor and save the sample
         */
        sample() {
            throw "subclass of Sensor does not implement sample()"
        }
        
        /**
         * Start sampling
         */
        start() {
            let self = this;
            this.sample()
            .catch((e) => {
                console.error("Sampling error: " + e);
            })
            .finally(() => {
                setTimeout(() => self.start(), self.mDelay);
            });
        }
    }

    return Sensor;
});
