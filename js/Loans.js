/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

"use strict";

/**
 * Entries for Loan events. These can be edited in place.
 */
function Loans(store, roles) {
    Entries.call(this, store, "loans", [
        "date",
        "item",
        "count",
        "borrower",
        "lender",
        "donation",
        "returned"
    ], {
        date: "Date",
	count: "Number",
        donation: "Number",
        returned: "Date"
    });

    var self = this;
    self.roles = roles;
    $(function() {
        $("#loan_controls").hide();

        $("#loan_save").on("click", function () {
            $(".modified").each(function () {
                $(this).removeClass("modified");
            });
	    // Save to file
            self.save()
                .then(() => {
                    $("#loan_controls").hide();
                });
        });

        $("#loan_reset").on("click", function () {
            $(".modified").each(function () {
                $(this).removeClass("modified");
            })
            // Reload from file
            self.entries = null;
            self.reload_ui();
            $("#loan_controls").hide();
        });

        $("#loan_show_all").on("change", () => {
            self.reload_ui();
        });
    });
}

Loans.prototype = Object.create(Entries.prototype);
Loans.prototype.constructor = Loans;

Loans.prototype.mod_number = function (row, field, integer) {
    var $td = $("<td></td>");
    var entry = this.entries[row];
    var type = this.types[field];

    var text = entry[field];
    if (type === "Date")
        text = Entries.formatDate(text);
    $td.text(text);

    $td.on("click", function () {
        $(this).edit_in_place({
            changed: function (s) {
                if (s !== entry[field]) {
                    entry[field] = s;
		    // TODO: number validation
                    $td.text(s);
                    $td.addClass("modified");
                    $("#loan_controls").show();
                }
                return s;
            }
        });
    });
    return $td;
};

Loans.prototype.mod_select = function (row, field, set) {
    var $td = $("<td></td>");
    var entry = this.entries[row];
    var text = entry[field];
    $td.text(text);

    $td.on("click", function () {
        $(this).select_in_place({
            changed: function (s) {
                if (s != entry[field]) {
                    entry[field] = s;
                    $td.text(s);
                    $td.addClass("modified");
                    $("#loan_controls").show();
                }
                return s;
            },
            options: set,
            initial: text
        });
    });
    return $td;
};

Loans.prototype.mod_date = function (row, field) {
    var entry = this.entries[row];
    var date = entry[field];
    var $td = $("<td></td>");
    if (typeof date !== "undefined")
        $td.text(Entries.formatDate(date));
    else {
        var $pencil = $("<span class='ui-icon ui-icon-pencil'></span>");
        $td.append($pencil);
        $pencil.with_info('#infoReturned');
    }

    $td.on("click", function (e) {
        $(this).datepicker(
            "dialog", entry[field],
            function (date, dp) {
                date = new Date(date);
                if (date != entry[field]) {
                    entry[field] = date;
                    $td.text(Entries.formatDate(date));
                    $td.addClass("modified");
                    $("#loan_controls").show();
                }
            }, {
                dateFormat: "yy-mm-dd"
            },
            e);
    });
    return $td;
};

Loans.prototype.mod_item = function(row) {
    var entry = this.entries[row];
    var $td = $("<td></td>");
    $td.text(entry.item);
    $td.on("click", function() {
	$("#inventory_pick_dialog")
	    .data("picked", entry.item)
	    .data("handler", function(item) {
                entry.item = item;
		$td.text(item);
                $td.addClass("modified");
                $("#loan_controls").show();
	    })
	    .dialog("open");
    });
    return $td;
};

Loans.prototype.reload_ui = function () {
    var self = this;
    return this.load()
	.then(() => {
	    console.debug("Loading",self.entries.length,"loan records");
            $(".loan_table>tbody").empty().each(function () {
		var list = self.entries;
		var show_all = $("#show_all_loans").is(':checked');
		var $row;
		for (var i = 0; i < list.length; i++) {
                    var row = list[i];
                    var active = (typeof row.returned === "undefined" ||
				  row.returned.valueOf() > Date.now());
                    if (!active && !show_all)
			continue;
                    $row = $("<tr></tr>");
                    if (typeof row.returned === "undefined") {
			var due = row.date.valueOf() +
                            (Cookies.get("loan_return") || 10) *
                            24 * 60 * 60 * 1000;
			if (due < Date.now())
                            $row.addClass("loan_late");
                    }
                    $row.append(self.mod_date(i, "date"));
                    $row.append(self.mod_item(i));
                    $row.append(self.mod_number(
			i, "count", true));
                    $row.append(self.mod_select(
			i, "borrower",
			self.roles["members"]));
                    $row.append(self.mod_select(
			i, "lender",
			self.roles["operators"]));
                    $row.append(self.mod_number(
			i, "donation", false));
                    $row.append(self.mod_date(
			i, "returned"));
                    $(this).append($row);
		}
		$(this).parent().tablesorter({
                    cancelSelection: true,
                    selectorHeaders: "> thead th",
                    selectorSort: "th",
                    headerTemplate: '{content}<a href="#">{icon}</a>',
                    widgets: ['zebra', 'columns', 'uitheme'],
                    theme: 'jui',
                    delayInit: true,
                    dateFormat: "ddmmyyyy"
		});
            });
	})
	.catch((e) => {
	    console.error("Loans load failed:", e);
	});
};

Loans.prototype.add = function (r) {
    r.date = new Date();
    Entries.prototype.add.call(this, r);
};

Loans.prototype.save_changes = function () {
    this.save();
    this.reload_ui();
};
