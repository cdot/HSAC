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
         * @param config {record_as:, age_limit:, store: }
         * record_as: file to store samples to, age_limit: maximum sample
         * age, in seconds,
         * store: SampleStore
         */
        constructor(config) {
            this.name = config.name;
            this.mStore = config.store;
            this.mAgeLimit = (config.age_limit || 600) * 1000;
            this.mTimer = null;
        }

        /**
         * @protected
         * Used by subclasses to add a sample to the store
         * @param data sample data
         * @param id to store the sample under
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
    }

    return Sensor;
});
