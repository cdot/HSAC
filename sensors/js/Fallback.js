define("js/Fallback", ["js/Sensor"], function(Sensor) {
    const MINT = -1;
    const MAXT = 91;
    const MINH = 0;
    const MAXH = 81;

    class Fallback extends Sensor {
        constructor(config) {
            console.log("Creating simlated", config.name);
            super(config);
            this.mTemp = (MAXT + MINT) / 2;
            this.mStepT = 1;
            this.mHum = (MAXH + MINH) / 2;
            this.mStepH = 1;
        }

        sample() {
            this.mTemp = MINT + Math.random() * (MAXT - MINT);
            this.mHum = MINH + Math.random() * (MAXH - MINH);
            if (/humidity/.test(this.name))
                return Promise.resolve(this.mHum);
            else
                return Promise.resolve(this.mTemp);
        }
    }

    return Fallback;
});
