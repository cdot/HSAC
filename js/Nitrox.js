/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Nitrox", () => {

    const ATMOSPHERIC_O2 = 100 * 0.209;
    
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
                    if (!$(e.target).valid())
                        return;
                    self.submit();
                });
            });
        }

        submit() {
            let conditions = {};
            $("#nitrox").find("form :input").each(function () {
                if (this.type === "number")
                    conditions[this.name] = parseFloat($(this).val());
                else
                    conditions[this.name] = $(this).val();
            });
            
            // Apply reality check
            if (conditions.start_mix < ATMOSPHERIC_O2) conditions.start_mix = ATMOSPHERIC_O2;
            if (conditions.target_mix < ATMOSPHERIC_O2) conditions.target_mix = ATMOSPHERIC_O2;
            if (conditions.start_pressure <= 0) conditions.start_pressure = 1;
            if (conditions.target_pressure <= 0) conditions.target_pressure = 1;

            if (this.debug) {
                this.debug("Temperature " + conditions.temperature + "°C");
                this.debug("Cylinder " + conditions.cylinder_size + " l");
                this.debug("Current Pressure " + conditions.start_pressure + " bar");
                this.debug("Current Mix " + conditions.start_mix + "%");
                this.debug("Target Pressure " + conditions.target_pressure + " bar");
                this.debug("Target Mix " + conditions.target_mix + "%");
            }
            
            let ppO2max = this.cfg.get("ppO2max");
            let MOD = Math.floor(((ppO2max / conditions.target_mix) * 10) - 10);
            let $report = $("#nitrox").children(".report");
            $report.html("Filling a " + conditions.cylinder_size + "L cylinder " +
                         "containing " + conditions.start_pressure + " bar of " +
                         conditions.start_mix + "% with " + conditions.target_pressure +
                         " bar of " + conditions.target_mix + "% (MOD " +
                         MOD + "m, ppO<sub>2</sub> " + ppO2max + " bar)<br>");
            let result = this.blend(conditions);
            if (typeof result.bleedTo !== "undefined") {
                $report.html(
                    "There is too much gas already in the cylinder for " +
                    "this fill. To use this bank you will have to bleed " +
                    "the cylinder down below " +
                    Math.floor(result.bleedTo) +
                    " bar");
            } else {
                $report.append(
                    "Boost cylinder with O<sub>2</sub> to " +
                    Math.floor(result.boostTo) +
                    " bar before topping up to " + conditions.target_pressure +
                    " bar with air.<br>");
                $report.append(
                    "This will use " +
                    Math.round(result.use) +
                    " litres of O<sub>2</sub> at a cost of <strong>&pound;" +
                    (result.use * parseFloat(this.cfg.get("o2_price"))).toFixed(2) +
                    "</strong><br>");
            }
        }

        /**
         * We know that the total pressure of a gas mix is the sum of the pressures
         * of the component gases. For some desired pressure P of a mix M,
         * we know that :
         * P * M = PO2 + PAIR * 20.9% where PO2 and PAIR are
         * the pressure of oxygen and air, respectively.
         *
         * We know the desired target pressure and mix, 
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

            if (conditions.start_pressure > conditions.O2_bank_pressure) {
                let bleedTo = conditions.O2_bank_pressure;
                if (this.debug) this.debug(
                    "Too much initial pressure", conditions.start_pressure, ">", bleedTo);
                return { bleedTo: bleedTo, differentBank: true };
            }

            // See Gary Kessler's EAN_gas_mix_v3.1.xls for details
            let extra_O2 = ((conditions.target_pressure * (conditions.target_mix - ATMOSPHERIC_O2))
                            - (conditions.start_pressure * (conditions.start_mix - ATMOSPHERIC_O2)))
                / (100 - ATMOSPHERIC_O2);

            let boostTo = extra_O2 + conditions.start_pressure;
            if (this.debug) this.debug("boostTo:", boostTo);
            
            if (boostTo < conditions.start_pressure) {
                let bleedTo = conditions.target_pressure * (conditions.target_mix - ATMOSPHERIC_O2)
                / (conditions.start_mix - ATMOSPHERIC_O2);
                
                if (this.debug) this.debug("bleed to", bleedTo, "bar");
                return { bleedTo: bleedTo, differentBank: false };
            }
            
            if (boostTo > conditions.O2_bank_pressure) {
                let bleedTo = conditions.target_pressure * (conditions.target_mix - ATMOSPHERIC_O2)
                / (conditions.O2_bank_pressure - ATMOSPHERIC_O2);
                
                if (this.debug) this.debug("Boost is over bank", boostTo, ">", conditions.O2_bank_pressure, "bleed to", bleedTo);
                return { bleedTo: bleedTo, differentBank: true };
            }
            
            if (conditions.start_pressure > conditions.O2_bank_pressure) {
                if (this.debug) this.debug("bank pressure too low for this fill");
                return { bleedTo: conditions.O2_bank_pressure, differentBank: true }
            }

            let use = extra_O2 * conditions.cylinder_size;
            if (this.debug) this.debug("fill will use", use, "litres of O2");

            return { boostTo: boostTo, use: use };
        };
    }
    return Nitrox;
});
        
