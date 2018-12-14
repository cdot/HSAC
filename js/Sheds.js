/**
 *
 * Shed management application
 */

(($) => {
    /**
       The 2001 manual predicts filter life to be 50 hours at 20C and
       provides a table of factors from which a lifetime can be
       calculated:
       T (C), Factor, Lifetime
       0,  3.8, 190
       5,  2.6, 130
       10, 1.85, 92.5
       20, 1, 50
       30, 0.57, 28.5
       40, 0.34, 17
       50, 0.2, 10
       It also states the pumping rate is 260lpm.
       
       The latest manual provided by Coltri explicitly for this
       compressor records a radically different filter life:
       -5, 84
       0, 53
       10, 29
       20, 19
       30, 12
       40, 7
       and gives a pumping rate of 315 lpm.
       
       Let's assume the older manual is correct, as there are reasons
       to assume the newer one is unreliable. We want a curve that will
       predict the filter lifetime in hours, based on the
       temperature. Using a symmetric sigmoidal curve fit,
       
       y = d + (a - d) / (1 + (x / c) ^ b)
       
       https://mycurvefit.com gives us an excellent fit.
    */
    const filter_coeff = {
        a: 189.9102,
        b: 1.149582,
        c: 11.50844,
        d: -24.03492
    };

    const dav_client = new dav.Client();
    const dav_store = new WebDAVStore();

    /*
     * Generic handling for items in lists (compressor events, loan events)
     * stored in CSV files.
     * @param name list name
     * @param fields array of column names
     * @param types map from column names to types. Types supported are
     * "Date" and "Number". Date is an integer epoch ms, or a string. Number
     * is a float.
     */
    function Entries(name, fields, types) {
        this.entries = undefined;
        this.name = name;
        this.fields = fields;
        this.types = types;
    }
    
    Entries.prototype.load = function() {
        return new Promise((resolve, reject) => {
            if (this.entries) {
                resolve();
                return;
            }
            
            return dav_store.read('/' + this.name + '.csv')
                .then((list) => {
                    data = $.csv.toArrays(list);
                    this.entries = [];
                    for (var i = 0; i < data.length; i++) {
                        this.entries.push(this.getFields(data[i]));
                    }
                    resolve();
                })
                .catch((e) => {
                    console.debug("Error reading " + this.name + ".csv", e);
                    this.entries = [];
                    resolve();
                });
        });
    };

    Entries.prototype.getFields = function(data) {
        var datum = {};
        for (var j = 0; j < this.fields.length; j++) {      
            var fieldname = this.fields[j];
            if (data instanceof Array) {
                d = data[j]; // arrays are indexed by column
            } else {
                d = data[fieldname]; // maps are indexed by name
            }
            if (typeof d === "undefined")
                continue; // ignore undefined
            if (this.types[fieldname]) {
                switch (this.types[fieldname]) {
                case 'Date':
                    if (d === "")
                        continue; // ignore empty date columns
                    if (/^[0-9]+$/.test(d))
                        // Numeric date
                        datum[fieldname] = new Date(parseInt(d));
                    else
                        // String date
                        datum[fieldname] = new Date(d);
                    break;
                case 'Number':
                    if (d === "")
                        continue; // ignore empty numbers
                    datum[fieldname] = parseFloat(d);
                    break;
                }
            } else
                // Assume string
                datum[fieldname] = d;
        }
        return datum;
    };
    
    Entries.prototype.save = function() {
        var data = [];
        for (var i = 0; i < this.entries.length; i++) {
            var datum = [];
            for (var j = 0; j < this.fields.length; j++) {
                datum[j] = this.entries[i][this.fields[j]];
            }
            data.push(datum);
        }
        return dav_store.write(
            '/' + this.name + '.csv', $.csv.fromArrays(data))
            .catch((e) => {
                debugger;
            });
    };

    Entries.prototype.add = function(r) {
        this.entries.push(r);
        this.save();
        this.update_ui();
    };
    
    Entries.prototype.submit = function(values) {
        if (!values)
            values = {};
        $("form[name='" + this.name + "'] :input").each(function() {
            values[this.name] = $(this).val();
        });
        this.add(this.getFields(values));
    }

    var lists = {};
    
    /**
     * Update time displays
     */
    function tick() {
        var now = new Date();
        $(".time_display").text(now.toLocaleDateString()
                       + " " + now.toLocaleTimeString());
        $(".date_display").text(now.toLocaleDateString());
        var when = 1000 - (Date.now() % 1000);
        window.setTimeout(tick, when);
    }

    function formatDate(date) {
        return date.toISOString().replace(/T.*/, "");
    }
    
    function infoDialog(outputMsg, titleMsg, onCloseCallback) {
        if (!titleMsg)
            titleMsg = 'Alert';

        if (!outputMsg)
            outputMsg = 'No Message to Display.';

        $("<div></div>").html(outputMsg).dialog({
            title: titleMsg,
            resizable: true,
            modal: true,
            buttons: {
                "OK": function () {
                    $(this).dialog("close");
                }
            },
            close: function() {
                /* Cleanup node(s) from DOM */
                $(this).dialog('destroy').remove();
                if (onCloseCallback)
                    onCloseCallback();
            }
        });
    }

    function with_info($thing, data) {
        var i = data || $thing.data("with-info");
        if (i.charAt(0) === '#' && $(i).length === 0)
            throw "Missing " + i;
        
        $icon = $("<span class='ui-icon ui-icon-info'></span>");
        $thing.after($icon);
        
        $icon.data("info", i);
        $icon.on("click", function() {
            var info = $icon.data("info");
            if (info.charAt(0) === '#')
                info = $(info).text();
            infoDialog(info);
        });
        return $thing;
    }

    // Entries for Compressor runtime events. This is a stack - the only
    // editing available is to delete the last entry.
    function Compressor() {
        this.entries = undefined;

        Entries.call(this, "compressor", [
            "date",
            "operator",
            "humidity",
            "temperature",
            "runtime",
            "filterlife"
        ], {
            date: "Date",
            humidity: "Number",
            temperature: "Number",
            runtime: "Number",
            filterlife: "Number"
        });
    }

    Compressor.prototype = Object.create(Entries.prototype);
    Compressor.prototype.constructor = Compressor;
    
    Compressor.prototype.update_ui = function() {
        this.load().then(() => {
            // predict filter life remaining at current temperature
            var cur = this.entries[this.entries.length - 1];
            $("#cr_operator").text(cur.operator);
            $("#cr_time").text(formatDate(cur.date));
            $("#cr_flr").text(Math.round(cur.filterlife * 100));
            $("#cr_runtime").text(cur.runtime);
            $("input[name='runtime']")
                .rules("remove", "min");
            $("input[name='runtime']")
                .rules("add", { min: cur.runtime });
        });
    };
    
    Compressor.prototype.add = function(r) {
        this.load().then(() => {
            var flr = 1, dt = 0;
            if (this.entries.length > 0) {
                var le = this.entries[this.entries.length - 1];
                flr = le.filterlife;
                dt = (r.runtime - le.runtime) / 60; // hours

                if (dt < 0) {
                    debugger;
                    throw "Bad runtime";
                }
                
                // Predicted filter lifetime at this temperature
                var lifetime = filter_coeff.d
                    + (filter_coeff.a - filter_coeff.d)
                    / (1 + Math.pow(le.temperature
                                    / filter_coeff.c, filter_coeff.b));
                // Fraction of filter change hours consumed
                var fraction = dt / lifetime;
                flr -= fraction; // remaining filter life
                console.debug(
                    "Old filter life was",flr,", runtime was",dt,"hours.",
                    "Predicted lifetime at", le.temperature,
                              "is",lifetime,"or",fraction,"of a filter, so",
                              "new prediction is", flr);
            }
            r.date = new Date();
            r.filterlife = flr;
            Entries.prototype.add.call(this, r);
        });
    };

    var compressor = new Compressor();

    // Entries for Loan events. These can be edited in place.
    function Loans() {
        Entries.call(this, "loans", [
            "date",
            "desc",
            "id",
            "borrower",
            "lender",
            "donation",
            "returned"
        ], {
            date : "Date",
            donation: "Number",
            returned: "Date"
        });
    }

    Loans.prototype = Object.create(Entries.prototype);
    Loans.prototype.constructor = Loans;

    Loans.prototype.mod_text = function(row, field) {
        var entry = this.entries[row];
        var type = this.types[field];
        
        var $span = $("<span></span>");

        var text = entry[field];
        if (type === "Date")
            text = formatDate(text);
        $span.text(text);

        $span.on("click", function() {
            $(this).edit_in_place({
                changed: function (s) {
                    if (s !== entry[field]) {
                        entry[field] = s;
                        $span.text(s);
                        $span.addClass("modified");
                        $("#loan_controls").show();
                    }
                    return s;
                }
            });
        });
        return $span;
    };

    Loans.prototype.mod_select = function(row, field, set) {
        var entry = this.entries[row];
        var $span = $("<span></span>");
        var text = entry[field];
        $span.text(text);

        $span.on("click", function() {
            $(this).select_in_place({
                changed: function(s) {
                    if (s != entry[field]) {
                        entry[field] = s;
                        $span.text(s);
                        $span.addClass("modified");
                        $("#loan_controls").show();
                    }
                    return s;
                },
                options: lists[set],
                initial: text
            });
        });
        return $span;
    };
    
    Loans.prototype.mod_date = function(row, field) {
        var entry = this.entries[row];
        var date = entry[field];
        var $span = $('<div style="width:100%;height:100%"></div>');
        if (typeof date !== "undefined")
            $span.text(formatDate(date));
        else {
            var $pencil = $("<span class='ui-icon ui-icon-pencil'></span>");
            $span.append($pencil);
            with_info($pencil, '#infoReturned');
        }

        $span.on("click", function(e) {
            $(this).datepicker(
                "dialog", entry[field],
                function(date, dp) {
                    date = new Date(date);
                    if (date != entry[field]) {
                        entry[field] = date;
                        $span.text(formatDate(date));
                        $span.addClass("modified");
                        $("#loan_controls").show();
                    }
                },
                {
                    dateFormat: "yy-mm-dd"
                },
                e);
        });
        return $span;
    };

    Loans.prototype.update_ui = function() {
        var self = this;
        this.load().then(() => {
            $("#loans_table>tbody").empty().each(function() {
                var list = self.entries;
                var show_all = $("#show_all_loans").is(':checked');
                var $row;
                for (var i = 0; i < list.length; i++) {
                    var row = list[i];
                    var active = (typeof row.returned === "undefined"
                                  || row.returned.valueOf() > Date.now());
                    if (!active && !show_all)
                        continue;
                    $row = $("<tr></tr>");
                    var $td = $("<td></td>");
                    $td.append(self.mod_date(i, "date"));
                    if (typeof row.returned === "undefined") {
                        var due = row.date.valueOf() +
                        (Cookies.get("loan_return") || 10)
                            * 24 * 60 * 60 * 1000;
                        if (due < Date.now())
                            $row.addClass("late");
                    }
                    $row.append($td);
                    $td = $("<td></td>");
                    $td.append(self.mod_text(i, "desc"));
                    $row.append($td);
                    $td = $("<td></td>");
                    $td.append(self.mod_text(i, "id"));
                    $row.append($td);
                    $td = $("<td></td>");
                    $td.append(self.mod_select(i, "borrower", "members"));
                    $row.append($td);
                    $td = $("<td></td>");
                    $td.append(self.mod_select(i, "lender", "operators"));
                    $row.append($td);
                    $td = $("<td></td>");
                    $td.append(self.mod_text(i, "donation"));
                    $row.append($td);
                    $td = $("<td></td>");
                    $td.append(self.mod_date(i, "returned"));
                    $row.append($td);
                    $(this).append($row);
                }
                $(this).parent().tablesorter({
                    cancelSelection: true,
                    selectorHeaders: "> thead th",
                    selectorSort: "th",
                    headerTemplate: '{content}<a href="#">{icon}</a>',
                    selectorSort: "a",
		    widgets: ['zebra', 'columns', 'uitheme'],
                    theme: 'jui',
                    delayInit: true,
                    dateFormat: "ddmmyyyy"
                });
            });
        });
    };

    Loans.prototype.add = function(r) {
        r.date = new Date();
        Entries.prototype.add.call(this, r);
    };
    
    Loans.prototype.save_changes = function() {
        this.save();
        this.update_ui();
    };
    
    var loans = new Loans();

    function Whereis() {
    }

    Whereis.prototype.submit = function() {
    };
    
    function NitroxForm() {
    };

    NitroxForm.prototype.submit = function() {
        $("#nitrox_report").empty();
        var conditions = {};
        $("form[name='nitrox'] :input").each(function() {
            if (this.type === "number")
                conditions[this.name] = parseFloat($(this).val());
            else
                conditions[this.name] = $(this).val();
        });
        var result = Nitrox.blend(conditions);
        var mess;
        switch (result.status) {
        case Nitrox.MIX_ACHIEVABLE:
            mess = "Add " + Math.floor(result.add_real_O2_bar) + " bar of O<sub>2</sub>. This will use " +
                Math.round(result.O2_needed_litres) + " litres of O<sub>2</sub> at a cost of £"
                + (Math.round(100 * (result.O2_needed_litres * Cookies.get("o2_price"))) / 100);
            break;
        case Nitrox.BANK_LACKS_O2:
            mess = "There is not enough O2 in the bank for this fill.";
            break;
        case Nitrox.TOO_MUCH_O2:
            mess = "There is too much gas already in the cylinder for this fill. To use this bank you"
                + " will have to bleed it down below " + result.bleed + " bar"
            break;
        default:
            debugger;
        }
        $("#nitrox_report").append(mess + "<br>");
    }
    
    var nitrox = new NitroxForm();

    function dav_connect() {
        return dav_store.connect({
            url: Cookies.get("webdav_url"),
            username: Cookies.get("webdav_user"),
            password: Cookies.get("webdav_pass")
        }).then(() => {
            var promises = [];
            
            // Populate operators and members drop-downs.
            ['operators', 'members', 'blenders'].forEach((f) => {
                promises.push(
                    dav_store.read('/' + f + '.csv')
                        .then((list) => {
                            list = $.csv.toArrays(list);
                            lists[f] = list.map(x => x[0]).sort();
                            return f;
                        })
                        .then((f) => {
                            $("select." + f).html(
                                "<option></option><option>"
                                    + lists[f]
                                    .join("</option><option>")
                                    + "</option>");
                        }));
            });

            // Populate equipment descriptions
            promises.push(dav_store.read('/descriptions.csv')
                .then((list) => {
                    list = $.csv.toArrays(list);
                    $("input[name='description']").autocomplete({
                        source: list.map(x => x[0])
                    });
                }));
            
            return Promise.all(promises);
        })
        .then(() => {
            compressor.update_ui();
            loans.update_ui();
            $("#tabs").tabs("option","disabled", []);
        })
        .catch((e) => {
            $("#tabs").tabs("option","disabled", [0, 1, 2, 3]);
            $("#tabs").tabs("option", "active", 4);
        });
    }
          
    $(document).ready(() => {
        // Start the clock
        tick();

        // Build UI components
        $('#tabs').tabs();
        
        $("button").button();
        $(".spinner").spinner();
        $('.ui-spinner-button').click(function() {
            $(this).siblings('input').change();
        });
        
        $(".validated_form").validate();

        $(".validated_form").on("submit", (e) => {
            e.preventDefault();
            if (!$(e.target).valid())
                return;
            eval(e.target.name + ".submit()");
        });

        $("#show_all_loans").on("change", () => {
            loans.update_ui();
        });

        $("#cfg_webdav_url").val(Cookies.get("webdav_url"));
        $("#cfg_webdav_user").val(Cookies.get("webdav_user"));
        $("#cfg_webdav_pass").val(Cookies.get("webdav_pass"));
        $("#cfg_loan_return").val(Cookies.get("loan_return"));
        $("#cfg_o2_price").val(Cookies.get("o2_price"));

        $("form[name='cfg_form']").on("submit", (e) => {
            var lr = $("#cfg_loan_return").val();
            Cookies.set("loan_return", lr);
            var o2 = $("#cfg_o2_price").val();
            Cookies.set("o2_price", o2);
            var url = $("#cfg_webdav_url").val();
            var user = $("#cfg_webdav_user").val();
            var pass = $("#cfg_webdav_pass").val();
            if (url !== Cookies.get("webdav_url")
                || user !== Cookies.get("webdav_user")
                || pass !== Cookies.get("webdav_pass")) {
                
                Cookies.set("webdav_url", url, { expires: 365 });
                Cookies.set("webdav_user", user, { expires: 365 });
                Cookies.set("webdav_pass", pass, { expires: 365 });

                dav_store.disconnect().then(() => {
                    dav_connect();
                });
            }
        });
        
        $("[data-with-info]").each(function() {
            with_info($(this));
        });

        $("#loan_controls").hide();
        
        $("#loan_save").on("click", function() {
            $(".modified").each(function() {
                $(this).removeClass("modified");
            })
            // Save to file
            loans.save()
                .then(() => {
                    $("#loan_controls").hide();
                });
        });
        
        $("#loan_reset").on("click", function() {
            $(".modified").each(function() {
                $(this).removeClass("modified");
            })
            // Reload from file
            loans.entries = null;
            loans.update_ui();
            $("#loan_controls").hide();
        });
        
        // Try and connect, enable tabs if successful
        dav_connect();
    });
})(jQuery);

