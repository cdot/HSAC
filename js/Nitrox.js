"use strict";

var Nitrox = {
    MIX_ACHIEVABLE: 0, //"Mix is achievable"
    TOO_MUCH_O2: 1,    //"Too much O2",
    BANK_LACKS_O2: 2,  //"Not enough usable O2 in bank",

    /**
     * temperature: deg C
     * cylinder_size: litres
     * start_mix: percent
     * start_pressure: bar
     * target_mix: percent
     * target_pressure: bar
     * O2_bank_size: litres
     * O2_bank_pressure: bar
     */
    blend: function(conditions, log) {
        // Universal gas constant
        const R = 0.0820578; // l-atm/mol-K

        var T = conditions.temperature + 273.15; // Kelvin
        var V = conditions.cylinder_size; // Cylinder size, in litres
        var start_mix = conditions.start_mix / 100; // 0.percent
        var start_pressure = conditions.start_pressure; // bar
        var target_mix = conditions.target_mix / 100; // 0.percent
        var target_pressure = conditions.target_pressure; // bar

        console.log("Temperature is",T, "K");
        console.log("Cylinder",V,"l with", start_pressure, "bar of", start_mix);
        console.log("Target is", target_pressure, "of", target_mix);
        
        // Ideal O2 to add to make mix
        var eO2_in_start_mix = ((start_mix - 0.21) / 0.79) * start_pressure; // litres
        var eO2_in_target_mix = ((target_mix - 0.21) / 0.79) * target_pressure;
        if (eO2_in_start_mix > eO2_in_target_mix) {
            var down_to = start_pressure * eO2_in_target_mix / eO2_in_start_mix; // bar
            // Too much O2; bleed and recalculate
            return { bleed: down_to, status: Nitrox.TOO_MUCH_O2 };
        }
        
        var ideal_O2_to_add =
            ((target_mix - 0.21) / 0.79) * target_pressure - ((start_mix - 0.21) / 0.79) * start_pressure; // bar
            console.log("Ideal O2 to add", ideal_O2_to_add,"bar")
        
        // MOD of final mix
        var MOD = ((1.4 / target_mix) * 10) - 10; // m

        // O2 bank parameters
        var O2_bank_size = conditions.O2_bank_size; // l
        var O2_bank_pressure = conditions.O2_bank_pressure; // bar

        // Ideal gas law states PV = nRT, but this doesn't work very well
        // for real gases. A closer approximation to reality uses
        // Van der Waals equation of state to derive better numbers for
        // P, V, and n. See
        // https://en.wikipedia.org/wiki/Van_der_Waals_equation
        // This class calculates Van der Waal's for a gas
        // Options:
        // Van der Waal's coefficients
        // a: correction for intermolecular forces
        // b: correction for finite molecular size
        // P: partial pressure of this gas in final system
        function Gas(options) {
            for (var o in options) {
                this[o] = options[o];
            }
            
            var P = this.P; // Pressure (bar)
            var V = this.V; // total volume, litres
            const N = 1;    // Number of moles
            console.log(this.name + ": Pressure", P, "Volume", V);
            
            var N2 = N * N, N3 = N2 * N;
            var a = this.a, b = this.b;
            var ab = a * b, Nb = N * b, N2a = N2 * a;

            var NRT = N * R * T;

            // initial approximation of real volume using ideal gas law (litres)
            var vReal = NRT / P;
            //console.log(this.name + ": Initial approximation of vReal", vReal);
            
            // Iterate Van De Waal's equation of state to improve estimate
            // of volume
            //console.log(this.name + ": Van der Waal's equation of state");
            var limit = 100;
            while (true) {
                var vReal2 = vReal * vReal;
                var fvReal =
                    (P + (N2a / vReal2)) * (vReal - Nb) - NRT;
                var f_vReal =
                    (P - (N2a / vReal2) + (2 * ab * (N3 / (vReal2 * vReal))));
                var h = fvReal / f_vReal;
                if (Math.abs(h) < 1e-12)
                    break;
                vReal = vReal - h;
                console.log(this.name + ": vReal = vReal - ", h, "=", vReal);
                if (limit-- == 0)
                    throw "Error: Van der Waal iteration overran";
            }
            console.log(this.name + ": vReal", vReal);
            var nReal = N * V / vReal; // Real number of moles
            this.pReal = (nReal * R * T) / V; // Real pressure, bar
        }

        // Gases in final mix
        const O2 = new Gas({
            name: "O2",
            P: ideal_O2_to_add, // bar
            V: V, // litres

            // Van der Waal's coefficients
            a: 1.36, // l^2 atm/mol^2
            b: 0.03183, // l/mol

            mw: 31.998  // g
        });
        console.log("Real O2 to add", O2.pReal, "bar", "B11");

        /*
          const Helium  = new Gas({
          V: V, // litres

          a: 0.03412,
          b: 0.0237,
          mw: 4.0020602,
          mw: 28.85 // weight of 1 mole, g
          });
        */
        
        const Air = new Gas({
            name: "Air",
            V: V, // litres

            P: target_pressure - (start_pressure + ideal_O2_to_add), // bar

            // Van der Waal's coefficients
            // "Air" = 20.9% nitrox, so these are ~ nitrogen
            a: 1.3725, // l^2 atm/mol^2
            b: 0.0372, // l/mol
            mw: 28.85 // weight of 1 mole, g
        });
        var O2_in_cylinder = start_pressure * start_mix;
        var O2_needed = V * (O2.pReal - O2_in_cylinder);
        var O2_in_bank = O2_bank_pressure * O2_bank_size;
        // SMELL: use real_O2_to_add?
        var useable = (O2_bank_pressure - (start_pressure + ideal_O2_to_add)) * O2_bank_size;

        if (useable < O2_needed)
            return {
                O2_needed_litres: O2_needed,
                bank_useable_litres: useable,
                status: Nitrox.BANK_LACKS_O2
            };
        
        return {
            add_ideal_O2_bar: ideal_O2_to_add,
            add_real_O2_bar: O2.pReal,
            O2_in_cylinder_bar: O2_in_cylinder,
            O2_needed_litres: O2_needed,
            bank_total_litres: O2_in_bank,
            bank_useable_litres: useable,
            bank_left_bar: (1 - (O2_needed / O2_in_bank)) * O2_bank_pressure,
            status: Nitrox.MIX_ACHIEVABLE
        };
    }
};

if (typeof module !== "undefined")
    module.exports = Nitrox;
    
