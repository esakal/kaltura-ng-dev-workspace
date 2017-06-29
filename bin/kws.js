#!/usr/bin/env node
require("babel-polyfill");
const yargs = require('yargs');

yargs
	.commandDir("../lib/commands")
	.demandCommand()
	.help("h").alias("h", "help")
	.parse(process.argv.slice(2));