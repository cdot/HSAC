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
         * Register the sensor entry point with the given express server
         * @param server an express server to add handlers to
         */
        register(server) {
            let self = this;
            return this.check()
            .then(() => {
                server.get("/" + this.name, (req, res) => {
                    self.sample()
                    .then((sample) => {
                        res.send(sample);
                    });
                });
                this.log("/" + this.name, "registered");
            })
            .catch((e) => {
                if (e.message) e = e.message;
                console.error(this.name, "sensor could not be registered", e);
                if (this.simulation) {
                    this.log("Using simulation for", this.name);
                    return new (this.simulation)({name: this.name}).register(server);
                } else
                    throw new Error(this.name + " could not be registered: " + e);

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
