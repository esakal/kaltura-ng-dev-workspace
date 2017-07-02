#!/usr/bin/env node
require("babel-polyfill");

var globalOptions = require('../lib/command').builder;
const yargs = require('yargs');

// the options grouped under "Global Options:" header
const globalKeys = Object.keys(globalOptions).concat([
  "help",
  "version",
]);

yargs()
  .options(globalOptions).group(globalKeys, "Global Options:")
	.commandDir("../lib/commands")
	.demandCommand()
	.help("h").alias("h", "help")
	.parse(process.argv.slice(2));