/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries */
/* global Compressor: true */

"use strict";

/**
 * Entries for Compressor runtime events. This is a stack - the only
 * editing available is to delete the last entry. Standard params same as
 * Entries.
 * @param roles Roles object
 */
function Compressor(params) {
    Entries.call(this, $.extend({
        name: "compressor",
        keys: {
            date: "Date",
            operator: "string",
            temperature: "number",
            runtime: "number",
            filterlife: "number"
        }
    }, params));
    this.roles = params.roles;
}

Compressor.prototype = Object.create(Entries.prototype);
Compressor.prototype.constructor = Compressor;

/**
 * The manual predicts filter life to be 50 hours at 20C and provides
 * a table of factors from which a lifetime can be
 * calculated:
 * T (C), Factor
 * 0, 3.8
 * 5, 2.6
 * 10, 1.85
 * 20, 1
 * 30, 0.57
 * 40, 0.34
 * 50, 0.2
 * It also states the pumping rate is 260lpm.
   
 * We want a curve that will give the filter factor, based on the
 * temperature. Using a symmetric sigmoidal curve fit,
 *    
 *    y = d + (a - d) / (1 + (x / c) ^ b)
 *    
 * https://mycurvefit.com gives us an excellent fit.
*/

Compressor.prototype.reload_ui = function () {
    var self = this;
    var $form = $("form[name='compressor']");

    $form
        .on("submit", (e) => {
            console.log("Adding compressor record");
            e.preventDefault();
            if (!$(e.target).valid())
                return;
            var values = {};
            $(e.target).find(":input").each(function () {
                values[this.name] = self.deserialise(this.name, $(this).val());
            });
            this.add(values);
        });

    return this.load()
        .then(() => {
            console.debug("Loading", this.entries.length, "compressor records");
            if (this.entries.length === 0)
                return;
            var cur = this.entries[this.entries.length - 1];
            $("#cr_operator").text(cur.operator);
            $("#cr_time").text(Entries.formatDate(cur.date));
            $("#cr_flr").text(Math.round(
                    100 * this.cfg.get("filter_lifetime") * cur.filterlife) /
                100);
            $("#cr_runtime").text(cur.runtime);
            $form.find("input[name='runtime']")
                .rules("remove", "min");
            $form.find("input[name='runtime']")
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
        var fca = this.config.get("filter_coeff_a");
        var fcb = this.config.get("filter_coeff_b");
        var fcc = this.config.get("filter_coeff_c");
        var fcd = this.config.get("filter_coeff_d");
        var flr = 1,
            dt = 0;
        if (this.entries.length > 0) {
            var le = this.entries[this.entries.length - 1];
            if (r.filters_changed !== "on")
                flr = le.filterlife;
            dt = (r.runtime - le.runtime) / 60; // hours
            if (dt < 0)
                throw "Bad runtime"; // debug

            // Calculate predicted filter lifetime at this temperature,
            // in hours
            var factor = fcd + (fca - fcd) /
                (1 + Math.pow(le.temperature / fcc, fcb));
            var lifetime = this.cfg.get("filter_lifetime") * factor;

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
        this.entries.push(r);
        this.save().then(() => {
            this.reload_ui();
        });
    });
};