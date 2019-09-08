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
                    
                    compressor: {
                        portable: {
                            filter: {
                                lifetime: 15,
                                a: 1.84879,
                                b: 1.124939,
                                c: 14.60044,
                                d: -0.3252651
                            }
                        },
                        fixed: {
                            filter: {
                                lifetime: 40,
                                a: 3.798205,
                                b: 1.149582,
                                c: 11.50844,
                                d: -0.4806983
                            },
                            pumping_rate: 300,
                            purge_freq: 5,
                            safe_limit: 25,
                            sensor_url: null,
                            poll_frequency: 0,
                            internal_temperature_alarm: 90
                        }
                    }
                },
                this.debug
            );

            this.roles = new Roles({
                config: this.config
            });

            this.compressors = {
                fixed: new Compressor({
                    id: "fixed",
                    roles: this.roles,
                    config: this.config
                }),
                portable: new Compressor({
                    id: "portable",
                    roles: this.roles,
                    config: this.config
                })
            };
            
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
                this.compressors.fixed.reload_ui(),
                this.compressors.portable.reload_ui(),
                this.loans.reload_ui(),
                this.inventory.reload_ui(loans)
            ])
            .then((res) => {
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

        initialise_ui() {
            let self = this;
            // Generics
            $(".spinner").spinner();
            $("button").button();
            $("input[type='checkbox']").checkboxradio();
            $('.ui-spinner-button').click(function () {
                $(this).siblings('input').change();
            });

            $.validator.setDefaults({ignore: ".novalidate"});

            $(".validated_form").each(function () {
                $(this).validate({
                    // Don't ignore selects that are hidden by jQuery plugins
                    ignore: ""
                });
            });

            // Add a validator that looks at the temperature and humidity
            // to determine if the values are within range for operating
            // this compressor
            jQuery.validator.addMethod(
                "compressor",
                (v, el, compressor) => {
                    let $form = $(el).closest("form");
                    return self.compressors[compressor].operable();
                },
                "Compressor must not be operated");

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
                    autoClose: 'close|60000',
                    buttons: {
                        close: function () {
                            let p;
                            if (this.$content.find("[name='cache_update']").is(":checked")) {
                                let $a = $.confirm({
                                    title: "Updating from the web",
                                    content: ""
                                });

                                p = self.update_from_web((clss, m) => {
                                    $a.setContentAppend(
                                        "<div class='" + clss + "'>" +
                                        m + "</div>");
                                });
                            } else
                                p = Promise.resolve();

                            p.then(() => {
                                return self.config.save();
                            })
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
                    /* onContentReady defined in Config.js */
                    moreOnContentReady: function () {
                        debugger;
                        this.$content.find("[data-with-info]")
                        .with_info();

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

                        // jconfirm knackers checkboxes, so have to do some
                        // fancy footwork
                        this.$content.find(".cache_updater")
                        .each(function() {
                            let $label =
                                $("<label>" + $(this).text() + "</label>");
                            let $b = $("<input type='checkbox' name='cache_update'>");
                            $label.append($b);
                            //$b.checkboxradio();
                            $(this).replaceWith($label);
                        })
                    }
                });
            });

            // Information buttons
            $("[data-with-info]").with_info();
  
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
