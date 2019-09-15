/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env node.js */
define("js/Timer", ['raspi', 'raspi-gpio', "js/Sensor", "js/Time"], function(raspi, gpio, Sensor, Time) {

    /**
     * Keeps a count of the number of ms that a pin with a pull-down is held
     * high between calls to sample(). Used with a custom power detection circuit
     * that senses power via a current loop.
     */
    class Timer extends Sensor {

        constructor(config) {
            super(config);
            // GPIO pin number
            this.gpio = config.gpio;

            // Polling frequency, default to 10ms (ASAP). Polling will be no faster
            // than this, and will probably be slower.
            this.poll = config.poll || 10;

            // State of pin that means timer on, 1 or 0
            this.on_state = config.on_state || 0;

            // Current timer state, on = true, off = false
            this.isOn = false;

            // Accumulate "on" time since the last call to sample()
            this.onTime = 0;
            this.lastUpdate = Date.now();
        }

        handleTick() {
            let t = Date.now();
            let newState = this.pin.read();
            if (this.isOn)
                this.onTime += t - this.lastUpdate;
            this.isOn = (newState === this.on_state);
            this.lastUpdate = t;
            setTimeout(() => { this.handleTick(); }, this.poll)
        }

        connect() {
            if (!this.gpio)
                return Promise.reject(this.name + " has no gpio");

            return new Promise((resolve, reject) => {
                raspi.init(() => {
                    this.pin = new gpio.DigitalInput({
                        pin: "GPIO" + this.gpio,
                        pullResistor: gpio.PULL_DOWN
                    });

                    this.isOn = (this.pin.read() === this.on_state);
                    this.handleTick();
                    console.log("Timer polling GPIO", this.gpio, "every", this.poll, "ms");
                    resolve();
                });
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
