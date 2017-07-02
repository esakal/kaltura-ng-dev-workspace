#!/usr/bin/env node
import log from "npmlog";

import Command from '../command';

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
      this.repository.runLernaCommand(`clean`);
	  }

    log.info("bootstrap repositories dependencies");
    this.repository.runLernaCommand(`bootstrap --nohoist`);

    if (this.options.build) {
      this.repository.runLernaCommand(`run build`);
    }
	}
}
