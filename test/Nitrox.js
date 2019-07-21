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

    let tests = [
        {    name: "simple 1",
             cylinder_size: 12,
             start_mix: 26,  start_pressure: 30,
             target_mix: 32, target_pressure: 232,
             O2_bank_size: 49,  O2_bank_pressure: 90,
             expected: { boostTo: 61, use: 367 } },
        {    name: "simple 2",
             cylinder_size:  7,
             start_mix:  21,  start_pressure: 50,
             target_mix: 32, target_pressure: 232,
             O2_bank_size: 49, O2_bank_pressure: 200,
             expected: { boostTo: 83, use: 227 } },
        {    name: "simple 3",
             cylinder_size: 12,
             start_mix: 28,  start_pressure: 50,
             target_mix: 32, target_pressure: 232,
             O2_bank_size: 47,  O2_bank_pressure: 90,
             expected: { boostTo: 79, use: 336 } },
        // Too much O2 already in cylinder
        {    name: "too much O2",
             cylinder_size: 10,
             start_mix: 32, start_pressure: 200,
             target_mix: 28, target_pressure: 230,
             O2_bank_size: 47,  O2_bank_pressure: 210,
             expected: { bleedTo: 147 } },
        // Mix achievable, but not enough O2 in bank
        {    name: "not enough in bank",
             cylinder_size: 24,
             start_mix: 21, start_pressure: 50,
             target_mix: 28, target_pressure: 230,
             O2_bank_size: 4,  O2_bank_pressure: 60,
             expected: { bleedTo: 42 } },
        // Mix achievable, but too much pressure already in cylinder.
        {    name: "too much pressure",
             cylinder_size: 24,
             start_mix: 21, start_pressure: 40,
             target_mix: 32, target_pressure: 230,
             O2_bank_size: 40,  O2_bank_pressure: 30,
             expected: { bleedTo: 30 } },
    ];

    for (let test of tests) {
        tr.addTest(test.name, function() {
            let n = new Nitrox({
                debug: console.debug
            });
            let result = n.blend(test);
            console.log(result);
            for (let j in test.expected) {
                assert.isNotNull(result[j]);
                assert.closeTo(result[j], test.expected[j], 1, j);
            }
        });
    }

    tr.run();
});
