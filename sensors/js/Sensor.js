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
        }

        /**
         * Register the sensor with the given express server
         * @param server an express server to add handlers to
         * @param fallback class object to use for sampling if the
         * hardware for this sensor isn't available
         */
        register(server, fallback) {
            let self = this;
            return this.check()
            .then(() => {
                server.get("/" + this.name, (req, res) => {
                    self.sample()
                    .then((val) => {
                        res.send({
                            sample: val,
                            time: Date.now()
                        });
                    });
                });
            })
            .catch((e) => {
                if (e.message) e = e.message;
                console.log(this.name, "sensor could not be registered", e);
                if (fallback) {
                    return new fallback({name: this.name}).register(server);
                }
                server.get("/" + this.name, (req, res, next) => {
                    next(self.name + " was not registered");
                });
            });
        }

        /**
         * Check that the sensor is ready. Default does nothing
         * @return {Promise} a promise to check that the sensor is available
         */
        check() {
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
