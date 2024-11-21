/*eslint-env node, mocha */
import { assert } from "chai";
import { Nitrox } from "../js/Nitrox.js";
import { AbstractStore } from "../js/AbstractStore.js";

import { setup$, UNit } from "./Fixtures.js";

class TestStore extends AbstractStore {
  read(path) {
    assert.equal("nitrox.csv", path);
    return Promise.resolve([]);
  }
}

const tests = [
  {    name: "simple 1",
       temperature: 4,
       cylinder_size: 12,
       start_mix: 26,  start_pressure: 30,
       target_mix: 32, target_pressure: 232,
       banks: {
         A: { size: 49, bar: 90, price: 0.02 }
       },
       expected: "1. Add O2 to 61 bar from bank A, using 367L and leaving 83 bar in the bank.2. Top up with air to 232 bar.3. Pay £7.35."
  },
  {    name: "simple 2",
       temperature: 25,
       cylinder_size:  7,
       start_mix:  21,  start_pressure: 50,
       target_mix: 32, target_pressure: 232,
       banks: {
         B: { size: 49, bar: 200, price: 0.02 }
       },
       expected: "1. Add O2 to 83 bar from bank B, using 228L and leaving 195 bar in the bank.2. Top up with air to 232 bar.3. Pay £4.56."
  },
  {    name: "simple 3",
       temperature: 16,
       cylinder_size: 12,
       start_mix: 28,  start_pressure: 50,
       target_mix: 32, target_pressure: 232,
       banks: {
         C: { size: 47, bar: 90, price: 0.02 }
       },
       expected: "1. Add O2 to 78 bar from bank C, using 337L and leaving 83 bar in the bank.2. Top up with air to 232 bar.3. Pay £6.74."
  },
  // Too much O2 already in cylinder
  {    name: "too much O2",
       temperature: 40,
       cylinder_size: 10,
       start_mix: 32, start_pressure: 200,
       target_mix: 28, target_pressure: 230,
       banks: {
         D: { size: 47, bar: 210, price: 0.02 }
       },
       expected: "1. Drain the cylinder down to 147 bar.2. Top up with air to 230 bar." },
  // Mix achievable, but not enough O2 in bank
  {    name: "not enough in bank",
       temperature: 16,
       cylinder_size: 24,
       start_mix: 21, start_pressure: 50,
       target_mix: 28, target_pressure: 230,
       banks: {
         E: { size: 4, bar: 60, price: 0.02 }
       },
       expected: "1. Add O2 to 52 bar from bank E, using 44L and leaving 49 bar in the bank.2. Sorry, fill is not possible."
  },
  // Mix achievable, but too much pressure already in cylinder.
  {    name: "too much pressure",
       temperature: 18,
       cylinder_size: 24,
       start_mix: 21, start_pressure: 40,
       target_mix: 32, target_pressure: 230,
       banks: {
         F: { size: 40, bar: 30, price: 0.02 }
       },
       expected: "1. Drain the cylinder down to 1 bar.2. Add O2 to 19 bar from bank F, using 440L and leaving 19 bar in the bank.3. Sorry, fill is not possible."
  },
];

describe("Nitrox", () => {
  before(() => setup$(
    `../../..`,
    "../html/nitrox.html"));

  for (const test of tests) {
    it(test.name, () => {
      const n = new Nitrox();
      n.store = new TestStore();
      return n.init({
        id: "nitrox",
        config: {
          store_data: { o2: { bank: test.banks } }
        }
      })
      .then(() => n.loadUI())
      .then(() => n.reload_ui())
      .then(() => {
        n.$tab.find("[name=blender]").val(test.name);
        n.$tab.find("#nox_t").val(test.temperature);
        n.$tab.find("#nox_cs").val(test.cylinder_size);
        n.$tab.find("#nox_sp").val(test.start_pressure);
        n.$tab.find("#nox_sm").val(test.start_mix);
        n.$tab.find("#nox_tp").val(test.target_pressure);
        n.$tab.find("#nox_tm").val(test.target_mix);
        n.$tab.find("#nox_ppO2max").val(1.4);
        n.recalculate();
        //assert.equal(33, $("#nox_MOD").text());
        assert.equal(n.$tab.find("div[name=report]").text(), test.expected);
      });
    });
  }
});

