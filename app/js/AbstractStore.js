/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

define("app/js/AbstractStore", () => {
    /**
     * Pure virtual base class of store providers.
     *
     * Store providers provide a simple file system interface to text data in the
     * store.
     */

    class AbstractStore {

        /**
         * Promise to connect to this store using the given parameters.
         * Pure virtual.
         * @param params
         */
        connect(params) {
            return Promise.reject(new Error("Store has no connect method"));
        };

        /**
         * Set credentials for this store
         * @param user username
         * @param pass password
         */
        setCredentials(user, pass) {
            throw new Error("Store has no setCredentials method");
        };

        /**
         * Promise to disconnect from this store. Virtual.
         * This method should clear all caches and log out from the store,
         * if appropriate.
         */
        disconnect() {
            return Promise.resolve();
        };

        /**
         * Return a Promise to write data. Pure virtual. Note that the store is
         * expected to create intermediate directory levels on the fly.
         * @param path pathname to store the data under, a / separated path string
         * @param data a string to store
         */
        write(path, data) {
            return Promise.reject(new Error("Store has no write method"));
        };

        /**
         * Return a Promise to read data.
         * @param path pathname the data is stored under, a / separated path string
         * @param ok called on success with this=self, passed String
         * @param fail called on failure
         */
        read(path, ok, fail) {
            return Promise.reject(new Error("Store has no read method"));
        }
    }
    return AbstractStore;
});
