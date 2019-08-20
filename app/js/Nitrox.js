/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("app/js/Nitrox", () => {

    // Universal gas constant
    const R = 0.0820578; // l-atm/mol-K
    const atmO2 = 0.209;
    const K0C = 273.15; // 0C in Kelvin
    // Van der Waal's coefficients
    const VdVA_O2 = 1.36; // l^2 atm/mol^2
    const VdVB_O2 = 0.03183; // l/mol

    /**
     * Ideal gas law states PV = nRT, but this doesn't work very well
     * for real gases. A closer approximation to reality uses
     * Van der Waals equation of state to derive better numbers for
     * P, V, and n. See
     * https://en.wikipedia.org/wiki/Van_der_Waals_equation
     * This function calculates this for a gas.
     * @param P partial pressure of this gas in final system (ideal bar)
     * @param V total volume, litres
     * @param a correction for intermolecular forces
     * @param b correction for finite molecular size
     * @return real gas partial pressure, in bar
     */
    function vanDerWaal(P, V, T, a, b) {

        if (P == 0)
            return V;

        const N = 1; // Number of moles

        var N2 = N * N,
            N3 = N2 * N;
        var ab = a * b,
            Nb = N * b,
            N2a = N2 * a;

        var NRT = N * R * T;

        // initial approximation of real volume using ideal gas law (litres)
        var vReal = NRT / P;

        // Iterate Van De Waal's equation of state to improve estimate
        // of volume
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
            if (limit-- == 0)
                throw "Error: Van der Waal iteration overran";
        }
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
            let self = this;

            $(() => {
                $("#nitrox").children("form").on("submit", (e) => {
                    e.preventDefault();
                });
                
                $("#nitrox").find("input").on("change", function (e) {
                    let $form = $(this).closest("form");
                    if (!$form.valid()) {
                        $("#nitrox").children(".report").text("");
                        return;
                    }
                    self.submit();
                });
                self.submit();
            });
        }

        submit() {
            let conditions = {};

            // temperature: deg C (only needed for real gas approximation)
            // cylinder_size: litres
            // start_mix: percent
            // start_pressure: bar
            // target_mix: percent
            // target_pressure: bar
            // O2_bank_size: litres
            // O2_bank_pressure: bar
            // ppO2max: max ppO2
            $("#nitrox").find("form :input").each(function () {
                if (this.type === "number")
                    conditions[this.name] = parseFloat($(this).val());
                else
                    conditions[this.name] = $(this).val();
            });

            let MOD = Math.floor((100 * conditions.ppO2max
                                  / conditions.target_mix - 1) * 10);
            $("#nox_MOD").text(MOD);

            let $report = $("#nitrox").children(".report");
            $report.empty();
           
            let Pd = conditions.target_pressure;
            let Md = conditions.target_mix / 100;
            let Ps = conditions.start_pressure;
            let Ms = conditions.start_mix / 100;
            let Pbs = conditions.O2_bank_pressure;
            let Sb = conditions.O2_bank_size;
            let Sc = conditions.cylinder_size;

            if (this.debug)
                this.debug("Pd %f Md %f Ps %f Ms %f Sb %f Sc %f",
                           Pd,    Md,   Ps,   Ms,   Sb,   Sc);

            // See https://scuba.garykessler.net/library/BlendingPaper.pdf
            // We know that
            // Pd * Md = Ps * Ms + Pf * Mf + Pt * Mt
            // Given that Pt = Pd - Ps - Pf, rewrite as
            // Pd * Md = Ps * Ms + Pf * Mf + (Pd - Ps - Pf) * Mt
            // Pd * Md = Ps * Ms + Pf * Mf + Pd * Mt - Ps * Mt - Pf * Mt
            // Pd * Md = Ps * Ms + Pf * Mf + Pd * Mt - Ps * Mt - Pf * Mt
            // Pf * Mf - Pf * Mt = Pd * Md - Pd * Mt - Ps * Ms + Ps * Mt
            // Pf * (Mf - Mt) = Pd * (Md - Mt) - Ps * (Ms - Mt)
            // Pf = (Pd * (Md - Mt) - Ps * (Ms - Mt)) / (Mf - Mt)
            // Given Mf = 1, Mt = 0.209
            let Pf = (Pd * (Md - 0.209) - Ps * (Ms - 0.209)) / 0.791;
            if (this.debug)
                this.debug("Pf",Pf);
          
            // Adjust for real gas approximation
            // Pf = vanDerWaal(Pf, conditions.cylinder_size,
            //        conditions.temperature + K0C, VdVA_O2, VdVB_O2);

            if (this.debug)
                this.debug("O2 required:", Pf);

            if (Pf < 0) {
                // Calculate maximum starting pressure for given fill
                // Pf = 0 = (Pd * (Md - 0.209) - Ps * (Ms - 0.209)) / 0.791
                // 0 = Pd * (Md - 0.209) / 0.791 - Ps * (Ms - 0.209) / 0.791
                // Pd * (Md - 0.209) / 0.791 = Ps * (Ms - 0.209) / 0.791
                // Pd * (Md - 0.209) = Ps * (Ms - 0.209)
                let bleedTo = Pd * (Md - 0.209) / (Ms - 0.209);

                if (this.debug)
                    this.debug("Mix already too rich; bleed to", bleedTo, "bar");
                $report.html(
                    "There is too much gas already in the cylinder for " +
                    "this fill. To use this bank you will have to bleed " +
                    "the cylinder down below " +
                    Math.floor(bleedTo) +
                    " bar");
                return;
            }

            let Pce = Ps + Pf;
            if (this.debug)
                this.debug("New cylinder pressure", Pce);

            // Can we do this fill with the current bank?
            // Work out litres of O2 required
            let litres = Pf * Sc;
            if (this.debug)
                this.debug("%f litres of O2 required", litres);

            // Work out pressure loss from the bank
            let pressure_loss = litres / Sb;
            if (this.debug)
                this.debug("%f bar required from bank", pressure_loss);

            // Pbe = Pressure in bank after Pf added to cylinder
            let Pbe = Pbs - pressure_loss;
            if (this.debug)
                this.debug("Pbe", Pbe);

            // Is the final cylinder pressure <= the final bank pressure?
            if (Pce <= Pbe) {
                // Fill is possible
                let Pt = Pd - Ps - Pf;
                if (this.debug)
                    this.debug("top up with", Pt, "bar of air");

                $report.append(
                    "Boost cylinder with O<sub>2</sub> to " +
                    Math.ceil(Pce) +
                    " bar before topping up to " + conditions.target_pressure +
                    " bar with air<br>");
                $report.append(
                    "This will use " +
                    Math.round(litres) +
                    " litres of O<sub>2</sub> at a cost of <strong>&pound;" +
                    (litres * parseFloat(this.cfg.get("o2_price"))).toFixed(2) +
                    "</strong><br>");

                return;
            }

            $report.append("<div class='warning'>That mix isn't possible</div>");
            
            // Fill isn't possible. We need to either bleed the
            // cylinder down to a level where it is possible, or
            // adjust the mix (or use a fuller bank)
            if (this.debug)
                this.debug("Not enough pressure in bank, %f>%f", Pce, Pbe);
             
            // First see what the best fill we *can* deliver with
            // this bank is, given the current Ps
            if (Ps > Pbs) {
                $report.append(
                    "To use this bank you will have to bleed the cylinder down to below "
                    + Pbs + " bar first<br />");
                return;
            }
            
            // Pressure equilibrium is reached when Ps + Pf = Pbe

            // The litres lost from the bank (and therefore gained
            // by the cylinder)
            // Bll = (Pbs - Pbe) * Sb;
            
            // So the pressure gained by the cylinder
            // Pf = Bll / Sc = (Pbs - Pbe) * Sb / Sc
            
            // Since Pbe = Ps + Pf at equilibrium,
            // Pf = (Pbs - Ps - Pf) * Sb / Sc
            // Pf * Sc / Sb = Pbs - Ps - Pf
            // Pf * Sc / Sb + Pf = Pbs - Ps
            // Pf * (Sc / Sb + 1) = Pbs - Ps
            // Pf = (Pbs - Ps) / (Sc / Sb + 1)
            let best_Pf = (Pbs - Ps) / (Sc / Sb + 1);
            Pbe = Ps + best_Pf;
            if (this.debug)
                this.debug("Best Pf %f Pbe %f", best_Pf, Pbe);

            litres = best_Pf * conditions.cylinder_size;
            pressure_loss = litres / conditions.O2_bank_size;
            if (this.debug)
                this.debug("Lose %f bar to %f", pressure_loss, Pbe);

            // Now we know from above that 
            // Pf = (Pd * (Md - 0.209) - Ps * (Ms - 0.209)) / 0.791
            // Rearrange for Md
            let best_Md = 0.209 + (best_Pf * 0.791 + Ps * (Ms - 0.209)) / Pd;
            if (this.debug)
                this.debug("Best possible mix is %f%", best_Md * 100);
            
            if (best_Md < Md) {
                $report.append(
                    "The best that can be achieved with this bank is "
                    + Math.floor(best_Md * 100) + "%<br />");
            }

            if (Ps <= 1)
                return; // can't bleed an empty cylinder

            // Can we reduce Ps to achieve the same Md?
            // Now we know from above that 
            // Pf = (Pd * (Md - 0.209) - Ps * (Ms - 0.209)) / 0.791
            // and that equilibrium requires that
            // Pf = (Pbs - Ps) / (Sc / Sb + 1)
            // so
            // (Pd * (Md - 0.209) - Ps * (Ms - 0.209)) / 0.791 =
            //     (Pbs - Ps) / (Sc / Sb + 1)
            // Pd * (Md - 0.209) - Ps * (Ms - 0.209) = 
            //     0.791 * Pbs / (Sc / Sb + 1) - 0.791 * Ps / (Sc / Sb + 1)
            // Pd * (Md - 0.209) - 0.791 * Pbs / (Sc / Sb + 1) = 
            //      Ps * (Ms - 0.209) - 0.791 * Ps / (Sc / Sb + 1)
            // Pd * (Md - 0.209) - 0.791 * Pbs / (Sc / Sb + 1) = 
            //      Ps * ((Ms - 0.209) - 0.791 / (Sc / Sb + 1))
            // Ps = (Pd * (Md - 0.209) - 0.791 * Pbs / (Sc / Sb + 1)) / 
            //      ((Ms - 0.209) - 0.791 / (Sc / Sb + 1))
            let best_Ps =
                (Pd * (Md - 0.209) - Pbs * 0.791 / (Sc / Sb + 1)) /
                (     (Ms - 0.209) -       0.791 / (Sc / Sb + 1));
            if (best_Ps >= 1)
                $report.append(
                    conditions.target_mix
                    + "% can be achieved if you bleed the cylinder down to "
                    + Math.floor(best_Ps) + " bar first");
        }
    }
    return Nitrox;
});

