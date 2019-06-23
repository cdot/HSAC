/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Shed management application. See README.md
 */

/* eslint-env jquery */
/* global Cookies */
/* global Entries */
/* global Config */
/* global Nitrox */
/* global Compressor */
/* global Loans */
/* global Inventory */
/* global Roles */
/* global WebDAVStore */

(($) => {
    /**
     * Update time displays
     */
    function tick() {
        var now = new Date();
        $(".time_display").text(now.toLocaleDateString() +
            " " + now.toLocaleTimeString());
        $(".date_display").text(now.toLocaleDateString());
        var when = 1000 - (Date.now() % 1000);
        window.setTimeout(tick, when);
    }

    // Configuration defaults
    const config = new Config(
        new WebDAVStore(), {
            ppO2max: 1.4,
            loan_return: 10,
            o2_price: 0.02,
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
        });

    const roles = new Roles({
        config: config
    });
    const static_compressor = new Compressor({
        id: "static",
        roles: roles,
        config: config
    });
    const portable_compressor = new Compressor({
        id: "portable",
        roles: roles,
        config: config
    });
    const loans = new Loans({
        roles: roles,
        config: config
    });
    const inventory = new Inventory({
        config: config,
        loans: loans
    });
    const nitrox = new Nitrox(config);

    /**
     * Update all UIs from the cache
     */
    function reload_ui() {
        console.debug("Reloading UI");
        return Promise
            .all([
                static_compressor.reload_ui(),
                portable_compressor.reload_ui(),
                loans.reload_ui(),
                inventory.reload_ui(loans)
            ])
            .then(() => {
                restart_sampling();
                $("#main_tabs").tabs("option", "disabled", []);
                return roles.reload_ui();
            });
    }

    function update_from_web(report) {
        if (!config.get("db_index_url")) {
            $.alert({
                title: "Cannot update from web",
                content: "No DB index URL set"
            });
            return;
        }
        console.debug("Updating WebDAV from read-only database");
        var index = new Entries({
            url: config.get("db_index_url"),
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
                            return roles.update_from_web(row.url, report)
                        }),
                        index.find("sheet", "inventory")
                            .then((row) => {
                            return inventory.update_from_web(row.url, report);
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
    function restart_sampling() {
        const self = this;
        
        function sample() {
            const url = config.get("sensor_url");
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
                this.samples = {};
                for (let r of rows) {
                    this.samples[r[0]] = { time: r[1], sample: r[2] }
                }
                $("input[data-sampler]").each(function() {
                    let spec = $(this).data("sampler");
                    if (typeof spec.config !== "undefined")
                        spec.id = config.get(spec.config);
                    let sample = self.samples[spec.id];
                    let thresh = Date.now() - spec.max_age;
                    if (typeof sample === "undefined" || sample.time < thresh) {
                        $(this).prop("readonly", null);
                        $(this).removeClass("greyed_out");
                        $(spec.disabled).hide();
                    } else {
                        $(this).val(sample.sample);
                        $(this).addClass("greyed_out");
                        $(this).closest(".validated_form").valid();
                        $(this).prop("readonly", "readonly");
                        $(spec.disabled).show();
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
    
    function initialise_ui() {
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

        var $gear = $('#settings');
        $gear.on("click", function () {
            config.open_dialog({
                buttons: {
                    "Update cache from web": function () {
                        var $a = $.confirm({
                            title: "Updating from the web",
                            content: ""
                        });

                        config.save()
                            .then(() => {
                                return update_from_web((clss, m) => {
                                    $a.setContentAppend(
                                        "<div class='" + clss + "'>" +
                                        m + "</div>");
                                });
                            })
                            .then(reload_ui);
                    },
                    close: function () {
                        config.save().then(reload_ui);
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
                            var nurl = $(e.target).val();
                            if (nurl != Cookies.get("cache_url")) {
                                Cookies.set("cache_url", nurl, {
                                    expires: 365
                                });
                                $.alert({
                                    title: "Store cache URL changed",
                                    content: "Application will now be reloaded",
                                    buttons: {
                                        ok: function () {
                                            var loc = String(location).replace(/\?.*$/, "");
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

        $(document).on("reload_ui", function () {
            reload_ui().then(() => {
                $("#loading").hide();
                $("#loaded").show();
            });
        });
    }

    var cache_connect;

    function promise_to_reconnect(url) {
        return new Promise((resolve) => {
            $.confirm({
                title: $("#connect_failed_dialog").prop("title"),
                content: $("#connect_failed_dialog").html(),
                onContentReady: function () {
                    var jc = this;
                    jc.$content
                        .find("input")
                        .on("change", function () {
                            jc.$$try_again.trigger("click");
                        })
                        .val(url ? url : "");
                    jc.$content.find(".url").text(url);
                    jc.buttons.try_again.setText("Try again");
                },
                buttons: {
                    try_again: function () {
                        var nurl = this.$content.find("input").val();
                        console.debug("Trying again with " + nurl);
                        resolve(cache_connect(nurl));
                    }
                }
            });
        });
    }

    function promise_to_authenticate(url) {
        return new Promise((resolve) => {
            $.confirm({
                title: $("#auth_required").prop("title"),
                content: $("#auth_required").html(),
                onContentReady: function () {
                    var self = this;
                    this.$content.find(".url").text(url);
                    this.$content.find("input[name='pass']").on("change", function () {
                        self.$$login.trigger("click");
                    });
                },
                buttons: {
                    "login": function () {
                        var user = this.$content.find("input[name='user']").val();
                        var pass = this.$content.find("input[name='pass']").val();
                        config.store.setCredentials(user, pass);
                        resolve(cache_connect(url));
                    }
                }
            });
        });
    }

    cache_connect = function (url) {
        console.debug("Trying to connect to " + url);
        return config.store
            .connect(url)
            .then(() => {
                console.debug(url + " connected, loading config");
                return config.load()
                .then(() => {
                    Cookies.set("cache_url", url, {
                        expires: 365
                    });
                    $(document).trigger("reload_ui");
                })
                .catch((e) => {
                    console.debug("config.json load failed: " + e +
                                  "; Trying to save a draft");
                    return config.save()
                    .then(() => {
                        return cache_connect(url);
                    })
                    .catch((e) => {
                        console.debug("Bootstrap failed: " + e);
                        $.alert({
                            title: "Bootstrap failed",
                            content: "Could not write config.json"
                        });
                        return promise_to_reconnect();
                    });
                });
            })
        .catch((e) => {
            console.debug(url + " connect failed: " + e);
            if (e == 401) {
                // XMLHttpRequest will only prompt for credentials if
                // the request is for the same origin with no explicit
                // credentials. So we have to handle credentials.
                return promise_to_authenticate(url);
            }
            return promise_to_reconnect(url);
        });

    };

    $(() => {
        var url = Cookies.get("cache_url")
        initialise_ui();
        if (typeof url === "undefined" || url.length == 0)
            promise_to_reconnect();
        else
            cache_connect(url);
    });

})(jQuery);
