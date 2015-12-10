build.addCmd("hello", function(task, noun) {
    task.shell(`echo Hello ${noun}`);
});
