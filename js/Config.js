/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Config: true */

/**
 * Configuration items are stored in a file 'config.json' on WebDAV
 */
function Config(store, defaults) {
    this.store = store;
    var sd = {};
    for (var key in defaults) {
        if (defaults.hasOwnProperty(key))
            sd[key] = defaults[key];
    }
    this.store_data = sd;
}

Config.prototype.load = function () {
    return this.store
        .read("config.json")
        .then((json) => {
            var d = JSON.parse(json);
            this.store_data = $.extend({}, this.store_data, d);
            console.debug("Config loaded");
        });
};

Config.prototype.save = function () {
    return this.store.write("config.json", JSON.stringify(this.store_data));
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

Config.prototype.open_dialog = function (options) {
    var self = this;
    var $template = $("#settings_dialog");

    return new Promise((resolve, reject) => {
        var opts = $.extend({
            title: $template.data("title"),
            content: $template.html(),
            onContentReady: function () {
                var $form = this.$content.find("form");
                var jc = this;
                this.$content.find("input")
                    .on("change", function () {
                        var item = this.name;
                        var v = $(this).val();
                        var ok = $form.valid();
                        if (opts.validity)
                            opts.validity.call(jc, ok);
                        if ($form.valid()) {
                            self.set(item, v);
                        }
                    })
                    .each(function () {
                        var el = this;
                        $(el).val(self.get(el.name));
                    });
                if (opts.moreOnContentReady)
                    opts.moreOnContentReady.call(this);
                if (!this.$content.find("form").valid())
                    this.buttons.close.disable();
            }
        }, options);
        $.confirm(opts);
    });
};

if (module)
    module.exports = Config;