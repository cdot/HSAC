/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("app/js/Config", () => {

    class Config {
        /**
         * Configuration items are stored in a file 'config.json' on WebDAV
         */
        constructor(store, defaults, debug) {
            this.store = store;
            this.debug = debug;
            const sd = {};
            let key;
            for (key in defaults) {
                if (defaults.hasOwnProperty(key))
                    sd[key] = defaults[key];
            }
            this.store_data = sd;
        }

        load() {
            return this.store
            .read("config.json")
            .then((json) => {
                const d = JSON.parse(json);
                this.store_data = $.extend({}, this.store_data, d);
                if (this.debug) this.debug("Config loaded");
            });
        }

        save() {
            return this.store.write("config.json",
                                    JSON.stringify(this.store_data, null, 1))
            .then(() => {
                if (this.debug) this.debug("Config saved");
            })
            .catch((e) => {
                $.alert({ title: "Config save failed",
                          content: e.message });
            });
        }

        get(k, deflt) {
            let data = this.store_data;
            for (let bit of k.split(":")) {
                data = data[bit];
                if (typeof data === "undefined")
                    return deflt;
            }
            return data;
        }

        set(k, v) {
            let bits = k.split(":");
            let data = this.store_data;
            while (bits.length > 1) {
                let k = bits.shift();
                if (typeof data[k] === "undefined")
                    data[k] = {};
                data = data[k];
            }
            data[bits[0]] = v;
            return this.save();
        }

        open(options) {
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
                            let v = $(this).val();
                            try {
                                v = parseFloat(v);
                            } catch (e) {};
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
        }
    }
    return Config;
});


