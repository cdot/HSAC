/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser, jquery */

define("app/js/Inventory", ["app/js/Entries", "app/js/jq/with-info"], (Entries) => {
        // Inventory columns that are NOT to be used in a descriptor
    const hide_cols = {
        "Kit Pool": true,
        "Location": true,
        "Count": true
    };

    function getLoanDescriptor(sheet, entry) {
        var desc = [sheet.Class];
        for (var ci = 0; ci < sheet.heads.length; ci++) {
            if (!hide_cols[sheet.heads[ci]])
                desc.push(entry[ci]);
        }
        return desc.join(",");
    }

    class Inventory extends Entries {

        /**
         * Inventory is read from inventory.json
         */
        constructor(params) {
            super(params.config);
            this.loans = params.loans;
            var self = this;
            self.uid = 0;
            $(() => {
                $("#inventory_pick_dialog").dialog({
                    title: "Select loan item",
                    modal: true,
                    autoOpen: false,
                    width: "100vw",
                    open: function () {
                        self.select_picked($(this));
                    }
                });
            });
        }

        /**
         * Highlight the inventory item identified by data-picked by adding the
         * inventory_chosen class to it
         */
        select_picked($dlg) {
            var picked = $dlg.data("picked");
            if (typeof picked === "undefined" || picked == "")
                return;

            var sheet = picked.replace(/,.*$/, "");
            $dlg.find(".inventory_chosen").removeClass("inventory_chosen");

            if (!this.data)
                return;

            var si = this.data.findIndex((e) => {
                return e.Class == sheet;
            });
            if (si < 0)
                return;

            var $tabs = $dlg.children().first();
            var $tab = $(($tabs.children())[si + 1]);
            $tabs.tabs("option", "active", si);

            // Find the best match among the entries on this sheet
            sheet = this.data[si];
            var ents = sheet.entries;
            var ei = ents.findIndex((e) => {
                return getLoanDescriptor(sheet, e) == picked;
            });

            if (ei >= 0) {
                var $trs = $tab.find("tr");
                // +1 to skip header row
                var tr = $trs[ei + 1];
                $(tr).addClass("inventory_chosen");
            }
        }

        reload_ui() {
            var self = this;
            return this.store.read('inventory.json')
            .then((data) => {
                self.data = JSON.parse(data);
                if (self.debug) self.debug("Loading inventory");
                $(".inventory_tab").each(function () {
                    self.populate_tab($(this));
                });
            })
            .catch((e) => {
                console.error("Inventory load failed: " + e);
            });
        }


        /**
         * Populate an inventory tab. This will be either the top level tab or the
         * loan item dialog tab. The top level tab will have the class main-inventory
         * which will modify the way it is populated.
         * @param $it the tabs div
         */
        populate_tab($it) {
            var inventory = this.data;
            var hide_cols = {};
            var self = this;

            function fill_sheet(sheet) {
                var nc = sheet.heads.length,
                    ci,
                    showCol = {},
                    colIndex = {};

                function make_row(ei) {
                    // Make a copy, as we may modify Count
                    var entry = [].concat(sheet.entries[ei]);
                    var $tr = $("<tr></tr>");
                    var desc = getLoanDescriptor(sheet, entry);
                    $tr.data("loan_desc", desc);
                    var on_loan = self.loans.number_on_loan(desc);
                    var can_pick = true;
                    if (on_loan > 0) {
                        if (typeof colIndex.Count === "undefined") {
                            $tr.addClass("inventory_on_loan");
                            can_pick = false;
                        } else {
                            if (on_loan >= entry[colIndex.Count]) {
                                $tr.addClass("inventory_on_loan");
                                can_pick = false;
                            }
                            entry[colIndex.Count] +=
                            " <span data-with-info='#infoOnLoan1'>(" + on_loan + ")</span>";
                        }
                    }
                    if (can_pick)
                        $tr.on("click", function () {
                            var $dlg = $("#inventory_pick_dialog");
                            $dlg.dialog("close");
                            var handler = $dlg.data("handler");
                            if (typeof handler === "function")
                                handler($(this).data("loan_desc"));
                        });
                    for (ci = 0; ci < nc; ci++) {
                        if (showCol[ci])
                            $tr.append("<td>" + entry[ci] + "</td>");
                    }
                    return $tr;
                }

                var $table = $("<table class='inventory_table zebra'></table>");
                var $tr = $("<tr></tr>");
                for (ci = 0; ci < nc; ci++) {
                    colIndex[sheet.heads[ci]] = ci;
                    if (!hide_cols[sheet.heads[ci]]) {
                        $tr.append("<th>" + sheet.heads[ci] + "</th>");
                        showCol[ci] = true;
                    }
                }
                $table.append($tr);

                for (var ei = 0; ei < sheet.entries.length; ei++)
                    $table.append(make_row(ei));

                return $table;
            }

            if ($it.children().length > 0) {
                if ($it.tabs("instance"))
                    $it.tabs("destroy");
                $it.empty();
            }

            var $it_ul = $("<ul></ul>");

            if (typeof $it.data("hide-cols") !== "undefined") {
                $it.data("hide-cols").split(/,\s*/).map(function (e) {
                    hide_cols[e] = true;
                    return true;
                });
            }

            this.uid++;
            $it.append($it_ul);
            for (var i in inventory) {
                var sheet = inventory[i];
                var id = ["sheet", sheet.Class.replace(/\s+/, "_"), this.uid].join("_");
                $it_ul.append("<li><a href='#" + id + "'>" + sheet.Class + "</a></li>");
                var $div = $("<div class='inventory_sheet scroll_container' id='" + id + "'></div>");
                $it.append($div);
                $div.append(fill_sheet(sheet));
            }
            $it.find("span[data-with-info]").with_info();
            $it.find('.inventory_on_loan').with_info({
                position: "hidden",
                text: '#infoOnLoan2'
            });
            $it.tabs();
        }

        /**
         * Update the inventory on WebDAV by reading an updated version from
         * CSV files on the web.  The inventory index is read from a known URL, and
         * then the URLs listed therein are read to get the individual sheets.
         */
        update_from_web(sheets_url, report) {

            var self = this;
            var sheetp = new Entries({
                url: sheets_url,
                keys: {
                    sheet: "string",
                    url: "string"
                }
            });

            return sheetp.load()
            .then(() => {
                var promises = [];

                sheetp.each((mapping) => {
                    // Get the published CSV
                    var sheet = new Entries({
                        url: mapping.url,
                        asArrays: true,
                        keys: {
                            Count: "number"
                        }
                        // typeless, columns default to "string"
                    });
                    promises.push(
                        sheet.load()
                        .then(() => {
                            report("info", "Read " + mapping.sheet +
                                   " from the web");
                            return {
                                Class: mapping.sheet,
                                heads: sheet.getHeads(),
                                entries: sheet.getEntries()
                            }
                        }));
                });

                return Promise.all(promises);
            })
            .then((sheets) => {
                return self.store.write(
                    'inventory.json', JSON.stringify(sheets))
                .then(() => {
                    report("info", "Updated inventory.json");
                });
            })
            .catch((e) => {
                report("error",
                       "Error reading sheets from the web: " +
                       (e.status ? e.status : e));
            });
        }
    }
    return Inventory;
});
