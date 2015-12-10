# rbuild

A `make`-like tool with a few additional conventions and conveniences.

## Example

```js
build.task("tbd")
```

## Command-line Usage

* `-w, --watch` - runs in watch mode: will run the given task then poll all the dependent files and rerun the top-level task whenever
* `-f, --force` - ignores timestamps and forces all tasks to be run. When combined with the watch option, the force option only applies to the first run of the tasks
* `-h, --help` - describes the tasks
* `-d, --describe`, - outputs a detailed JSON dependency graph

## rbuild.config.js

The configuration file has the following properties:

* Interpreted as ES6 JavaScript
* The `build` variable is exposed as a global
* The environment variables are exposed as the map `ENV`

## API

Builds are described in a file named `rbuild.config.js`.  This exports two special variables `build` and `ENV`. It is also compiled as ES6 Javascript.

**build**

* `task(name)` - create a new named task
* `include(directory)` - add in the tasks and commands from another rbuild.config
* `addCmd(name, { desc })` - add a custom named command

**Task**

* `describe(msg)` - give the task a brief description
* `deps([ dependencies ])` - ordered list of dependencies of this task
* `watch([ dependencies ])` - dependencies that should retrigger this task in watch mode
* `shell(command)` - run the command string via the shell
* `exec(process, [ args ], { options })` - run an executable outside the shell
* `cmd(name, ...)` - run a command registered with addCmd

<!--
* `shelljs( callback => (sh) )`
* `subtasks(arr, { options} , callback => (task))`
-->

### task(name)

Create a new named task.

```js
build.task("test")
```

### describe(msg)

```js
build.task("test")
    .describe("runs all the unit tests")
    .shell("npm run test")
```

### deps(deps)

```js
build.task("test")
    .describe("runs all the unit tests")
    .deps([ "build", "lint" ])
    .shell("npm run test")
```

### shell(command)

Runs a command or array of commands as bash scripts. `rbuild` will go out of its way to try to run these commands *with bash* (e.g. using MinGW on Windows).

* `shell(command)`
* `shell([ commands ])`

```js
build.task("test")
    .describe("runs all the unit tests")
    .deps([ "build", "lint" ])
    .shell("npm run test")
```

```js
build.task("test")
    .describe("runs all the unit tests")
    .deps([ "build", "lint" ])
    .shell([
        "npm run test-fast",
        "npm run test-slow",        
    ]);
```

As `rbuild` compiles the source files using ES6 syntax, the long-string form can be used to construct full scripts inline in the `rbuild.config.js` file:

```js
build.task("<tbd>")
    .shell(`\
set -e
echo
echo Hello World
echo
gcc -c myfile.cc -o myfile.o
`)
```

### exec(cmdName, ...args, options)

The `exec` command explicitly launches a new process without going through a sub-shell.

```js
build.task("test")
    .describe("runs all the unit tests")
    .deps([ "build", "lint" ]
    .exec("go", "build", "...", { })
```

### subtasks(arr, opts, cb(task))

Creates a new anonymous child task for each element in the array.  The child task is automatically a dependency of the named parent task.

```js
var glob = require("glob");
build.task("compile-less")
    .subtasks(glob.sync("assets/style/*.less"), (task, filename) => {
        task.shell(`lessc ${fileanme}`)
    })
```
