/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Shed management application. See README.md
 */

/* eslint-env jquery */
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

    const config = new Config({
        loan_return: "webdav",
        o2_price: "webdav"
    });

    const roles = new Roles(config);
    const compressor = new Compressor(config, roles);
    const loans = new Loans(config, roles);
    const inventory = new Inventory(config);
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

    function update_from_drive(report) {
        Promise
            .all([
                roles.update_from_drive(report),
                inventory.update_from_drive(report)
            ])
            .then(() => {
                return reload_ui()
                    .then(() => {
                        report("info", "Update finished");
                    });
            });
    }

    function initialise() {
        // Generics
        $("button").button();
        $(".spinner").spinner();
        $("select").selectmenu();
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

        $("#settings").on("click", function () {
            $("#Configuration_dialog").dialog("open");
        });

        // Submit handler for validated forms that link to Entries
        // (currently only Compressor, but may be useful again)
        $(".validated_form").on("submit", (e) => {
            e.preventDefault();
            if (!$(e.target).valid())
                return;
            eval(e.target.name + ".submit()");
        });

        // Information buttons
        $("[data-with-info]").each(function () {
            $(this).with_info();
        });

        $("#update_webdav").on("click", function () {
            $("#alert_messages").empty();
            $("#alert_dialog").dialog({
                title: "Updating from Drive",
                modal: true,
                width: "90%",
                close: function (e, ui) {
                    $("#alert_dialog").dialog("destroy");
                }
            }).dialog("open");
            update_from_drive(function (clss, m) {
                $("#alert_messages").append("<div class='" + clss + "'>" +
                    m + "</div>");
            });
        });

        reload_ui();
        $("#loading").hide();
        $("#loaded").show();
    }

    function promise_to_reconnect() {
        return new Promise((resolve, reject) => {
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
                    if (!$("form[name='connect_failed_form']").valid())
                        return false;
                    $("#connect_failed_form")
                        .find("input")
                        .each(function () {
                            config.set(this.name, $(this).val());
                        });
                    config.save().then(() => {
                        resolve(dav_connect());
                    });
                }
            });
        });
    }

    function dav_connect() {
        return config.store
            .connect({
                url: Cookies.get("webdav_url"),
                username: Cookies.get("webdav_user"),
                password: Cookies.get("webdav_pass")
            })
            .then(() => {
                console.debug("WebDAV connected, loading config");
                return config.load()
                    .catch((e) => {
                        console.debug("config load failed: " + e);
                        return promise_to_reconnect();
                    });
            });
    }

    $(() => {
        dav_connect().then(initialise);
    });

})(jQuery);