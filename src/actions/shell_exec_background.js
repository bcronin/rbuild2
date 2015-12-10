'use strict';

const child_process = require('child_process');
const _ = require('underscore');
const log = require('../logger');
const fs = require('fs');
const shelljs = require('shelljs');

const filename = process.argv[2];
const cwd = process.argv[3];

var child = child_process.execFile(shelljs.which('bash'), [ filename ], {
    stdio : [ 'ignore', 'inherit', 'inherit' ],
    cwd   : cwd,
});
child.on('error', function(err) {
    console.log("ERROR:", err);
});
child.stdout.on('data', function (data) {
  console.log(data.replace(/\n$/, ""));
});

child.stderr.on('data', function (data) {
  console.error(data.replace(/\n$/, ""));
});

child.on('close', function() {
    fs.unlinkSync(filename);
})

process.on('beforeExit', function() {
    if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
    }
    child.kill();
})
