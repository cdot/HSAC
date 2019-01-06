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
     * Update all UIs from webdav
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

        config.setup_UIs(reload_ui);
        $("#main_tabs").tabs();

        var $gear = $('#settings');
        $gear.on("click", function () {
            $("input[name='webdav_url']")
                .val(Cookies.get("webdav_url"))
                .off("change")
                .on("change", function (e) {
                    var nurl = $(e.target).val();
                    if (nurl != Cookies.get("webdav_url")) {
                        Cookies.set("webdav_url", nurl, {
                            expires: 365
                        });
                        $.alert({
                            title: "WebDAV url changed",
                            content: "Application will now be reloaded",
                            buttons: {
                                ok: function () {
                                    var loc = ("" + location).replace(/\?.*$/, "");
                                    location = loc + "?t=" + Date.now();
                                }
                            }
                        });
                    }
                });
            $("#Configuration_dialog").dialog("open");
        });

        // Information buttons
        $("[data-with-info]").each(function () {
            $(this).with_info();
        });

        $("#update_webdav").on("click", function () {
            var $a = $.confirm({
                title: "Updating from the web",
                content: ""
            });

            update_from_web((clss, m) => {
                $a.setContentAppend("<div class='" + clss + "'>" +
                    m + "</div>");
            });
        });

        $(document).on("reload_ui", function () {
            reload_ui().then(() => {
                $("#loading").hide();
                $("#loaded").show();
            });
        });

        $(document).trigger("reload_ui");
    }

    function promise_to_reconnect() {
        return new Promise((resolve) => {
            $(".connect_control")
                .each(function () {
                    var el = this;
                    $(el).val(Cookies.get(el.name));
                });
            $("#connect_failed_set")
                .on("click", function () {
                    $("#connect_failed_dialog").dialog("close");
                });
            $("#connect_failed_dialog").dialog({
                title: "Connect failed",
                autoOpen: true,
                modal: true,
                width: "100%",
                classes: {
                    'ui-dialog-titlebar-close': "hidden"
                },
                beforeClose: function () {
                    var $form = $("form[name='connect_failed_form']");
                    if (!$form.valid())
                        return false;
                    $form
                        .find("input")
                        .each(function () {
                            Cookies.set(this.name, $(this).val(), {
                                expires: 365
                            });
                        });
                    console.debug("Reconnecting to", Cookies.get("webdav_url"));
                    config.store
                        .connect({
                            url: Cookies.get("webdav_url")
                        })
                        .then(() => {
                            return config.save().then(() => {
                                resolve(dav_connect());
                            });
                        });
                }
            });
        });
    }

    function dav_connect() {
        console.debug("Connecting to", Cookies.get("webdav_url"));
        return config.store
            .connect({
                url: Cookies.get("webdav_url")
            })
            .then(() => {
                console.debug("WebDAV connected, loading config");
                return config.load();
            })
            .catch((e) => {
                console.debug("config load failed: " + e);
                return promise_to_reconnect();
            });

    }

    $(() => {
        dav_connect().then(initialise);
    });

})(jQuery);