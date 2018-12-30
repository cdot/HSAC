/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries: true */

"use strict";

/*
 * Generic handling for items in lists (compressor events, loan events)
 * stored in CSV files.
 * @param name list name
 * @param fields array of column names
 * @param types map from column names to types. Types supported are
 * "Date" and "Number". Date is an integer epoch ms, or a string. Number
 * is a float.
 */
function Entries(store, name, fields, types) {
    this.store = store;
    this.entries = undefined;
    this.name = name;
    this.fields = fields;
    this.types = types;
}

/** Make a simple date string */
Entries.formatDate = function (date) {
    return date.toISOString().replace(/T.*/, "");
};

Entries.prototype.load = function () {
    return new Promise((resolve, reject) => {
        if (this.entries) {
            resolve();
            return;
        }

        return this.store.read('/' + this.name + '.csv')
            .then((list) => {
                var data = $.csv.toArrays(list);
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

Entries.prototype.getFields = function (data) {
    var datum = {};
    for (var j = 0; j < this.fields.length; j++) {
        var fieldname = this.fields[j],
            d;
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

Entries.prototype.save = function () {
    var data = [];
    for (var i = 0; i < this.entries.length; i++) {
        var datum = [];
        for (var j = 0; j < this.fields.length; j++) {
            datum[j] = this.entries[i][this.fields[j]];
        }
        data.push(datum);
    }
    return this.store.write(
        '/' + this.name + '.csv', $.csv.fromArrays(data));
};

Entries.prototype.add = function (r) {
    this.entries.push(r);
    this.save();
    this.reload_ui();
};

Entries.prototype.submit = function (values) {
    if (!values)
        values = {};
    $("form[name='" + this.name + "'] :input").each(function () {
        values[this.name] = $(this).val();
    });
    this.add(this.getFields(values));
};