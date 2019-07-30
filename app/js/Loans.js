/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Entries for Loan events. These can be edited in place.
 *
 * @param params.config Config object
 * @param params.roles Roles object
 */
define("app/js/Loans", ["app/js/Entries", "app/js/jq/in-place"], (Entries) => {

    class Loans extends Entries {
        constructor(params) {
            super({
                store: params.config.store,
                file: "loans.csv",
                keys: {
                    date: "Date",
                    item: "string",
                    count: "number",
                    borrower: "string",
                    lender: "string",
                    donation: "number",
                    returned: "string"
                },
                debug: params.config.debug
            });
            this.cfg = params.config;
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
                        $(document).trigger("reload_ui");
                    });
                });

                $("#loan_reset").on("click", function () {
                    $(".loan_modified").each(function () {
                        $(this).removeClass("loan_modified");
                    })
                    // Reload from file
                    self.reset();
                    $(document).trigger("reload_ui");
                    $("#loan_controls").hide();
                });

                $("#loan_show_all").on("change", () => {
                    $(document).trigger("reload_ui");
                });

                // Add whatever is in 'capture' as a new loan (after validation)
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
                    try {
                        if (parseFloat(self.capture.donation) < 0)
                            bad.push("donation");
                    } catch (e) {
                        bad.push("donation");
                    }
                    Promise.all([
                        self.roles.find("role", "member")
                        .then((row) => {
                            if (row.list.split(",").indexOf(self.capture.borrower) < 0)
                                bad.push("borrower");
                        })
                        .catch(() => {
                            bad.push("borrower");
                        }),
                        self.roles.find("role", "operator")
                        .then((row) => {
                            if (row.list.split(",").indexOf(self.capture.lender) < 0)
                                bad.push("lender");
                        })
                        .catch(() => {
                            bad.push("lender");
                        })
                    ]).then(() => {
                        if (bad.length == 0) {
                            $("#loan_table>tfoot")
                            .find(".loan_modified")
                            .removeClass("loan_modified");
                            self.push($.extend({}, self.capture));
                            self.save().then(() => {
                                $(document).trigger("reload_ui");
                            });
                        } else {
                            $.each(bad, function (i, e) {
                                $("#loan_dlg_" + e).addClass("error");
                            })
                        }
                    });
                });
            });
        }

        mark_loan_modified($td) {
            // Table body are td, tfoot are th
            if ($td.is("td")) {
                $td.addClass("loan_modified");
                $("#loan_controls").show();
            }
        }

        /**
         * mod_* functions are used for table calls in the tbody and also for
         * the cells in the tfoot that capture new loans
         */
        mod_number($td, field, isInteger) {
            var entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
                $td.css("text-align", "center");
            }
            var type = this.keys[field];
            var text = entry[field];

            if (type === "Date")
                text = Entries.formatDate(text);
            $td.text(text);

            $td
            .off("click")
            .on("click", function () {
                $td.removeClass("error");
                $(this).edit_in_place({
                    changed: function (s) {
                        if (s !== entry[field]) {
                            var v = Number(s);
                            if (isNaN(v) || isInteger && !v.isInteger())
                                $td.addClass("error");
                            else {
                                if ($td.is("td"))
                                    $td.addClass("loan_modified");
                                entry[field] = s;
                                $td.text(s);
                            }
                        }
                        return s;
                    }
                });
            });

            return $td;
        }

        mod_select($td, field, set) {
            var self = this;
            var entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
            }
            var text = entry[field];
            $td.text(text);

            $td
            .off("click")
            .on("click", function () {
                $td.removeClass("error");
                self.roles.find("role", set)
                .then((row) => {
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
                        initial: text,
                        options: row.list.split(",")
                    });
                })
                .catch(() => {
                    $.alert({
                        title: set + " list",
                        content: "Not found"
                    });
                });
            });
            return $td;
        }

        mod_date($td, field) {
            var self = this;
            var entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
            }
            var date = entry[field];
            if (typeof date !== "undefined")
                $td.text(Entries.formatDate(date));
            else
                $td.text("?");

            $td
            .off("click")
            .on("click", function (e) {
                $td.removeClass("error");
                $(this).datepicker(
                    "dialog", entry[field],
                    function (date) {
                        date = new Date(date);
                        if (date != entry[field]) {
                            entry[field] = date;
                            $td.text(Entries.formatDate(date));
                            self.mark_loan_modified($td);
                        }
                    }, {
                        dateFormat: "yy-mm-dd"
                    },
                    e);
            });
            return $td;
        };

        mod_item($td, field) {
            var self = this;
            var entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
            }
            $td
            .text(entry[field])
            .off("click")
            .on("click", function () {
                $td.removeClass("error");
                $("#inventory_pick_dialog")
                .data("picked", entry.item)
                .data("handler", function (item) {
                    entry.item = item;
                    $td.text(item);
                    self.mark_loan_modified($td);
                })
                .dialog("option", "title",
                        ($td.is("td") ? "Change" : "Select new") + " loan item")
                .dialog("open");
            });
            return $td;
        };

        // The tbody is where current loans are recorded
        load_tbody () {
            var order = $("#loan_table").data("order").split(",");
            var $tbody = $("#loan_table>tbody");
            $tbody.empty();

            var show_all = $("#loan_show_all").is(':checked');
            var someLate = false;
            this.each((row, r) => {
                var active = (typeof row.returned === "undefined" ||
                              row.returned === "");
                if (!active && !show_all)
                    return;
                var $row = $("<tr></tr>");
                var isLate = false;
                if (active) {
                    var due = row.date.valueOf() +
                        this.cfg.get("loan_return") * 24 * 60 * 60 * 1000;
                    if (due < Date.now()) {
                        isLate = true;
                        someLate = true;
                    }
                }
                for (var c = 0; c < order.length; c++) {
                    switch (order[c]) {
                    case 'date':
                        $row.append(this.mod_date(r, "date"));
                        break;
                    case 'count':
                        $row.append(this.mod_number(r, "count", true));
                        break;
                    case 'item':
                        $row.append(this.mod_item(r, "item"));
                        break;
                    case 'borrower':
                        $row.append(this.mod_select(r, "borrower", "member"));
                        break;
                    case 'lender':
                        $row.append(this.mod_select(r, "lender", "operator"));
                        break;
                    case 'donation':
                        $row.append(this.mod_number(r, "donation", false));
                        break;
                    case 'returned':
                        $row.append(this.mod_select(r, "returned", "operator"));
                        break;
                    }
                }
                if (isLate)
                    $row.find("td").addClass("loan_late");
                $tbody.append($row);
            });
            if (someLate)
                $("#loan_some_late").show();
            else
                $("#loan_some_late").hide();
        };

        // The tfoot is where new loans are entered
        load_tfoot() {
            var order = $("#loan_table").data("order").split(",");

            $("#loan_table>tfoot").find(".loan_modified").removeClass("modified");
            var $col = $("#loan_table>tfoot th").first();
            for (var i = 0; i < order.length; i++) {
                switch (order[i]) {
                case 'date':
                    this.mod_date($col, "date");
                    break;
                case 'count':
                    this.mod_number($col, "count", true);
                    break;
                case 'item':
                    this.mod_item($col, "item");
                    break;
                case 'borrower':
                    this.mod_select($col, "borrower", "member");
                    break;
                case 'lender':
                    this.mod_select($col, "lender", "operator");
                    break;
                case 'donation':
                    this.mod_number($col, "donation", false);
                    break;
                }
                $col = $col.next();
            }
        };

        reload_ui() {
            let self = this;
            return new Promise((resolve) => {
                return this.load()
                .then(() => {
                    if (self.debug) self.debug("Loading " + this.length() + " loan records");
                    this.load_tbody();
                    resolve();
                })
                .catch((e) => {
                    console.error("Loans load failed: " + e);
                    resolve();
                });
            })
            .then(() => {
                this.capture = $.extend({}, this.defaults);
                this.load_tfoot();
                $("#loan_table").trigger("updateAll");
                /*$("#loan_table").tablesorter({
                    cancelSelection: true,
                    selectorHeaders: "> thead th",
                    selectorSort: "th",
                    headerTemplate: '{content}<a href="#">{icon}</a>',
                    widgets: ['zebra', 'columns', 'uitheme'],
                    theme: 'jui',
                    delayInit: true,
                    dateFormat: "ddmmyyyy"
                });*/
            });
        };

        save_changes() {
            this.save().then(() => {
                $(document).trigger("reload_ui");
            });
        };

        number_on_loan = function (item) {
            var on_loan = 0;
            this.each((row) => {
                var active = (typeof row.returned === "undefined" ||
                              row.returned === "");
                if (active && row.item === item)
                    on_loan += row.count;
            });
            return on_loan;
        }
    }
    return Loans;
});
