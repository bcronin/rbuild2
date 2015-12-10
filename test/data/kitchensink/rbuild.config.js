build.include("commands");

build.task("build")
    .deps([ "compile", "assets" ])

build.task("assets")
    .shell("echo Pretending to build assets")

build.task("compile")
    .deps([ "compile-go", "compile-cpp", "compile-rust" ])

build.task("compile-go")
    .shell("echo go build ...")
    .cmd("hello", "World")
    .cmd("hello", "Everyone")

build.task("compile-cpp")
    .shell([
        "echo gcc -c somefile1.cpp",
        "echo gcc -c somefile2.cpp",
        "echo gcc -c somefile3.cpp",
    ]);

build.task("compile-rust")
    .deps([ "subproject/:build" ])
    .shell("echo rustc sourcecode.rst")
