/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

"use strict";

function Inventory(store) {
    this.store = store;
    var self = this;
    self.uid = 0;
    $(function() {
	$("#inventory_pick_dialog").dialog({
            title: "Select loan item",
            modal: true,
	    autoOpen: false,
            width: "90%"
	});
    });
};

Inventory.prototype.populate_dialog = function($dlg) {
    var picked = $dlg.data("picked");
    if (typeof picked === "undefined")
	picked = [];
    else if (typeof picked === "string")
	picked = picked.split(/,\s*/);
    $dlg.data("picked", picked);

};

Inventory.prototype.reload_ui = function () {
    var self = this;
    return this.store.read('/inventory.json')
        .then((data) => {
            this.data = JSON.parse(data);
	    console.debug("Loading inventory");
	    $(".inventory_tab").each(function() {
		self.populate_tab($(this));
	    });
	})
	.catch((e) => {
	    console.error("Inventory load failed:", e);
	});
};

/**
 * Populate an inventory tab.
 */
Inventory.prototype.populate_tab = function ($it) {
    var inventory = this.data;
    if ($it.children().length > 0) {
        if ($it.tabs("instance"))
	    $it.tabs("destroy");
        $it.empty();
    }
    var isMain = $it.hasClass("main-inventory");
    var $it_ul = $("<ul></ul>");
    this.uid++;
    $it.append($it_ul);
    for (var i in inventory) {
        var inv = inventory[i];
        var id = ["itab", inv.Class.replace(/\s+/, "_"), this.uid].join("_");
        $it_ul.append("<li><a href='#" + id + "'>" + inv.Class + "</a></li>");
        var $div = $("<div class='inventory_class' id='" + id + "'></div>");
        $it.append($div);
        var $table = $("<table class='inventory_table zebra'></table>");
        $div.append($table);
        var $tr = $("<tr></tr>");
        var nc = inv.heads.length,
        ci,
	showCol = [];
        for (ci = 0; ci < nc; ci++) {
	    var show = isMain || !(
		inv.heads[ci] == "Kit Pool" ||
		    inv.heads[ci] == "Location");
            if (show)
		$tr.append("<th>" + inv.heads[ci]
			   + "</th>");
	    showCol.push(show);
        }
        $table.append($tr);
        var ne = inv.entries.length,
        ei;
        for (ei = 0; ei < ne; ei++) {
            $tr = $("<tr></tr>");
            for (ci = 0; ci < nc; ci++) {
                if (showCol[ci])
		    $tr.append("<td>" + inv.entries[ei][ci] + "</td>");
            }
            $table.append($tr);
        }
    }
    $it.tabs();
};

