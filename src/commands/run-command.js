#!/usr/bin/env node
import loadJsonFile from "load-json-file";
import log from "npmlog";
import path from 'path';
import shelljs from 'shelljs';
import fs from 'fs';
import findUp from 'find-up';
import writeJsonFile from 'write-json-file';
import Command from '../command';

export async function handler(argv) {
  return new RunCommand([argv.script, ...argv.args], argv).run();
}

export const command = "run <script> [args..]";

export const description = 'Run an npm script in each package that contains that script.';

export const builder = {
};

export default class RunCommand extends Command {
	async runCommand() {

    this.script = this.input[0];
    this.args = this.input.slice(1);

    if (!this.script) {
      throw new Error("You must specify which npm script to run.");
    }

    this.workspace.runLernaCommand(`run ${[this.script].concat(this.args).join(" ")}`);
	}
}
