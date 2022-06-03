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
 */
define("app/js/Entries", ["jquery-csv"], () => {

    class Entries {

		/**
		 * @param {object} params parameters
		 * @param {AbstractStore} params.store Data will be saved
		 * using this, and loaded too unless url is set.
		 * @param {string} params.file CSV file name in store
		 * @param {string} params.url URL to load data from, overriding store.
		 * @param {Object.<string,string>} params.keys map from
		 *  column names to types. Types supported are "string",
		 *  "Date" and "number". Date is an integer epoch ms, or a
		 *  string. Number is a float.
		 * @param {boolean} params.asArrays if true, conversion to a
		 * map won't happen
		 */
        constructor(params) {
			for (let field in params)
				this[field] = params[field];
            this.reset();
		}

		/**
		 * Promise to load the HTML.
		 * Override in subclasses, calling the superclass.
		 */
		loadUI() {
			return $.get(`app/html/${this.id}.html?nocache=${Date.now()}`)
			.then(html => {
				const $tab = $(`<div id="${this.id}"></div>`);
				$tab.html(html);
				$("#main_tabs").append($tab);
				this.$tab = $(`#${this.id}`);

				$tab.find(".spinner").spinner();
				$tab.find("button").button();
				$tab.find("input[type='checkbox']").checkboxradio();
				$tab.find('.ui-spinner-button').click(function () {
					$(this).siblings('input').change();
				});
				this.attachHandlers();
				this.debug("Loaded", this.id);
			});
        }

		/**
		 * Attach handlers, such as button click handlers, to the
		 * elements in the tab. Pure virtual, subclasses must implement.
		 */
		attachHandlers() {
			throw new Error("Pure virtual");
		}

		/**
		 * Promise to reload the UI with new data. NOP unless the UI
		 * is loaded, as indicated by $tab.
		 */
		reloadUI() {
			if (this.$tab) {
				this.debug("Reloading", this.id);
				return this.reload_ui();
			}
			return Promise.resolve();
		}

		/**
		 * Re-read the store and populate the tab with the data read.
		 * Pure virtual, subclasses must implement.
		 */
		reload_ui() {
			throw new Error("Pure virtual");
		}

        /**
         * Reset and force reload at the next opportunity
		 * @return {Promise} resolves to this when done
         */
        reset() {
            this.entries = [];
            this.heads = [];
            this.loaded = false;
			return Promise.resolve(this);
        }

        /**
		 * Get the number of entries
		 * @return {number}
		 */
        length() {
            return this.entries.length;
        }

        /**
		 * Get the given entry
		 * @return {object{ the entry
		 */
        get(i) {
            if (i < 0 || i >= this.entries.length)
                return undefined;
            return this.entries[i];
        }

        /**
         * Return a promise to find the row that has "col":val.
         * resolve is called with the row object.
         * @param col name of the column to search
         * @param val value to search for
         */
        find(col, val) {
            return new Promise((resolve, reject) => {
                for (var i = 0; i < this.entries.length; i++) {
                    if (this.entries[i][col] == val) {
                        resolve(this.entries[i]);
                        return;
                    }
                }
                reject(new Error(val + " not found in " + col));
            });
        }

        /**
		 * Push a new entry
		 * @param {object} r the entry
		 */
        push(r) {
            this.entries.push(r);
        }

        /**
		 * Get a simple array of column heads
		 */
        getHeads() {
            return this.heads;
        }

        /**
		 * Get a simple array of entries
		 */
        getEntries() {
            return this.entries;
        }

        /**
		 ** Make a simple date string
		 */
        static formatDate(date) {
            return date.toISOString().replace(/T.*/, "");
        }

        /**
		 * Make a simple date/time string
		 */
        static formatDateTime(date) {
            return date.toISOString().replace(/T(\d\d:\d\d).*/, " $1");
        }

		/**
		 */
        loadFromStore() {
			this.debug("loadFromStore of",this.id);
            if (this.loaded) {
				this.debug("\tskipped");
                return Promise.resolve(this);
			}

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
                    if (typeof list !== "undefined") {
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
                    }
                    this.loaded = true;
                    resolve();
                })
                .catch((e) => {
                    this.debug("Error reading " + (this.url || this.file) +
                                  ": ", e);
                    this.heads = [];
                    this.entries = [];
                    // Resolve it as an empty list
                    this.loaded = true;
                    resolve();
                    //reject(new Error("Error reading " + (this.url || this.file) + ": " +
                    //(e.status ? e.status : e)));
                });
            });
        }

        /**
         * Like jQuery each except the callback params are reversed
         */
        each(callback) {
            $.each(this.entries, (i, e) => {
                return callback(e, i);
            });
        }

        /**
		 * Cannot save unless store is defined
		 */
        save() {
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
            for (let row of this.entries) {
                if (this.asArrays)
                    data.push(row);
                else
                    data.push(this.map2array(heads, row));
            }
            return this.store.write(this.file, $.csv.fromArrays(data));
        }

        /**
         * Given an array of values and a same-sized array of keys,
         * create an object with fields key:value after applying type
         * conversions.
         * @param vals Array of values
         * @params keys Array of keys
         */
        array2map(keys, vals) {
            var datum = {};
            for (var j = 0; j < keys.length; j++) {
                var val = vals[j];

                if (typeof val === "undefined")
                    continue; // ignore undefined

                // Apply type conversions
                datum[keys[j]] = this.deserialise(keys[j], val);
            }
            return datum;
        }

        /**
         * Given a key and a string, convert that to the target type
         * for that key
         * @param key the key
         * @param val the string
         * @return the converted value
         * @throws if the value can't be converted
         */
        deserialise(key, val) {
            if (typeof val === "undefined")
                return val;
            switch (this.keys[key]) {
            case 'Date':
                if (/^[0-9]+$/.test(val))
                    // Numeric date (ms since 1/1/70)
                    return new Date(parseInt(val));
                // String date
                if (val === "")
                    return undefined;
                return new Date(val);
            case 'number':
                if (val === "")
                    return 0;
                return parseFloat(val);
            case 'boolean':
                // "on", "true" "yes", and "1" are taken as true.
                // Anything else as false.
                return (/^\s*(true|1|on|yes)\s*/i.test(val));
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
        serialise(key, val) {
            if (typeof val !== "undefined" && (this.keys[key] === "Date"
                                               || val instanceof Date))
                // Dates are serialised as simplified ISO8601 strings
                return val.toISOString();
            return val;
        }

		/**
		 */
        map2array(keys, vals) {
            var datum = [];
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j],
                    val = vals[key];
                datum.push(this.serialise(key, val));
            }
            return datum;
        }
    }
    return Entries;
});

