/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global WebDAVStore */
/* global Config: true */

/**
 * Configuration items are stored in a file 'config.json' on WebDAV
 */
function Config(items) {
    this.store = new WebDAVStore()
    this.store_data = {};
}

Config.prototype.load = function () {
    return this.store
        .read("/config.json")
        .then((json) => {
            this.store_data = JSON.parse(json);
            console.debug("Config loaded");
        });
};

Config.prototype.save = function () {
    this.store.write("/config.json", JSON.stringify(this.store_data));
};

Config.prototype.get = function (k, deflt) {
    if (typeof this.store_data[k] === "undefined")
        return deflt;
    return this.store_data[k];
};

Config.prototype.set = function (k, v) {
    this.store_data[k] = v;
    return this.save();
};

Config.prototype.setup_UIs = function (on_reconfig) {
    var self = this;
    $(".cfg_control")
        .each(function () {
            var el = this;
            $(el).val(self.get(el.name));
        })
        .on("change", function () {
            var item = this.name;
            var v = $(this).val();
            if (v != self.get(item)) {
                self.set(item, v);
                self.save();
            }
        });

    $("#Configuration_dialog").dialog({
        title: "Settings",
        autoOpen: false,
        resizable: true,
        modal: true,
        width: "100%",
        close: on_reconfig
    });
};