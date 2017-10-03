#!/usr/bin/env node

import Command from '../command';

export async function handler(argv) {
  await new PublishCommand(argv._, argv).run();
}

export const command = 'publish';

export const description = 'publish new version';

export const builder = {
  "prepare": {
    group: "Command Options:",
    describe: "Prepare phase",
    type: "boolean",
    default: false,
  },
  "publish": {
    group: "Command Options:",
    describe: "Publish phase",
    type: "boolean",
    default: true
  }
};

export default class PublishCommand extends Command {
  async runCommand() {
    if (this.options.prepare) {
      // 1. determine next version according to commit history
      // 2. modify changelog.md file according to changes in github
      //    2.1. if possible: run check to make sure messages follow the conventional commit syntax
      // 3. modify angular component that holds the change log content. (md to html conversion)
      // 4. update the app-config file with the application version
      // 5. commit changes (without pushing)
    }

    if (this.options.publish) {
      // 0. [optional]: make sure no changes pending commit (let me know if you need my assistance here)
      // 1. tag the version. include the relevant part from the changelog
      // 2. invoke the publish command as suggested by standard version.
    }

  }
}
