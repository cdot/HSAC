/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries: true */

"use strict";

/**
 * Generic handling for storing lists of key-value maps in CSV files.
 * Requires the jQuery CSV plugin.
 * For example, a data set such as:
 *
 * [
 *    { a: 1, c: 2 },
 *    { a: 3, b: 4, c: 5 }
 * ]
 *
 * will be stored in CSV as:
 *
 * a,b,c
 * 1,,2
 * 3,5
 *
 * Note that the first item in the list is used to determine the keys.
 *
 * @param config Config object
 * @param name list name, used as CSV file name
 * @param csv array of column names
 * @param types map from column names to types. Types supported are "string",
 * "Date" and "number". Date is an integer epoch ms, or a string. Number
 *  is a float.
 */
function Entries(params) {
    this.cfg = params.config;
    this.entries = undefined;
    this.name = params.name;
    this.keys = params.keys;
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

        return this.cfg.store.read('/' + this.name + '.csv')
            .then((list) => {
                var data = $.csv.toArrays(list);
                var heads = data[0];
                this.entries = [];
                for (var i = 1; i < data.length; i++) {
                    this.entries.push(this.array2map(heads, data[i]));
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

Entries.prototype.save = function () {
    // Slightly more supported than Object.keys?
    var heads = [];
    for (var k in this.keys) {
        if (this.keys.hasOwnProperty(k))
            heads.push(k);
    }
    var data = [heads];
    for (var row = 0; row < this.entries.length; row++)
        data.push(this.map2array(heads, this.entries[row]));

    return this.cfg.store.write(
        '/' + this.name + '.csv', $.csv.fromArrays(data));
};

/**
 * Given an array of values and a same-sized array of keys,
 * create an object with fields key:value after applying type
 * conversions.
 * @param vals Array of values
 * @params keys Array of keys
 */
Entries.prototype.array2map = function (keys, vals) {
    var datum = {};
    for (var j = 0; j < keys.length; j++) {
        var val = vals[j];

        if (typeof val === "undefined")
            continue; // ignore undefined

        // Apply type conversions
        datum[keys[j]] = this.deserialise(keys[j], val);
    }
    return datum;
};

/**
 * Given a key and a string, convert that to the target type for that key
 * @param key the key
 * @param val the string
 * @return the converted value
 * @throws if the value can't be converted
 */
Entries.prototype.deserialise = function (key, val) {
    if (typeof val === "undefined")
        return val;
    switch (this.keys[key]) {
    case 'Date':
        if (/^[0-9]+$/.test(val))
            // Numeric date
            return new Date(parseInt(val));
        // String date
        if (val === "")
            return undefined;
        return new Date(val);
    case 'number':
        if (val === "")
            return 0;
        return parseFloat(val);
    default:
        return val;
    }
}

/**
 * Given a key and a string, convert that to a suitable type for
 * serialisation
 * @param key the key
 * @param val the string
 * @return the converted value
 * @throws if the value can't be converted
 */
Entries.prototype.serialise = function (key, val) {
    if (typeof val !== "undefined" && this.keys[key] === "Date")
        // Dates are serialised as numbers
        return val.getTime();
    return val;
};

Entries.prototype.map2array = function (keys, vals) {
    var datum = [];
    for (var j = 0; j < keys.length; j++) {
        var key = keys[j],
            val = vals[key];
        datum.push(this.serialise(key, val));
    }
    return datum;
};