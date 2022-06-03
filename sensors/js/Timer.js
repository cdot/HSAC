/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env node.js */
define("js/Timer", ['fs-extra', "js/Sensor", "js/Time", "js/OnOffSimulator"], function(Fs, Sensor, Time, OnOffSimulator) {

    /**
     * Keeps a count of the number of ms that a pin with a pull-down is held
     * in a given state between calls to sample().
     */
    const GPIOPATH = '/sys/class/gpio/';

    class Timer extends Sensor {

        constructor(config) {
            super(config);
            // GPIO pin number
            this.gpio = config.gpio;
            this.pin = GPIOPATH + "gpio" + this.gpio + "/";

            // Frequency at which we poll the pin. Polling
            // will be no faster than this, and will probably be slower
            // due to delays in the IO system reading the pin. Default
            // is 100ms or 1/10th of a second.
            this.poll = config.poll || 100;

            // State of pin that means timer on, 1 or 0, default 0
            this.on_state = config.on_state || 0;

            // Current timer state, on = true, off = false
            this.isOn = false;

            // Accumulate "on" time since the last call to sample()
            this.onTime = 0;
            this.lastUpdate = Date.now();
        }

        pollPin() {
            Fs.readFile(this.pin + "value")
           .then((v) => {
                v = parseInt(v.toString());
                let t = Date.now();
                let newState = v;
                if (this.isOn)
                    this.onTime += t - this.lastUpdate;
                this.isOn = (newState === this.on_state);
                this.lastUpdate = t;
                setTimeout(() => { this.pollPin(); }, this.poll);
           });
        }

        connect() {
            if (!this.gpio)
                return Promise.reject("Timer not given a gpio pin");

            // Force-unexport first, in case it was previously left locked after a crash
            return Fs.writeFile(GPIOPATH + "unexport", "" + this.gpio)
            .catch((e) => {
                console.error("Unexport", this.gpio, "failed", e);
                return Promise.resolve();
            })
            .then(() => {
                return Fs.writeFile(GPIOPATH + "export", this.gpio);
            })
            .then(() => {
                return Fs.readFile(this.pin + "value");
            })
            .then((v) => {
                 this.isOn = (parseInt(v.toString()) === this.on_state);
                 this.pollPin();
                 console.log("Timer polling GPIO", this.gpio, "every", this.poll, "ms");
            });
        }

        /**
         * Sample is the runtime (time the compressor has been running
         * since the last sample() call)
         */
        sample() {
            return new Promise((resolve) => {
                let sample;
                if (this.simulation)
                    sample = this.simulation.sample();
                else
                    sample = this.onTime;
                this.onTime = 0;
                resolve({ time: Time.now(), sample: sample });
            });
        }

        // @Override
        simulate() {
            this.simulation = new OnOffSimulator();
        }
    }

    return Timer;
});
