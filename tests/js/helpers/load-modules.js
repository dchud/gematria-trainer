/**
 * Test helper: loads ES5 IIFE modules into the global scope.
 *
 * Reads the letters CSV to build LETTERS_DATA, then evaluates each
 * JS module file using vm.runInThisContext() so that `var` declarations
 * attach to the Node.js global object. Modules are loaded in
 * dependency order matching base.html.
 *
 * Usage:
 *   require('./helpers/load-modules');
 *   // Now SpacedRepetition, Gematria, etc. are available as globals.
 */

var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

// ---------------------------------------------------------------
// Build LETTERS_DATA from CSV
// ---------------------------------------------------------------

var csvPath = path.resolve(__dirname, '../../../src/data/letters.csv');
var csvText = fs.readFileSync(csvPath, 'utf8');
var lines = csvText.trim().split('\n');
var headers = lines[0].split(',');

// Numeric fields that should be coerced to match production JSON types.
// In production, Python's load_letters() converts these to int before
// json.dumps(), so they arrive as numbers in the browser.
var NUMERIC_FIELDS = { position: true, standard_value: true, final_value: true };

var lettersData = [];
for (var i = 1; i < lines.length; i++) {
    var values = lines[i].split(',');
    var row = {};
    for (var j = 0; j < headers.length; j++) {
        var key = headers[j];
        var val = values[j] || '';
        if (NUMERIC_FIELDS[key] && val !== '') {
            row[key] = Number(val);
        } else if (NUMERIC_FIELDS[key] && val === '') {
            row[key] = null;
        } else {
            row[key] = val;
        }
    }
    lettersData.push(row);
}

globalThis.LETTERS_DATA = lettersData;

// ---------------------------------------------------------------
// Load JS modules in dependency order
// ---------------------------------------------------------------

var jsDir = path.resolve(__dirname, '../../../static/js');

var modules = [
    'gematria.js',
    'registry.js',
    'spaced-repetition.js',
    'tiers.js',
    'card-state.js',
    // storage.js depends on localStorage (browser only), skip in Node
    // settings.js depends on storage.js (browser only), skip in Node
    'card-selection.js',
    'generator.js',
    'progression.js',
    'placement.js',
];

for (var m = 0; m < modules.length; m++) {
    var filePath = path.join(jsDir, modules[m]);
    var code = fs.readFileSync(filePath, 'utf8');
    vm.runInThisContext(code, { filename: modules[m] });
}
