/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries */
/* global Compressor: true */

"use strict";

/**
 * Entries for Compressor runtime events. This is a stack - the only
 * editing available is to delete the last entry.
 */
function Compressor(store, roles) {
    this.entries = undefined;

    Entries.call(this, store, "compressor", [
        "date",
        "operator",
        "humidity",
        "temperature",
        "runtime",
        "filterlife"
    ], {
        date: "Date",
        humidity: "Number",
        temperature: "Number",
        runtime: "Number",
        filterlife: "Number"
    });
    this.roles = roles;
}

Compressor.prototype = Object.create(Entries.prototype);
Compressor.prototype.constructor = Compressor;

/**
   The 2001 manual predicts filter life to be 50 hours at 20C and
   provides a table of factors from which a lifetime can be
   calculated:
   T (C), Factor, Lifetime
   0,  3.8, 190
   5,  2.6, 130
   10, 1.85, 92.5
   20, 1, 50
   30, 0.57, 28.5
   40, 0.34, 17
   50, 0.2, 10
   It also states the pumping rate is 260lpm.
   
   Let's assume the older manual is correct, as there are reasons
   to assume the newer one is unreliable. We want a curve that
   will predict the filter lifetime in hours, based on the
   temperature. Using a symmetric sigmoidal curve fit,
   
   y = d + (a - d) / (1 + (x / c) ^ b)
   
   https://mycurvefit.com gives us an excellent fit.
*/
Compressor.filter_coeff = {
    a: 189.9102,
    b: 1.149582,
    c: 11.50844,
    d: -24.03492
};

Compressor.prototype.reload_ui = function () {
    return this.load()
        .then(() => {
            console.debug("Loading", this.entries.length, "compressor records");
            if (this.entries.length === 0)
                return;
            // predict filter life remaining at current temperature
            var cur = this.entries[this.entries.length - 1];
            $("#cr_operator").text(cur.operator);
            $("#cr_time").text(Entries.formatDate(cur.date));
            $("#cr_flr").text(Math.round(cur.filterlife * 100));
            $("#cr_runtime").text(cur.runtime);
            $("input[name='runtime']")
                .rules("remove", "min");
            $("input[name='runtime']")
                .rules("add", {
                    min: cur.runtime
                });
        })
        .catch((e) => {
            console.error("Compressor load failed:", e);
        });
};

Compressor.prototype.add = function (r) {
    this.load().then(() => {
        var flr = 1,
            dt = 0;
        if (this.entries.length > 0) {
            var le = this.entries[this.entries.length - 1];
            flr = le.filterlife;
            dt = (r.runtime - le.runtime) / 60; // hours

            if (dt < 0)
                throw "Bad runtime";

            // Predicted filter lifetime at this temperature
            var lifetime = Compressor.filter_coeff.d +
                (Compressor.filter_coeff.a - Compressor.filter_coeff.d) /
                (1 + Math.pow(
                    le.temperature / Compressor.filter_coeff.c,
                    Compressor.filter_coeff.b));
            // Fraction of filter change hours consumed
            var fraction = dt / lifetime;
            flr -= fraction; // remaining filter life
            console.debug(
                "Old filter life was", flr, ", runtime was", dt, "hours.",
                "Predicted lifetime at", le.temperature,
                "is", lifetime, "or", fraction, "of a filter, so",
                "new prediction is", flr);
        }
        r.date = new Date();
        r.filterlife = flr;
        Entries.prototype.add.call(this, r);
    });
};