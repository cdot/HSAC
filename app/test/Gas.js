/*eslint-env node, mocha */
import { assert } from "chai";
import { setup$, UNit } from "./Fixtures.js";
import { Gas } from "../js/Gas.js";

/**
 * Real gases
 */

/**
 * @param P partial pressure of this gas in final system (ideal bar)
 * @param V total volume, litres
 * @param a correction for intermolecular forces, l^2 atm/mol^2
 * @param b correction for finite molecular size, l/mol
 * @return real gas partial pressure, in bar
 */
function vdw_moles(P, V, T, a, b) {
	
  if (P === 0)
    return 0;
	
  const n = 1;
	
  const n2 = n * n;
  const n3 = n2 * n;
  const aXb = a * b;
  const nXb = n * b;
  const aXn2 = n2 * a;
  const nXRT = n * Gas.R * T;
	
  // initial approximation of real volume using ideal gas law (litres)
  let vReal = nXRT / P;
	
  // Iterate Van De Waal's equation of state to improve estimate
  // of volume
  let limit = 100;
  while (true) {
    const vReal2 = vReal * vReal;
    const fvReal =
          (P + (aXn2 / vReal2)) * (vReal - nXb) - nXRT;
    const f_vReal =
          (P - (aXn2 / vReal2) + (2 * aXb * (n3 / (vReal2 * vReal))));
    const h = fvReal / f_vReal;
    if (Math.abs(h) < 1e-12)
      break;
    vReal -= h;
    if (limit-- == 0)
      throw "Error: Van der Waal iteration overran";
  }
  return n * V / vReal; // Real number of moles
}

describe("Gas", () => {
  it("real moles", () => {
	  assert.equal(Gas.real_moles(
		  Gas.bar2Pa(1),
		  Gas.litres2m3(1),
		  Gas.C2K(0), "O"), 0.04408787974788986);
	  assert.equal(Gas.real_moles(
		  Gas.bar2Pa(200),
		  Gas.litres2m3(50),
		  Gas.C2K(20), "N"), 408.89951855075736);
  });

  it("real pressure", () => {
	  assert.equal(Gas.Pa2bar(Gas.real_pressure(
		  Gas.real_moles(Gas.bar2Pa(1), Gas.litres2m3(1), Gas.C2K(26), "O"),
		  Gas.litres2m3(1),
		  Gas.C2K(26), "O")), 1.0000000000000289);
	  assert.equal(Gas.Pa2bar(Gas.real_pressure(
		  Gas.real_moles(Gas.bar2Pa(200), Gas.litres2m3(50), Gas.C2K(17), "N"),
		  Gas.litres2m3(50),
		  Gas.C2K(17), "N")), 200);
  });

  it("merge_volumes", () => {
	  const T = Gas.C2K(20); // constant temperature
	  const V1 =  Gas.litres2m3(50); // volume of bank
	  const V2 = Gas.litres2m3(12); // volume of cylinder
	  const V = V1 + V2; // combined volume
	  const P1 = Gas.bar2Pa(100); // initial pressure of bank
	  const P2 = Gas.bar2Pa(50); // initial pressure of cylinder
	  const Ms = 0.21; // fraction of O2 in cylinder at start

	  // First method: Simple Combination by ideal gas law
	  // P1V1/T = P2V2/T
	  // T is held constant, so P1V1 = P2V2
	  // P3 = (P1*V1 + P2*V2) / (V1 + V2)
    console.debug("Merge volumes: VISUAL CHECK",
                "Please check that that the 4 calculations all",
                "produce acceptable results");
	  console.debug("\n1: Combined Gas Law, P1V1/T1 = P2V2/T2");
	  let ppO2 = (P1 * V1 + (P2 * V2 * Ms)) / (V1 + V2);
	  let ppN2 = (P2 * V2 * (1 - Ms)) / (V1 + V2);
	  console.debug("ppO2", Gas.Pa2bar(ppO2),"bar");
	  console.debug("ppN2", Gas.Pa2bar(ppN2), "bar");
	  console.debug("P   ", Gas.Pa2bar(ppO2 + ppN2), "bar");

	  // Second method: calculate moles using simplistic application
	  // of the ideal gas law
	  console.debug("\n2: Ideal Gas Law, PV = nRT");
	  let bank_moles_O2 = Gas.ideal_moles(P1, V1, T);
	  let cyl_moles_O2 = Gas.ideal_moles(Ms * P2, V2, T);
	  let cyl_moles_N2 = Gas.ideal_moles((1 - Ms) * P2, V2, T);
	  console.debug("bank nO2 moles", bank_moles_O2);
	  console.debug("cylinder nO2 moles", cyl_moles_O2);
	  console.debug("cylinder nN2 moles", cyl_moles_N2);
	  // P = nRT/V
	  ppO2 = Gas.ideal_pressure(bank_moles_O2 + cyl_moles_O2, V, T);
	  ppN2 = Gas.ideal_pressure(cyl_moles_N2, V, T);
	  console.debug("ppO2", Gas.Pa2bar(ppO2), "bar");
	  console.debug("ppN2", Gas.Pa2bar(ppN2), "bar");
	  console.debug("P   ", Gas.Pa2bar(ppO2 + ppN2), "bar");

	  // Third method: use Van Der Waal's equation to calculate moles
	  // of the individual gases.
	  console.debug("\n3: Van der Waal, estimated");
	  bank_moles_O2 = Gas.real_moles(P1, V1, T, "O");
	  cyl_moles_O2 = Gas.real_moles(Ms * P2, V2, T, "O");
	  cyl_moles_N2 = Gas.real_moles((1 - Ms) * P2, V2, T, "N");
	  console.debug("bank nO2 moles", bank_moles_O2);
	  console.debug("cylinder nO2 moles", cyl_moles_O2);
	  console.debug("cylinder nN2 moles", cyl_moles_N2);
	  ppO2 = Gas.real_pressure(bank_moles_O2 + cyl_moles_O2, V, T, "O");
	  ppN2 = Gas.real_pressure(cyl_moles_N2, V, T, "N");
	  console.debug("ppO2", Gas.Pa2bar(ppO2), "bar");
	  console.debug("ppN2", Gas.Pa2bar(ppN2),"bar");
	  console.debug("P   ", Gas.Pa2bar(ppO2 + ppN2), "bar");

	  // Alternative method: use an iterative solution to Van der Waals
	  // equation - it may give better results if there is a question.
	  console.debug("\n4: Van der Waal, iterated");
	  bank_moles_O2 = vdw_moles(
		  P1, V1, T, Gas.GASES.O.a, Gas.GASES.O.b);
	  cyl_moles_O2 = vdw_moles(
		  Ms * P2, V2, T, Gas.GASES.O.a, Gas.GASES.O.b);
	  cyl_moles_N2 = vdw_moles(
		  (1 - Ms) * P2, V2, T, Gas.GASES.O.a, Gas.GASES.O.b);
	  console.debug("bank nO2 moles", bank_moles_O2);
	  console.debug("cylinder nO2 moles", cyl_moles_O2);
	  console.debug("cylinder nN2 moles", cyl_moles_N2);
	  ppO2 = Gas.real_pressure(bank_moles_O2 + cyl_moles_O2, V, T, "O");
	  ppN2 = Gas.real_pressure(cyl_moles_N2, V, T, "N");
	  console.debug("ppO2", Gas.Pa2bar(ppO2), "bar");
	  console.debug("ppN2", Gas.Pa2bar(ppN2),"bar");
	  console.debug("P   ", Gas.Pa2bar(ppO2 + ppN2), "bar");
  });
});
