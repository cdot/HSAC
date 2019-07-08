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
    baseUrl: ".."
});

requirejs(["js/Nitrox", "test/TestRunner", "jquery"], function(Nitrox, TestRunner) {
    let tr = new TestRunner("Compressor");
    let assert = tr.assert;

    var tests = [
        // Figures calculated using spreadsheet derived from Gas Mixing Planner Issue 1a
        // T   V   %    P  t%   tP  bV   bP =>
        [ 4,  12, 26,  30, 32, 232, 49,  90, {
            boostToReal_b: 61.80, O2Needed_l: 288, bankLeft_b: 84.12 } ],
        [ 15, 12, 21,  50, 32, 232, 49, 200, {
            boostToReal_b: 83.65, O2Needed_l: 277.81, bankLeft_b: 194.33 } ],
        [ 40, 12, 28,  50, 32, 232, 47,  90, {
            boostToReal_b: 78.71, O2Needed_l: 176.49, bankLeft_b: 86.25 } ],
        // Error: too much O2 already in cylinder. How much to bleed by?
        [ 38, 24, 32, 200, 28, 230, 47,  60,  { bleed_b: 147.12 } ],
        // Error: mix achievable, but not enough O2 in bank
        [ 38, 24, 21, 50, 28, 230, 4,  60,  { boostToReal_b: 70.93, O2Needed_l: 250.44, bankLeft_b: -2.61 } ],
        // Error: mix achievable, but too much pressure already in cylinder. How much to bleed by?
        [ 38, 24, 21, 40, 32, 230, 40,  60,  { O2Needed_l: 592.45, bleed_b: 12.10, bankLeft_b: 45.19 } ],
    ];

    function make_test(test) {
        return function() {
            var conditions = {
                temperature:      test[0],
                cylinder_size:    test[1],
                start_mix:        test[2],
                start_pressure:   test[3],
                target_mix:       test[4],
                target_pressure:  test[5],
                O2_bank_size:     test[6],
                O2_bank_pressure: test[7]
            };
            var expected = test[8];
            var n = new Nitrox({
                //debug: console.debug
            });
            var result = n.blend(conditions);
            for (var j in expected) {
                if (result[j] != null)
                    assert.closeTo(result[j], expected[j], 0.1, j);
            }
        };
    }

    for (var i = 0; i < tests.length; i++) {
        tr.addTest("Test " + i, make_test(tests[i]));
    }

    tr.run();
});
