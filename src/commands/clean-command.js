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
	await new CleanCommand(argv._, argv).run();
}

export const command = 'clean';

export const description = 'Remove the node_modules directory from all packages.';

export default class CleanCommand extends Command {
	async runCommand() {
      this.repository.runLernaCommand(`clean --yes`);
	}
}
