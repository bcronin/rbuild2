build.task("build")
    .deps([ "sub-server" ])
    .sources([ "somefile.txt" ])
    .shell("echo run_script.sh")

build.task("sub-server")
    .deps([ "sub-compile", "sub-assets" ])
    .watch([ "sub-compile" ])
    .shell("./sub_server.sh", { background : true })

build.task("sub-compile")
    .sources([ "src/**/*" ])
    .shell("echo compile -c code.c");

build.task("sub-assets")
    .deps(["meta-less"])
    .sources([ "assets/**/*.less" ])
    .shell("echo lessc *.less");

build.task("meta-less")
    .sources([ "assets/colors.js", "assets/nonexistent_file.txt" ])
    .shell("echo generate_some_file")
