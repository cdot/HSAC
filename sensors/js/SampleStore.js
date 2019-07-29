define("sensors/js/SampleStore", [ "webdav"], function(WebDAV) {

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
         * @param age_limit max age for samples
         * @param id name to store sample in
         * @return Promise that will resolve when the sample has been saved
         */
        addSample(data, age_limit, id) {
            let path = id + ".csv";
            let cutoff = Date.now() - age_limit;
            // SMELL: npm webdav doesn't provide any locking mechanism.
            // Not a big deal, as the architecture can't cause collisions.
            return this.mDAV.getFileContents(path)
            .then((res) => {
                // Split into lines, and then into columns
                let records;
                if (res) {
                    let lines = res.toString().split("\n");
                    records = lines.map(s => s.split(","));                    
                } else
                    records = [];

                // Parse columns
                for (let r of records)
                    r[1] = parseNumber(r[1]);
                    
                // Filter records by age
                while (records[0][1] < cutoff)
                    records.shift();

                // Add new sample
                records.push([sensor, Date.now(), samples[sensor]]);

                // Recombine into a string
                let body = records.map(r => r.join(",")).join("\n");

                // And save the new body
                return this.mDAV.putFileContents(this.mPath,  body);
            });
        }
    }
    return SampleStore;
});
