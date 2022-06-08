/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */
/* global requirejs */

/**
 * Shed management application. See README.md
 */

define("app/js/Sheds", [
	"app/js/Config", "app/js/WebDAVStore", "app/js/Entries", "app/js/Roles",
	"js-cookie",

	"jquery", "jquery-ui","jquery-validate", "jquery-confirm",
	"app/js/jq/with-info"
], (
	Config, WebDAVStore, Entries, Roles,
	Cookies
) => {

	/**
     * Update time displays
     */
    function tick() {
        const now = new Date();
        $(".time_display").text(now.toLocaleDateString() +
                                " " + now.toLocaleTimeString());
        $(".date_display").text(now.toLocaleDateString());
        const when = 1000 - (Date.now() % 1000);
        window.setTimeout(tick, when);
    }

    class Sheds {

        constructor(params) {
            if (params.debug) {
                if (params.console) {
                    // Simulated console in #console
                    this.debug = () => {
                        console.debug.apply(console, arguments);
                        $("#console")
                        .append(
                            `<div>${Array.from(arguments).join(" ")}</div>`);
                    };
                    this.consoleActive = true;
                } else
                    this.debug = console.debug;
            } else
				this.debug = () => {};

            // Possible override of cache_url, otherwise use whatever
            // is cookied in the browser
            if (params.cache_url) {
                Cookies.set("cache_url", params.cache_url, {
                    expires: 365,
					sameSite: "strict"
                });
            }

            // Configuration defaults
            this.config = new Config(
                new WebDAVStore(this.debug),
                {
                    loan_return: 10,
                    o2: {
						price: 0.01,
						bank: {
							1: 50.2,
							2: 50.2,
							3: 47.5,
							4: 47.5
						}
					},
                    
                    compressor: {
                        portable: {
                            filter: {
                                lifetime: 15,
                                a: 1.84879,
                                b: 1.124939,
                                c: 14.60044,
                                d: -0.3252651
                            }
                        },
                        fixed: {
                            filter: {
                                lifetime: 40,
                                a: 3.798205,
                                b: 1.149582,
                                c: 11.50844,
                                d: -0.4806983
                            },
                            pumping_rate: 300,
                            purge_freq: 5,
                            safe_limit: 25,
                            sensor_url: null,
                            poll_frequency: 0,
                            internal_temperature_alarm: 90
                        }
                    }
                },
                this.debug
            );

            new Roles()
            .init(this.config)
            .then(roles => this.roles = roles);
        }

        /**
         * Update all UIs from the cache
         * @return {Promise} promise that resolves to this
         * @override
         */
        reloadUI() {
            this.debug("Reloading UI", this.roles);
            return Promise.all(
                Object.values(this)
				.filter(f => f instanceof Entries)
				.map(f => f.reloadUI()))
            .then(() => {
                $("#main_tabs").tabs("option", "disabled", []);
                return this;
            });
        }

        update_from_web(report) {
            if (!this.config.get("db_index_url")) {
                $.alert({
                    title: "Cannot update from web",
                    content: "No DB index URL set"
                });
                return Promise.reject(new Error("Cannot update form web"));
            }
            this.debug("Updating WebDAV from read-only database");
            return new Entries()
            .init({
                url: this.config.get("db_index_url"),
                keys: {
                    sheet: "string",
                    url: "string"
                }
            })
            .then(index => index.loadFromStore())
            .then(index => Promise.all([
                index.find("sheet", "roles")
                .then(row => this.roles.update_from_web(row.url, report)),
                index.find("sheet", "inventory")
                .then(row => (
                    this.inventory
                    ? this.inventory.update_from_web(row.url, report)
                    : null))
            ]))
            .then(() => {
                report("info", "Update from the web finished");
                $(document).trigger("reload_ui");
            })
            .catch(e => {
                $.alert({
                    title: "Web update failed",
                    content: e
                });
            });
        }

        /**
         * @return Promise
         */
        initialise_ui() {
            // Generics
            $(".spinner").spinner();
            $("button").button();
            $("input[type='checkbox']").checkboxradio();
            $('.ui-spinner-button').click(function () {
                $(this).siblings('input').change();
            });

            $.validator.setDefaults({ ignore: ".novalidate" });

            $(".validated_form").each(function () {
                $(this).validate({
                    // Don't ignore selects that are hidden by jQuery plugins
                    ignore: ""
                });
            });

            // Add a validator that looks at the temperature and humidity
            // to determine if the values are within range for operating
            // this compressor
            $.validator.addMethod(
                "compressor",
                (v, el, compressor) => {
                    return this[compressor].operable();
                },
                "Compressor must not be operated");

            $("input").on("keypress", function (e) {
                if (e.charCode == 13 && /Android/.test(navigator.userAgent)) {
                    e.preventDefault();
                    $(this).blur();
                }
            });

            // Start the clock
            tick();

            const $gear = $('#settings');
            const self = this;
            $gear.on("click", () => {
                this.config.open({
                    autoClose: 'close|60000',
                    buttons: {
                        close: {
                            btnClass: "ui-button ui-corner-all ui-widget",
                            action: function () {
                                if (this.$content.find("[name='cache_update']").is(":checked")) {
                                    const $a = $.confirm({
                                        title: "Updating from the web",
                                        content: ""
                                    });
                                    self.config.save()
                                    .then(() => self.update_from_web((clss, m) => {
                                        $a.setContentAppend(`<div class="${clss}">${m}</div>`);
                                    }));
                                } else
                                    self.config.save();
                            }
                        }
                    },
                    validity: function (ok) {
                        $.each(this.buttons, function (i, m) {
                            if (ok) {
                                m.removeClass("ui-button-disabled ui-state-disabled");
                                m.enable();
                            } else {
                                m.addClass("ui-button-disabled ui-state-disabled");
                                m.disable();
                            }
                        });
                    },
                    /* onContentReady defined in Config.js */
                    moreOnContentReady: function () {
                        this.$content.find("[data-with-info]")
                        .with_info();

                        this.$content.find("input[name='cache_url']")
                        .val(Cookies.get("cache_url"))
                        .off("change")
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

                        // jconfirm knackers checkboxes, so have to do some
                        // fancy footwork
                        this.$content.find(".cache_updater")
                        .each(function() {
                            const $label =
                                $("<label>" + $(this).text() + "</label>");
                            const $b = $("<input type='checkbox' name='cache_update'>");
                            $label.append($b);
                            //$b.checkboxradio();
                            $(this).replaceWith($label);
                        });
                    }
                });
            });

            // Information buttons
            $("[data-with-info]").with_info();
  
            $(".slider").each(function() {
                const $this = $(this);
                const data = $this.data("slider");
                data.animate = true;
				// The "friend" of a slider is the id of an input that will
				// take the value from the slider
                if (data.friend) {
                    data.slide = (e, ui) => {
						// As the slider slides, set the value of the friend
                        $(data.friend).val(ui.value);
                    };
                }
                $(this).slider(data);
                if (data.friend) {
					// Initialise the slider value to the friend value
                    $this.slider("value", $(data.friend).val());
                }
            });

            $(document).on("reload_ui", () => {
                this.reloadUI()
                .then(() => {
                    if (!this.consoleActive)
                        $("#loading").hide();
                    $("#loaded").show();
                    window.scrollTo(0,document.body.scrollHeight);
                });
            });
        }

        promise_to_reconnect(url) {
			const app = this;
            return new Promise(resolve => {
                $.confirm({
                    title: $("#connect_failed_dialog").prop("title"),
                    content: $("#connect_failed_dialog").html(),
                    onContentReady: function () {
                        const jc = this;
                        jc.$content
                        .find("input")
                        .on("change", () => {
                            jc.$$try_again.trigger("click");
                        })
                        .val(url ? url : "");
                        jc.$content.find(".url").text(url);
                        jc.buttons.try_again.setText("Try again");
                        jc.buttons.continue_without.setText("Continue without cache");
                    },
                    buttons: {
                        try_again: function () {
                            const nurl = this.$content.find("input").val();
                            app.debug("Trying again with", nurl);
                            resolve(app.cache_connect(nurl));
                        },
                        continue_without:  function () {
                            app.debug("Continuing without cache");
                            $(document).trigger("reload_ui");
                            resolve();
                        }
                    }
                });
            });
        }

        promise_to_authenticate(url) {
            const app = this;
            return new Promise(resolve => {
                $.confirm({
                    title: $("#auth_required").prop("title"),
                    content: $("#auth_required").html(),
                    onContentReady: function () {
                        this.$content.find(".url").text(url);
                        this.$content
						.find("input[name='pass']")
						.on("change", () => {
							this.$$login.trigger("click");
						});
                    },
                    buttons: {
                        login: function () {
                            const user = this.$content
								.find("input[name='user']").val();
                            const pass = this.$content
								.find("input[name='pass']").val();
                            app.config.store.setCredentials(user, pass);
                            resolve(app.cache_connect(url));
                        }
                    }
                });
            });
        }

        cache_connect(url) {
            this.debug("Trying to connect to", url);
            return this.config.store
            .connect(url)
            .then(() => {
                this.debug("connected to", url, "loading config");
                return this.config.load()
                .then(() => {
                    Cookies.set("cache_url", url, {
                        expires: 365
                    });

					// Reset all Entries
					Promise.all(Object
								.values(this)
								.filter(f => f instanceof Entries)
								.map(f => f.reset()))
					.then(() => $(document).trigger("reload_ui"));
                })
                .catch(e => {
                    this.debug("config.json load failed:", e,
                                  "Trying to save a draft");
                    return this.config.save()
                    .then(() => {
                        return this.cache_connect(url);
                    })
                    .catch(e => {
                        this.debug("Bootstrap failed:", e);
                        $.alert({
                            title: "Bootstrap failed",
                            content: "Could not write config.json"
                        });
                        return this.promise_to_reconnect();
                    });
                });
            })
            .catch(e => {
                this.debug(url, "connect failed", e);
                if (e.status === 401) {
                    // XMLHttpRequest will only prompt for credentials if
                    // the request is for the same origin with no explicit
                    // credentials. So we have to handle credentials.
                    this.debug("Auth failure, get auth");
                    return this.promise_to_authenticate(url);
                }
                //return this.promise_to_reconnect(url);
                // Trying to repeatedly connect doesn't provide any
                // useful feedback. Rejecting at least gives a chance
                // to feeback.
                if (e.html)
                    $("#loading").html(e.html);
                return Promise.reject(new Error("Could not connect to " + url));
            });

        }

        begin() {
			const requires = [];
			$("#main_tabs li>a").each((i, el) => {
				const id = el.href.replace(/^.*#/, "");
				const clazz = $(el).data("class");
				requires.push(
					new Promise(resolve => {
						this.debug("Requiring", id);
						requirejs([`app/js/${clazz}`], Tab => resolve(Tab));
                    })
                    .then(Tab => new Tab()
                          .init({
							  config: this.config,
							  sheds: this,
							  id: id,
							  store: this.config.store,
							  debug: this.debug
						  }))
                    .then(tab => tab.loadUI())
                    .then(tab => tab.attachHandlers())
                    .then(tab => this[id] = tab));
			});
			Promise.all(requires)
			.then(() => $("#main_tabs").tabs())
            .then(() => this.initialise_ui())
            .then(() => {
                let promise;
                const url = Cookies.get("cache_url");
                if (typeof url === "undefined" || url.length == 0)
                    promise = this.promise_to_reconnect();
                else
                    promise = this.cache_connect(url);

                promise
                .catch(e => {
                    console.error("Internal failure", e, url);
                });
            });
        }
    }

    return Sheds;
});
