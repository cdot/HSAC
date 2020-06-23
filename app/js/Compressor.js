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

            this.init_ui();
        }

        init_ui() {
            let self = this;

            this.$tab = $("#" + this.id);
            this.$form = this.$tab.children("form");
            this.$runtime = this.$form.find("input[name='runtime']");
            this.$submit = this.$tab.find("button[name='add_record']");

            // Controls for manual timer with portable compressor
            const $session_play = this.$tab.find("button.session_play");
            const $session_pause = this.$tab.find("button.session_pause");
            const $session_time = this.$tab.find(".session_time");
            let timer;
            this.session_time = 0; // ms
            let session_step_start;

            // Handler for a clock tick event
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
                self.formChanged();
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
                timer = setTimeout(tick, when);
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

            // Digits runtime control changed?
            this.$form.find("select.digital")
            .on("change", () => { this.readDigits(); });

            // Handling form submission
            this.$form
            .find("input[name='filters_changed']")
            .on("change", function() {
                self.$tab
                .find(".cr_filters_changed")
                .toggle($(this).is(":checked"));
            });

            this.$form.find(":input")
            .on("change", () => { self.formChanged() });
            
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
                                self.formChanged();
                            });
                        },
                        "Don't remove": () => {}
                    }
                });
            });

            this.$submit
            .off("click")
            .on("click", function () {
                if (!self.$form.valid())
                    return;

                // Stop the counter
                $session_pause.trigger("click");

                const values = {};
                self.$form.find(":input").each(function () {
                    if (this.name in self.keys)
                        values[this.name] = self.deserialise(
                            this.name, $(this).val());
                });

                self.$form.find(":input[type='checkbox']").each(function () {
                    if (this.name in self.keys)
                        values[this.name] = $(this).is(":checked");
                });

                if (self.debug) self.debug("Adding compressor record", values);
                self.add(values).then(() => {
                    // Clear the timer
                    this.session_time = 0;
                    $session_time.trigger("ticktock");
                    // Clear down the operator
                    self.$form.find("[name='operator']").val('');
                    // Make sure the form reflects where we are
                    self.setRuntimeAndDigits(values.runtime);
                    self.setMinRuntime(values.runtime);
                    // Validate the form for the new values
                    self.formChanged();
                });
            });
        }

        /**
         * @private
         * One of the form fields has changed, validate the form and
         * update the submit button
         */
        formChanged() {
            this.$submit.button(
                "option", "disabled", !this.$form.valid());
        }


        /**
         * @private
         * Set the runtime but not the digits display
         */
        setRuntime(v) {
            this.runtime = v;

            this.$runtime.val(v);

            let delta = (this.length() > 0)
                ? v - this.get(this.length() - 1).runtime : 0;

            const $delta = this.$tab.find(".cr_delta");
            if (delta > 0) {
                let hours = Math.floor(delta);
                delta = (delta - hours) * 60; // minutes
                let mins = Math.floor(delta);
                let secs = ((delta - mins) * 60).toFixed(2); // seconds
                $delta.show().text(
                    + ("0" + hours).slice(-2)
                    + ":" + ("0" + mins).slice(-2)
                    + ":" + ("0" + secs).slice(-5));
            } else
                $delta.hide();
        }

        /**
         * @private
         * Set the runtime and also the digits display
         */
        setRuntimeAndDigits(v) {
            this.setRuntime(v);
            this.$form.find("select.digital").each(function() {
                let u = $(this).data("units");
                let dig = Math.floor(v / u);
                dig = (u === 0.01) ? Math.round(dig) : Math.floor(dig);
                $(this).val(dig % 10);
            });
        }

        /**
         * @private
         * On change to the digits display, read it and set the runtime
         */
        readDigits() {
            let v = 0;
            this.$form.find("select.digital").each(function() {
                v += $(this).val() * $(this).data("units");
            });
            this.setRuntime(v);
        }

        /**
         * @private
         * Set the rule for the minimum runtime
         */
        setMinRuntime(r) {
            if (this.$runtime.length === 0)
                return;
            if (this.$runtime.attr("type") === "hidden")
                return;

            this.$runtime.rules("remove", "min");
            this.$runtime.rules("add", {
                min: r + 1 / (60 * 60) // 1 second
            });
        }

        /**
         * @private
         * Use an AJAX request to retrieve the latest sample
         * for a sensor
         */
        getSample(name) {
            const url = this.cfg.get("compressor:" + this.id + ":sensor_url");
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url + "/" + name,
                    data: {
                        t: Date.now() // defeat cache
                    },
                    dataType: "text"
                })
                .done((sample) => {
                    resolve(JSON.parse(sample));
                })
                .fail(() => {
                    resolve(null);
                });
            });
        }

        reload_ui() {
            const self = this;

            return this.load()
            .then(() => {
                if (self.debug)
                    self.debug("Loading " + this.length() + " " + this.id +
                               " compressor records");
                if (this.length() > 0) {
					const cur = this.get(this.length() - 1);

					self.setRuntimeAndDigits(cur.runtime);
					self.setMinRuntime(cur.runtime);

					// Set the compressor record
					self.$tab.find(".cr_operator").text(cur.operator);
					self.$tab.find(".cr_time").text(
						Entries.formatDateTime(cur.date));
					self.$tab.find(".cr_flr").text(
						new Number(this.remainingFilterLife()).toFixed(2));
					self.$tab.find(".cr_runtime").text(cur.runtime);
				}

                // Restart the sensor loop
                this.readSensors();

                // Validate the form
                this.formChanged();
            })
            .catch((e) => {
                console.error("Compressor load failed: " + e, e);
            });
        }

        /**
         * @private
         * Update a sampled input field. These fields are identified
         * by data-sensor="id" where id is the identifier for the sensor
         * to be sampled, and data-compressor is the compressor.
         * data-sample-config further has:
         *     max_age: maximum age for valid samples.
         *     sampled: element id for the element to be shown
         *              when a sample is found and deemed valid.
         *     unsampled: element id for the element to be shown
         *                when the sample is too old or no sample
         *                can be retrieved.
         */
        updateSampledField($el, sample) {
            let id = this.id + ":" + $el.data("sensor");
            let spec = $el.data("sample-config");

            if (!sample) {
                if (this.debug) this.debug("Sample for", id, "unavailable");
            } else {
                let thresh = Date.now() - spec.max_age;
                if (sample.time < thresh) {
                    // Sample unavailable or too old
                    if (this.debug) this.debug("Sample for", id, "too old");
                    sample = null;
                }
            }
            if (!sample) {
                $el.prop("readonly", null);
                $(spec.sampled).hide();
                $(spec.dubious).hide();
                $(spec.unsampled).show();
            } else if (sample.dubious) {
                $el.prop("readonly", null);
                $(spec.sampled).hide();
				$(spec.dubious).text(sample.dubious);
                $(spec.dubious).show();
                $(spec.unsampled).show();
			} else {
                // sample available, trustworthy, and young enough
                $el.prop("readonly", "readonly");
                $el.val(Math.round(sample.sample));
                $(spec.sampled).show();
                $(spec.dubious).hide();
                $(spec.unsampled).hide();
            }

            // Update validation message
            $el.closest(".validated_form").valid();
        }

        /**
         * @private
         * Update the sensor readings from the remote sensor URL
         */
        readSensors() {
            let self = this;

            // Clear any existing timeout
            if (this.sensor_tick)
                clearTimeout(this.sensor_tick);
            this.sensor_tick = null;

            let url = this.cfg.get("compressor:" + this.id + ":sensor_url");
            if (typeof url !== "string" || url.length === 0) {
                if (this.debug) this.debug("No sensor URL set");
                return;
            }

            let promises = [
                // Promise to update runtime
                this.getSample("power")
                .then((sample) => {
                    if (sample.sample > 0) {
                        // Check that we are within operable limits, if
                        // not raise an alarm
                        if (!this.operable()) {
                            let $report = $("#report:" + this.id);
                            $report.addClass("error");
                            if (typeof Audio !== "undefined") {
                                var snd = new Audio("app/sounds/alarm.mp3");
                                snd.play();
                            }
                        }
                        this.setRuntimeAndDigits(
                            this.runtime + sample.sample / (60 * 60 * 1000));
                        this.formChanged();
                    }
                })
                .catch((e) => {})
            ];
            
            // Promise to update sampled fields
            $("input[data-compressor='" + this.id + "'][data-sensor]")
            .each(function() {
                let $el = $(this);
                let name = $el.data("sensor");
                promises.push(
                    self.getSample(name)
                    .then((sample) => {
                        self.updateSampledField($el, sample);
                    })
                    .catch((e) => { self.updateSampledField($el, null); }));
            });

            // Promise to check alarm sensors
            $(".alarm[data-compressor='" + this.id + "'][data-sensor]")
            .each(function() {
                let $el = $(this);
                if ($el.data("compressor") !== this.id)
                    return;
                let name = $el.data("sensor");
                promises.push(
                    self.getSample(name)
                    .then((sample) => {
                        sample = sample ? sample.sample : 0;
                        let $report = $("#report:" + this.id);
                        $report.html(Math.round(sample) + "&deg;C");
                        let alarm_temp = self.cfg.get(
                            "compressor: " + this.id + ":" + name + "_alarm");
                        if (sample >= alarm_temp) {
                            $report.addClass("error");
                            $el.show();
                            if (typeof Audio !== "undefined") {
                                var snd = new Audio("app/sounds/siren.mp3");
                                snd.play();
                            }
                        } else {
                            $report.removeClass("error");
                            $el.hide();
                        }
                    }));
            });

            // Check all sensors
            Promise.all(promises)
            .finally(() => {
                let timeout = self.cfg.get(
                    "compressor:" + this.id + ":poll_frequency");
                // If poll freq <= 0, don't poll again
                if (timeout > 0) {
                    // Queue the next poll
                    this.sensor_tick =
                    setTimeout(() => { self.readSensors(); }, timeout);
                }
            });
        }

        // Recalcalculate the remaining filter life from the history
        remainingFilterLife() {
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
                    // Filters changed. Zero runtime (or filters
                    // changed after runtime) assumed.
                    flr = avelife;
                    if (details && self.debug)
                        self.debug("Filters changed, lifetime = " + flr);
                } else {
                    let dt = (e.runtime - runtime); // hours
                    if (dt > 0) {
                        // Calculate predicted filter lifetime at this
                        // temperature, in hours
                        let factor = fcd + (fca - fcd) /
                            (1 + Math.pow(e.temperature / fcc, fcb));
                        let hours_at_T = avelife * factor;
                        if (details && self.debug)
                            self.debug("Predicted lifetime at "
                                       + e.temperature +
                                       "°C is " + hours_at_T + " hours");
                        let used = avelife * dt / hours_at_T;
                        if (details && self.debug)
                            self.debug("Run of " + dt + " hours used " + used
                                          + " hours of filter life");
                        // Fraction of filter change hours consumed
                        flr -= used; // remaining filter life
                        if (details && self.debug)
                            self.debug("Remaining filter life " + flr
                                       + " hours");
                    }
                }
                runtime = e.runtime;
            }
            return flr;
        }

        /**
         * @private
         * Add a new compressor record
         */
        add(r) {
            let self = this;
            if (typeof r.runtime === "undefined")
                r.runtime = 0;
            if (typeof r.filters_changed === "undefined")
                r.filters_changed = false;
            this.session_time = 0;

            // Reload entries in case they were asynchronously changed
            return this.load().then(() => {
                r.date = new Date();
                this.push(r);
                if (self.debug) {
                    self.debug("Runtime after this event was "
                               + r.runtime + " hours");
                    self.debug("New prediction of remaining lifetime is "
                               + this.remainingFilterLife() + " hours");
                }
                return this.save().then(() => {
                    if (typeof Audio !== "undefined") {
                        let pick = Math.floor(Math.random() * 25);
                        try {
                            let snd = new Audio("app/sounds/" + pick + ".mp3");
                            snd.play();
                        } catch (e) {
                        }
                    }
                })
                .then(() => {
                    return this.reload_ui();
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
        operable() {
            // See https://www.conservationphysics.org/atmcalc/atmoclc2.pdf

            let temperature = parseFloat(this.$form.find("input[name='temperature']").val());
            let humidity = parseFloat(this.$form.find("input[name='humidity']").val());
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

            let pumping_rate = this.cfg.get(
                "compressor:" + this.id + ":pumping_rate"); // l/min
            let purge_freq = this.cfg.get(
                "compressor:" + this.id + ":purge_freq"); // mins
            let air_per_purge = pumping_rate * purge_freq / 1000; // m^3

            // Volume of condensate expected to be generated during 1
            // purge period
            let ml = conc3 * air_per_purge; // g ~ ml

            let threshold = this.cfg.get(
                "compressor:" + this.id + ":safe_limit"); // ml

            //console.debug(temperature, humidity, sat, conc1, conc2, ml, "<", threshold,"?");
            return ml <= threshold;
        }
    }
    return Compressor;
});
