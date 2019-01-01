/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Roles: true */

/**
 * Roles are read from "roles.csv' on WebDAV
 */
function Roles(config) {
    this.cfg = config;
}

/**
 * Reload the UI by re-reading the roles file from webdav
 */
Roles.prototype.reload_ui = function () {
    console.debug("Reloading roles");
    return this.cfg.store.read('/roles.csv')
        .then((list) => {
            list = $.csv.toArrays(list);
            for (var col = 0; col < list[0].length; col++) {
                var f = list[0][col];
                this[f] = [];
                for (var row = 1; row < list.length; row++) {
                    var e = list[row][col];
                    if (e && e.length > 0)
                        this[f].push(e);
                }
                $("select." + f).html(
                    "<option></option>" +
                    "<option>" +
                    this[f]
                    .join("</option><option>") +
                    "</option>");
            }
        })
        .catch((e) => {
            console.error("Roles load failed:", e);
        });
};

/**
 * Update roles by reading from a known published file on Google Drive
 */
Roles.prototype.update_from_drive = function (report) {
    var now = Date.now(); // default caches

    const roles_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRB9rTpKqexsJ9UE_78FJI9sFrZWtXRMi2St-wuxofyVwufMHzzpxQuTRnzH0xhoXhhgL6W_QVA_vNZ/pub?output=csv";
    var self = this;

    return $.ajax({
            url: roles_url + "&t=" + now,
            method: "GET",
            dataType: "text"
        })
        .then((response) => {
            report("info", "Read roles from Drive");
            return self.cfg.store.write('/roles.csv', response)
                .then(() => {
                    report("info", "Updated roles");
                });
        })
        .catch((e) => {
            report("error", "Error reading roles from Drive: " +
                (e.status ? e.status : e));
        });
};