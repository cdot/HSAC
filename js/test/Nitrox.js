/*eslint-env node, mocha */
const assert = require("chai").assert;
var Nitrox = require("../Nitrox.js");

var tests = [
    // T   V   %    P  t%   tP  bV   bP =>  iO2    rO2   eO2        nO2   bTL       bUL      bLb, bleed_02
    [ 15, 12, 21,  50, 32, 232, 49, 200, {
        add_ideal_O2_bar: 32.30, add_real_O2_bar: 33.45, O2_needed_litres: 275.38, bank_left_bar: 194.38,
        status: Nitrox.MIX_ACHIEVABLE } ],
    [ 40, 12, 28,  50, 32, 232, 49,  90, {
        add_ideal_O2_bar: 27.87, add_real_O2_bar: 28.5, O2_needed_litres: 174.04, bank_left_bar: 86.45,
        status: Nitrox.MIX_ACHIEVABLE } ],
    [ 38, 24, 32,  30, 28, 230, 47,  60, {
        add_ideal_O2_bar: 16.20, add_real_O2_bar: 16.42, O2_needed_litres: 163.73, bank_left_bar: 56.52,
        status: Nitrox.MIX_ACHIEVABLE } ],
    // Error: too much O2 already in cylinder. How much to bleed by?
    [ 38, 24, 32, 200, 28, 230, 47,  60,  { bleed: 146.36, status: Nitrox.TOO_MUCH_O2 } ],
    // Error: mix achievable, but not enough O2 in bank
    [ 38, 24, 21, 50, 28, 230, 4,  60,  {
        status: Nitrox.BANK_LACKS_O2, O2_needed_litres: 245.43, bank_useable_litres: -41.52 } ],
    // Error: mix achievable, but too much pressure already in cylinder. How much to bleed by?
    [ 38, 24, 21, 40, 28, 230, 4,  60,  {
        status: Nitrox.BANK_LACKS_O2, O2_needed_litres: 295.83, bank_useable_litres: -1.52 } ],    
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
        var result = test[8];
        var top_up = Nitrox.blend(conditions);
        for (var j in result) {
            if (result[j] != null)
                assert.closeTo(top_up[j], result[j], 0.1, j);
        }
    };
}

describe("Nitrox tests", function() {
    for (var i = 0; i < tests.length; i++) {
        it("Test " + i, make_test(tests[i]));
    }
});
