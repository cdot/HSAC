/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define([ "js-cookie" ], Cookies => {

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
      return this.store.write(
        "config.json",
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
      for (const bit of k.split(":")) {
        data = data[bit];
        if (typeof data === "undefined")
          return deflt;
      }
      return data;
    }

    set(k, v) {
      const bits = k.split(":");
      let data = this.store_data;
      while (bits.length > 1) {
        const k = bits.shift();
        if (typeof data[k] === "undefined")
          data[k] = {};
        data = data[k];
      }
      data[bits[0]] = v;
    }

    create(app) {
      this.$content = $("#settings_dialog");
      this.$content.show();
      $("input[type=number]", this.$content)
      .on("change", evt => {
        let v = $(evt.target).val();
        if (/^[0-9.]*$/.test(v)) {
          const sv = v;
          try {
            v = parseFloat(sv);
          } catch (e) {
            v = sv;
          }
        }
        
        this.set(evt.target.name, v);
      });
      
      $("input[type=text]", this.$content)
      .on("change", evt => 
          this.set(evt.target.name, $(evt.target).val()));
      
      $("input[type=checkbox]", this.$content)
      .on("click", evt =>
          this.set(evt.target.name, $(evt.target).is(":checked")));

      $("[data-with-info]", this.$content)
      .with_info();

      $("input[name=cache_url]", this.$content)
      .on("change", function (e) {
        const nurl = $(e.target).val();
        if (nurl != Cookies.get("cache_url")) {
          Cookies.set("cache_url", nurl, {
            expires: 365
          });
          $.alert({
            title: "Store cache URL changed",
            content: "Application will now be reloaded",
            buttons: {
              ok: function () {
                const loc = String(location).replace(/\?.*$/, "");
                location = loc + "?t=" + Date.now();
              }
            }
          });
        }
      });

      $("button[name=update_cache]")
      .on("click", () => {
        const $a = $.confirm({
          title: "Updating from the web",
          content: ""
        });
        this.save()
        .then(() => app.update_from_web((clss, m) => {
          $a.setContentAppend(`<div class="${clss}">${m}</div>`);
        }));
      });

      $("button[name=close]", this.$content)
      .on("click", () => {
        this.$content.hide();
        $("#loaded").show();
      });
    }

    open(app) {
      if (!this.$content)
        this.create(app);

      $("input[type=text],input[type=number]", this.$content)
      .each((i, el) => $(el).val(this.get(el.name)));

      $("input[name=cache_url]", this.$content)
      .val(Cookies.get("cache_url"));

      $("input[type=checkbox]", this.$content)
      .each((i, el) => {
        const v = this.get(el.name);
        if (/^\s*(true|1|on|yes)\s*/i.test(v))
          $(el).prop("checked", true);
        else
          $(el).removeProp("checked");
      });

      $("#loaded").hide();
      this.$content.show();
    }
  }
  return Config;
});
