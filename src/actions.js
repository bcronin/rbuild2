'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');
const _ = require('underscore');
const log = require('./logger');
const resolve = require('./path_resolve');


class Action {
    // Returns true if the action succeeded
    run() { throw new Error("Not implemented"); }
}

class SpawnActionBase extends Action {
    constructor() {
        super();
        this._child = null;

        process.on('beforeExit', ()=>{
            this._killChildren();
        });
    }

    _killChildren() {
        if (!this._child) {
            return;
        }

        log.infof("Terminating process ID: %d", this._child.pid);
        try {
            this._child.kill();
            /*if (os.platform() === 'win32') {
                child_process.execSync('taskkill /F /t /pid '+this._child.pid);
            }*/
        } catch (e) {}
        this._child = null;
    }
}

class ShellAction extends SpawnActionBase {
    constructor(desc) {
        super();
        this._desc = desc;
        this._command = desc.command;
        this._cwd = path.resolve(resolve.dirname(desc.options.cwd || desc.cwd || process.cwd()));
    }
    run() {
        log.infof("{{%s|command}}", this._command);
        this._killChildren();

        // Originally the implementation simply used shelljs.exec().
        // However, this failed on MinGW32 as the environment would end up being
        // "unix-ish" but CMD.exe would be used to run the command, not bash.
        let filename = path.join(os.tmpdir(), "rbuild-" + (Math.random() * 0x100000000 + 1).toString(36) + "-" + (Date.now()).toString(36));
        fs.writeFileSync(filename, this._command + "\n");

        if (!this._desc.options.background) {
            return this._execForeground(filename);
        } else {
            return this._execBackground(filename);
        }
    }

    _execForeground(filename) {
        try {
            child_process.execSync("bash " + filename, {
                stdio : 'inherit',
                cwd   : this._cwd,
            });
        } catch (e) {
            log.errorf("Exception: %s", e);
            log.errorf("Working directory: %s", this._cwd);
            return false;
        } finally {
            fs.unlinkSync(filename);
        }
        return true;
    }

    _execBackground(filename) {
        let script = path.join(__dirname, "/actions/shell_exec_background.js");
        this._child = child_process.fork(script, [
            filename,
            this._cwd,
        ]);
        this._child.on('error', (err) => {
            log.errorf('Failed to start child process. %s', err);
            log.errorf("Command: '%s'", cmd);
            log.errorf("CWD: %s", spawnOpts.cwd);
            log.errorf("Descriptor: %j", this._desc);
        });
        log.infof("Started child process ID: %d", this._child.pid);
        return (this._child != null);
    }
}

class ExecAction extends SpawnActionBase {
    constructor(desc) {
        super();
        this._desc = desc;
        this._cwd = resolve.dirname(desc.options.cwd || desc.cwd || process.cwd());
        this._cmd = resolve.executable(this._cwd, desc.command);
        this._args = desc.args || [];
        this._options = desc.options || {};
    }

    run() {
        log.infof("{{%s|yellow.bold}} {{%s|yellow}}", this._desc.command, this._args.join(" "));
        this._killChildren();

        let spawnOpts = {
            cwd   : this._cwd,
        };
        if (this._options.background) {
            return this._execBackground(spawnOpts);
        } else {
            return this._exec(spawnOpts);
        }
    }

    _exec(spawnOpts) {
        spawnOpts = _.extend(spawnOpts, {
            stdio : 'inherit',
        });
        try {
            let output = child_process.execFileSync(this._cmd, this._args, spawnOpts);
        } catch (e) {
            return false;
        }
        return true;
    }

    _execBackground(spawnOpts) {
        let cmd = this._cmd;
        spawnOpts = _.extend(spawnOpts, {
            stdio : [ 'ignore', 'inherit', 'inherit' ],
        });
        this._child = child_process.execFile(cmd, this._args, spawnOpts);
        this._child.on('error', (err) => {
            log.errorf('Failed to start child process. %s', err);
            log.errorf("Command: '%s'", cmd);
            log.errorf("CWD: %s", spawnOpts.cwd);
            log.errorf("Descriptor: %j", this._desc);
            console.log(require("shelljs").which("bash"));
        });
        return (this._child != null);
    }
}

class Lib {
    compile (act) {
        switch (act.type) {
        case "shell" : return new ShellAction(act);
        case "exec"  : return new ExecAction(act);
        default:
            return null;
        }
    }
}

module.exports = new Lib();
