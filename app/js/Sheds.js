/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Shed management application. See README.md
 */

define("app/js/Sheds", ["app/js/Config", "app/js/WebDAVStore", "app/js/Entries", "app/js/Roles", "app/js/Compressor", "app/js/Loans", "app/js/Inventory", "app/js/Nitrox", "js-cookie", "jquery-validate", "jquery-confirm"], (Config, WebDAVStore, Entries, Roles, Compressor, Loans, Inventory, Nitrox, Cookies) => {

    /**
     * Update time displays
     */
    function tick() {
        let now = new Date();
        $(".time_display").text(now.toLocaleDateString() +
                                " " + now.toLocaleTimeString());
        $(".date_display").text(now.toLocaleDateString());
        let when = 1000 - (Date.now() % 1000);
        window.setTimeout(tick, when);
    }

    class Sheds {

        constructor(params) {
            if (params.debug) {
                if (params.console) {
                    // Simulated console in #loading
                    this.debug = function() {
                        console.debug.apply(console, arguments);
                        $("#loading").append(
                            "<br />" + Array.from(arguments).join(" "));
                    };
                    this.consoleActive = true;
                } else
                    this.debug = console.debug;
            }

            // Possible override of cache_url, otherwise use whatever
            // is cookied in the browser
            if (params.cache_url) {
                Cookies.set("cache_url", params.cache_url, {
                    expires: 365
                });
            }

            // Configuration defaults
            this.config = new Config(
                new WebDAVStore(this.debug),
                {
                    ppO2max: 1.4,
                    loan_return: 10,
                    o2_price: 0.01,
                    portable_filter_lifetime: 15,
                    portable_filter_coeff_a: 1.84879,
                    portable_filter_coeff_b: 1.124939,
                    portable_filter_coeff_c: 14.60044,
                    portable_filter_coeff_d: -0.3252651,
                    static_filter_lifetime: 40,
                    static_filter_coeff_a: 3.798205,
                    static_filter_coeff_b: 1.149582,
                    static_filter_coeff_c: 11.50844,
                    static_filter_coeff_d: -0.4806983,
                    sensor_url: null,
                    poll_frequency: 15000,
                    internal_temperature_alarm: 90,
                },
                this.debug
            );

            this.roles = new Roles({
                config: this.config
            });

            this.static_compressor = new Compressor({
                id: "static",
                roles: this.roles,
                config: this.config
            });
            this.portable_compressor = new Compressor({
                id: "portable",
                roles: this.roles,
                config: this.config
            });
            this.loans = new Loans({
                roles: this.roles,
                config: this.config
            });
            this.inventory = new Inventory({
                config: this.config,
                loans: this.loans
            });
            this.nitrox = new Nitrox(this.config);
        }

        /**
         * Update all UIs from the cache
         */
        reload_ui() {
            if (this.debug) this.debug("Reloading UI");
            return Promise
            .all([
                this.static_compressor.reload_ui(),
                this.portable_compressor.reload_ui(),
                this.loans.reload_ui(),
                this.inventory.reload_ui(loans)
            ])
            .then((res) => {
                this.read_sensors();
                $("#main_tabs").tabs("option", "disabled", []);
                return this.roles.reload_ui();
            });
        }

        update_from_web(report) {
            let self = this;
            if (!this.config.get("db_index_url")) {
                $.alert({
                    title: "Cannot update from web",
                    content: "No DB index URL set"
                });
                return;
            }
            if (self.debug) self.debug("Updating WebDAV from read-only database");
            let index = new Entries({
                url: this.config.get("db_index_url"),
                keys: {
                    sheet: "string",
                    url: "string"
                }
            });
            return index.load()
            .then(() => {
                return Promise
                .all([
                    index.find("sheet", "roles")
                    .then((row) => {
                        return self.roles.update_from_web(row.url, report)
                    }),
                    index.find("sheet", "inventory")
                    .then((row) => {
                        return self.inventory.update_from_web(row.url, report);
                    })
                ]);
            })
            .then(() => {
                report("info", "Update from the web finished");
                $(document).trigger("reload_ui");
            })
            .catch((e) => {
                $.alert({
                    title: "Web update failed",
                    content: e
                });
            });
        }

        /**
         * Update the sensor readings from the remote sensor URL
         */
        read_sensors() {
            let self = this;
            
            /**
             * Update a sampled input field
             */
            function update_sample(id, sample) {
                let $el = $("input[data-samples='" + id + "']");

                // data-sample-config further has:
                // max_age: maximum age for valid samples
                // sampled: element id for the element to be shown
                //          when a sample is found and deemed valid
                // unsampled: element id for the element to be shown
                //          when the sample is too old or is unavailable
                let spec = $el.data("sample-config");

                if (!sample) {
                    if (self.debug) self.debug("Sample for", id, "unavailable");
                } else {
                    let thresh = Date.now() - spec.max_age;
                    if (sample.time < thresh) {
                        // Sample unavailable or too old
                        if (self.debug) self.debug("Sample for", id, "too old");
                        sample = null;
                    }
                }

                if (!sample) {
                    $el.prop("readonly", null);
                    $(spec.sampled).hide();
                    $(spec.unsampled).show();
                } else {
                    // sample available and young enough
                    $el.prop("readonly", "readonly");
                    $el.val(Math.round(sample.sample));
                    $(spec.sampled).show();
                    $(spec.unsampled).hide();
                }
                // Update validation message
                $el.closest(".validated_form").valid();
            }

            function get_sample(sensor) {
                return new Promise((resolve, reject) => {
                    $.ajax({
                        url: url + "/" + sensor,
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
            
            if (this.sensor_tick)
                clearTimeout(this.sensor_tick);
            this.sensor_tick = null;
            const url = this.config.get("sensor_url");
            if (typeof url !== "string" || url.length === 0) {
                if (this.debug) this.debug("No sensor URL set");
                return;
            }

            let promises = [];
            
            $("input[data-samples]").each(function() {
                let name = $(this).data("samples");
                promises.push(
                    get_sample(name)
                    .then((sample) => { update_sample(name, sample); })
                    .catch((e) => { update_sample(name, null); }));
            });

            // Check alarm sensors
            $(".alarm[data-samples]").each(function() {
                let $el = $(this);
                let name = $el.data("samples");
                promises.push(
                    get_sample(name)
                    .then((sample) => {
                        sample = sample ? sample.sample : 0;
                        let $report = $(".report_" + name);
                        $report.html(Math.round(sample) + "&deg;C");
                        let alarm_temp = self.config.get(name + "_alarm");
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

            Promise.all(promises)
            .finally(() => {
                // Queue the next poll for 15s hence
                this.sensor_tick =
                setTimeout(() => { self.read_sensors(); },
                           parseInt(self.config.get("poll_frequency")));
            });
        }

        initialise_ui() {
            let self = this;
            // Generics
            $(".spinner").spinner();
            $("button").button();
            $("input[type='checkbox']").checkboxradio();
            $('.ui-spinner-button').click(function () {
                $(this).siblings('input').change();
            });

            $(".validated_form").each(function () {
                $(this).validate({
                    // Don't ignore selects that are hidden by jQuery plugins
                    ignore: ""
                });
            });

            $("input").on("keypress", function (e) {
                if (e.charCode == 13 && /Android/.test(navigator.userAgent)) {
                    e.preventDefault();
                    $(this).blur();
                }
            });

            // Start the clock
            tick();

            $("#main_tabs").tabs();

            let $gear = $('#settings');
            $gear.on("click", function () {
                self.config.open({
                    buttons: {
                        "Update cache from web": function () {
                            let $a = $.confirm({
                                title: "Updating from the web",
                                content: ""
                            });

                            self.config.save()
                            .then(() => {
                                return self.update_from_web((clss, m) => {
                                    $a.setContentAppend(
                                        "<div class='" + clss + "'>" +
                                        m + "</div>");
                                });
                            })
                            .then(() => { self.reload_ui(); });
                        },
                        close: function () {
                            self.config.save()
                            .then(() => { self.reload_ui(); });
                        }
                    },
                    validity: function (ok) {
                        $.each(this.buttons, function (i, m) {
                            if (ok)
                                m.enable();
                            else
                                m.disable();
                        });
                    },
                    moreOnContentReady: function () {
                        this.$content.find("[data-info]").each(function () {
                            $(this).with_info($(this).data("info"));
                        });
                        this.$content.find("input[name='cache_url']")
                        .val(Cookies.get("cache_url"))
                        .off("change")
                        .on("change", function (e) {
                            let nurl = $(e.target).val();
                            if (nurl != Cookies.get("cache_url")) {
                                Cookies.set("cache_url", nurl, {
                                    expires: 365
                                });
                                $.alert({
                                    title: "Store cache URL changed",
                                    content: "Application will now be reloaded",
                                    buttons: {
                                        ok: function () {
                                            let loc = String(location).replace(/\?.*$/, "");
                                            location = loc + "?t=" + Date.now();
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            });

            // Information buttons
            $("[data-with-info]").each(function () {
                $(this).with_info();
            });

            $(".slider").each(function() {
                let $self = $(this);
                let data = $self.data("slider");
                data.animate = true;
                if (data.friend) {
                    data.slide = (e, ui) => {
                        $(data.friend).val(ui.value);
                    };
                }
                $(this).slider(data);
                if (data.friend) {
                    $self.slider("value", $(data.friend).val());
                }
            });

            $(document).on("reload_ui", function () {
                self.reload_ui().then(() => {
                    if (!self.consoleActive)
                        $("#loading").hide();
                    $("#loaded").show();
                });
            });
        }

        promise_to_reconnect(url) {
            let self = this;
            return new Promise((resolve) => {
                $.confirm({
                    title: $("#connect_failed_dialog").prop("title"),
                    content: $("#connect_failed_dialog").html(),
                    onContentReady: function () {
                        let jc = this;
                        jc.$content
                        .find("input")
                        .on("change", function () {
                            jc.$$try_again.trigger("click");
                        })
                        .val(url ? url : "");
                        jc.$content.find(".url").text(url);
                        jc.buttons.try_again.setText("Try again");
                        jc.buttons.continue_without.setText("Continue without cache");
                    },
                    buttons: {
                        try_again: function () {
                            let nurl = this.$content.find("input").val();
                            if (self.debug) self.debug("Trying again with", nurl);
                            resolve(self.cache_connect(nurl));
                        },
                        continue_without:  function () {
                            if (self.debug)
                                self.debug("Continuing without cache");

                            $(document).trigger("reload_ui");
                            resolve();
                        }
                    }
                });
            });
        }

        promise_to_authenticate(url) {
            let self = this;
            return new Promise((resolve) => {
                $.confirm({
                    title: $("#auth_required").prop("title"),
                    content: $("#auth_required").html(),
                    onContentReady: function () {
                        let self = this;
                        this.$content.find(".url").text(url);
                        this.$content.find("input[name='pass']").on("change", function () {
                            self.$$login.trigger("click");
                        });
                    },
                    buttons: {
                        login: function () {
                            let user = this.$content.find("input[name='user']").val();
                            let pass = this.$content.find("input[name='pass']").val();
                            self.config.store.setCredentials(user, pass);
                            resolve(self.cache_connect(url));
                        }
                    }
                });
            });
        }

        cache_connect(url) {
            let self = this;
            if (self.debug) self.debug("Trying to connect to", url);
            return this.config.store
            .connect(url)
            .then(() => {
                if (self.debug) self.debug(url, "connected, loading config");
                return self.config.load()
                .then(() => {
                    Cookies.set("cache_url", url, {
                        expires: 365
                    });

                    $(document).trigger("reload_ui");
                })
                .catch((e) => {
                    if (self.debug) self.debug("config.json load failed:", e,
                                  "Trying to save a draft");
                    return self.config.save()
                    .then(() => {
                        return self.cache_connect(url);
                    })
                    .catch((e) => {
                        if (self.debug) self.debug("Bootstrap failed:", e);
                        $.alert({
                            title: "Bootstrap failed",
                            content: "Could not write config.json"
                        });
                        return self.promise_to_reconnect();
                    });
                });
            })
            .catch((e) => {
                if (self.debug) self.debug(url, "connect failed", e);
                if (e.status === 401) {
                    // XMLHttpRequest will only prompt for credentials if
                    // the request is for the same origin with no explicit
                    // credentials. So we have to handle credentials.
                    if (self.debug) self.debug("Auth failure, get auth");
                    return self.promise_to_authenticate(url);
                }
                //return self.promise_to_reconnect(url);
                // Trying to repeatedly connect doesn't provide any
                // useful feedback. Rejecting at least gives a chance
                // to feeback.
                if (e.html)
                    $("#loading").html(e.html);
                return Promise.reject("Could not connect to " + url);
            });

        }

        begin(params) {
            this.initialise_ui();

            let promise;
            let url = Cookies.get("cache_url");
            if (typeof url === "undefined" || url.length == 0)
                promise = this.promise_to_reconnect();
            else
                promise = this.cache_connect(url);

            promise
            .then(() => {
                // Can't do this without an interaction first
                // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play 
                /* if (typeof Audio !== "undefined") {
                    let snd = new Audio("app/sounds/forecast.wav");
                    return snd.play();
                } */
            })
            .catch((e) => {
                console.error("Internal failure", e, url);
            });
        }
    }

    return Sheds;
});
