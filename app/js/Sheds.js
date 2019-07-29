/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
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

        constructor() {
            this.debug = console.debug;
            
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
                    static_intake_temp_id: null,
                    static_intake_hum_id: null,
                    static_internal_temp_id: null
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
            .then(() => {
                setInterval(() => { this.read_sensors(); }, 2000);
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
         * Update a sampled input field
         */
        update_sampled($el) {
            // The data-sampler attribute specifies:
            // config: the config item that provides the sensor ID
            //         which uniquely identifies samples in the
            //         sample data file
            // max_age: maximum age for valid samples
            // sampled: element id for the element to be shown
            //          when a sample is found and deemed valid
            // unsampled: element id for the element to be shown
            //          when the sample is too old or is unavailable
                        
            let spec = $el.data("sampler");
            
            // Look up the config to get the sensor ID for this
            // input. This indirection is required because we don't
            // want to lock sensor id's into the HTML
            if (typeof spec.config !== "undefined")
                spec.id = this.config.get(spec.config);
                        
            let sample = this.samples[spec.id];
            let thresh = Date.now() - spec.max_age;
            if (typeof sample === "undefined" || sample.time < thresh) {
                // Sample unavailable or too old
                if (this.debug) this.debug("No sample for", spec.id, "or too old");
                $el.prop("readonly", null);
                $el.removeClass("greyed_out");
                $(spec.sampled).hide();
                $(spec.unsampled).show();
                return;
            }
            // sample available and young enough
            $el.prop("readonly", "readonly");
            $el.addClass("greyed_out");
            $el.val(sample.sample);
            $(spec.sampled).show();
            $(spec.unsampled).hide();
            // Switch off validation message
            $el.closest(".validated_form").valid();
        }

        /**
         * Update the sensor readings from the remote sensor URL
         */
        read_sensors() {
            const url = this.config.get("static_sensor_url");
            if (typeof url !== "string" || url.length === 0) {
                if (this.debug) this.debug("No sensor URL set");
                return;
            }
            
            let self = this;
            $.ajax({
                url: url,
                data: {
                    t: Date.now() // defeat cache
                },
                dataType: "text"
            })
            .done((list) => {
                // The CSV is structured as:
                // ID time sample
                // sample may be humidity or temperature depending on
                // sensor type
                const rows = $.csv.toArrays(list);
                // Get the most recent sample for each unique ID
                self.samples = {};
                for (let r of rows) {
                    let id = r[0];
                    let row = {
                        time: r[1], sample: r[2]
                    };
                    self.samples[id] = row;
                }
                // Have to update all sample fields, as we don't know
                // the right ID without redirecting through config
                $("input[data-sampler]").each(function() {
                    self.update_sampled($(this));
                });
            })
            .fail((e) => {
                if (this.debug) this.debug("Could not get samples:", e);
            });
        }
        
        initialise_ui() {
            let self = this;
            // Generics
            $("button").button();
            $(".spinner").spinner();
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
                if (e == 401) {
                    // XMLHttpRequest will only prompt for credentials if
                    // the request is for the same origin with no explicit
                    // credentials. So we have to handle credentials.
                    if (self.debug) self.debug("Auth failure, get auth");
                    return self.promise_to_authenticate(url);
                }
                return self.promise_to_reconnect(url);
            });

        }

        begin() {
            let url = Cookies.get("cache_url")
            this.initialise_ui();
            if (typeof url === "undefined" || url.length == 0)
                this.promise_to_reconnect();
            else
                this.cache_connect(url);
        }
    }

    return Sheds;
});
