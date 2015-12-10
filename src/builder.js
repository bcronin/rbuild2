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
const Task    = require('./task');

class Builder {

    constructor() {
        this._primaryTask = null;
        this._tasks = {};
        this._force = false;
        this._basedir = null;
    }

    compile (desc) {

        let taskDescs = {};
        _.each(desc._tasks, (task, name) => {
            this._tasks[name] = new Task(task.desc);
        });

        if (!this._primaryTask && desc._primary) {
            this._primaryTask = this._tasks[desc._primary];
        }

        let ok = true;
        for (let taskName in this._tasks) {
            let task = this._tasks[taskName];
            for (let index in task._desc.dependencies) {
                let name = task._desc.dependencies[index];
                let dep = this._tasks[name];
                if (!dep) {
                    log.errorf("Reference to unknown task: {{%s|task}}", name);
                    ok = false;
                }
            }
        }
        if (!ok) {
            return false;
        }

        _.each(this._tasks, (task) => {
            task._parentDepSet = new Set();
        });
        _.each(this._tasks, (task) => {
            task._deps = _.map(task._desc.dependencies, name => this._tasks[name]);

            task._watches = _.map(task._desc.watches, name => this._tasks[name]);
            if (task._watches.length === 0) {
                task._watches = _.clone(task._deps);
            }

            _.each(task._watches, (subtask) => {
                subtask._parentDepSet.add(task);
            });

            task.expandSources();
            task.compileActions();
        });
        _.each(this._tasks, (task) => {
            task._parentDeps = Array.from(task._parentDepSet);
            delete task._parentDepSet;
        });

        return ok;
    }

    watchFiles() {



        //
        let sourceMap = (() => {
            let sourceMapSet = {};
            let sourceMapList = {};
            _.each(this._tasks, (task) => {
                _.each(task._sources, (src) => {
                    let absolutePath = path.resolve(src);
                    sourceMapSet[absolutePath] = sourceMapSet[absolutePath] || new Set();
                    sourceMapList[absolutePath] = sourceMapList[absolutePath] || [];
                    if (!sourceMapSet[absolutePath].has(task)) {
                        sourceMapSet[absolutePath].add(task);
                        sourceMapList[absolutePath].push(task);
                    }
                });
            });
            return sourceMapList;
        })();

        let onModified = (file) => {
            let runSet = new Set();
            _.each(sourceMap[file], task => {
                task._mergeParentDeps(runSet)
            });

            log.infof("Restarting tasks...");
            this.runFiltered(this._primaryTask, runSet)
        }

        let files = _.keys(sourceMap);
        if (files.length === 0) {
            return;
        }

        log.infof("Starting file watch (%d files)...", files.length);
        _.each(files, f => log.infof_v2('%s', f) );

        let lastModified = {};
        _.each(files, (f) => {
            lastModified[f] = fileTime(f);
        });

        let loop = () => {
            files = _.shuffle(files);

            let file = _.find(_.shuffle(files), (f) => {
                let last = lastModified[f];
                let now = fileTime(f);
                if (now > last) {
                    lastModified[f] = now;
                    return true;
                }
            });

            if (file) {
                log.infof("File modification: {{%s|file}}", file);
                onModified(file);
            }
            _.delay(loop, 50);
        };
        loop();
    }

    describe(taskName) {
        let series = _.map(this.prepare(taskName), task => task.name());
        console.log(JSON.stringify({
            build : {
                list : series,
            },
        }, null, 4));
    }

    run(taskName) {
        let task = this._tasks[taskName];
        log.infof("Running top-level task {{%s|green.bold}}...", task.name());
        return this.runFiltered(task, null);
    }

    runFiltered(task, filter) {
        this.loadStatus();

        let list =  task.prepare();
        if (filter) {
            list = _.filter(list, task => {
                return filter.has(task);
            });
        }

        let taskNames = _.map(list, task => task.name()).join(", ");
        log.infof("Preparing task chain (%d): {{%s|task}}", list.length, taskNames);

        let ok = true;
        for (let task of list) {

            if (!this._force && task.isUpToDate()) {
                log.infof("Task {{%s|task}} up-to-date.", task.name());
                continue;
            }

            log.infof("Starting {{%s|task}}...", task.name());

            let start = Date.now();
            ok = task.run(this);
            let duration = Date.now() - start;

            if (!ok) {
                log.errorf("{{%s|task}} failed after ({{%s|ms}})", task.name(), duration);
                break;
            }
            log.infof("Finished {{%s|task}} ({{%s|ms}})", task.name(), duration);
        }
        this.saveStatus();
        return ok;
    }

    _getStatusSet() {
        let rbuildSet = {};
        _.each(this._tasks, (task, name) => {
            let cwd = task._desc.cwd;
            rbuildSet[cwd] = rbuildSet[cwd] || {};
            rbuildSet[cwd][name] = task._status;
        });
        return rbuildSet;
    }

    _loadRBuildStatus(filename) {
        let existing = {};
        try {
            existing = JSON.parse(fs.readFileSync(filename, "utf8"));
        } catch (e) {
            // Ignored
        }
        return existing;
    }

    loadStatus() {
        if (this._force) {
            return;
        }
        let rbuildSet = this._getStatusSet();
        _.each(rbuildSet, (status, dir) => {
            let filename = path.join(dir, ".rbuild.status");
            if (!fs.existsSync(filename)) {
                return;
            }

            log.infof_v1("Loading {{%s|file}}", filename);

            let configTime = fileTime(path.join(dir, "rbuild.config.js"));

            let existing = this._loadRBuildStatus(filename);
            let prefix = path.relative(this._basedir, dir);
            _.each(existing, (status, name) => {
                if (prefix) {
                    name = prefix + "/:" + name;
                }
                let task = this._tasks[name];
                if (task) {
                    task._status = _.extend(task._status, status);

                    // If the build file itself has been modified since the task was
                    // last run, consider that task invalid
                    if (task._status.last_run < configTime) {
                        task._status.last_run = 0;
                    }
                }
            });
        });
    }

    saveStatus() {
        let rbuildSet = this._getStatusSet();
        _.each(rbuildSet, (status, dir) => {
            let filename = path.join(dir, ".rbuild.status");
            let existing = this._loadRBuildStatus(filename);
            _.each(status, (taskStatus, name) => {
                name = name.replace(/^(.+):/, "");
                existing[name] = _.extend({}, existing[name], taskStatus);
            })
            fs.writeFileSync(filename, JSON.stringify(existing, null, 4));
            log.infof("Updated {{%s|file}}", filename);
        });
    }
}

function fileTime(f) {
    let mod = 0;
    if (fs.existsSync(f)) {
        let stat = fs.statSync(f);
        mod = stat.mtime.getTime();
    }
    return mod;
}

module.exports = Builder;
