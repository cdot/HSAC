/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    // node.js
    const { JSDOM } = require('jsdom');
    document = new JSDOM('<!doctype html><html><body></body></html>');
    const { window } = document;
    global.window = window;
    global.document = window.document;
    global.navigator = { userAgent: "node.js" };
    let jQuery = require('jquery');
    global.jQuery = jQuery;
    global.$ = jQuery;

    $.getTapEvent = function() { return "click"; }
}

requirejs.config({
    baseUrl: "../..",
    paths: {
        jquery: "app/node_modules/jquery/dist/jquery",
        "jquery-csv": "app/node_modules/jquery-csv/src/jquery.csv",
        "touch-punch": "app/node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch"
    }
});

requirejs(["app/js/Compressor", "app/js/Config", "app/test/TestRunner", "jquery"], function(Compressor, Config, TestRunner) {

    let tr = new TestRunner("Compressor");
    let assert = tr.assert;
    let stdheads = ["date","operator","temperature","humidity", "runtime","filters_changed"];
    let reset = {
        "compressor.csv": stdheads.join(",")
    };

    let store = $.extend({}, reset);
    let test_points = { 
        50: 0.20,
        40: 0.34,
        30: 0.57,
        20: 1.00,
        10: 1.85,
        5: 2.60,
        0: 3.80
    };

    let cfg = new Config(
        // Dummy store
        {
            read: what => Promise.resolve(store[what]),
            write: (what, data) => {
                store[what] = data;
                return Promise.resolve();
            }
        },
        // Set up test compressor config, using coefficients calculated
        // for test_points in mycurvefit.com
        {
            test: {
                filter: {
                    lifetime: 50,
                    a: 3.798205,
                    b: 1.149582,
                    c: 11.50844,
                    d: -0.4806983
                }
            }
        }//, console.debug
    );

    tr.addTest("initialises", () => {
        store = $.extend({}, reset);
        var comp = new Compressor($.extend(cfg, { id: "test" }));
        assert.equal(comp._remainingFilterLife(),
                     cfg.get("test_filter_lifetime"));
        return comp._add({ operator: "Nuts", temperature: 20, humidity:50,runtime: 0 })
        .then(() => {
            assert.equal(comp.length(), 1);
            var e = comp.get(0);
            assert.equal(e.temperature, 20);
            assert.equal(e.humidity, 50);
            assert.equal(e.operator, "Nuts");
            assert.equal(e.runtime, 0);
            assert(!e.filters_changed);
        });
    });

    tr.addTest("saves", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ id:"test", config: cfg });
        return comp._add({ operator: "Nuts", temperature: 20, runtime: 1 })
        .then(() => {
            return comp.save().then(() => {
                var s = $.csv.toArrays(store["test_compressor.csv"]);
                assert.equal(s.length, 2);
            });
        })
        .then(() => {
            var s = $.csv.toArrays(store["test_compressor.csv"]);
            assert.equal(s.length, 2);
            assert.deepEqual(s[0], stdheads);
            assert(Date.now() - new Date(s[1][0]).getTime() <= 1000,
                  s);
            assert.deepEqual(s[1],
                             [s[1][0],"Nuts","20","","1","false"]);
        });
    });

    tr.addTest("predicts filter life at 20C", () => {
        store = $.extend({}, reset);
        let comp = new Compressor({ id: "test", config: cfg });
        return comp._add({ temperature: 20, runtime: 0, filters_changed: true })
        .then(() => {
            // Add 50 hours at 20C, should take
            // the filter to (near) zero
            return comp._add({ temperature: 20, runtime:50 });
        })
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life()) < 0.1,
                   "FL "+comp.remaining_filter_life());
        });
    });

    tr.addTest("predicts filter life at 40C", () => {
        store = $.extend({}, reset);
        let comp = new Compressor({ id: "test", config: cfg });
        // At 40C, multiplicative coefficient should be 0.34, so
        // lifetime should be 50 * 0.34 = 17 hours
        return comp._add({ temperature: 40, runtime:17 })
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life()) < 1,
                   "FL " + comp.remaining_filter_life());
        });
    });

    tr.addTest("predicts filter life at 0C", () => {
        store = $.extend({}, reset);
        let comp = new Compressor({ id: "test", config: cfg });
        // At 0C, multiplicative coefficient is 3.8, so
        // lifetime should be 50 * 3.8 = 190 hours
        return comp._add({ temperature: 0, runtime:190 })
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life()) < 0.1,
                   "FL " + comp.remaining_filter_life());
        });
    });

    tr.addTest("accumulates usage", () => {
        store = $.extend({}, reset);
        var comp = new Compressor({ id: "test", config: cfg });
        let flt = cfg.get("test_filter_lifetime");
        let prom = Promise.resolve(), n = 1;
        for (let i in test_points) {
            flt -= 1 / test_points[i];
            prom = prom.then(() => {
                comp._add({ temperature: i, runtime: n++ });
            });
        }
        return prom
        .then(() => {
            assert(Math.abs(comp.remaining_filter_life() - flt) < 0.5,
                  comp.remaining_filter_life() +" "+ flt);
        })
    });

    tr.run();
});
