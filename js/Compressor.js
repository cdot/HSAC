/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery,node */
/* global Entries :true */

"use strict";

if (typeof Entries === "undefined")
    Entries = require('./Entries');

/**
 * Entries for Compressor runtime events. This is a stack - the only
 * editing available is to delete the last entry. Standard params same as
 * Entries.
 * @param params.config Config object
 */
function Compressor(params) {
    const id = params.id;
    Entries.call(this, {
        store: params.config.store,
        file: id + '_compressor.csv',
        keys: {
            date: "Date",
            operator: "string",
            temperature: "number",
            runtime: "number",
            filterlife: "number"
        }
    });
    this.cfg = params.config;
    this.id = id;
    this.session_time = 0;
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
    const self = this;
    const $tab = $("#" + this.id);
    const $form = $tab.children("form");
    const $submit = $tab.find("button[name='add_record']");
    const $rta = $form.find("input[name='runtime']");

    function onChange() {
        if ($form.length)
            $submit.button(
                "option", "disabled", !$form.valid());
    }

    $form.on("submit", function (e) {
        e.preventDefault();
        return false;
    });

    $tab.find(".cr_last_run")
        .off("click")
        .on("click", function () {
            $.confirm({
                title: $("#infoLastRun").data("title"),
                content: $("#infoLastRun").html(),
                buttons: {
                    "Remove last run": () => {
                        self.pop().then((r) => {
                            if ($rta.length && $rta.attr("type") !== "hidden") {
                                $rta.rules("remove", "min");
                                $rta.rules("add", {
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

    const $session_play = $tab.find("button.session_play");
    const $session_pause = $tab.find("button.session_pause");
    const $session_time = $tab.find(".session_time");
    let timer;
    this.session_time = 0;
    let session_step_start;

    $session_time.on("ticktock", function () {
        let seconds = Math.round(self.session_time / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        const hours = Math.floor(minutes / 60);
        minutes -= hours * 60;

        let times = (minutes < 10 ? "0" : "") + minutes +
            ":" + (seconds < 10 ? "0" : "") + seconds;
        if (hours > 0)
            times = (hours < 10 ? "0" : "") + hours + ":" + times;
        $session_time.text(times);
        let rta = 0;
        if (self.length() > 0)
            rta = self.get(self.length() - 1).runtime;
        // Convert to minutes
        rta += self.session_time / (60 * 1000);
        $rta.val(rta.toFixed(2));
    });

    function tock() {
        const now = Date.now();
        self.session_time += now - session_step_start;
        session_step_start = now;
        $session_time.trigger("ticktock");
    }

    function tick() {
        tock();
        const when = 1000 - (Date.now() % 1000);
        timer = window.setTimeout(tick, when);
    }

    $session_play.on("click", function () {
        session_step_start = Date.now();
        tick();
        $(this).button("disable");
        $session_pause.button("enable");
        $rta.prop("disabled", true);
    });

    $session_pause.click(function () {
        if (timer)
            clearTimeout(timer);
        timer = null;
        tock();
        $(this).button("disable");
        $session_play.button("enable");
        $rta.prop("disabled", false);
    });

    $submit
        .off("click")
        .on("click", function () {
            if (!$form.valid())
                return;
            // Stop the counter
            $session_pause.trigger("click");
            console.log("Adding compressor record");
            const values = {};
            $form.find(":input").each(function () {
                values[this.name] = self.deserialise(this.name, $(this).val());
                if (this.name === "filters_changed")
                    values[this.name] = (values[this.name] === "on");
            });
            self.add(values).then((r) => {
                this.session_time = 0;
                $session_time.trigger("ticktock");
                if ($rta.length && $rta.attr("type") !== "hidden") {
                    $rta.rules("remove", "min");
                    $rta.rules("add", {
                        min: (r ? r.runtime : 0) + 0.01
                    });
                }
                onChange();
            });
        });

    return this.load()
        .then(() => {
            console.debug("Loading " + this.length() + " " + this.id +
                " compressor records");
            if (this.length() === 0)
                return;
            const cur = this.get(this.length() - 1);
            $rta.val(cur.runtime.toFixed(2));
            $tab.find(".cr_operator").text(cur.operator);
            $tab.find(".cr_time").text(Entries.formatDate(cur.date));
            $tab.find(".cr_flr").text(Math.round(
                    100 * this.cfg.get(this.id + "_filter_lifetime") * cur.filterlife) /
                100);
            $tab.find(".cr_runtime").text(cur.runtime);
            if ($rta.length && $rta.attr("type") !== "hidden") {
                $rta.rules("remove", "min");
                $rta.rules("add", {
                    min: cur.runtime + 0.01
                });
            }

            $form.find(":input").on("change", onChange);
            onChange();
        })
        .catch((e) => {
            console.error("Compressor load failed: " + e);
        });
};

Compressor.prototype.add = function (r) {
    if (typeof r.runtime === "undefined")
        r.runtime = 0;
    this.session_time = 0;

    return this.load().then(() => {
        const fca = this.cfg.get(this.id + "_filter_coeff_a");
        const fcb = this.cfg.get(this.id + "_filter_coeff_b");
        const fcc = this.cfg.get(this.id + "_filter_coeff_c");
        const fcd = this.cfg.get(this.id + "_filter_coeff_d");
        let flr = 1,
            dt = 0;
        const avelife = this.cfg.get(this.id + "_filter_lifetime");
        if (this.length() > 0) {
            const le = this.get(this.length() - 1);
            dt = (r.runtime - le.runtime) / 60; // hours
            if (dt < 0)
                throw new Error("Bad runtime " + r.runtime + "<" + le.runtime); // debug
            flr = r.filters_changed ? 1 : le.filterlife;
            if (dt > 0) {
                // Calculate predicted filter lifetime at this temperature,
                // in hours
                const factor = fcd + (fca - fcd) /
                    (1 + Math.pow(r.temperature / fcc, fcb));
                const lifetime = avelife * factor;
                console.debug("Predicted lifetime at " + r.temperature +
                    "degrees is" + lifetime + "hours");

                // Fraction of filter change hours consumed
                flr -= dt / lifetime; // remaining filter life
            }
        }
        console.debug("Runtime of this event was " + dt + " hours");
        console.debug("So new prediction of remaining lifetime is " + flr);
        console.debug("Which would be roughly " + (flr * avelife) + " hours");
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

if (typeof module !== "undefined")
    module.exports = Compressor;
