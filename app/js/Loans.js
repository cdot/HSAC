/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Entries for Loan events. These can be edited in place.
 */
define("app/js/Loans", [
    "app/js/Entries", "app/js/jq/in-place"
], Entries => {

    class Loans extends Entries {
        constructor(params) {
            super($.extend(params, {
                file: "loans.csv",
                keys: {
                    date: "Date",
                    item: "string",
                    count: "number",
                    borrower: "string",
                    lender: "string",
                    donation: "number",
                    returned: "string"
                }
            }));

            // Defaults used to populate the new entry row
            this.defaults = {
                date: new Date(),
                item: "select",
                count: 1,
                borrower: "select",
                lender: "select",
                donation: 0
            };
		}

		//@override
		attachHandlers() {
			this.$tab = $(`#${this.id}`);

			$("#loan_controls").hide();

			$("#loan_save").on("click", () => {
				$(".loan_modified").each((i, el) => {
					$(el).removeClass("loan_modified");
				});
				// Save to file
				this.save()
				.then(() => {
					$("#loan_controls").hide();
					$(document).trigger("reload_ui");
				});
			});

			$("#loan_reset").on("click", () => {
				$(".loan_modified").each((i, el) => {
					$(el).removeClass("loan_modified");
				});
				// Reload from file
				this.reset();
				$(document).trigger("reload_ui");
				$("#loan_controls").hide();
			});

			$("#loan_show_all").on("change", () => {
				$(document).trigger("reload_ui");
			});

			// Add whatever is in 'capture' as a new loan (after validation)
			$("#loan_add").on("click", () => {
				let bad = [];
				try {
					if (new Date(this.capture.date) > new Date())
						bad.push("date");
				} catch (e) {
					bad.push("date");
				}
				if (this.capture.item == this.defaults.item)
					bad.push("item");
				try {
					if (parseInt(this.capture.count) < 0)
						bad.push("count");
				} catch (e) {
					bad.push("count");
				}
				try {
					if (parseFloat(this.capture.donation) < 0)
						bad.push("donation");
				} catch (e) {
					bad.push("donation");
				}
				Promise.all([
					this.app.roles.find("role", "member")
					.then(row => {
						if (row.list.split(",").indexOf(this.capture.borrower) < 0)
							bad.push("borrower");
					})
					.catch(() => {
						bad.push("borrower");
					}),
					this.app.roles.find("role", "operator")
					.then(row => {
						if (row.list.split(",").indexOf(this.capture.lender) < 0)
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
						this.push($.extend({}, this.capture));
						this.save().then(() => {
							this.reset();
							$(document).trigger("reload_ui");
						});
					} else {
						$.each(bad, function (i, e) {
							$("#loan_dlg_" + e).addClass("error");
						});
					}
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
            let entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
                $td.css("text-align", "center");
            }
            let type = this.keys[field];
            let text = entry[field];

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
                            let v = Number(s);
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
            let entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
            }
            let text = entry[field];
            $td.text(text);

            $td
            .off("click")
            .on("click", () => {
                $td.removeClass("error");
                this.app.roles.find("role", set)
                .then(row => {
                    $(this).select_in_place({
                        changed: s => {
                            if (s != entry[field]) {
                                entry[field] = s;
                                $td.text(s);
                                $td.removeClass("error");
                                this.mark_loan_modified($td);
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
            let entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
            }
            let date = entry[field];
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
                    date => {
                        date = new Date(date);
                        if (date != entry[field]) {
                            entry[field] = date;
                            $td.text(Entries.formatDate(date));
							this.mark_loan_modified($td);
                        }
                    }, {
                        dateFormat: "yy-mm-dd"
                    },
                    e);
            });
            return $td;
        }

        mod_item($td, field) {
            let entry = this.capture;
            if (typeof $td === "number") {
                entry = this.get($td);
                $td = $("<td></td>");
            }
            $td
            .text(entry[field])
            .off("click")
            .on("click", () => {
                $td.removeClass("error");
                $("#inventory_pick_dialog")
                .data("picked", entry.item)
                .data("handler", item => {
                    entry.item = item;
                    $td.text(item);
                    this.mark_loan_modified($td);
                })
                .dialog("option", "title",
                        ($td.is("td") ? "Change" : "Select new") + " loan item")
                .dialog("open");
            });
            return $td;
        }

        // The tbody is where current loans are recorded
        load_tbody () {
            let order = $("#loan_table").data("order").split(",");
            let $tbody = $("#loan_table>tbody");
            $tbody.empty();

            let show_all = $("#loan_show_all").is(':checked');
            let someLate = false;
            this.each((row, r) => {
                let active = (typeof row.returned === "undefined" ||
                              row.returned === "");
                if (!active && !show_all)
                    return;
                let $row = $("<tr></tr>");
                let isLate = false;
                if (active) {
                    let due = row.date.valueOf() +
                        this.config.get("loan_return") * 24 * 60 * 60 * 1000;
                    if (due < Date.now()) {
                        isLate = true;
                        someLate = true;
                    }
                }
                for (let c = 0; c < order.length; c++) {
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
        }

        // The tfoot is where new loans are entered
        load_tfoot() {
            let order = $("#loan_table").data("order").split(",");

            $("#loan_table>tfoot").find(".loan_modified").removeClass("modified");
            let $col = $("#loan_table>tfoot th").first();
            for (let i = 0; i < order.length; i++) {
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
        }

        reload_ui() {
            return new Promise(resolve => {
                return this.loadFromStore()
                .then(() => {
                    this.debug("Loading " + this.length() + " loan records");
                    this.load_tbody();
                    resolve();
                })
                .catch(e => {
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
        }

        save_changes() {
            this.save().then(() => {
				this.reset();
                $(document).trigger("reload_ui");
            });
        }

        number_on_loan(item) {
            let on_loan = 0;
            this.each(row => {
                let active = (typeof row.returned === "undefined" ||
                              row.returned === "");
                if (active && row.item === item)
                    on_loan += row.count;
            });
            return on_loan;
        }
    }
    return Loans;
});
