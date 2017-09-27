#!/usr/bin/env node

import shelljs from 'shelljs';
import fs from 'fs';
import path from 'path';
import Command from '../command';


export async function handler(argv) {
	await new CleanCommand(argv._, argv).run();
}

export const command = 'clean';

export const description = 'Remove the node_modules directory from all packages.';

export default class CleanCommand extends Command {
	async runCommand() {
      this.workspace.runLernaCommand(`clean --yes`);

      this.workspace.repositories.filter(repository =>
      {
      	return repository.isMonoRepo;
      }).forEach((repository) =>
      {
        const repoModulesPath = path.join(repository.path,'node_modules');
        this.logger.info(`removing ${repoModulesPath}`);
        shelljs.rm('-rf', path.join(repository.path,'node_modules'));
      });
	}
}
