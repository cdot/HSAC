/*eslint-env node, mocha */
const assert = require("chai").assert;
var Config = require("../Config");
var Compressor = require("../Compressor");
const { JSDOM } = require('jsdom');
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = jsdom;
global.$ = global.jQuery = require('jquery')(window);
require('../../libs/jquery.csv.min.js');

var reset = {
    "compressor.csv": "date,operator,temperature,runtime,filterlife"
};

var store = $.extend({}, reset);

/*
  50,0.2
  40,0.34
  30,0.57
  20,1
  10,1.85
  5,2.6
  0,3.8
*/

describe("Compressor tests", function() {
    var cfg = new Config(
        {
            read: (what) => {
                return Promise.resolve(store[what]);
            },
            write: (what, data) => {
                store[what] = data;
                return Promise.resolve();
            }
        },
        {
            filter_lifetime: 100,
            filter_coeff_a: 3.798205,
            filter_coeff_b: 1.149582,
            filter_coeff_c: 11.50844,
            filter_coeff_d: -0.4806983
        });
    it("initialises", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ config: cfg });
        return comp.add({ operator: "Nuts", temperature: 20, runtime: 0 })
            .then(() => {
                assert.equal(comp.length(), 1);
                var e = comp.get(0);
                assert.equal(e.temperature, 20);
                assert.equal(e.operator, "Nuts");
                assert.equal(e.runtime, 0);
                assert.equal(e.filterlife, 1);
            });
    });
    it("saves", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ config: cfg });
        return comp.add({ operator: "Nuts", temperature: 20, runtime: 0 })
            .then(() => {
                return comp.save().then(() => {
                    var s = $.csv.toArrays(store["compressor.csv"]);
                    assert.equal(s.length, 2);
                });
            })
            .then(() => {
                var s = $.csv.toArrays(store["compressor.csv"]);
                assert.equal(s.length, 2);
                assert.deepEqual(s[0],
                                 ["date","operator","temperature","runtime","filterlife"]);
                assert(Date.now() - s[1][0] <= 1000);
                assert.deepEqual(s[1],
                                 [s[1][0],"Nuts","20","0","1"]);
            });
    });
    it("predicts filter life", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ config: cfg });
        return comp.add({ temperature: 20, runtime: 0, filters_changed: true })
            .then(() => {
                // Add 100 hours = 6000 minutes use at 20C
                return comp.add({ temperature: 20, runtime:6000 });
            })
            .then(() => {
                var c = comp.get(1);
                assert(c.filterlife < 0.01);
            })
            .then(() => {
                // At 40C, multiplicative coefficient should be 0.34, so
                // lifetime should be 100 * 0.34 = 34 hours = 2040 minutes
                return comp.add({ temperature: 40, runtime:8040,
                                  filters_changed: true });
            })
            .then(() => {
                var c = comp.get(1);
                assert(c.filterlife < 0.01);
            })
            .then(() => {
                // At 0C, multiplicative coefficient is 3.8, so
                // lifetime should be 100 * 3.8 = 380 hours = 22800 minutes
                return comp.add({ temperature: 0, runtime:30840,
                                  filters_changed: true });
            })
            .then(() => {
                var c = comp.get(1);
                assert(c.filterlife < 0.01);
            });
    });
    it("accumulates usage", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ config: cfg });
        return comp.add({ temperature: 0, runtime: 0, filters_changed: true })
            .then(() => {
                return comp.add({ temperature: 0, runtime:60 });
            })
            .then(() => {
                return comp.add({ temperature: 5, runtime:120 });
            })
            .then(() => {
                return comp.add({ temperature: 10, runtime:180 });
            })
            .then(() => {
                return comp.add({ temperature: 20, runtime:240 });
            })
            .then(() => {
                return comp.add({ temperature: 30, runtime:300 });
            })
            .then(() => {
                return comp.add({ temperature: 40, runtime:360 });
            })
            .then(() => {
                assert.equal(comp.length(), 7);
                var factors = [ 3.8, 2.6, 1.85, 1, 0.57, 0.34 ];
                var f = 1;
                for (var i = 0; i < factors.length; i++) {
                    f -= 1 / (100 * factors[i]);
                    //console.log(f);
                }
                var c = comp.get(comp.length() - 1);
                assert(Math.abs(c.filterlife - f) < 0.001);
            })
    });
});
