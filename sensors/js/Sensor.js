/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/Sensor", function(Fs) {

    /**
     * Common base class for sensors
     */
    class Sensor {

        /**
         * @param name sensor name
         * @param server express server
         */
        constructor(config) {
            this.name = config.name;
            this.log = config.log;
            this.simulation = config.simulation;
        }

        /**
         * Check that the sensor is ready. Default does nothing
         * @return {Promise} a promise to check that the sensor is available
         */
        connect() {
            return Promise.resolve();
        }

        /**
         * Sample the sensor
         * @return {Promise} to sample the sensor and return a simple value
         */
        sample() {
            return Promise.resolve(null);
        }
    }

    return Sensor;
});
