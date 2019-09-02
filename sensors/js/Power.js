/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/Power", ['raspi', 'raspi-gpio', "js/Sensor", "js/Time"], function(raspi, gpio, Sensor, Time) {

    /**
     * Power detection sensor, used with a custom circuit that senses
     * AC power via a current loop. Because the circuit is AC, we may sense
     * high or low depending on where in the power cycle we sample the pin.
     * We could rectify and smooth this, but the extra hardware isn't worth
     * it when can handle it adequately in software. This is based on the
     * observation that that we get no edges when the sensed device is off,
     * but are flooded with edges (both rising and falling) when it is
     * active. All we are need to watch is when we last got an edge - if
     * we've had no edges for a timeout period, then the pin has gone low.
     * Note that it is theoretically possible for the sampling to
     * synchronise with the AC power cycle, so we end up always sampling
     * 0.
     */
    class Power extends Sensor {

        constructor(config) {
            super(config);
            // GPIO pin number
            this.gpio = config.gpio;
            // How long to wait before acknowledging an "off" state
            this.timeout = config.timeout;

            // Current state, either high (1) or low (0)
            this.state = 0;
            // Accumulate "on" time.
            this.onTime = 0;
        }

        handleTick() {
            let now = Time.now()
            // If the state is high and we get another edge within
            // the timeout period - either rising or falling - then
            // that is taken as meaning something is still going on.
            if (this.state === 1) {
                if ((this.lastEdge + this.timeout) < now) {
                    //console.debug('1->0');
                    this.state = 0;
                } else {
                    // something is still going on
                    let t = Time.now();
                    this.onTime += t - this.lastUpdate;
                    this.lastUpdate = t;
                }
            }

            setTimeout(() => { this.handleTick(); }, this.timeout)
        }

        connect() {

            if (!this.gpio)
                return Promise.reject(this.name + " has no gpio");

            let self = this;
            return new Promise((resolve, reject) => {
                raspi.init(() => {
                    let pin = new gpio.DigitalInput({
                        pin: "P1-" + self.gpio,
                        pullResistor: gpio.PULL_DOWN
                    });

                    pin.on("change", (value) => {
                        //console.debug("Edge", value);
                        self.lastEdge = Time.now();
                        if (self.state === 0 && value === gpio.HIGH) {
                            //console.debug('0->1');
                            self.state = 1;
                            self.lastUpdate = self.lastEdge;
                        }
                    });

                    self.handleTick();
                    resolve();
                });
            });
        }

        /**
         * Sample is the runtime (time the compressor has been running
         * since the last sample() call)
         */
        sample() {
            //console.debug("Sample", this.onTime);
            let sample = this.onTime;
            this.onTime = 0;
            return Promise.resolve({
                time: Time.now(), sample: sample
            });
        }
    }

    return Power;
});
