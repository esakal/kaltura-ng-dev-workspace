#!/usr/bin/env node

import Command from '../command';
import conventionalRecommendedBump from 'conventional-recommended-bump';
import semver from 'semver';
import path from 'path';
import fs from 'fs';
import conventionalChangelog from 'conventional-changelog';
import { accessSync } from 'fs-access';
import showdown from 'showdown';
import util from 'util';

export async function handler(argv) {
  await new PublishCommand(argv._, argv).run();
}

export const command = 'publish';

export const description = 'publish a new version';

export const builder = {
  'prepare': {
    group: 'Command Options:',
    describe: 'Prepare phase',
    type: 'boolean',
    default: true,
  },
  'publish': {
    group: 'Command Options:',
    describe: 'Publish phase',
    type: 'boolean',
    default: false // TODO [kmcng] default will be true
  }
};

const pkgPath = path.resolve(process.cwd(), './package.json');
const pkg = require(pkgPath);
const changelogFile = path.resolve(process.cwd(), './CHANGELOG.md');
const changelogComponentFile = path.resolve(process.cwd(), './src/app/components/changelog/changelog-content/changelog-content.component.html');
let configsToUpdate = {};
let version = pkg.version;

export default class PublishCommand extends Command {
  async runCommand() {
    if (this.options.prepare) {
      this.logger.verbose('Prepare phase');

      this.logger.verbose('Get new version and update configs.\n');
      version = await this.getNewVersion();

      this.logger.verbose('Update changelog.\n');
      const changelog = await this.updateChangelog(version);

      this.logger.verbose('Update changelog component.\n');
      this.updateChangelogComponent(changelog);

      this.logger.verbose('Update app-config with new version.\n');
      this.updateAppConfigVersion(version);

      this.logger.verbose('Commit changes.\n');
      await this.execCommit(version);
    }

    if (this.options.publish) {
      this.logger.verbose('Publish phase.\n');

      const hasUncommittedChanges = !!(await this.workspace.runShellCommnad('git status -s', true));
      this.logger.silly('hasUncommittedChanges', hasUncommittedChanges);

      if (hasUncommittedChanges) {
        this.logger.warn('It seems that you have uncommitted changes.\n');
        this.logger.warn('To perform this command you should either commit your changes or reset them.\n');
        this.logger.warn('Aborting command.\n');
        return;
      }

      this.logger.verbose(`Tagging release. Current version: ${ version }.\n`);
      await this.workspace.runShellCommnad(`git tag -a ${ version } -m "${ version }"`); // TODO [kmcng] tag message

      this.logger.verbose('Publishing release.\n');
      await this.workspace.runShellCommnad('git push --follow-tags origin master')
    }

  }

  async getNewVersion() {
    const release = await this.bumpVersion();
    const newVersion = semver.valid(release.releaseType) || semver.inc(pkg.version, release.releaseType, false);
    this.updateConfigs(newVersion);

    return newVersion;
  }

  bumpVersion() {
    return new Promise((resolve, reject) => {
      conventionalRecommendedBump(
        { preset: 'angular' },
        (err, release) => err ? reject(err) : resolve(release)
      );
    });
  }

  updateConfigs(newVersion) {
    configsToUpdate[path.resolve(process.cwd(), './package.json')] = false;
    configsToUpdate[path.resolve(process.cwd(), './package-lock.json')] = false;

    Object.keys(configsToUpdate).forEach(configPath => {
      try {
        const stat = fs.lstatSync(configPath);
        if (stat.isFile()) {
          const config = require(configPath);
          config.version = newVersion;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
          // flag any config files that we modify the version # for
          // as having been updated.
          configsToUpdate[configPath] = true;
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.logger.error(err.message);
        }
      }
    })
  }

  updateChangelog(newVersion) {
    return new Promise((resolve, reject) => {
      this.createIfMissing();
      let oldContent = fs.readFileSync(changelogFile, 'utf-8');
      // find the position of the last release and remove header:
      if (oldContent.indexOf('<a name=') !== -1) {
        oldContent = oldContent.substring(oldContent.indexOf('<a name='));
      }

      let content = '';

      let changelogStream = conventionalChangelog(
        { preset: 'angular' },
        { version: newVersion },
        { merges: null }
      ).on('error', err => reject(err));

      changelogStream.on('data', buffer => {
        content += buffer.toString();
      });

      changelogStream.on('end', function () {
        const changelog = (content + oldContent).replace(/\n+$/, '\n');
        fs.writeFileSync(changelogFile, changelog);
        return resolve(changelog);
      })
    })
  }

  createIfMissing() {
    try {
      accessSync(changelogFile, fs.F_OK)
    } catch (err) {
      if (err.code === 'ENOENT') {
        fs.writeFileSync(changelogFile, '\n');
      }
    }
  }

  updateChangelogComponent(changelog) {
    const converter = new showdown.Converter();
    const html = converter.makeHtml(changelog).replace(/[{}]+/g, '');
    fs.writeFileSync(changelogComponentFile, html, 'utf8');
  }

  updateAppConfigVersion(newVersion) {
    const filePath = path.resolve(process.cwd(), './src/app-config/index.ts');

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return this.logger.error(err);
      }

      const result = data.replace(/'appVersion':.*,/g, `'appVersion': '${ newVersion }',`);

      fs.writeFileSync(filePath, result, 'utf8');
    });
  }

  async execCommit (newVersion) {
    const paths = [changelogFile, changelogComponentFile];
    const commitMessage = `Commit changes for ${ newVersion } release`; // TODO [kmcng] commit message
    let msg = 'committing %s';
    let toAdd = `${changelogFile} ${changelogComponentFile}`;

    Object.keys(configsToUpdate).forEach(config => {
      if (configsToUpdate[config]) {
        msg += ' and %s';
        paths.unshift(path.basename(config));
        toAdd += ' ' + path.relative(process.cwd(), config);
      }
    });

    await this.workspace.runShellCommnad(`git add ${toAdd}`);
    await this.workspace.runShellCommnad(`git commit ${toAdd} -m "${this.formatCommitMessage(commitMessage, newVersion)}"`);
  }

  formatCommitMessage(msg, newVersion) {
    return String(msg).indexOf('%s') !== -1 ? util.format(msg, newVersion) : msg;
  }
}