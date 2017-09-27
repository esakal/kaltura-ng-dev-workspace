#!/usr/bin/env node
import log from "npmlog";

import Command from '../command';
import shelljs from 'shelljs';

export async function handler(argv) {
	await new SetupCommand(argv._, argv).run();
}

export const command = 'setup';

export const description = 'setup dev environment';

export const builder = {
  "clean": {
    group: "Command Options:",
    describe: "Delete node_modules of packages before running the setup",
	  type : "boolean",
    defaultDescription: false,
  },
  "build": {
    group: "Command Options:",
    describe: "Build packages once setup is completed",
    type : "boolean",
    default : true
  }
};

export default class SetupCommand extends Command {
	async runCommand() {

	  if (this.options.clean) {
      log.info("delete packages 'node_modules' folder");
      this.workspace.runLernaCommand(`clean`);

      // TODO consider executing the clean command instead of having duplicated code
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

    if (this.options.build) {
      this.workspace.runLernaCommand(`run build`);
    }
	}
}
