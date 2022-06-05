/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node.js */
define("js/OnOffSimulator", ["js/Sensor", "js/Time"], function(Sensor, Time) {

    class OnOffSimulator {

        constructor() {
            this.lastask = Date.now();
        }

		// Sample that gives on/off times
		sample() {
            // Power on time since last sample
            const sample = Math.floor(Math.random() * (Date.now() - this.lastask));
            this.lastask = Date.now();
            return sample;
		}
	}

    return OnOffSimulator;
});
