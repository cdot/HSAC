/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Inventory: true */

"use strict";

function Inventory(store) {
    this.store = store;
    var self = this;
    self.uid = 0;
    $(function () {
        $("#inventory_pick_dialog").dialog({
            title: "Select loan item",
            modal: true,
            autoOpen: false,
            width: "100vw",
            open: function () {
                var $dlg = $("#inventory_pick_dialog");
                var $tabs = $dlg.children(".tabs");
                var picked = $dlg.data("picked");
                if (typeof picked === "undefined" || picked == "")
                    return;
                picked = picked.split(/,\s*/);
                // picked data is always in the order of the fields
                // in the inventory, 
                var sheet = picked.shift();
                $(".loan_chosen").removeClass("loan_chosen");

                var si = self.data.findIndex((e) => {
                    return e.Class == sheet;
                });
                if (si < 0)
                    return;
                
                var $tab = $(($tabs.children())[si + 1]);
                $tabs.tabs("option", "active", si);

                
                // Find the best match among the entries on this sheet
                var ents = self.data[si].entries;
                var best_match = -1;
                var best_matched = 0;
                for (var j = 0; j < ents.length && picked.length > 0; j++) {
                    var ent = ents[j];
                    var m = 0
                    for (var k = 0; k < ent.length; k++) {
                        if (ents[j][k] == picked[m]) {
                            m++;
                            if (m > best_matched) {
                                best_matched = m;
                                best_match = j;
                            }
                        }
                    }
                }
                if (best_match >= 0) {
                    var $trs = $tab.find("tr");
                    // +1 to skip header row
                    var tr = $trs[best_match + 1];
                    $(tr).addClass("loan_chosen");
                }
            }
        });
    });
}

Inventory.prototype.reload_ui = function () {
    var self = this;
    return this.store.read('/inventory.json')
        .then((data) => {
            this.data = JSON.parse(data);
            console.debug("Loading inventory");
            $(".inventory_tab").each(function () {
                self.populate_tab($(this));
            });
        })
        .catch((e) => {
            console.error("Inventory load failed:", e);
        });
};

/**
 * Populate an inventory tab. This will be either the top level tab or the
 * loan item dialog tab. The top level tab will have the class main-inventory
 * which will modify the way it is populated.
 * @param $it the tabs div
 */
Inventory.prototype.populate_tab = function ($it) {
    var inventory = this.data;

    if ($it.children().length > 0) {
        if ($it.tabs("instance"))
            $it.tabs("destroy");
        $it.empty();
    }

    var $it_ul = $("<ul></ul>");

    var hide_cols = {};
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
        var $table = $("<table class='inventory_table zebra'></table>");
        $div.append($table);
        var $tr = $("<tr></tr>");
        var nc = sheet.heads.length,
            ci,
            showCol = {};
        for (ci = 0; ci < nc; ci++) {
            if (!hide_cols[sheet.heads[ci]]) {
                $tr.append("<th>" + sheet.heads[ci] +
                    "</th>");
                showCol[ci] = true;
            }
        }
        $table.append($tr);
        var ne = sheet.entries.length;
        for (var ei = 0; ei < ne; ei++) {
            var desc = [sheet.Class];
            $tr = $("<tr></tr>");
            for (ci = 0; ci < nc; ci++) {
                if (showCol[ci]) {
                    $tr.append("<td>" + sheet.entries[ei][ci] + "</td>");
                    desc.push(sheet.entries[ei][ci]);
                }
            }
            $tr.data("loan_desc", desc.join(","));
            $table.append($tr);
            $tr.on("click", function () {
                var $dlg = $("#inventory_pick_dialog");
                $dlg.dialog("close");
                var handler = $dlg.data("handler");
                if (typeof handler === "function")
                    handler($(this).data("loan_desc"));
            });
        }
    }
    $it.tabs();
};
