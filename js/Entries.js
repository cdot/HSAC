/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Entries: true */
/* global module */

"use strict";

/**
 * Generic handling for storing lists of key-value maps in CSV files.
 * Requires the jQuery CSV plugin.
 *
 * For example, a data set such as:
 *
 * a,b,c
 * x,y,z
 * i,j,k
 *
 * will be loaded as:
 *
 * [
 *   { a:x, b:y, c:z },
 *   { a:i, b:j, c:k }
 * ]
 * 
 * if asArrays if false, or if it's true:
 * 
 * [ x, y, z ],
 * [ i, j, k ]
 *
 * In either case getHeads() will return a list of column headings.
 *
 * Note that the first item in the list is used to determine the keys
 * when saving. Keys in later entries that are not in the first entry
 * will be lost.
 *
 * @param params.store AbstractStore subclass. Data will be saved
 * using this, and loaded too unless url is set.
 * @param params.file CSV file name in store
 * @param params.url URL to load data from, overriding store.
 * @param params.keys map from column names to types. Types supported
 * are "string", "Date" and "number". Date is an integer epoch ms, or
 * a string. Number is a float.
 * @param params.asArrays if true, conversion to a map won't happen
 */
function Entries(params) {
    this.store = params.store;
    this.url = params.url;
    this.file = params.file;
    this.keys = params.keys;
    this.asArrays = params.asArrays;
    this.reset();
}

/**
 * Reset and force reload
 */
Entries.prototype.reset = function () {
    this.entries = [];
    this.heads = [];
    this.loaded = false;
};

// Get the number of entries
Entries.prototype.length = function () {
    return this.entries.length;
};

// Get the given entry
Entries.prototype.get = function (i) {
    if (i < 0 || i >= this.entries.length)
        return undefined;
    return this.entries[i];
};

/**
 * Return a promise to find the row that has "col":val.
 * resolve is called with the row object.
 * @param col name of the column to search
 * @param val value to search for
 */
Entries.prototype.find = function (col, val) {
    return new Promise((resolve, reject) => {
        for (var i = 0; i < this.entries.length; i++) {
            if (this.entries[i][col] == val) {
                resolve(this.entries[i]);
                return;
            }
        }
        reject(new Error(val + " not found in " + col));
    });
};

// Push a new entry
Entries.prototype.push = function (r) {
    this.entries.push(r);
};

// Get a simple array of column heads
Entries.prototype.getHeads = function () {
    return this.heads;
};

// Get a simple array of entries
Entries.prototype.getEntries = function () {
    return this.entries;
};

/** Make a simple date string */
Entries.formatDate = function (date) {
    debugger;
    return date.toISOString().replace(/T.*/, "");
};

Entries.prototype.load = function () {
    if (this.loaded)
        return Promise.resolve(this);

    var lp;
    if (typeof this.url !== "undefined")
        lp = $.ajax({
            url: this.url,
            data: {
                t: Date.now()
            },
            dataType: "text"
        });
    else
        lp = this.store.read(this.file);

    return new Promise((resolve, reject) => {
        return lp
            .then((list) => {
                var data = $.csv.toArrays(list);
                if (this.asArrays) {
                    this.heads = data.shift();
                    this.entries = data;
                } else {
                    this.heads = data[0];
                    this.entries = [];
                    for (var i = 1; i < data.length; i++) {
                        this.entries.push(this.array2map(this.heads, data[i]));
                    }
                }
                this.loaded = true;
                resolve();
            })
            .catch((e) => {
                console.debug("Error reading " + (this.url || this.file) +
                    ": " + e);
                this.heads = [];
                this.entries = [];
                // Resolve it as an empty list
                this.loaded = true;
                resolve();
                //reject(new Error("Error reading " + (this.url || this.file) + ": " +
                //(e.status ? e.status : e)));
            });
    });
};

/**
 * Like jQuery each except the callback params are reversed
 */
Entries.prototype.each = function (callback) {
    $.each(this.entries, (i, e) => {
        return callback(e, i);
    });
};

// Cannot save unless store is defined
Entries.prototype.save = function () {
    if (!this.loaded)
        throw "Can't save, not loaded";
    if (!this.store)
        throw "Can't save, no store";

    // Slightly more supported than Object.keys?
    var heads = [];
    for (var k in this.keys) {
        if (this.keys.hasOwnProperty(k))
            heads.push(k);
    }
    var data = [heads];
    for (var row = 0; row < this.entries.length; row++) {
        if (this.asArrays) {
            data.push(this.entries[row]);
        } else {
            data.push(this.map2array(heads, this.entries[row]));
        }
    }

    return this.store.write(this.file, $.csv.fromArrays(data));
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

if (typeof module !== "undefined")
    module.exports = Entries;
