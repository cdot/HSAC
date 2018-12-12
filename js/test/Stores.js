/*eslint-env node, mocha */

const TESTR = "1234567";
const DATASIZE = 89344;

if (typeof module !== "undefined") {
    var assert = require("chai").assert;
} else
    assert = chai.assert;

var storeClass, store;

mocha.setup("bdd");
mocha.globals(['jQuery']);

describe("Store", function() {

    this.timeout(10000); // give time to log in
    var testdata = Date.now();
    after(function() {
        store.disconnect();
    });
    
    it("write/read empty", function(done) {
        store
            .write('/emptysheds.txt', '')
            .then(function() {
                return store.read('emptysheds.txt');
            })
            .then(function(ab) {
                assert.equal(ab, '');
            })
            .then(done);
    });

    it("write/read full", function(done) {
        store
            .write('fullsheds.txt', testdata)
            .then(function() {
                return store.read('/fullsheds.txt');
            })
            .then(function(s) {
                assert.equal(s, testdata);
            })
            .then(done);
    });
    
    it("write/read subdir", function(done) {
        store
            .write('ShedsTest/fullsheds.txt', testdata)
            .then(function() {
                return store.read('/ShedsTest/fullsheds.txt');
            })
            .then(function(s) {
                assert.equal(s, testdata);
            })
            .then(done);
    });
});

$(document).ready(function() {
    $("#tabs").tabs();
    $(".store_tab>form").on("submit", function(e) {
        storeClass = this.name + "Store";
        var params = {};
        $(this).closest("div").find(".param").each(function() {
            params[this.name] = $(this).val();
        });
        $.getScript("../" + storeClass + ".js")
            .then(function() {
                store = eval("new " + storeClass + "()");
                store
                    .connect(params)
                    .then(() => {
                        return new Promise((resolve, reject) => {
                            console.debug("Running mocha");
                            mocha.run();
                        });
                    });
            })
            .catch(function(e) {
                console.debug(e);
            });
        return false;
    });
});
