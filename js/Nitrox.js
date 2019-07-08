/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Nitrox", () => {

    // Universal gas constant
    const R = 0.0820578; // l-atm/mol-K
    const atmO2 = 0.209;
    
    // Ideal gas law states PV = nRT, but this doesn't work very well
    // for real gases. A closer approximation to reality uses
    // Van der Waals equation of state to derive better numbers for
    // P, V, and n. See
    // https://en.wikipedia.org/wiki/Van_der_Waals_equation
    // This class calculates Van der Waal's for a gas
    // @param P partial pressure of this gas in final system (bar)
    // @param V total volume, litres
    // @param a correction for intermolecular forces
    // @param b correction for finite molecular size
    function vanDerWaal(name, P, V, T, a, b, debug) {

        if (P == 0)
            return V;

        const N = 1; // Number of moles
        if (debug) debug(name + ": Pressure " + P + " Volume " + V);

        var N2 = N * N,
            N3 = N2 * N;
        var ab = a * b,
            Nb = N * b,
            N2a = N2 * a;

        var NRT = N * R * T;

        // initial approximation of real volume using ideal gas law (litres)
        var vReal = NRT / P;
        //if (debug) debug(name + ": Initial approximation of vReal " + vReal);

        // Iterate Van De Waal's equation of state to improve estimate
        // of volume
        //if (this.cfg.debug) debug(name + ": Van der Waal's equation of state");
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
            vReal -= h;
            if (debug) debug(name + ": vReal = vReal - " + h);
            if (limit-- == 0)
                throw "Error: Van der Waal iteration overran";
        }
        if (debug) debug(name + ": vReal" + vReal);
        var nReal = N * V / vReal; // Real number of moles
        return (nReal * R * T) / V; // Real pressure, bar
    }

    class Nitrox {
        /**
         * Nitrox calculation tab
         */
        constructor(config) {
            this.cfg = config || {};
            this.debug = this.cfg.debug;
            var self = this;

            $(() => {
                $("#nitrox").children("form").on("submit", (e) => {
                    e.preventDefault();
                    if (!$(e.target).valid())
                        return;
                    self.submit();
                });
            });
        }

        submit() {
            var conditions = {};
            $("#nitrox").find("form :input").each(function () {
                if (this.type === "number")
                    conditions[this.name] = parseFloat($(this).val());
                else
                    conditions[this.name] = $(this).val();
            });
            var result = this.blend(conditions);
            var ppO2max = this.cfg.get("ppO2max");
            var MOD = Math.floor(((ppO2max / result.tgtMix) * 10) - 10);
            var $report = $("#nitrox").children(".report");
            $report.html("Filling a " + result.V + "L cylinder " +
                         "containing " + result.curP_b + " bar of " +
                         (result.curMix * 100) + "% with " + result.tgtP_b +
                         " bar of " + (result.tgtMix * 100) + "% (MOD " +
                         MOD + "m, ppO<sub>2</sub> " + ppO2max + " bar)<br>");
            if (result.bleed_b > 0) {
                $report.html(
                    "There is too much gas already in the cylinder for " +
                    "this fill. To use this bank you will have to bleed " +
                    "the cylinder down below " +
                    Math.floor(result.bleed_b) +
                    " bar");
            } else if (result.useableO2_l < result.O2Needed_l) {
                $report.html(
                    "There is not enough O<sub>2</sub> in this bank for " +
                    " this fill");
                if (result.curPressure_b > 1)
                    $report.append(", even if the cylinder is emptied first.");
            } else {
                $report.append(
                    "Boost cylinder with O<sub>2</sub> to " +
                    Math.floor(result.boostToReal_b) +
                    " bar before topping up to " + result.tgtP_b +
                    " bar with air.<br>");
                $report.append(
                    "This will use " +
                    Math.round(result.O2Needed_l) +
                    " litres of O<sub>2</sub> at a cost of <strong>&pound;" +
                    (Math.round(100 * (result.O2Needed_l *
                                       parseFloat(this.cfg.get("o2_price")))) / 100) +
                    "</strong><br>");
                $report.append("There should be approximately " +
                               Math.floor(result.bankLeft_b) +
                               " bar left in the bank<br>");
            }
        }

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
        blend(conditions) {
            if (this.debug) {
                this.debug("Temperature " + conditions.temperature + "°C");
                this.debug("Cylinder " + conditions.cylinder_size + " l");
                this.debug("Current Pressure " + conditions.start_pressure + " bar");
                this.debug("Current Mix " + conditions.start_mix + "%");
                this.debug("Target Pressure " + conditions.target_pressure + " bar");
                this.debug("Target Mix " + conditions.target_mix + "%");
            }

            // O2 bank parameters
            var O2BankV_l = conditions.O2_bank_size; // l
            var O2BankP_b = conditions.O2_bank_pressure; // bar
            
            // Load result structure with initial conditions
            var r = {
                T: conditions.temperature + 273.15, // Kelvin
                V: conditions.cylinder_size,
                curMix: conditions.start_mix / 100, // 0.percent
                curP_b: conditions.start_pressure, // bar
                tgtMix: conditions.target_mix / 100, // 0.percent
                tgtP_b: conditions.target_pressure // bar 
            };
            
            // Work out how many bar of extra O2 in the start and target
            // mixes, over and above atmospheric 21%.
            var extraO2InStartMix_b = ((r.curMix - atmO2) / (1 - atmO2)) * r.curP_b;
            if (this.debug) this.debug("Extra O2 in start mix " + extraO2InStartMix_b + " bar");
            
            var extraO2InTargetMix_b = ((r.tgtMix - atmO2) / (1 - atmO2)) * r.tgtP_b;
            if (this.debug) this.debug("Extra O2 in target mix " + extraO2InTargetMix_b + " bar");
            
            if (extraO2InStartMix_b > extraO2InTargetMix_b) {
                // Too much O2; bleed and recalculate
                r.bleed_b = r.curP_b * extraO2InTargetMix_b /
                extraO2InStartMix_b;
                if (this.debug) this.debug("bleed to " + r.bleed_b + " bar");
                
                return r;
            }
            
            // Calculate how many bar of O2 we'd have to add to make up the
            // difference, ideal gas
            var idealO2ToAdd_b = extraO2InTargetMix_b - extraO2InStartMix_b;
            var boostToIdeal_b = r.curP_b + idealO2ToAdd_b;

            if (this.debug) {
                this.debug("Ideal gas O2 to add " + idealO2ToAdd_b + " bar");
                this.debug("Ideal gas boost to " + boostToIdeal_b + " bar");
            }

            // Calculate how many bar of O2 we'd have to add to make up the
            // difference, real gas
            var realO2ToAdd_b = vanDerWaal(
                "O2",
                idealO2ToAdd_b, // bar
                r.V, // litres
                r.T,

                // Van der Waal's coefficients
                1.36, // l^2 atm/mol^2
                0.03183, // l/mol
                this.debug
            );

            if (this.debug) this.debug("Real O2 to add " + realO2ToAdd_b + " bar");

            /*var Air_pReal = vanDerWaal(
              "Air",
              r.tgtP_b - (r.curP_b + idealO2ToAdd_b), // bar
              V, // litres
              r.T,

              // Van der Waal's coefficients
              // "Air" = 20.9% oxygen, so these are ~ nitrogen
              1.3725, // l^2 atm/mol^2
              0.0372 // l/mol
              );*/
            r.boostToReal_b = r.curP_b + realO2ToAdd_b;
            if (this.debug) this.debug("Real gas boost to " + r.boostToReal_b + " bar");

            // We need to add O2, but that's only possible if the bank pressure
            // is high enough
            r.O2Needed_l = r.V * (realO2ToAdd_b - r.curP_b * r.curMix);
            r.bankLoss_b = r.O2Needed_l / O2BankV_l;
            r.bankLeft_b = O2BankP_b - r.bankLoss_b;

            if (this.debug) this.debug("O2 needed for this fill " + r.O2Needed_l + " litres");

            if (r.bankLeft_b < r.boostToReal_b) {
                // It will actually be a bit more than this
                r.bleed_b = r.bankLeft_b - realO2ToAdd_b;
                return r;
            }

            if (this.debug) this.debug("Bank left " + r.bankLeft_b + " bar");

            return r;
        };
    }
    return Nitrox;
});
        
