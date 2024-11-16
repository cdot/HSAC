/*@preserve Copyright (C) 2018-2024 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Real gas approximation and gas unit conversion
 */
function cuberoot(x) {
	return x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3);
}

/**
 * Find the roots of a cubic polynomial x^3 + ax + b
 * There are three roots, 2R, -R+sqrt(3)I, -R-sqrt(3)I
 * See the wikipedia article for more.
 */
function polyCubicRoots(a, b, c) {
	const a_3 = a / 3;
	const p = b - a * a_3;
	const q = (2 * a_3 * a_3 - b) * a_3 + c;
	const p_3 = p / 3;
	const X = p_3 * p_3 * p_3;
	const Y = Math.pow((q / 2), 2);
	const Q = X + Y;
	if (Q >= 0) {
		const sqQ = Math.sqrt(Q);
		const A = cuberoot(-q / 2 + sqQ);
		const B = cuberoot(-q / 2 - sqQ);
		//const R = -(A + B) / 2 - a_3;
		//const I = Math.sqrt(3) / 2 * (A - B);
		return A + B - a_3;
	}
	const p3by27 = Math.sqrt(-Math.pow(p, 3) / 27);
	const costheta = -q / 2 / p3by27;
	const alpha = Math.acos(costheta);
	const mag = 2 * Math.sqrt(-p / 3);
	const alpha_3 = alpha / 3;
	return mag * Math.cos(alpha_3) - a_3;
}

// Universal gas constant
const R = 8.31446261815324;

// Van der Waal's Constants for different diving gases
const GASES = {
	//       J.m3/mol2       m3/mol
	'He':  { a: 0.00346, b: 0.0000238 },
	'N':   { a: 0.13700, b: 0.00003870 },
	'O':   { a: 0.13820, b: 0.00003186 }
};

class Gas {

	/**
	 * Convert litres to cubic metres
	 */
	static litres2m3(L) {
    if (Number.isNaN(L)) throw new Error("NaN");
		return L / 1000;
	}

	/**
	 * Convert cubic metres to litres
	 */
	static m32litres(m3) {
    if (Number.isNaN(m3)) throw new Error("NaN");
		return m3 * 1000;
	}

	/**
	 * Convert bar to Pascals
	 */
	static bar2Pa(bar) {
    if (Number.isNaN(bar)) throw new Error("NaN");
		return bar * 100000;
	}

	/**
	 * Convert Pascals to bar
	 */
	static Pa2bar(Pa) {
    if (Number.isNaN(Pa)) throw new Error("NaN");
		return Pa / 100000;
	}

	/**
	 * Convert degrees Celsius to Kelvin
	 */
	static C2K(C) {
    if (Number.isNaN(C)) throw new Error("NaN");
		return 273.15 + C;
	}

	/**
	 * Convert Kelvin to degrees Celcius
	 */
	static K2C(K) {
    if (Number.isNaN(K)) throw new Error("NaN");
		return K - 273.15;
	}

	/**
	 * Use ideal gas law to determine number of moles of a gas in 
	 * a system. PV=nRT, n = PV/RT
	 * @param {number} P partial pressure of gas in system, in Pascals
	 * @param {number} V total volume, cubic metres (m3)
	 * @param {number} T temperature, Kelvin
	 * @return {number} number of moles
	 */
	static ideal_moles(P, V, T) {
    if (Number.isNaN(P)) throw new Error("P NaN");
    if (Number.isNaN(V)) throw new Error("V NaN");
    if (Number.isNaN(T)) throw new Error("T NaN");
		return P * V / (Gas.R * T);
	}

	/**
	 * Use Van der Waal's equation of state to derive a better approximation
	 * for number of moles of a gas in a system
	 * @param {number} P partial pressure of gas in system, in Pascals
	 * @param {number} V total volume, cubic metres (m3)
	 * @param {number} T temperature, Kelvin
	 * @param {string} gas - one of the supported gases
	 * @return {number} number of moles
	 * @return {number} pressure, in Pa
	 */
	static real_moles(P, V, T, gas) {
    if (Number.isNaN(P)) throw new Error("P NaN");
    if (Number.isNaN(V)) throw new Error("V NaN");
    if (Number.isNaN(T)) throw new Error("T NaN");
		const C = GASES[gas];
		return polyCubicRoots(
			-V / C.b,
			V * V * (P * C.b + R * T) / (C.a * C.b),
			-V * V * V * P / (C.a * C.b));
	}

	/**
	 * Use ideal gas law to determine partial pressure of a gas in a system.
	 * PV=nRT, P = nRT/V
	 * @param {number} N number of moles of the gas in the system
	 * @param {number} V total volume, cubic metres (m3)
	 * @param {number} T temperature, Kelvin
	 */
	static ideal_pressure(N, V, T) {
    if (Number.isNaN(N)) throw new Error("N NaN");
    if (Number.isNaN(V)) throw new Error("V NaN");
    if (Number.isNaN(T)) throw new Error("T NaN");
		return N * Gas.R * T / V;
	}

	/**
	 * Use Van der Waal's equation of state to derive a better approximation
	 * for partial pressure of a gas in a system
	 * @param {number} N number of moles of the gas in the system
	 * @param {number} V total volume, cubic metres (m3)
	 * @param {number} T temperature, Kelvin
	 * @param {string} gas - one of the supported gases
	 * @return {number} pressure, in Pa
	 */
	static real_pressure(N, V, T, gas) {
    if (Number.isNaN(N)) throw new Error("N NaN");
    if (Number.isNaN(V)) throw new Error("V NaN");
    if (Number.isNaN(T)) throw new Error("T NaN");
		const C = GASES[gas];
		// (P + a*n2/v2)(v - n*b) = n*R*T
		// (P + a*(n2/v2) = n*R*T / (v - n*b)
		// P = n*R*T / (v - n*b) - a*(n2/v2)
		return N * R * T / (V - N * C.b) - C.a * N * N / (V * V);
	}
}

Gas.R = R;
Gas.GASES = GASES;

export { Gas }
