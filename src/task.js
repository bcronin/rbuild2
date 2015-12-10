'use strict';

const fs      = require("fs");
const path    = require("path");
const _       = require("underscore");
const shelljs = require("shelljs");
const glob    = require("glob");
const log     = require("./logger");
const actions = require("./actions");
const trace   = require("api-javascript");

const kCurrentUser = require('username').sync();

class Task {

    constructor(desc) {
        this._desc = desc;
        this._cwd = desc.cwd;
        this._deps = [];
        this._watches = [];
        this._parentDeps = [];
        this._actions = [];
        this._sources = [];
        this._status = {
            last_run : 0,
        };
    }

    name() {
        return this._desc.name;
    }

    expandSources() {
        // The sources are internally expanded to be relative to rbuild's
        // current working directory (not the task's).
        var set = {};
        _.each(this._desc.sources, s => {
            let results = glob.hasMagic(s)
                ? glob.sync(s, { cwd : this._cwd })
                : [ s ];
            _.each(results, r => { set[r] = true });
        });
        _.each(_.keys(set), t => {
            this._sources.push(path.join(this._cwd, t));
        });
    }

    compileActions() {
        this._actions = _.map(this._desc.actions, (act) => {
            return actions.compile(act);
        });
    }

    // Builds the task dependency chain for this task ordered bottom-up to,
    // and including, this task.
    prepare() {
        let set = new Set();
        let list = [];
        this._prepareImp(set, list)
        return list;
    }

    _prepareImp(set, list) {
        if (set.has(this)) {
            return;
        }
        set.add(this);
        _.each(this._deps, dep => {
            dep._prepareImp(set, list);
        });
        list.push(this);
    }

    _mergeParentDeps(set) {
        if (set.has(this)) {
            return;
        }
        set.add(this);
        _.each(this._parentDeps, dep => {
            dep._mergeParentDeps(set);
        });
    }

    isUpToDate() {
        // Always run tasks without explicit sources
        if (this._sources.length === 0) {
            return false;
        }

        return !_.any(this._sources, s => {
            if (!fs.existsSync(s)) {
                return true;
            }
            let stat = fs.statSync(s);
            let modified = stat.mtime.getTime();
            if (modified >= this._status.last_run) {
                return true;
            }
        });
    }

    run(builder) {
        let workingDir = process.cwd();

        let span = trace.span("task/" + this.name());
        span.endUserID(kCurrentUser);

        let ok = true;
        try {
            // Run the actions in the Task's working directory
            process.chdir(this._cwd);
            for (let action of this._actions) {
                ok = action.run();
                if (!ok) {
                    break;
                }
            }
            if (ok) {
                this._status.last_run = Date.now();
            }
        } finally {
            process.chdir(workingDir);
            span.end();
        }
        return ok;
    }
}

module.exports = Task;
