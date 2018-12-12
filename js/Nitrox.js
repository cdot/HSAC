"use strict";

function nitrox_blend(conditions) {
    var T = conditions.temperature; // degress C
    var V = conditions.cylinder_size; // Cylinder size, in litres
    var start_mix = conditions.start_mix; // percent
    var start_pressure = conditions.start_pressure; // bar
    var final_mix = conditions.final_mix; // percent
    var final_pressure = conditions.final_pressure; // bar
    var O2_bank_size = conditions.O2_bank_size; // l
    var O2_bank_pressure = conditions.O2_bank_pressure; // bar
    
    var K = 273.15 + T; // degrees K
    var ideal_O2_to_add = (((final_mix / 100) - 0.21) / 0.79) * final_pressure
        - (((start_mix / 100) - 0.21) / 0.79) * start_pressure; // bar
    var MOD = ((1.4/(final_mix/100))*10)-10; // m
    
    function Gas(options) {
        var n;
        
        for (var n in options) {
            this[n] = options[n];
        }
        
        var N = this.mol, R = this.R, a = this.a, b = this.b, p = this.p;
        var N2 = N * N, N3 = N * N * N;
        var Vn = N * R * K / p; // l
        for (var n = 0; n < 10; n++) {
            var fVn = ((p + (N2 * a / (Vn * Vn))) * (Vn - (N * b)) - (N * R * K));
            var f_Vn = (p - (a * (N2 / (Vn * Vn))) + (2 * a * b * (N3 / (Vn * Vn * Vn))));
            var h = fVn / f_Vn;
            Vn = Vn - h;
        }
        this.Vn = Vn;
        this.n = V / Vn; // mol
        this.weight = this.mw * this.n / 1000; // kg
        this.fVo = this.mol * this.R * K / this.p; // 
        this.pactual = (this.n * this.R * K) / V; // bar
        this.nideal = (this.p * V) / (this.R * K); // mol
        this.preal = (this.nideal / this.n) * this.p // atm
        
        var A = this.n * this.R * K * V * V;
        var B = this.n * this.n * this.a * V;
        var C = this.n * this.n * this.n * this.a * this.b;
        var D = V * V * V - (this.n * this.b * V * V);
        this.pwdw = (A - B + C) / D; // atm
    }
    
    var O2 = new Gas({
        p: ideal_O2_to_add, // atm		
        a: 1.36, // l^2 atm/mol^2
        b: 0.03183, // l/mol
        mol: 1, // mol
        R: 0.0820578, // l-atm/mol-K
        mw: 31.998  // g
    });
    
    var Air = new Gas({
        p: (final_pressure - ideal_O2_to_add) > 0 ?
            (final_pressure - ideal_O2_to_add) : 0.1, // atm
            a: 1.3725, // l^2 atm/mol^2
            b: 0.0372, // l/mol
            mol: 1, // mol
            R: 0.0820578, // l-atm/mol-K
            mw: 28.85 // g
    });
    
    var pinitial = O2.p + Air.p; // atm
    var ptotal = O2.pactual + Air.pactual; // bar
    var real_O2_to_add = O2.pactual; // bar
    
    var O2_in_cylinder = start_pressure * (start_mix / 100); // bar
    var O2_needed = (real_O2_to_add * V) - (V * O2_in_cylinder); // l
    var O2_in_full_bank = O2_bank_pressure * O2_bank_size; // l
    var O2_available = (O2_bank_pressure - (start_pressure + real_O2_to_add)) * O2_bank_size; // l
    var O2_bank_pressure_after_fill	= O2_bank_pressure - ((O2_needed / O2_in_full_bank) * O2_bank_pressure); // bar
    
    if ((real_O2_to_add + start_pressure) <= O2_bank_pressure_after_fill && real_O2_to_add > 0) {
        if (O2_available < O2_needed) {
            conditions.log("Not enough O2 in this bank, even if the cylinder was empty");
            conditions.log("Try a different bank (or a weaker mix)");
        } else {
            conditions.log("Add O2 to a pressure of", (start_pressure + real_O2_to_add), "bar");
            if ((real_O2_to_add + start_pressure) < final_pressure)
                conditions.log("and fill-up with air to", final_pressure," bar");
            conditions.log("MOD of", final_mix,"% =", MOD, " metres");
        }
    } else {
        conditions.log("Cannot achieve mix; bleed cylinder, re-measure cylinder pressure and recalculate"); // bar
        if (real_O2_to_add > 0) {
            conditions.log("start pressure + O2 to add =", start_pressure, "+", real_O2_to_add, "=", (real_O2_to_add + start_pressure));
            conditions.log("bank pressure after top-up =", O2_bank_pressure_after_fill);
        } else {
            conditions.log("Not enough room in the cylinder");
        }
    }
}    
