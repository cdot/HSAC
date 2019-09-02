/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/SimulatedSensor", ["js/Sensor", "js/Time"], function(Sensor, Time) {

    class SimulatedSensor extends Sensor {
        
        constructor(config) {
            console.log("Creating simulated", config.name);
            super(config);
            if (config.class === "DHTxx") {
                if (config.field === "temperature")
                    this.resample = () => 46 * Math.random() - 5;
                else
                    this.resample = () => 100 * Math.random();
            } else if (config.class === "Power") {
                this.resample = () => {
                    // Power on time since last sample - 3s
                    return Math.floor(Math.random() * 6000);
                }
            } else
                this.resample = () => 71 * Math.random() + 20;
        }

        sample() {
            return Promise.resolve({
                sample: this.resample(), time: Time.now()
            });
        }
    }

    return SimulatedSensor;
});
