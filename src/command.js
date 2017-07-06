import log from 'npmlog';
import _ from "lodash";

import WorkspaceConfig from './workspace-config';

export const builder = {
  "loglevel": {
    defaultDescription: "info",
    describe: "What level of logs to report.",
    type: "string",
  }
};

export default class Command
{
	constructor(input, flags, cwd) {
		log.pause();
		log.heading = "kaltura-ng-workspace";

		if (flags.loglevel) {
			log.level = flags.loglevel;
		}

		this.input = input;
		this._flags = flags;

		log.silly("input", input);

		this.logger = log.newGroup(this.name);

		log.resume();

    this.workspace = new WorkspaceConfig();

    log.silly("options",this.options);
  }

	get name() {
		// For a class named "FooCommand" this returns "foo".
		return commandNameFromClassName(this.className);
	}

	get className() {
		return this.constructor.name;
	}

	async run()
	{
		try {
      await this.workspace.load();
      this.runCommand();
    }catch(err)
		{
			console.log(err);
			process.exit(1);
		}
	}

  get options() {
    if (!this._options) {
      this._options = _.defaults(
        {},
        // CLI flags, which if defined overrule subsequent values
        this._flags
      );
    }

    return this._options;
  }
}


export function commandNameFromClassName(className) {
	return className.replace(/Command$/, "").toLowerCase();
}
