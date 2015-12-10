'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const _ = require('underscore');
const shelljs = require('shelljs');

const isWindows = os.platform() == 'win32';

// Resolves paths for files/directories that are known to exist.
class Resolver {

    dirname (baseName) {
        // If it's found, assume we're all good...
        if (fs.existsSync(baseName)) {
            return baseName;
        }

        // Check if a MinGW path is being used on Windows
        if (isWindows) {
            let cwd = baseName.replace(/^\/([a-z])\//, "$1:\\").replace(/\//, "\\");
            if (cwd != baseName && fs.existsSync(cwd)) {
                return cwd;
            }
        }

        // Failed: leave it as is
        return baseName;
    }

    // Resolves the filename and also gives priority to Windows executable
    // extensions like ".cmd" and ".exe"
    executable(workingDir, baseCmd) {

        if (typeof workingDir !== 'string') {
            throw new Error('Invalid argument: workingDir is not a string');
        }
        if (typeof baseCmd !== 'string') {
            throw new Error('Invalid argument: baseCmd is not a string');
        }

        function resolveBase(baseCmd) {
            let cmd = baseCmd;
            if (!fs.existsSync(baseCmd)) {
                cmd = shelljs.which(baseCmd);
            }
            // On Windows give ".cmd" and ".exe" a try if the file cannot be located
            if (isWindows && !cmd) {
                if (cmd === null) {
                    cmd = shelljs.which(baseCmd + ".cmd");
                }
                if (cmd === null) {
                    cmd = shelljs.which(baseCmd + ".exe");
                }
            }
            return cmd;
        }

        // Try the full path if the base path does not resolve
        let cmd = resolveBase(baseCmd);
        if (!cmd) {
            let full = path.resolve(workingDir, baseCmd);
            cmd = resolveBase(full);
        }

        // On Windows give preference to a ".exe" or ".cmd" with the same name
        // as the located file. A specific case here is "npm" will be found
        // but we want to run "npm.cmd" on Windows.
        if (isWindows) {
            if (fs.existsSync(cmd + ".cmd")) {
                cmd += ".cmd";
            } else if (fs.existsSync(cmd + ".exe")) {
                cmd += ".exe";
            }
        }
        return cmd;
    }
}

module.exports = new Resolver();
