'use strict';

const fs      = require("fs");
const path    = require("path");
const _       = require("underscore");
const shelljs = require("shelljs");
const glob    = require("glob");
const log     = require("./logger");
const actions = require("./actions");
const trace   = require("api-javascript");
const TaskDesc = require('./desc/task_desc');
const BuildDesc = require('./desc/build_desc');
const Builder = require('./builder');

const kCurrentUser = require('username').sync();

trace.options({
    access_token : "{your_access_token}",
    group_name   : "sc-test/rbuild",
});

log.transforms({
    "task"    : "green",
    "command" : "grey",
    "file"    : "magenta",
});

process.setMaxListeners(16 * 1024);



function initArgs() {
    var argv = require("yargs")
    //  .strict()
        .option("v", {
            alias    : "verbose",
            type     : "count",
            decribe  : "enables verbose logging",
        })
        .option("w", {
            alias    : "watch",
            type     : "boolean",
            describe : "enables file watching",
            default  : false,
        })
        .option("d", {
            alias    : "describe",
            type     : "boolean",
            describe : "prints out a JSON description of the task configuration",
            default  : false,
        })
        .option("f", {
            alias    : "force",
            type     : "boolean",
            describe : "forces all tasks to run, even if they are up to date",
            default  : false,
        })
        .option("filename", {
            type     : "string",
            describe : "build configuration filename",
            default  : path.join(process.cwd(), "rbuild.config.js"),
        })
        .option("task", {
            type     : "string",
            describe : "the task to run",
            default  : undefined,
        })
        .argv;

    // Make the first positional argument into the task
    if (argv._.length > 0) {
        argv.task = argv._[0];
    }
    return argv;
}


(function main() {
    const argv = initArgs();

    //
    // Stage 1: read the build description and store it in normalized form
    //
    let buildDesc = new BuildDesc();
    buildDesc._load(argv.filename || process.cwd());

    let externalReferences = new Set();
    _.each(buildDesc._tasks, task => {
        _.each(task.desc.external_references, (_ignore, xref) => {
            buildDesc.include(xref);
        });
    });

    let taskName = argv.task || buildDesc._primary;

    //
    // Stage 2: convert the normalized build description to action-able objects
    //
    let builder = new Builder();
    builder._basedir = buildDesc._dirname;
    if (argv.force) {
        builder._force = true;
    }
    if (!builder.compile(buildDesc)) {
        process.exit(1);
    }
    if (argv.describe) {
        console.log(JSON.stringify(buildDesc, null, 4));
        process.exit();
    }

    builder.run(taskName);

    if (argv.watch) {
        builder.watchFiles();
    }
})();
