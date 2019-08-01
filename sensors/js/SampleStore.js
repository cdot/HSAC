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
        }

        /**
         * Promise to save a new sample
         * @param data sample to store
         * @param age_limit max age for samples, in ms
         * @param id name to store sample in
         * @return Promise that will resolve when the sample has been saved
         */
        addSample(data, age_limit, id) {
            let path = id + ".csv";
            let cutoff = Date.now() - age_limit;
            // SMELL: npm webdav doesn't provide any locking mechanism.
            // Not a big deal, as the architecture can't cause collisions.
            return this.mDAV.getFileContents(path, { format:"text" })
            .catch((e) => {
                console.error("Failed to read", path, "from", this.mURL);
                return "";
            })
            .then((res) => {
                // Split into lines, and then into columns. Each row has
                // two columns, time and sample.
                let records;
                if (res) {
                    let lines = res.toString().split("\n");
                    records = lines.map(s => s.split(","));
                } else
                    records = [];
                // Parse columns
                for (let r of records) {
                    r[0] = parseNumber(r[0]);

                    // Filter records by age
                    while (records[0][0] < cutoff)
                        records.shift();
                }

                console.debug("Adding sample");
                // Add new sample
                records.push([Date.now(), samples[sensor]]);

                // Recombine into a string
                let body = records.map(r => r.join(",")).join("\n");

                // And save the new body
                return this.mDAV.putFileContents(this.mPath,  body)
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
