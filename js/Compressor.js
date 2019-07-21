/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Compressor", ["js/Entries", "jquery", "touch-punch"], (Entries) => {

    class Compressor extends Entries {
        
        /**
         * Entries for Compressor runtime events. This is a stack - the only
         * editing available is to delete the last entry. Standard params same as
         * Entries.
         * @param params.config Config object
         */
        constructor(params) {
            super({
                store: params.config.store,
                file: params.id + '_compressor.csv',
                keys: {
                    date: "Date",
                    operator: "string",
                    temperature: "number",
                    humidity: "number",
                    runtime: "number",
                    filters_changed: "boolean"
                }
            });
            this.id = params.id;
            this.cfg = params.config;
            this.debug = this.cfg.debug;
            this.session_time = 0;
        }

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

        reload_ui() {
            const self = this;
            const $tab = $("#" + this.id);
            const $form = $tab.children("form");
            const $submit = $tab.find("button[name='add_record']");
            const $rta = $form.find("input[name='runtime']");
            
            const $delta = $form.find(".cr_delta");
            const $digits = {};
            
            for (let d of [ 1000, 100, 10, 1, 0.1, 0.01 ]) {
                $digits[d] = $form.find("select[name='runtime" + d + "']");
                $digits[d].on("change", get_digits);
            }
            
            $form.find("input[name='filters_changed']").on("change", function() {
                $form.find(".cr_filters_changed").toggle($(this).is(":checked"));
            });
            
            function get_digits() {
                let v = 0;
                for (let d of [ 1000, 100, 10, 1, 0.1, 0.01 ]) {
                    v += $digits[d].val() * d;
                }
                set_runtime(v, true);
            }
            
            function set_runtime(v, nodigs) {
                $rta.val(v.toFixed(2));
                let delta = (self.length() > 0)
                    ? v - self.get(self.length() - 1).runtime : 0;
                
                if (delta > 0)
                    $delta.show().text("This run: " + delta.toFixed(2) + " hours");
                else
                    $delta.hide();
                
                if (!nodigs) {
                    for (let d of [ 1000, 100, 10, 1, 0.1, 0.01 ]) {
                        let dig = Math.floor(v / d);
                        $digits[d].val(dig);
                        v -= dig * d;
                    }
                }
            }
            
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
            this.session_time = 0; // ms
            let session_step_start;

            // Handler for a clock time event
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
                // Convert to hours
                rta += self.session_time / 3600000;
                set_runtime(rta);
                $(this).closest(".validated_form").valid();
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
                $rta.prop("readonly", "readonly");
            });

            $session_pause.click(function () {
                if (timer)
                    clearTimeout(timer);
                timer = null;
                tock();
                $(this).button("disable");
                $session_play.button("enable");
                $rta.prop("readonly", null);
            });

            $submit
            .off("click")
            .on("click", function () {
                if (!$form.valid())
                    return;

                // Stop the counter
                $session_pause.trigger("click");

                const values = {};
                $form.find(":input").each(function () {
                    if (this.name in self.keys)
                        values[this.name] = self.deserialise(this.name, $(this).val());
                });
                $form.find(":input[type='checkbox']").each(function () {
                    if (this.name in self.keys)
                        values[this.name] = $(this).is(":checked");
                });

                if (self.debug) self.debug("Adding compressor record", values);
                self.add(values).then((r) => {
                    this.session_time = 0;
                    $session_time.trigger("ticktock");
                    if ($rta.length && $rta.attr("type") !== "hidden") {
                        // Reset the runtime lower constraint to be more
                        // than the just-recorded runtime
                        $rta.rules("remove", "min");
                        $rta.rules("add", {
                            min: (r ? r.runtime : 0) + 0.01
                        });
                    }
                    $form.find("[name='operator']").val('');
                    onChange();
                });
            });

            return this.load()
            .then(() => {
                if (self.debug) self.debug("Loading " + this.length() + " " + this.id +
                              " compressor records");
                if (this.length() === 0)
                    return;
                const cur = this.get(this.length() - 1);
                set_runtime(cur.runtime);
                $tab.find(".cr_operator").text(cur.operator);
                $tab.find(".cr_time").text(Entries.formatDate(cur.date));
                $tab.find(".cr_flr").text(new Number(this.remaining_filter_life()).toFixed(2));
                $tab.find(".cr_runtime").text(cur.runtime);
                if ($rta.length && $rta.attr("type") !== "hidden") {
                    $rta.rules("remove", "min");
                    $rta.rules("add", {
                        min: cur.runtime + 0.009
                    });
                }
                
                $form.find(":input").on("change", onChange);
                onChange();
            })
            .catch((e) => {
                console.error("Compressor load failed: " + e, e);
            });
        }

        // Recalcalculate the remaining filter life from the history
        remaining_filter_life() {
            let self = this;
            const details = false;
            let avelife = this.cfg.get(this.id + "_filter_lifetime");
            if (this.length() === 0)
                return avelife;
            let fca = this.cfg.get(this.id + "_filter_coeff_a");
            let fcb = this.cfg.get(this.id + "_filter_coeff_b");
            let fcc = this.cfg.get(this.id + "_filter_coeff_c");
            let fcd = this.cfg.get(this.id + "_filter_coeff_d");
            let flr = avelife;
            let runtime = 0;
            if (details && self.debug)
                self.debug("Compute rfl from", this.length(), "records");
            for (let e of this.entries) {
                if (e.filters_changed) {
                    // Filters changed. Zero runtime (or filters changed after runtime)
                    // assumed.
                    flr = avelife;
                    if (details && self.debug)
                        self.debug("Filters changed, lifetime = " + flr);
                } else {
                    let dt = (e.runtime - runtime); // hours
                    if (dt > 0) {
                        // Calculate predicted filter lifetime at this temperature,
                        // in hours
                        let factor = fcd + (fca - fcd) /
                            (1 + Math.pow(e.temperature / fcc, fcb));
                        let hours_at_T = avelife * factor;
                        if (details && self.debug)
                            self.debug("Predicted lifetime at " + e.temperature +
                                          "°C is " + hours_at_T + " hours");
                        let used = avelife * dt / hours_at_T;
                        if (details && self.debug)
                            self.debug("Run of " + dt + " hours used " + used
                                          + " hours of filter life");
                        // Fraction of filter change hours consumed
                        flr -= used; // remaining filter life
                        if (details && self.debug)
                            self.debug("Remaining filter life " + flr + " hours");
                    }
                }
                runtime = e.runtime;
            }
            return flr;
        }

        add(r) {
            let self = this;
            if (typeof r.runtime === "undefined")
                r.runtime = 0;
            if (typeof r.filters_changed === "undefined")
                r.filters_changed = false;
            this.session_time = 0;

            return this.load().then(() => {
                r.date = new Date();
                this.push(r);
                if (self.debug) {
                    self.debug("Runtime after this event was " + r.runtime + " hours");
                    self.debug("New prediction of remaining lifetime is "
                               + this.remaining_filter_life() + " hours");
                }
                return this.save().then(() => {
                    this.reload_ui().then(() => {
                        return r;
                    });
                });
            });
        }

        pop() {
            return this.load().then(() => {
                this.entries.pop();
                return this.save().then(() => {
                    this.reload_ui().then(() => {
                        return this.get(this.length() - 1);
                    });
                });
            });
        }
    }
    return Compressor;
});
