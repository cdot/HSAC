let raspi = require('raspi');
let gpio = require('raspi-gpio');

console.log(process.argv);
let gpioPin = parseInt(process.argv[2]);

raspi.init(() => {
   let pin = new gpio.DigitalInput({
       pin: "GPIO" + gpioPin,
       pullResistor: gpio.PULL_DOWN
    });

    let state;
    function sample() {
        let newstate = pin.read();
        if (newstate != state)
            console.log("Edge", newstate);
        state = newstate;
        setTimeout(sample, 1);
    }

    sample();
});


