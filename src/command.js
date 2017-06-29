import log from 'npmlog';

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
		this.runCommand();
	}
}


export function commandNameFromClassName(className) {
	return className.replace(/Command$/, "").toLowerCase();
}
