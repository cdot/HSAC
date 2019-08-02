define("js/SampleStore", [ "webdav" ], function(WebDAV) {

    /**
     * Singleton interface to a webdav service that stores .csv
     * sample files. We use a singleton to avoid any issues with request
     * overlaps.
     */
    class SampleStore {

        /**
         * @param url webdav URL,
         * @param user webdav username
         * @param pass webdav password
         */
        constructor(url, user, pass) {
            this.mURL = url;
            this.mDAV = WebDAV.createClient(
                url,
                {
                    username: user,
                    password: pass
                });

            // Keep a cache of what was last written for each sensor ID
            this.mCaches = {};
        }

        /**
         * Promise to save a new sample
         * @param data sample to store
         * @param age_limit max age for samples, in ms
         * @param id name to store sample in
         * @return Promise that will resolve when the sample has been saved
         */
        addSample(data, age_limit, id) {
            let cutoff = Date.now() - age_limit;
            let path = id + ".csv";
            let promise;
            if (this.mCaches[id])
                promise = Promise.resolve(this.mCaches[id]);
            else {
                // Need to initialise internal cache from webdav
                promise =  this.mDAV.getFileContents(path, { format:"text" })
                .catch((e) => {
                    console.error("Failed to read", path, "from", this.mURL);
                    this.mCaches[id] = [];
                    return this.mCaches[id];
                })
                .then((res) => {
                    // Split into lines, and then into columns. Each row has
                    // two columns, time and sample.
                    let records;
                    if (res) {
                        let lines = res.toString().split("\n");
                        records = lines.map(s => s.split(","));

                        // Parse columns
                        for (let r of records) {
                            r[0] = parseInt(r[0]); // time
                            r[1] = parseFloat(r[1]); // sample
                        }
                        this.mCaches[id] = records;
                    } else
                        this.mCaches[id] = [];

                    return this.mCaches[id];
                });
            }

            return promise.then((records) => {
                // Filter records by age
                while (records.length > 0 && records[0][0] < cutoff)
                    records.shift();

                // Add new sample
                records.push([Date.now(), data]);

                // Recombine into a string
                let body = records.map(r => r.join(",")).join("\n");

                // And save the new body
                return this.mDAV.putFileContents(path,  body)
                .catch((e) => {
                    // WebDAV errors don't kill the service
                    console.error("Failed to update", path, "on", this.mURL, e);
                    return Promise.resolve();
                });
            });
        }
    }
    return SampleStore;
});
