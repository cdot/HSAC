/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries */
/* global Config */
/* global Loans: true */

"use strict";

/**
 * Entries for Loan events. These can be edited in place.
 */
function Loans(params) {
    Entries.call(this, $.extend({
        name: "loans",
        keys: {
            date: "Date",
            item: "string",
            count: "number",
            borrower: "string",
            lender: "string",
            donation: "number",
            returned: "Date"
        }
    }, params));
    this.roles = params.roles;

    // Defaults used to populate the new entry row
    this.defaults = {
        date: new Date(),
        item: "select",
        count: 1,
        borrower: "select",
        lender: "select",
        donation: 0
    };

    var self = this;

    $(function () {
        $("#loan_controls").hide();

        $("#loan_save").on("click", function () {
            $(".loan_modified").each(function () {
                $(this).removeClass("loan_modified");
            });
            // Save to file
            self.save()
                .then(() => {
                    $("#loan_controls").hide();
                });
        });

        $("#loan_reset").on("click", function () {
            $(".loan_modified").each(function () {
                $(this).removeClass("loan_modified");
            })
            // Reload from file
            self.entries = null;
            self.reload_ui();
            $("#loan_controls").hide();
        });

        $("#loan_show_all").on("change", () => {
            self.reload_ui();
        });

        $("#loan_add").on("click", () => {
            var bad = [];
            try {
                if (new Date(self.capture.date) > new Date())
                    bad.push("date");
            } catch (e) {
                bad.push("date");
            }
            if (self.capture.item == self.defaults.item)
                bad.push("item");
            try {
                if (parseInt(self.capture.count) < 0)
                    bad.push("count");
            } catch (e) {
                bad.push("count");
            }
            if (self.roles.members.indexOf(self.capture.borrower) < 0)
                bad.push("borrower");
            if (self.roles.operators.indexOf(self.capture.lender) < 0)
                bad.push("lender");
            try {
                if (parseFloat(self.capture.donation) < 0)
                    bad.push("donation");
            } catch (e) {
                bad.push("donation");
            }
            if (bad.length == 0) {
                $("#loan_table>tfoot")
                    .find(".loan_modified")
                    .removeClass("loan_modified");
                self.entries.push($.extend({}, self.capture));
                self.save();
                self.reload_ui();
            } else {
                bad.forEach(function (e) {
                    $("#loan_dlg_" + e).addClass("error");
                })
            }
        });
    });
}

Loans.prototype = Object.create(Entries.prototype);
Loans.prototype.constructor = Loans;

Loans.prototype.mark_loan_modified = function ($td) {
    if (!$td.hasClass("loan_foot")) {
        $td.addClass("loan_modified");
        $("#loan_controls").show();
    }
};

Loans.prototype.mod_number = function ($td, field, isInteger) {
    var entry = this.capture;
    if (typeof $td === "number") {
        entry = this.entries[$td];
        $td = $("<td></td>");
    }
    var type = this.keys[field];
    var text = entry[field];
    var self = this;

    if (type === "Date")
        text = Entries.formatDate(text);
    $td.text(text);

    $td
        .off("click")
        .on("click", function () {
            $(this).edit_in_place({
                changed: function (s) {
                    if (s !== entry[field]) {
                        entry[field] = s;
                        $td.text(s);
                        try {
                            if (isInteger)
                                parseInt(s);
                            else
                                parseFloat(s);
                            $td.removeClass("error");
                        } catch (e) {
                            $td.addClass("error");
                        }
                        if (!$td.hasClass("loan_foot")) {
                            $td.addClass("loan_modified");
                        }
                    }
                    return s;
                }
            });
        });

    return $td;
};

Loans.prototype.mod_select = function ($td, field, set) {
    var self = this;
    var entry = this.capture;
    if (typeof $td === "number") {
        entry = this.entries[$td];
        $td = $("<td></td>");
    }
    var text = entry[field];
    $td.text(text);

    $td
        .off("click")
        .on("click", function () {
            $(this).select_in_place({
                changed: function (s) {
                    if (s != entry[field]) {
                        entry[field] = s;
                        $td.text(s);
                        $td.removeClass("error");
                        self.mark_loan_modified($td);
                    }
                    return s;
                },
                options: self.roles[set],
                initial: text
            });
        });
    return $td;
};

Loans.prototype.mod_date = function ($td, field) {
    var self = this;
    var entry = this.capture;
    if (typeof $td === "number") {
        entry = this.entries[$td];
        $td = $("<td></td>");
    }
    var date = entry[field];
    if (typeof date !== "undefined")
        $td.text(Entries.formatDate(date));
    else {
        var $pencil = $("<span class='ui-icon ui-icon-pencil'></span>");
        $td.append($pencil);
    }

    $td
        .off("click")
        .on("click", function (e) {
            $(this).datepicker(
                "dialog", entry[field],
                function (date, dp) {
                    date = new Date(date);
                    if (date != entry[field]) {
                        entry[field] = date;
                        $td.text(Entries.formatDate(date));
                        $td.removeClass("error");
                        self.mark_loan_modified($td);
                    }
                }, {
                    dateFormat: "yy-mm-dd"
                },
                e);
        });
    return $td;
};

Loans.prototype.mod_item = function ($td, field) {
    var self = this;
    var entry = this.capture;
    if (typeof $td === "number") {
        entry = this.entries[$td];
        $td = $("<td></td>");
    }
    $td
        .text(entry[field])
        .off("click")
        .on("click", function () {
            $("#inventory_pick_dialog")
                .data("picked", entry.item)
                .data("handler", function (item) {
                    entry.item = item;
                    $td.text(item);
                    $td.removeClass("error");
                    self.mark_loan_modified($td);
                })
                .dialog("open");
        });
    return $td;
};

Loans.prototype.load_tbody = function () {
    var $tbody = $("#loan_table>tbody");
    $tbody.empty();

    var list = this.entries;
    var show_all = $("#loan_show_all").is(':checked');
    var $row;
    var someLate = false;
    for (var i = 0; i < list.length; i++) {
        var row = list[i];
        var active = (typeof row.returned === "undefined" ||
            row.returned.valueOf() > Date.now());
        if (!active && !show_all)
            continue;
        $row = $("<tr></tr>");
        var isLate = false;
        if (typeof row.returned === "undefined") {
            var due = row.date.valueOf() +
                this.cfg.get("loan_return", 10) * 24 * 60 * 60 * 1000;
            if (due < Date.now()) {
                isLate = true;
                someLate = true;
            }
        }
        $row.append(this.mod_date(i, "date"));
        $row.append(this.mod_item(i, "item"));
        $row.append(this.mod_number(i, "count", true));
        $row.append(this.mod_select(i, "borrower", "members"));
        $row.append(this.mod_select(i, "lender", "operators"));
        $row.append(this.mod_number(i, "donation", false));
        $row.append(this.mod_date(i, "returned"));
        if (isLate)
            $row.addClass("loan_late");
        $tbody.append($row);
    }
    if (someLate)
        $("#loan_some_late").show();
    else
        $("#loan_some_late").show();
};

Loans.prototype.load_tfoot = function () {
    $("#loan_table>tfoot").find(".loan_modified").removeClass("modified");
    var $col = $("#loan_table>tfoot th").first();
    this.mod_date($col, "date");
    $col = $col.next();
    this.mod_item($col, "item");
    $col = $col.next();
    this.mod_number($col, "count", true);
    $col = $col.next();
    this.mod_select($col, "borrower", "members");
    $col = $col.next();
    this.mod_select($col, "lender", "operators");
    $col = $col.next();
    this.mod_number($col, "donation", false);
};

Loans.prototype.reload_ui = function () {
    return this.load()
        .then(() => {
            console.debug("Loading", this.entries.length, "loan records");
            this.load_tbody();
            this.capture = $.extend({}, this.defaults);
            this.load_tfoot();
            $("#loan_table thead th:eq(3)").data("sorter");
            $("#loan_table").tablesorter({
                cancelSelection: true,
                selectorHeaders: "> thead th",
                selectorSort: "th",
                headerTemplate: '{content}<a href="#">{icon}</a>',
                widgets: ['zebra', 'columns', 'uitheme'],
                theme: 'jui',
                delayInit: true,
                dateFormat: "ddmmyyyy"
            });
        })
        .catch((e) => {
            console.error("Loans load failed:", e);
        });
};

Loans.prototype.save_changes = function () {
    this.save();
    this.reload_ui();
};