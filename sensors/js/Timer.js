/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env node.js */
define("js/Timer", ['fs-extra', "js/Sensor", "js/Time"], function(Fs, Sensor, Time) {

    /**
     * Keeps a count of the number of ms that a pin with a pull-down is held
     * high between calls to sample(). Used with a custom power detection circuit
     * that senses power via a current loop.
     */
    const GPIOPATH = '/sys/class/gpio/';

    class Timer extends Sensor {

        constructor(config) {
            super(config);
            // GPIO pin number
            this.gpio = config.gpio;
            this.pin = GPIOPATH + "gpio" + this.gpio + "/";

            // Polling frequency, default to 10ms (ASAP). Polling will be no faster
            // than this, and will probably be slower.
            this.poll = config.poll || 10;

            // State of pin that means timer on, "1" or "0"
            this.on_state = config.on_state;

            // Current timer state, on = true, off = false
            this.isOn = false;

            // Accumulate "on" time since the last call to sample()
            this.onTime = 0;
            this.lastUpdate = Date.now();
        }

        handleTick() {
            Fs.readFile(this.pin + "value")
           .then((v) => {
                v = parseInt(v.toString());
                let t = Date.now();
                let newState = v;
                if (this.isOn)
                    this.onTime += t - this.lastUpdate;
                this.isOn = (newState === this.on_state);
                this.lastUpdate = t;
                setTimeout(() => { this.handleTick(); }, this.poll);
           });
        }

        connect() {
            if (!this.gpio)
                return Promise.reject("Timer not given a gpio pin");

            // Force-unexport first, in case it was previously left locked after a crash
            return Fs.writeFile(GPIOPATH + "unexport", this.gpio)
            .then(() => {
                return Fs.writeFile(GPIOPATH + "export", this.gpio);
            })
            .then(() => {
                return Fs.readFile(this.pin + "value");
            })
            .then((v) => {
                 this.isOn = (parseInt(v.toString()) === this.on_state);
                 this.handleTick();
                 console.log("Timer polling GPIO", this.gpio, "every", this.poll, "ms");
            });
        }

        /**
         * Sample is the runtime (time the compressor has been running
         * since the last sample() call)
         */
        sample() {
            return new Promise((resolve) => {
                let sample = this.onTime;
                this.onTime = 0;
                resolve({ time: Time.now(), sample: sample });
            });
        }
    }

    return Timer;
});
