/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery,node */
/* global Config: true */

/**
 * Configuration items are stored in a file 'config.json' on WebDAV
 */
function Config(store, defaults) {
    this.store = store;
    const sd = {};
    let key;
    for (key in defaults) {
        if (defaults.hasOwnProperty(key))
            sd[key] = defaults[key];
    }
    this.store_data = sd;
}

Config.prototype.load = function () {
    return this.store
        .read("config.json")
        .then((json) => {
            const d = JSON.parse(json);
            this.store_data = $.extend({}, this.store_data, d);
            console.debug("Config loaded");
        });
};

Config.prototype.save = function () {
    return this.store.write("config.json", JSON.stringify(this.store_data))
    .catch((e) => {
        $.alert({title: "Config save failed",
                 content: e.message });
    });
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
    const self = this;
    const $template = $("#settings_dialog");

    return new Promise((resolve, reject) => {
        const opts = $.extend({
            title: $template.data("title"),
            content: $template.html(),
            onContentReady: function () {
                const $form = this.$content.find("form");
                const jc = this;
                this.$content.find("input")
                    .on("change", function () {
                        const item = this.name;
                        const v = $(this).val();
                        const ok = $form.valid();
                        if (opts.validity)
                            opts.validity.call(jc, ok);
                        if ($form.valid())
                            self.set(item, v);
                    })
                    .each(function () {
                        const v = self.get(this.name);
                        if (this.type === "radio")
                            $(this).prop('checked', v === this.value);
                        else
                            $(this).val(v);
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

if (typeof module !== "undefined")
    module.exports = Config;
