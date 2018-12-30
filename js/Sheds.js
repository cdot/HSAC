/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 *
 * Shed management application
 */

/* eslint-env jquery */
/* global WebDAVStore */
/* global Cookies */
/* global Nitrox */
/* global Compressor */
/* global Loans */

(($) => {
    const dav_store = new WebDAVStore();

    /**
     * Promise to connect to webdav
     */
    function dav_connect() {
        return dav_store.connect({
            url: Cookies.get("webdav_url"),
            username: Cookies.get("webdav_user"),
            password: Cookies.get("webdav_pass")
        });
    }


    var roles = {};

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

    var compressor = new Compressor(dav_store, roles);
    var loans = new Loans(dav_store, roles);

    /**
     * Nitrox calculation tab
     */
    function NitroxForm() {}

    NitroxForm.prototype.submit = function () {
        $("#nitrox_report").empty();
        var conditions = {};
        $("form[name='nitrox'] :input").each(function () {
            if (this.type === "number")
                conditions[this.name] = parseFloat($(this).val());
            else
                conditions[this.name] = $(this).val();
        });
        var result = Nitrox.blend(conditions);
        var mess;
        switch (result.status) {
        case Nitrox.MIX_ACHIEVABLE:
            mess = "Add " + Math.floor(result.add_real_O2_bar) +
                " bar of O<sub>2</sub>. This will use " +
                Math.round(result.O2_needed_litres) +
                " litres of O<sub>2</sub> at a cost of &pound;" +
                (Math.round(100 * (result.O2_needed_litres *
                    Cookies.get("o2_price"))) / 100);
            break;
        case Nitrox.BANK_LACKS_O2:
            mess = "There is not enough O2 in the bank for this fill.";
            break;
        case Nitrox.TOO_MUCH_O2:
            mess = "There is too much gas already in the cylinder for " +
                "this fill. To use this bank you will have to bleed " +
                "the cylinder down below " + result.bleed + " bar"
            break;
        default:
            throw "Bad Nitrox response result.status";
        }
        $("#nitrox_report").append(mess + "<br>");
    }

    var nitrox = new NitroxForm();

    /**
     * Update all UIs from webdav
     */
    function reload_ui() {
	console.debug("Reloading UI");
        Promise.all([
	    compressor.reload_ui(),
	    loans.reload_ui(),
	    inventory.reload_ui()
	])
	    .then(() => {
		console.debug("Reloading roles");
		return dav_store.read('/roles.csv');
	    })
            .then((list) => {
                list = $.csv.toArrays(list);
                for (var col = 0; col < list[0].length; col++) {
                    var f = list[0][col];
                    roles[f] = [];
                    for (var row = 1; row < list.length; row++) {
                        var e = list[row][col];
                        if (e && e.length > 0)
                            roles[f].push(e);
                    }
                    $("select." + f).html(
                        "<option></option><option>" +
                            roles[f]
                            .join("</option><option>") +
                            "</option>");
                }
            })
	    .catch((e) => {
		console.error("Roles load failed:", e);
	    });
        $("#tabs").tabs("option", "disabled", []);
    }

    var inventory = new Inventory(dav_store);

    function update_webdav(report) {
        // The Committee/Equipment/Sheds folder contains two sheets
        // that summarise information from Drive. The first, "Roles",
        // contains columns for the member lists - at least members,
        // operators and blenders, and maybe more. This is created by
        // doing an IMPORTRANGE of data from the Members database.
        //
        // A second sheet, "Inventory", contains a mapping from the
        // name of each of the inventory sheets to the CSV publishing
        // URL of a sheet in Committee/Equipment/Sheds that extracts
        // the sheet of the same name from
        // Committee/Equipment/Sheds/Equipment & Servicing Schedules
        // These CSV files are downloaded and saved to webdav for
	// the Sheds app to use to populate the UI when offline.

        // Done this convoluted way because we want to be able to
        // serve the data to anyone who connects to the network in the
        // sheds using the sheds app on their nown mobile device,
        // which means we have to store the data persistently in
        // webdav. Secondly, the only way to get structured data out
        // of sheets without a google login is via CSV publishing,
        // which only publishes the first sheet in a spreadsheet.

        const roles_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRB9rTpKqexsJ9UE_78FJI9sFrZWtXRMi2St-wuxofyVwufMHzzpxQuTRnzH0xhoXhhgL6W_QVA_vNZ/pub?output=csv";

        var now = Date.now(); // default caches

        var p1 = $.ajax({
                url: roles_url + "&t=" + now,
                method: "GET",
                dataType: "text"
            })
            .then((response) => {
                report("info", "Read roles from Drive");
                var l = response;
                return dav_connect()
                    .then(() => {
                        return dav_store.write('/roles.csv', response)
                            .then(() => {
                                report("info", "Updated roles");
                                populate_dropdowns();
                            });
                    });
            })
            .catch((e) => {
                report("error", "Error reading roles from Drive: " +
                    (e.status ? e.status : e));
            });

        const sheets_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5d0yb4xLj024S35YUCnMQZmblbuAOZ5sO_wGn8gm9bgQeLgMXIUiMGQIPrN0wPvnmsM_fzQ0kzglD/pub?output=csv";

        var p2 = $.ajax({
                url: sheets_url + "&t=" + now,
                method: "GET",
                dataType: "text"
            })
            .then((response) => {
                report("debug", "Read sheets list from Drive");
                var sheets = $.csv.toArrays(response);
                var promises = [];

                sheets.forEach(function (sheet) {
                    var id = sheet[0];
                    var url = sheet[1] + "&t=" + now;

                    promises.push(new Promise((resolve, reject) => {
                        var clas = id;
                        // Get the published CSV
                        $.ajax({
                                url: url,
                                method: "GET",
                                dataType: "text"
                            })
                            .then((response) => {
                                report("info", "Read " + id +
                                        " from Drive");
                                var res = {
                                    "Class": id
                                };
                                var data = $.csv.toArrays(response);
                                res.heads = data.shift();
                                res.entries = data;
                                resolve(res);
                            });
                    }));
                });

                return Promise.all(promises).then(function (iv) {
                    return dav_connect().then(() => {
                        return dav_store.write(
                                '/inventory.json', JSON.stringify(iv))
                            .then(() => {
                                report("info", "Updated inventory.json");
                               inventory.populate_tab();
                            });
                    });
                });
            })
            .catch((e) => {
                report("error",
                    "Error reading sheets from Drive: " +
                    (e.status ? e.status : e));
            });

        Promise.all([p1, p2]).then(() => {
            report("info", "Update finished");
        });
    }

    function config(field) {
        var sel = "#cfg_" + field;
        $(sel).on("change", function () {
            var v = $(sel).val();
            if (v !== Cookies.get(field))
                Cookies.set(field, v, {
                    expires: 365
                });
        })
            .val(Cookies.get(field));
    }

    $(() => {
        // Start the clock
        tick();

        // Build UI components
        $('#tabs').tabs({});

        $("button").button();
        $(".spinner").spinner();
        $("select").selectmenu();
        $('.ui-spinner-button').click(function () {
            $(this).siblings('input').change();
        });

        config("webdav_url");
        config("webdav_user");
        config("webdav_pass");
        config("loan_return");
        config("o2_price");

        $("#Configuration_dialog").dialog({
            title: "Settings",
            autoOpen: false,
            resizable: true,
            modal: true,
            width: "100%",
            close: function () {
                dav_store.disconnect().then(() => {
                    populate_dropdowns();
                });
            }
        });

        $("#settings").on("click", function () {
            $("#Configuration_dialog").dialog("open");
        });

        $(".validated_form").validate();

        $(".validated_form").on("submit", (e) => {
            e.preventDefault();
            if (!$(e.target).valid())
                return;
            eval(e.target.name + ".submit()");
        });

        $("[data-with-info]").each(function () {
            $(this).with_info();
        });

        $("#update_webdav").on("click", function() {
            $("#progress_messages").empty();
            $("#progress_dialog").dialog({
		title: "Updating from Drive",
		modal: true,
		width: "90%",
		close: function (e, ui) {
                    $("#progress_dialog").dialog("destroy");
		}
            }).dialog("open");
	    update_webdav(function(clss, m) {
		$("#progress_messages").append("<div class='" + clss + "'>"
					       + m + "</div>");
	    });
	});

        dav_connect()
	    .then(function() {
		reload_ui();
	    })
            .catch((e) => {
                $("#tabs").tabs("option", "disabled", [0, 1, 2, 3]);
                $("#cfg_connect_error").text(e);
                $("#Configuration_dialog").dialog("open");
            });
    });
})(jQuery);
