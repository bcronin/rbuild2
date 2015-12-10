'use strict';

const fs      = require("fs");
const path    = require("path");
const _       = require("underscore");
const shelljs = require("shelljs");
const glob    = require("glob");
const log     = require("../logger");
const trace   = require("api-javascript");
const TaskDesc = require('./task_desc');


class BuildDesc {
    constructor(filename) {
        this._filename = null;
        this._dirname = null;
        this._primary = null;
        this._tasks = {};
        this._commands = {};
        this._included = {};
    }

    task(name) {
        this._primary = this._primary || name;
        let task = new TaskDesc(this, name);
        this._tasks[name] = task;
        return task;
    }

    addCmd(name , callback) {
        this._commands[name] = callback;
    }

    include(prefix, filename) {
        if (arguments.length == 1) {
            filename = prefix;
            prefix = filename + ":";
        }

        // Avoid duplicate inclusions
        let relpath  = path.join(this._dirname, filename);
        let fullpath = path.resolve(resolveRBuildConfig(relpath));
        if (this._included[fullpath]) {
            return;
        }
        this._included[fullpath];

        let xref = new BuildDesc();
        xref._load(relpath);
        xref._prefixTaskNames(prefix);
        this._merge(xref);
    }

    _load(filename) {
        filename = resolveRBuildConfig(filename);
        log.infof("{{%s|task}}", filename);

        this._filename = filename;
        this._dirname = path.dirname(this._filename);

        // Explicitly load the preset or else transformFileSync will try to load
        // it from the CWD rather than relative to the source
        let es2015 = require("babel-preset-es2015");

        let loaded = require("babel-core").transformFileSync(filename, { presets : [es2015] });
        let code = [];
        code.push("var ENV = {};");
        _.each(process.env, function (val, key) {
            code.push("ENV[" + JSON.stringify(key) + "] = " + JSON.stringify(val) + ";");
        });
        code.push(loaded.code);

        let requireProxy = function(name) {
            return require(name);
        }
        let f = new Function("build", "require", code.join("\n"));
        f(this, require);
    }

    _prefixTaskNames(prefix) {
        let t = {};
        _.each(this._tasks, (task, name) => {
            task.desc.name = prefix + name;
            task.desc.dependencies = _.map(task.desc.dependencies, (dep) => {
                return prefix + dep;
            });
            task.desc.watches = _.map(task.desc.watches, (dep) => {
                return prefix + dep;
            });
            t[prefix + name] = task;
        });
        this._tasks = t;
    }

    _merge(desc) {
        _.each(desc._commands, (cmd, name) => {
            if (this._commands[name]) {
                log.fatalf("Duplicate command with name '{{%s|task}}'", name);
            }
            this._commands[name] = cmd;
        });
        _.each(desc._tasks, (task, name) => {
            if (this._tasks[name]) {
                log.fatalf("Duplicate task with name '{{%s|task}}'", name);
            }
            this._tasks[name] = task;
        });
    }
}

function resolveRBuildConfig(filename) {
    let stat = fs.statSync(filename);
    if (stat.isDirectory()) {
        filename = path.join(filename, "rbuild.config.js");
    }
    if (!fs.existsSync(filename)) {
        return null;
    }
    return filename;
}

module.exports = BuildDesc;
