define("js/Sensor", function(Fs) {

    /**
     * Common base class for sensors. Controls polling.
     * Each sensor stores samples under one or more ID names; a
     * single sensor may generate samples for multiple IDs. Subclasses
     * must implement sample() which is called to poll the sensor; the
     * results of the poll are recorded using addSample().
     */
    class Sensor {

        /**
         * @param config {age_limit:, delay:, store: } age_limit: maximum sample
         * age, in seconds, delay: between samples, in milliseconds, 
         * store: SampleStore
         */
        constructor(config) {
            this.mStore = config.store;
            if (!config.delay || config.delay <= 100)
                config.delay = 100;
            this.mDelay = config.delay;
            this.mAgeLimit = (config.age_limit || 600000);
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
            return Promise.reject("subclass of Sensor does not implement sample()");
        }
        
        /**
         * Start sampling
         */
        start() {
            let self = this;
            this.sample()
            .then(() => {
                setTimeout(() => self.start(), self.mDelay);
            })
            .catch((e) => {
                console.error("Sampling error: " + e);
            });
        }
    }

    return Sensor;
});
