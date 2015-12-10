build.task("noop")

build.task("publish")
    .exec("npm", [ "version", "patch" ])
    .exec("node", [ "../rpublish/index.js" ])
