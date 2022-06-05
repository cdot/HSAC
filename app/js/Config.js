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
            .then(json => {
                const d = JSON.parse(json);
                this.store_data = $.extend({}, this.store_data, d);
                this.debug("Config loaded");
            });
        }

        save() {
            return this.store.write("config.json",
                                    JSON.stringify(this.store_data, null, 1))
            .then(() => {
                this.debug("Config saved");
            })
            .catch(e => {
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
            const $template = $("#settings_dialog");
            const self = this;

            const opts = $.extend({
                title: $template.data("title"),
                content: $template.html(),
                onContentReady: function() {
                    const $form = this.$content.find("form");
                    const jc = this;
                    $form.find("input")
                    .on("change", evt => {
                        const item = evt.target.name;
                        let v = $(evt.target).val();
                        if (/^[0-9.]*$/.test(v)) {
                            let sv = v;
                            try {
                                v = parseFloat(sv);
                            } catch (e) {
                                v = sv;
                            }
                        }
                        const ok = $form.valid();
                        if (opts.validity)
                            opts.validity.call(jc, ok);
                        if ($form.valid())
                            self.set(item, v);
                    })
                    .each((i, el) => {
                        const v = self.get(el.name);
                        if (this.type === "checkbox")
                            $(el).prop('checked', v === el.value);
                        else
                            $(el).val(v);
                    });
                    if (opts.moreOnContentReady)
                        opts.moreOnContentReady.call(this);
                    if (!this.$content.find("form").valid())
                        this.buttons.close.disable();
                }
            }, options);
            $.confirm(opts);
        }
    }
    return Config;
});


