#!/usr/bin/env node
import log from "npmlog";

import Command from '../command';

export async function handler(argv) {
	await new BookmarkCommand([argv.name, ...argv.args], argv).run();
}

export const command = 'bookmark <name> [args...]';

export const description = 'git checkout to specified bookmark';

export const builder = {
  "update": {
    group: "Command Options:",
    describe: "Update bookmark commit id to the latest commit.",
	  type : "boolean",
    default : false
  }
};

export default class BookmarkCommand extends Command {
  async runCommand() {

    this.bookmarkName = this.input[0];
    this.args = this.input.slice(1);

    try {
      if (this.options.update) {
        log.info(`updating bookmark ${this.bookmarkName} to the latest commit in local repo`);
        let latestCommitId = await this.workspace.runShellCommand('git log --format="%H" -n 1');
        latestCommitId = latestCommitId.match(/^[a-f0-9]{7,40}/);
        log.verbose(`commit id ${latestCommitId}`);

        this.workspace.updateKWSConfig({commands: {bookmark: {[this.bookmarkName] : latestCommitId}}});

      } else {
        log.info(`git checkout to stored commit of bookmark named ${this.bookmarkName}`);

        const bookmarkCommitId = this.workspace.getKWSCommandValue(`bookmark.${this.bookmarkName}`);

        if (!bookmarkCommitId)
        {
          log.error(`couldn't find bookmark named ${this.bookmarkName}.`);
          process.exit(1);
        }

        log.silly("bookmark commit id", bookmarkCommitId);

        const hasUnCommitedChanges = !!(await this.workspace.runShellCommand('git status -s', true));
        log.silly("hasUnCommitedChanges", hasUnCommitedChanges);

        if (hasUnCommitedChanges) {
          log.warn('it seems that you have uncommited changes. to perform this command you should either commit your chnages or reset them. aborting command');
        } else {
          await this.workspace.runShellCommand(`git checkout ${bookmarkCommitId}`, false);
        }
      }
    }
    catch(err) {
      log.error(err);
      process.exit(1);
    }
  }
}
