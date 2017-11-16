#!/usr/bin/env node
import log from "npmlog";

import Command from '../command';
import shelljs from 'shelljs';

export async function handler(argv) {
	await new NpmLinkCommand(argv._, argv).run();
}

export const command = 'npm-link';

export const description = 'link workspace libraries locally';

export const builder = {
};

export default class NpmLinkCommand extends Command {
	async runCommand() {

    log.info("setup your workspace (this action might take several minutes)");
    this.workspace.repositories.filter(repository =>
    {
      return repository.isMonoRepo;
    }).forEach((repository) =>
    {
      log.info(`install dependencies in '${repository.name}' mono repository root folder`);
      shelljs.exec('npm install',{cwd : repository.path});
    });

    log.info("bootstrap repositories dependencies (this action might take several minutes)");
    this.workspace.runLernaCommand(`bootstrap --nohoist`);
	}
}
