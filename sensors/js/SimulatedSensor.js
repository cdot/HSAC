/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/SimulatedSensor", ["js/Sensor", "js/Time"], function(Sensor, Time) {

    class SimulatedSensor extends Sensor {
        constructor(config) {
            console.log("Creating simulated", config.name);
            super(config);
            if (config.name === "internal_temperature") {
                this.min = 20; this.max = 91;
            } else if (config.name === "intake_temperature") {
                this.min = -5, this.max = 41;
            } else {
                this.min = 0, this.max = 100;
            }
        }

        sample() {
            this.val = this.min + (this.max - this.min) * Math.random();
            return Promise.resolve({ sample: this.val, time: Time.now() });
        }
    }

    return SimulatedSensor;
});
