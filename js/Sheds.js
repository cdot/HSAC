/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Shed management application. See README.md
 */

define("js/Sheds", ["js/Config", "js/WebDAVStore", "js/Entries", "js/Roles", "js/Compressor", "js/Loans", "js/Inventory", "js/Nitrox", "js-cookie", "jquery-validate", "jquery-confirm"], (Config, WebDAVStore, Entries, Roles, Compressor, Loans, Inventory, Nitrox, Cookies) => {
    
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
                    o2_price: 0.005,
                    portable_filter_lifetime: 15,
                    portable_filter_coeff_a: 1.84879,
                    portable_filter_coeff_b: 1.124939,
                    portable_filter_coeff_c: 14.60044,
                    portable_filter_coeff_d: -0.3252651,
                    portable_filter_sensor_id: null,
                    static_filter_lifetime: 40,
                    static_filter_coeff_a: 3.798205,
                    static_filter_coeff_b: 1.149582,
                    static_filter_coeff_c: 11.50844,
                    static_filter_coeff_d: -0.4806983,
                    static_filter_sensor_id: null
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
                this.restart_sampling();
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
         * Start/restart sampling from the sensor data file
         */
        restart_sampling() {
            let self = this;
        
            function sample() {
                const url = self.config.get("sensor_url");
                if (typeof url !== "string" || url.length === 0)
                    return;
                $.ajax({
                    url: url,
                    data: {
                        t: Date.now() // defeat cache
                    },
                    dataType: "text"
                })
                .then((list) => {
                    const rows = $.csv.toArrays(list);
                    // Get the most recent sample for each unique ID
                    self.samples = {};
                    for (let r of rows) {
                        self.samples[r[0]] = { time: r[1], sample: r[2] }
                    }
                    $("input[data-sampler]").each(function() {
                        let spec = $(this).data("sampler");
                        if (typeof spec.config !== "undefined")
                            spec.id = self.config.get(spec.config);
                        let sample = self.samples[spec.id];
                        let thresh = Date.now() - spec.max_age;
                        if (typeof sample === "undefined" || sample.time < thresh) {
                            $(this).prop("readonly", null);
                            $(this).removeClass("greyed_out");
                            $(spec.sampled).hide();
                            $(spec.unsampled).show();
                        } else {
                            $(this).val(sample.sample);
                            $(this).addClass("greyed_out");
                            $(this).closest(".validated_form").valid();
                            $(this).prop("readonly", "readonly");
                            $(spec.sampled).show();
                            $(spec.unsampled).hide();
                        }
                    });
                })
                .always(() => {
                    // Re-sample every 5 seconds
                    self.sampler = setTimeout(sample, 5000);
                });
            }
            
            if (typeof this.sampler !== "undefined")
                clearTimeout(this.sampler);
            
            sample();
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
