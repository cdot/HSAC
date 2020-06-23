/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/RangeSimulator", ["js/Time"], function(Time) {

    class RangeSimulator {

        constructor(min, max) {
			this.min = min; this.max = max;
        }

		// Sample that moves within a min..max range with occasional
		// forays into illegal values
        sample() {
            if (typeof this.lastsample == "undefined")
                this.lastsample = (this.min + this.max) / 2;
            let delta = (Math.random() - 0.5) * (this.max - this.min) / 10;
            this.lastsample += delta;
            if (this.lastsample > this.max)
                this.lastsample = this.max;
            if (this.lastsample < this.min)
                this.lastsample = this.min;
			// 1 in 10 values is illegal
			if (Math.random < 0.05)
				this.lastSample = this.max + 1;
			else if (Math.random < 0.1)
				this.lastSample = this.max - 1;
            return this.lastsample;
        }
	}

	return RangeSimulator;
});
