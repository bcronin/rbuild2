'use strict';

const fs      = require("fs");
const path    = require("path");
const _       = require("underscore");
const shelljs = require("shelljs");
const glob    = require("glob");
const log     = require("../logger");
const trace   = require("api-javascript");

class TaskDesc {
    constructor(buildDesc, name) {
        this._build = buildDesc;
        this.desc = {
            name                : name,
            description         : "",
            dependencies        : [],
            watches             : [],
            sources             : [],
            actions             : [],
            cwd                 : buildDesc._dirname,
            external_references : {},
        };
    }

    describe(description) {
        this.desc.description = description;
        return this;
    }

    deps(arr) {
        if (arguments.length != 1 || !_.isArray(arr)) {
            throw new Error("deps() should have exactly one argument: an array of string names of the dependent tasks");
        }
        _.each(arr, (d) => {
            let m;
            if (m = d.match(/^([^:]+):/)) {
                this.desc.external_references[m[1]] = true;
            }
            this.desc.dependencies.push(d);
        });
        return this;
    }

    watch(arr) {
        if (arguments.length != 1 || !_.isArray(arr)) {
            throw new Error("watch() should have exactly one argument: an array of string names of the watch tasks");
        }
        _.each(arr, (d) => {
            let m;
            if (m = d.match(/^([^:]+):/)) {
                this.desc.external_references[m[1]] = true;
            }
            this.desc.watches.push(d);
        });
        return this;
    }

    sources(arr) {
        if (arguments.length === 1 && _.isString(arr)) {
            arr = [ arr ];
        }
        _.each(arr, t => this.desc.sources.push(t));
        return this;
    }

    // Directly pass the string to the shell so things like piping can be
    // taken advantage of.
    shell(cmd, opts) {
        if (_.isArray(cmd)) {
            _.each(cmd, (cmd) => {
                this.shell(cmd);
            });
            return;
        }
        this.desc.actions.push({
            type    : "shell",
            command : cmd,
            cwd     : this.desc.cwd,
            options : opts || {},
        });
        return this;
    }

    // Spawn a separate process without the shell.  The shell can sometimes
    // introduce unwanted side-effects, especially in a cross-platform setup.
    exec(cmd, args, options) {

        // Normalize args
        if (arguments.length === 2) {
            if (!_.isArray(args)) {
                options = args;
                args = [];
            }
        }
        this.desc.actions.push({
            type    : "exec",
            command : cmd,
            args    : args,
            cwd     : this.desc.cwd,
            options : options || {},
        });
        return this;
    }

    cmd (name) {
        // Swap the command name with the task object before calling the
        // callback
        let args = Array.from(arguments);
        args[0] = this;
        let cmd = this._build._commands[name];
        cmd.apply(null, args);
        return this;
    }

    subtasks() {}
};

module.exports = TaskDesc;
