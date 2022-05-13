/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

define("app/js/Roles", ["app/js/Entries"], (Entries) => {

    class Roles extends Entries {
        /**
         * Roles are read from "roles.csv' on WebDAV
         */
        constructor(params) {
            super($.extend(params, {
                file: "roles.csv",
                keys: {
                    role: "string",
                    list: "string"
                },
            }));
        }

        /**
         * Reload the UI by re-reading the roles file from the cache
         */
        reloadUI() {
            this.debug("Reloading roles");
            return this.loadFromStore()
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
            return $.ajax({
                url: roles_url,
                data: {
                    t: Date.now()
                },
                dataType: "text"
            })
            .then((response) => {
                report("info", "Read roles from the web");
				this.reset();
                return this.store.write('roles.csv', response)
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
