/*eslint-env node, mocha */
const assert = require("chai").assert;
var Config = require("../Config");
var Entries;
const { JSDOM } = require('jsdom');
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = jsdom;
global.$ = global.jQuery = require('jquery')(window);
require('../../libs/jquery.csv.min.js');

var Compressor = require("../Compressor");

var reset = {
    "compressor.csv": "date,operator,temperature,runtime,filters_changed"
};

var store = $.extend({}, reset);
let test_points = { 
    50: 0.20,
    40: 0.34,
    30: 0.57,
    20: 1.00,
    10: 1.85,
     5: 2.60,
     0: 3.80
};

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
            // Set up test compressor, using coefficients calculated
            // for test_points in mycurvefit.com
            test_filter_lifetime: 50,
            test_filter_coeff_a: 3.798205,
            test_filter_coeff_b: 1.149582,
            test_filter_coeff_c: 11.50844,
            test_filter_coeff_d: -0.4806983
        });

    it("initialises", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ id: "test", config: cfg });
        assert.equal(comp.remaining_filter_life(),
                     cfg.get("test_filter_lifetime"));
        return comp.add({ operator: "Nuts", temperature: 20, runtime: 0 })
        .then(() => {
            assert.equal(comp.length(), 1);
            var e = comp.get(0);
            assert.equal(e.temperature, 20);
            assert.equal(e.operator, "Nuts");
            assert.equal(e.runtime, 0);
            assert(!e.filters_changed);
        });
    });

    it("saves", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ id:"test", config: cfg });
        return comp.add({ operator: "Nuts", temperature: 20, runtime: 1 })
        .then(() => {
            return comp.save().then(() => {
                var s = $.csv.toArrays(store["test_compressor.csv"]);
                assert.equal(s.length, 2);
            });
        })
        .then(() => {
            var s = $.csv.toArrays(store["test_compressor.csv"]);
            assert.equal(s.length, 2);
            assert.deepEqual(s[0],
                             ["date","operator","temperature","runtime","filters_changed"]);
            assert(Date.now() - new Date(s[1][0]).getTime() <= 1000,
                  s);
            assert.deepEqual(s[1],
                             [s[1][0],"Nuts","20","1","false"]);
        });
    });

    it("predicts filter life at 20C", () => {
        store = $.extend({}, reset);
        let comp = new Compressor({ id: "test", config: cfg });
        return comp.add({ temperature: 20, runtime: 0, filters_changed: true })
        .then(() => {
            // Add 50 hours at 20C, should take
            // the filter to (near) zero
            return comp.add({ temperature: 20, runtime:50 });
        })
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life()) < 0.1,
                   "FL "+comp.remaining_filter_life());
        });
    });

    it("predicts filter life at 40C", () => {
        store = $.extend({}, reset);
        let comp = new Compressor({ id: "test", config: cfg });
        // At 40C, multiplicative coefficient should be 0.34, so
        // lifetime should be 50 * 0.34 = 17 hours
        return comp.add({ temperature: 40, runtime:17 })
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life()) < 1,
                   "FL " + comp.remaining_filter_life());
        });
    });

    it("predicts filter life at 0C", () => {
        store = $.extend({}, reset);
        let comp = new Compressor({ id: "test", config: cfg });
        // At 0C, multiplicative coefficient is 3.8, so
        // lifetime should be 50 * 3.8 = 190 hours
        return comp.add({ temperature: 0, runtime:190 })
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life()) < 0.1,
                   "FL " + comp.remaining_filter_life());
        });
    });
    
    it("accumulates usage", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ id: "test", config: cfg });
        let flt = cfg.get("test_filter_lifetime");
        let prom = Promise.resolve(), n = 1;
        for (let i in test_points) {
            flt -= 1 / test_points[i];
            prom = prom.then(() => {
                comp.add({ temperature: i, runtime: n++ });
            });
        }
        return prom
        .then(() => {
            //console.debug(comp.remaining_filter_life(), flt);
            assert(Math.abs(comp.remaining_filter_life() - flt) < 0.5,
                  comp.remaining_filter_life() +" "+ flt);
        })
    });
});
