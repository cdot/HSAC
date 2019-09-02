/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/SimulatedSensor", ["js/Sensor", "js/Time"], function(Sensor, Time) {

    class SimulatedSensor extends Sensor {
        
        constructor(config) {
            console.log("Creating simulated", config.name);
            super(config);
            this.resample = () => { return this.minmax(); }
            if (config.class === "DHTxx") {
                if (config.field === "temperature") {
                    this.min = 3; this.max = 41;
                } else {
                    this.min = 0; this.max = 100;
                }
            } else if (config.class === "Power") {
                this.lastask = Date.now();
                this.resample = () => {
                    // Power on time since last sample
                    let sample = Math.floor(Math.random() * (Date.now() - this.lastask));
                    this.lastask = Date.now();
                    return sample;
                };
            } else {
                this.min = 4; this.max = 91;
            }
        }

        minmax() {
            if (typeof this.lastsample == "undefined")
                this.lastsample = (this.min + this.max) / 2;
            let delta = (Math.random() - 0.5) * (this.max - this.min) / 10;
            this.lastsample += delta;
            if (this.lastsample > this.max)
                this.lastsample = this.max;
            if (this.lastsample < this.min)
                this.lastsample = this.min;
            return this.lastsample;
        }

        sample() {
            return Promise.resolve({
                sample: this.resample(), time: Time.now()
            });
        }
    }

    return SimulatedSensor;
});
