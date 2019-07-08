/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

define("js/Roles", ["js/Entries"], (Entries) => {

    class Roles extends Entries {
        /**
         * Roles are read from "roles.csv' on WebDAV
         */
        constructor(params) {
            super({
                store: params.config.store,
                file: "roles.csv",
                keys: {
                    role: "string",
                    list: "string"
                },
                debug: params.config.debug
            });
        }

        /**
         * Reload the UI by re-reading the roles file from the cache
         */
        reload_ui() {
            if (this.debug) this.debug("Reloading roles");
            return this.load()
            .then(() => {
                // Roles.csv has two columns, "role" and "list" which is a
                // comma-separated list of members in that role
                this.each((row) => {
                    var $lists = $("select." + row.role);
                    $lists.html("<option></option>");
                    var list = row.list.split(",");
                    $.each(list, function (i, m) {
                        $lists.append("<option>" + m + "</option>");
                    });
                });
            })
            .catch((e) => {
                console.error("Roles load failed: " + e);
            });
        }

        /**
         * Update roles in the cache by reading from a CSV file on the web
         */
        update_from_web(roles_url, report) {
            var self = this;

            return $.ajax({
                url: roles_url,
                data: {
                    t: Date.now()
                },
                dataType: "text"
            })
            .then((response) => {
                report("info", "Read roles from the web");
                return self.store.write('roles.csv', response)
                .then(() => {
                    report("info", "Updated roles");
                })
                .catch((e) => {
                    report("error", "Error writing roles to the cache: " +
                           (e.status ? e.status : e));
                });
            })
            .catch((e) => {
                report("error", "Error reading roles from the web: " +
                       (e.status ? e.status : e));
            });
        }
    }
    return Roles;
});
