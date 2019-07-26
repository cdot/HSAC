define("sensors/js/DHTxx", ['node-dht-sensor'], function(DHT) {

    /**
     * Interface to DHTxx temperature and humidity sensors on 
     * Raspberry Pi gpio pins
     */
    class DHTxx {

        constructor(device, gpio) {
            this.device = device;
            this.gpio = gpio;
        }

	read() {
            return new Promise((resolve, reject) => {
                DHT.read(this.device, this.gpio, (err, temperature, humidity) => {
                    if (err)
                        reject(err);
                    else
                        resolve({t: temperature, h: humidity});
                });
            });
        }
    }
    return DHTxx;
});
