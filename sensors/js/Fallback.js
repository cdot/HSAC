/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/Fallback", ["js/Sensor", "js/Time"], function(Sensor, Time) {
    const MINT = -1;
    const MAXT = 91;
    const MINH = 0;
    const MAXH = 81;

    class Fallback extends Sensor {
        constructor(config) {
            console.log("Creating simulated", config.name);
            super(config);
            this.mTemp = (MAXT + MINT) / 2;
            this.mStepT = 1;
            this.mHum = (MAXH + MINH) / 2;
            this.mStepH = 1;
        }

        sample() {
            this.mTemp = MINT + Math.random() * (MAXT - MINT);
            this.mHum = MINH + Math.random() * (MAXH - MINH);
            let res = (/humidity/.test(this.name)) ? this.mHum : this.mTemp;
            return Promise.resolve({ sample: res, time: Time.now() });
        }
    }

    return Fallback;
});
