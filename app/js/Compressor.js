/*@preserve Copyright (C) 2018-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("app/js/Compressor", ["app/js/Entries", "jquery", "touch-punch"], (Entries) => {

	/**
     * Compressor runtime events page.
	 */
    class Compressor extends Entries {

        /**
		 * Standard params same as Entries.
         */
        constructor(params) {
            super($.extend(params, {
                file: `${params.id}_compressor.csv`,
                keys: {
                    date: "Date",
                    operator: "string",
                    temperature: "number",
                    humidity: "number",
                    runtime: "number",
                    filters_changed: "boolean"
                }
            }));
            this.session_time = 0;
            this.runtime = 0;
        }

		//@override
        attachHandlers() {
			this.$form = this.$tab.find(".validated_form");
			this.$runtime = this.$tab.find("input[name='runtime']");
			this.$submit = this.$tab.find("button[name='add_record']");
			this.$change = this.$tab.find("button[name='filters_changed']");

			// Controls for manual timer with portable compressor
			const $session_play = this.$tab.find("button.session_play");
			const $session_pause = this.$tab.find("button.session_pause");
			const $session_time = this.$tab.find(".session_time");
			let timer;
			this.session_time = 0; // ms
			let session_step_start;

			// Handler for a clock tick event
			$session_time.on("ticktock", () => {
				let seconds = Math.round(this.session_time / 1000);
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
				if (this.length() > 0)
					rta = this.get(this.length() - 1).runtime;
				// Convert to hours
				rta += this.session_time / 3600000;
				this._setRuntimeAndDigits(rta);
				this._formChanged();
			});

			const tock = () => {
				const now = Date.now();
				this.session_time += now - session_step_start;
				session_step_start = now;
				$session_time.trigger("ticktock");
			};

			const tick = () => {
				tock();
				const when = 1000 - (Date.now() % 1000);
				timer = setTimeout(tick, when);
			};

			$session_play.on("click", () => {
				session_step_start = Date.now();
				tick();
				$(this).button("disable");
				$session_pause.button("enable");
				this.$runtime.prop("readonly", "readonly");
			});

			$session_pause.click(() => {
				if (timer)
					clearTimeout(timer);
				timer = null;
				tock();
				$(this).button("disable");
				$session_play.button("enable");
				this.$runtime.prop("readonly", null);
			});

			// Digits runtime control changed?
			this.$form.find("select.digital")
			.on("change", () => { this._readDigits(); });

			// Handling form submission
			this.$form.find(":input")
			.on("change", () => this._formChanged());
			
			this.$form.on("submit", e => {
				e.preventDefault();
				return false;
			});

			const compressor = this;
			this.$tab.find(".cr_last_run")
			.off("click")
			.on("click", () => {
				let content = $("#infoLastRun").html().replace("$1", () => {
					return this._activityHTML(5);
				});
				$.confirm({
					title: $("#infoLastRun").data("title"),
					content: content,
					buttons: {
						"Remove last run": () => {
							compressor._removeLastEntry().then(r => {
								compressor._setRuntimeAndDigits(r.runtime);
								compressor._setMinRuntime(r.runtime);
								compressor._formChanged();
							});
						},
						"Don't remove": () => {}
					}
				});
			});

			this.$submit
			.off("click")
			.on("click", () => {
				if (!this.$form.valid())
					return;

				// Stop the counter
				$session_pause.trigger("click");

				const values = {};
				this.$form.find(":input").each((i, el) => {
					if (el.name in this.keys)
						values[el.name] = this.deserialise(
							el.name, $(el).val());
				});

				this.debug("Adding compressor record", values);
				this._add(values).then(() => {
					// Clear the timer
					this.session_time = 0;
					$session_time.trigger("ticktock");
					// Clear down the operator
					this.$form.find("[name='operator']").val('');
					// Make sure the form reflects where we are
					this._setRuntimeAndDigits(values.runtime);
					this._setMinRuntime(values.runtime);
					// Validate the form for the new values
					this._formChanged();
				});
			});

			this.$change
			.off("click")
			.on("click", () => {
				const values = {};
				this.$form.find(":input").each((i, el) => {
					if (el.name in this.keys)
						values[el.name] = this.deserialise(
							el.name, $(el).val());
				});
                values.filters_changed = true;
				this.debug("Adding filter changed record", values);
				this._add(values);
			});
        }

        /**
         * @private
         * One of the form fields has changed, validate the form and
         * update the submit button
         */
        _formChanged() {
            this.$submit.button(
                "option", "disabled", !this.$form.valid());
            this.$change.button(
                "option", "disabled", !this.$form.valid());
        }

        /**
         * @private
         * Set the runtime but not the digits display
         */
        _setRuntime(v) {
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
        _setRuntimeAndDigits(v) {
            this._setRuntime(v);
            this.$form.find("select.digital").each((i, el) => {
                let u = $(el).data("units");
                let dig = Math.floor(v / u);
                dig = (u === 0.01) ? Math.round(dig) : Math.floor(dig);
                $(el).val(dig % 10);
            });
        }

        /**
         * @private
         * On change to the digits display, read it and set the runtime
         */
        _readDigits() {
            let v = 0;
            this.$form.find("select.digital").each((i, el) => {
                v += $(el).val() * $(el).data("units");
            });
            this._setRuntime(v);
        }

        /**
         * @private
         * Set the rule for the minimum runtime
         */
        _setMinRuntime(r) {
            if (this.$runtime.length === 0)
                return;
            if (this.$runtime.attr("type") === "hidden")
                return;

            this.$runtime.rules("remove", "min");
            this.$runtime.rules("add", {
                min: r
            });
        }

        /**
         * @private
         * Use an AJAX request to retrieve the latest sample
         * for a sensor
         */
        _getSample(name) {
            const url = this.config.get("compressor:" + this.id + ":sensor_url");
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
			return this.loadFromStore()
            .then(() => {
                this.debug("\t", this.length(), this.id,
                           "compressor records");
                let lc = 0;
                for (let e of this.entries) {
                    if (e.filters_changed)
                        lc = e.date;
                }
                if (this.length() > 0) {
                    const cur = this.get(this.length() - 1);
                    this._setRuntimeAndDigits(cur.runtime);
                    this._setMinRuntime(cur.runtime);

                    // Set the compressor record
                    this.$tab.find(".cr_operator").text(cur.operator);
                    this.$tab.find(".cr_time").text(
                        Entries.formatDateTime(cur.date));
                    this.$tab.find(".cr_flr").text(
                        new Number(this._remainingFilterLife()).toFixed(2));
                    this.$tab.find(".cr_flc").text(lc.toLocaleDateString());
                    this.$tab.find(".cr_runtime").text(cur.runtime.toFixed(2));
                }

                // Restart the sensor loop
                this._readSensors();

                // Validate the form
                this._formChanged();
            })
            .catch((e) => {
                console.error(`${this.id} Compressor load failed`, e);
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
        _updateSampledField($el, sample) {
            let id = this.id + ":" + $el.data("sensor");
            let spec = $el.data("sample-config");

            if (!sample) {
                this.debug("Sample for", id, "unavailable");
            } else {
                let thresh = Date.now() - spec.max_age;
                if (sample.time < thresh) {
                    // Sample unavailable or too old
                    this.debug("Sample for", id, "too old");
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
        _readSensors() {

            // Clear any existing timeout
            if (this.sensor_tick)
                clearTimeout(this.sensor_tick);
            this.sensor_tick = null;

            let url = this.config.get("compressor:" + this.id + ":sensor_url");
            if (typeof url !== "string" || url.length === 0) {
                this.debug("No sensor URL set");
                return;
            }

            let promises = [
                // Promise to update runtime
                this._getSample("power")
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
                        this._setRuntimeAndDigits(
                            this.runtime + sample.sample / (60 * 60 * 1000));
                        this._formChanged();
                    }
                })
                .catch((e) => {})
            ];
            
            // Promise to update sampled fields
            $("input[data-compressor='" + this.id + "'][data-sensor]")
            .each((i, el) => {
                let $el = $(el);
                let name = $el.data("sensor");
                promises.push(
                    this._getSample(name)
                    .then((sample) => {
                        this._updateSampledField($el, sample);
                    })
                    .catch((e) => { this._updateSampledField($el, null); }));
            });

            // Promise to check alarm sensors
            $(".alarm[data-compressor='" + this.id + "'][data-sensor]")
            .each((i, el) => {
                let $el = $(el);
                if ($el.data("compressor") !== this.id)
                    return;
                let name = $el.data("sensor");
                promises.push(
                    this._getSample(name)
                    .then((sample) => {
                        sample = sample ? sample.sample : 0;
                        let $report = $("#report:" + this.id);
                        $report.html(Math.round(sample) + "&deg;C");
                        let alarm_temp = this.config.get(
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
                let timeout = this.config.get(
                    "compressor:" + this.id + ":poll_frequency");
                // If poll freq <= 0, don't poll again
                if (timeout > 0) {
                    // Queue the next poll
                    this.sensor_tick =
                    setTimeout(() => { this._readSensors(); }, timeout);
                }
            });
        }

        /**
		 * Recalcalculate the remaining filter life from the history
		 * @private
		 */
        _remainingFilterLife() {
            const details = false;
            let cfg_pre = "compressor:" + this.id + ":filter:";
            let avelife = this.config.get(cfg_pre + "lifetime");
            if (this.length() === 0)
                return avelife;
            let fca = this.config.get(cfg_pre + "a");
            let fcb = this.config.get(cfg_pre + "b");
            let fcc = this.config.get(cfg_pre + "c");
            let fcd = this.config.get(cfg_pre + "d");
            let flr = avelife;
            let runtime = 0;
            if (details)
                this.debug("Compute rfl from", this.length(), "records");
            for (let e of this.entries) {
                if (e.filters_changed) {
                    // Filters changed. Zero runtime (or filters
                    // changed after runtime) assumed.
                    flr = avelife;
                    if (details)
                        this.debug("Filters changed, lifetime = " + flr);
                } else {
                    let dt = (e.runtime - runtime); // hours
                    if (dt > 0) {
                        // Calculate predicted filter lifetime at this
                        // temperature, in hours
                        let factor = fcd + (fca - fcd) /
                            (1 + Math.pow(e.temperature / fcc, fcb));
                        let hours_at_T = avelife * factor;
                        if (details)
                            this.debug("Predicted lifetime at "
                                       + e.temperature +
                                       "°C is " + hours_at_T + " hours");
                        let used = avelife * dt / hours_at_T;
                        if (details)
                            this.debug("Run of " + dt + " hours used " + used
                                          + " hours of filter life");
                        // Fraction of filter change hours consumed
                        flr -= used; // remaining filter life
                        if (details)
                            this.debug("Remaining filter life " + flr
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
        _add(r) {
            if (typeof r.runtime === "undefined")
                r.runtime = 0;
            if (typeof r.filters_changed === "undefined")
                r.filters_changed = false;
            this.session_time = 0;

            // Reload entries in case they were asynchronously changed
            return this.loadFromStore().then(() => {
                r.date = new Date();
                this.push(r);
                this.debug("Runtime after this event was "
                           + r.runtime + " hours");
                this.debug("New prediction of remaining lifetime is "
                           + this._remainingFilterLife() + " hours");
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
                .then(() => this.reloadUI());
            });
        }

        /**
         * Pop the last entry and return the new last entry
		 * @private
         */
        _removeLastEntry() {
            return this.loadFromStore().then(() => {
                this.entries.pop();
                return this.save().then(() => this.reloadUI())
				.then(() => this.get(this.length() - 1));
            });
        }

		/**
		 * @private
		 */
        _activityHTML(num_records) {
            let ents = this.getEntries();
            if (ents.length === 0)
                return "No activity";
                
            let heads = this.getHeads().filter((h) => h !== "filters_changed");

            let table = "<table><thead><tr><th>"
                + heads.join("</th><th>") + "</tr></thead><tbody>";

            for (let i = ents.length - num_records; i < ents.length; i++) {
                let e = ents[i];
                table += "<tr>";
                if (e.filters_changed) {
                    table += "<td>" + e.date.toLocaleString() + "</td>";
                    table += "<td>" + e.operator + "</td>";
                    table += `<td colspan="${heads.length - 2}">`
                    + "FILTERS CHANGED" + "</td>";
                } else {
                    for (let h of heads) {
                        let d = e[h];
                        if (d instanceof Date)
                            d = d.toLocaleString();
                        table += "<td>" + d + "</td>";
                    }
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

            let pumping_rate = this.config.get(
                "compressor:" + this.id + ":pumping_rate"); // l/min
            let purge_freq = this.config.get(
                "compressor:" + this.id + ":purge_freq"); // mins
            let air_per_purge = pumping_rate * purge_freq / 1000; // m^3

            // Volume of condensate expected to be generated during 1
            // purge period
            let ml = conc3 * air_per_purge; // g ~ ml

            let threshold = this.config.get(
                "compressor:" + this.id + ":safe_limit"); // ml

            //console.debug(temperature, humidity, sat, conc1, conc2, ml, "<", threshold,"?");
            return ml <= threshold;
        }
    }
    return Compressor;
});
