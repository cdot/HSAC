/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("app/js/Compressor", ["app/js/Entries", "jquery", "touch-punch"], (Entries) => {

    class Compressor extends Entries {

        /**
         * Entries for Compressor runtime events. This is a stack -
         * the only editing available is to delete the last
         * entry. Standard params same as Entries.
         * @param params.config Config object
         * @param params.id string identifier
         * @param params.debug debug method
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
            this.runtime = 0;
            this.$tab = $("#" + this.id);
            this.$form = this.$tab.children("form");
            this.$runtime = this.$form.find("input[name='runtime']");

            let self = this;
            this.$form.find("select.digital")
            .on("change", () => { this.readDigits(); });
        }

        setRuntime(v) {
            this.runtime = v;

            this.$runtime.val(v.toFixed(2));

            let delta = (this.length() > 0)
                ? v - this.get(this.length() - 1).runtime : 0;

            const $delta = this.$form.find(".cr_delta");
            if (delta > 0)
                $delta.show().text("This run: " + delta.toFixed(2) + " hours");
            else
                $delta.hide();
        }

        setRuntimeAndDigits(v) {
            this.setRuntime(v);
            this.$form.find("select.digital").each(function() {
                let dig = Math.floor(v / $(this).data("units"));
                $(this).val(dig % 10);
            });
        }

        readDigits() {
            let v = 0;
            this.$form.find("select.digital").each(function() {
                v += $(this).val() * $(this).data("units");
            });
            self.setRuntime(v);
        }

        /**
         * Set the rule for the minimum runtime
         */
        setMinRuntime(r) {
            if (this.$runtime.length === 0)
                return;
            if (this.$runtime.attr("type") === "hidden")
                return;

            this.$runtime.rules("remove", "min");
            this.$runtime.rules("add", {
                min: r + 0.009
            });
        }

        samplePower() {
            const url = this.cfg.get("sensor_url");

            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url + "/power",
                    data: {
                        t: Date.now() // defeat cache
                    },
                    dataType: "text"
                })
                .done((sample) => {
                    resolve(JSON.parse(sample));
                })
                .fail(() => {
                    resolve({sample: 0});
                });
            });
        }

        reload_ui() {
            const self = this;
            const $submit = this.$tab.find("button[name='add_record']");

            this.$form
            .find("input[name='filters_changed']")
            .on("change", function() {
                self.$form
                .find(".cr_filters_changed")
                .toggle($(this).is(":checked"));
            });

            function onChange() {
                if (self.$form.length)
                    $submit.button(
                        "option", "disabled", !self.$form.valid());
            }

            this.$form.on("submit", function (e) {
                e.preventDefault();
                return false;
            });

            this.$tab.find(".cr_last_run")
            .off("click")
            .on("click", function () {
                let content = $("#infoLastRun").html().replace("$1", () => {
                    return self.activityHTML(5);
                });
                $.confirm({
                    title: $("#infoLastRun").data("title"),
                    content: content,
                    buttons: {
                        "Remove last run": () => {
                            self.removeLastEntry().then((r) => {
                                self.setRuntimeAndDigits(r.runtime);
                                self.setMinRuntime(r.runtime);
                                onChange();
                            });
                        },
                        "Don't remove": () => {}
                    }
                });
            });

            const $session_play = this.$tab.find("button.session_play");
            const $session_pause = this.$tab.find("button.session_pause");
            const $session_time = this.$tab.find(".session_time");
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
                self.setRuntimeAndDigits(rta);
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
                self.$runtime.prop("readonly", "readonly");
            });

            $session_pause.click(function () {
                if (timer)
                    clearTimeout(timer);
                timer = null;
                tock();
                $(this).button("disable");
                $session_play.button("enable");
                self.$runtime.prop("readonly", null);
            });

            $submit
            .off("click")
            .on("click", function () {
                if (!self.$form.valid())
                    return;

                // Stop the counter
                $session_pause.trigger("click");

                const values = {};
                self.$form.find(":input").each(function () {
                    if (this.name in self.keys)
                        values[this.name] = self.deserialise(this.name, $(this).val());
                });
                self.$form.find(":input[type='checkbox']").each(function () {
                    if (this.name in self.keys)
                        values[this.name] = $(this).is(":checked");
                });

                if (self.debug) self.debug("Adding compressor record", values);
                self.add(values).then(() => {
                    this.session_time = 0;
                    $session_time.trigger("ticktock");
                    self.setRuntimeAndDigits(values.runtime);
                    self.setMinRuntime(values.runtime);
                    // Clear down the operator
                    self.$form.find("[name='operator']").val('');
                    onChange();
                });
            });

            /**
             * Restart the power sampling loop
             */
            if (this.powerInterval) {
                clearInterval(this.powerInterval);
                this.powerInterval = null;
            }

            // The counter works in 100ths of an hour, so
            // every unit on the second decimal is 36 seconds.
            // By sampling every 5s that should give us more
            // than enough sensitivity.
            console.log("Start power sampling");
            this.powerInterval = setInterval(() => {
                console.log("Sample power");
                this.samplePower()
                .then((sample) => {
                    console.log("Sample", sample.sample / (60 * 60 * 1000));
                    this.setRuntimeAndDigits(
                        self.runtime + sample.sample / (60 * 60 * 1000));
                })
                .catch((e) => {});
            }, 5000);
            
            return this.load()
            .then(() => {
                if (self.debug)
                    self.debug("Loading " + this.length() + " " + this.id +
                               " compressor records");
                if (this.length() === 0)
                    return;
                const cur = this.get(this.length() - 1);

                self.setRuntimeAndDigits(cur.runtime);
                self.setMinRuntime(cur.runtime);

                // Set the compressor record
                self.$tab.find(".cr_operator").text(cur.operator);
                self.$tab.find(".cr_time").text(Entries.formatDateTime(cur.date));
                self.$tab.find(".cr_flr").text(new Number(this.remaining_filter_life()).toFixed(2));
                self.$tab.find(".cr_runtime").text(cur.runtime);

                self.$form.find(":input").on("change", onChange);
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
            let cfg_pre = "compressor:" + this.id + ":filter:";
            let avelife = this.cfg.get(cfg_pre + "lifetime");
            if (this.length() === 0)
                return avelife;
            let fca = this.cfg.get(cfg_pre + "a");
            let fcb = this.cfg.get(cfg_pre + "b");
            let fcc = this.cfg.get(cfg_pre + "c");
            let fcd = this.cfg.get(cfg_pre + "d");
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
                    if (typeof Audio !== "undefined") {
                        let pick = Math.floor(Math.random() * 25);
                        let snd = new Audio("app/sounds/" + pick + ".mp3");
                        snd.play();
                    }
                    this.reload_ui().then(() => {
                        return r;
                    });
                });
            });
        }

        /**
         * Pop the last entry and return the new last entry
         */
        removeLastEntry() {
            return this.load().then(() => {
                this.entries.pop();
                return this.save().then(() => {
                    this.reload_ui().then(() => {
                        return this.get(this.length() - 1);
                    });
                });
            });
        }

        activityHTML(num_records) {
            let ents = this.getEntries();
            if (ents.length === 0)
                return "No activity";
                
            let heads = this.getHeads().filter((h) => h !== "filters_changed");

            let table = "<table><thead><tr><th>"
                + heads.join("</th><th>") + "</tr></thead><tbody>";

            for (let i = ents.length - num_records; i < ents.length; i++) {
                let e = ents[i];
                table += "<tr>";
                for (let h of heads) {
                    let d = e[h];
                    if (d instanceof Date)
                        d = d.toLocaleString();
                    table += "<td>" + d + "</td>";
                }
                table += "</tr>";
            }
            
            return table + "</tbody></table>";
        }

        /**
         * Determine if the compressor should be operated under given
         * conditions of temperature and humidity. See README.md for details.
         */
        validate(temperature, humidity) {
            // See https://www.conservationphysics.org/atmcalc/atmoclc2.pdf
            temperature = parseFloat(temperature);
            humidity=parseFloat(humidity);
            // Saturation vapour (partial) pressure
            let sat = 610.78 * Math.exp(17.2694 * temperature / (temperature + 238.3)); // pascals

            // Concentration at saturation
            let conc1 = 2.166 * sat / (temperature + 273.16); // g/m^3

            // Adjust for relative humidity
            let conc2 = conc1 * humidity / 100;

            // Subtract the acceptable upper limit for nitrox (0.02g/m^3)
            if (conc2 <= 0.02)
                return true; // very dry already
            let conc3 = conc2 - 0.02;

            let pumping_rate = this.cfg.get("compressor:" + this.id + ":pumping_rate"); // l/min
            let purge_freq = this.cfg.get("compressor:" + this.id + ":purge_freq"); // mins
            let air_per_purge = pumping_rate * purge_freq / 1000; // m^3

            // Volume of condensate expected to be generated during 1 purge period
            let ml = conc3 * air_per_purge; // g ~ ml

            let threshold = this.cfg.get("compressor:" + this.id + ":safe_limit"); // ml
            //console.debug(temperature, humidity, sat, conc1, conc2, ml, "<", threshold,"?");
            return ml <= threshold;
        }
    }
    return Compressor;
});
