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
    const config = new Config({
        ppO2max: 1.4,
        loan_return: 10,
        o2_price: 0.02,
        filter_lifetime: 40,
        filter_coeff_a: 3.798205,
        filter_coeff_b: 1.149582,
        filter_coeff_c: 11.50844,
        filter_coeff_d: -0.4806983
    });

    const roles = new Roles({
        config: config
    });
    const compressor = new Compressor({
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
                compressor.reload_ui(),
                loans.reload_ui(),
                inventory.reload_ui(loans)
            ])
            .then(() => {
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

    function initialise() {
        // Generics
        $("button").button();
        $(".spinner").spinner();
        $(".spinner").spinner();
        $("input[type='checkbox']").checkboxradio();
        $('.ui-spinner-button').click(function () {
            $(this).siblings('input').change();
        });
        $(".validated_form").validate({
            // Don't ignore selects that are hidden by jQuery plugins
            ignore: ""
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

        $(document).trigger("reload_ui");
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
                        console.debug("Trying again with", nurl);
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
                    this.$content.find(".url").text(url);
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
        if (url === "undefined")
            url = "";
        console.debug("Trying to connect to", url);
        return config.store
            .connect(url)
            .then(() => {
                console.debug(url, "connected, loading config");
                return config.load()
                    .then(() => {
                        return url;
                    })
                    .catch((e) => {
                        console.debug("config.json load failed:", e,
                            "Trying to save a draft");
                        return config.save()
                            .then(() => {
                                return cache_connect(url);
                            })
                            .catch((e) => {
                                console.debug("Bootstrap failed", e);
                                $.alert({
                                    title: "Bootstrap failed",
                                    content: "Could not write config.json"
                                });
                            });
                    });
            })
            .catch((e) => {
                console.debug(url, "connect failed:", e);
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
        cache_connect(Cookies.get("cache_url")).then((url) => {
            Cookies.set("cache_url", url, {
                expires: 365
            });
            initialise();
        });
    });

})(jQuery);