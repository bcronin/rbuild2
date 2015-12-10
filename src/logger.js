'use strict';

const sprintf = require("sprintf-js").sprintf;
const colors = require("colors/safe");

class Logger {

    constructor() {
        this._transforms = {};
    }

    presets() {

        let list = Array.prototype.slice.call(arguments);

        function fmtMilliseconds(s) {
            let millis = parseFloat(s);
            let duration;
            let suffix;
            if (millis > 60 * 1000) {
                duration = millis / (60 * 1000);
                suffix = "m";
            } else if (millis > 1250) {
                duration = millis / 1000;
                suffix = "s";
            } else {
                duration = millis;
                suffix = "ms";
            }
            return colors.cyan.bold(sprintf("%.1f%s", duration, suffix));
        }

        let presetTable = {
            "colors" : {
                "black.bold"    : (s) => colors.black.bold(s),
                "red.bold"      : (s) => colors.red.bold(s),
                "green.bold"    : (s) => colors.green.bold(s),
                "yellow.bold"   : (s) => colors.yellow.bold(s),
                "blue.bold"     : (s) => colors.blue.bold(s),
                "magenta.bold"  : (s) => colors.magenta.bold(s),
                "cyan.bold"     : (s) => colors.cyan.bold(s),
                "white.bold"    : (s) => colors.white.bold(s),
                "gray.bold"     : (s) => colors.gray.bold(s),
                "grey.bold"     : (s) => colors.grey.bold(s),
                "black.dim"     : (s) => colors.black.dim(s),
                "red.dim"       : (s) => colors.red.dim(s),
                "green.dim"     : (s) => colors.green.dim(s),
                "yellow.dim"    : (s) => colors.yellow.dim(s),
                "blue.dim"      : (s) => colors.blue.dim(s),
                "magenta.dim"   : (s) => colors.magenta.dim(s),
                "cyan.dim"      : (s) => colors.cyan.dim(s),
                "white.dim"     : (s) => colors.white.dim(s),
                "gray.dim"      : (s) => colors.gray.dim(s),
                "grey.dim"      : (s) => colors.grey.dim(s),
                "black"         : (s) => colors.black(s),
                "red"           : (s) => colors.red(s),
                "green"         : (s) => colors.green(s),
                "yellow"        : (s) => colors.yellow(s),
                "blue"          : (s) => colors.blue(s),
                "magenta"       : (s) => colors.magenta(s),
                "cyan"          : (s) => colors.cyan(s),
                "white"         : (s) => colors.white(s),
                "gray"          : (s) => colors.gray(s),
                "grey"          : (s) => colors.grey(s),
                "bgBlack"       : (s) => colors.bgBlack(s),
                "bgRed"         : (s) => colors.bgRed(s),
                "bgGreen"       : (s) => colors.bgGreen(s),
                "bgYellow"      : (s) => colors.bgYellow(s),
                "bgBlue"        : (s) => colors.bgBlue(s),
                "bgMagenta"     : (s) => colors.bgMagenta(s),
                "bgCyan"        : (s) => colors.bgCyan(s),
                "bgWhite"       : (s) => colors.bgWhite(s),
            },
            "units" : {
                "ms"            : fmtMilliseconds,
            }
        }
        for (let value of list) {
            this.transforms(presetTable[value]);
        }
    }

    transforms(m) {
        for (let key in m) {
            let value = m[key];
            if (typeof value === "string") {
                this._transforms[key] = this._transforms[value];
            } else {
                this._transforms[key] = value;
            }
        }
    }

    _transform(text) {
        let errs = new Set();
        text = text.replace(/{{(.*?)\|([A-Za-z_\.]+?)}}/gm, (m, s, t) => {
            let f = this._transforms[t];
            if (typeof f === "function") {
                return f(s);
            }
            errs.add(t);
            return s;
        });
        if (errs.size) {
            text += " [%BAD_TRANSFORM:" + Array.from(errs).join(",") + "]";
        }
        return text;
    }

    infof_v2(fmt) {}
    infof_v1(fmt) {}

    infof(fmt) {
        let prefix = colors.gray("I" + this._prefix()) + " ";
        let text = prefix + sprintf.apply(sprintf, arguments);
        text = this._transform(text);
        console.log(text);
    }
    warnf(fmt) {
        let prefix = colors.bgYellow.black("I" + this._prefix()) + " ";
        let text = prefix + colors.yellow(sprintf.apply(sprintf, arguments));
        text = this._transform(text);
        console.warn(text);
    }
    errorf(fmt) {
        let prefix = colors.bgRed.black("E" + this._prefix()) + " ";
        let text = prefix + colors.red(sprintf.apply(sprintf, arguments));
        text = this._transform(text);
        console.error(text);
    }
    fatalf(fmt) {
        this.errorf.apply(this, arguments);
        process.exit(1);
    }

    _prefix() {
        var d = new Date();
        return sprintf("%02d:%02d.%02d]", d.getHours(), d.getMinutes(), d.getSeconds())
    }
}

// Create a default logger with nice-to-have presets
let log = new Logger();
log.presets("colors", "units");

log.createLogger = function() {
    return new Logger();
};

module.exports = log;
