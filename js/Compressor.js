/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries */
/* global Compressor: true */

"use strict";

if (typeof Entries === "undefined")
    var Entries = require("./Entries");

/**
 * Entries for Compressor runtime events. This is a stack - the only
 * editing available is to delete the last entry. Standard params same as
 * Entries.
 * @param params.config Config object
 */
function Compressor(params) {
    Entries.call(this, {
        store: params.config.store,
        file: 'compressor.csv',
        keys: {
            date: "Date",
            operator: "string",
            temperature: "number",
            runtime: "number",
            filterlife: "number"
        }
    });
    this.cfg = params.config;
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
    var $rt = $form.find("input[name='runtime']");

    function onChange() {
        if ($form.length)
            $("#add_compressor_record").button(
                "option", "disabled", !$form.valid());
    }

    $form.on("submit", function (e) {
        e.preventDefault();
        return false;
    });

    $("#cr_last_run")
        .off("click")
        .on("click", function () {
            $.confirm({
                title: $("#infoLastRun").data("title"),
                content: $("#infoLastRun").html(),
                buttons: {
                    "Remove last run": () => {
                        self.pop().then((r) => {
                            if ($rt.length) {
                                $rt.rules("remove", "min");
                                $rt.rules("add", {
                                    min: (r ? r.runtime : 0) + 0.01
                                });
                            }
                            onChange();
                        });
                    },
                    "Don't remove": () => {}
                }
            });
        });

    $("#add_compressor_record")
        .off("click")
        .on("click", function () {
            console.log("Adding compressor record");
            if (!$form.valid())
                return;
            var values = {};
            $form.find(":input").each(function () {
                values[this.name] = self.deserialise(this.name, $(this).val());
                if (this.name === "filters_changed")
                    values[this.name] = (values[this.name] === "on");
            });
            self.add(values).then((r) => {
                if ($rt.length) {
                    $rt.rules("remove", "min");
                    $rt.rules("add", {
                        min: (r ? r.runtime : 0) + 0.01
                    });
                }
                onChange();
            });
        });

    return this.load()
        .then(() => {
            console.debug("Loading", this.length(), "compressor records");
            if (this.length() === 0)
                return;
            var cur = this.get(this.length() - 1);
            $("#cr_operator").text(cur.operator);
            $("#cr_time").text(Entries.formatDate(cur.date));
            $("#cr_flr").text(Math.round(
                    100 * this.cfg.get("filter_lifetime") * cur.filterlife) /
                100);
            $("#cr_runtime").text(cur.runtime);
            if ($rt.length) {
                $rt.rules("remove", "min");
                $rt.rules("add", {
                    min: cur.runtime + 0.01
                });
            }

            $form.find(":input").on("change", onChange);
            onChange();
        })
        .catch((e) => {
            console.error("Compressor load failed:", e);
        });
};

Compressor.prototype.add = function (r) {
    return this.load().then(() => {
        var fca = this.cfg.get("filter_coeff_a");
        var fcb = this.cfg.get("filter_coeff_b");
        var fcc = this.cfg.get("filter_coeff_c");
        var fcd = this.cfg.get("filter_coeff_d");
        var flr = 1,
            dt = 0;
        var avelife = this.cfg.get("filter_lifetime");
        if (this.length() > 0) {
            var le = this.get(this.length() - 1);
            dt = (r.runtime - le.runtime) / 60; // hours
            if (dt < 0)
                throw new Error("Bad runtime " + r.runtime + "<" + le.runtime); // debug
            flr = r.filters_changed ? 1 : le.filterlife;
            if (dt > 0) {
                // Calculate predicted filter lifetime at this temperature,
                // in hours
                var factor = fcd + (fca - fcd) /
                    (1 + Math.pow(r.temperature / fcc, fcb));
                var lifetime = avelife * factor;
                console.debug("Predicted lifetime at", r.temperature,
                    "degrees is", lifetime, "hours");

                // Fraction of filter change hours consumed
                flr -= dt / lifetime; // remaining filter life
            }
        }
        console.debug("Runtime of this event was", dt, "hours");
        console.debug("So new prediction of remaining lifetime is", flr);
        console.debug("Which would be roughly", flr * avelife, "hours");
        r.date = new Date();
        r.filterlife = flr;
        this.push(r);
        return this.save().then(() => {
            this.reload_ui().then(() => {
                return r;
            });
        });
    });
};

Compressor.prototype.pop = function () {
    return this.load().then(() => {
        this.entries.pop();
        return this.save().then(() => {
            this.reload_ui().then(() => {
                return this.get(this.length() - 1);
            });
        });
    });
};

if (module)
    module.exports = Compressor;