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
import { lint } from '@commitlint/core';
import { rules } from '@commitlint/config-angular';
import findUp from 'find-up';
import loadJsonFile from 'load-json-file';
import writeJsonFile from 'write-json-file';

export async function handler(argv) {
  await new ReleaseCommand(argv._, argv).run();
}

export const command = 'release';

export const description = 'release the new version';

export const builder = {
  'prepare': {
    group: 'Command Options:',
    describe: 'Prepare phase: bump version, update configs, update change logs',
    type: 'boolean',
    default: true,
  },
  'publish': {
    group: 'Command Options:',
    describe: 'Publish phase: tag release and push changes',
    type: 'boolean',
    default: true
  },
  'branch': {
    group: 'Command Options:',
    describe: 'Change target branch',
    type: 'string',
    default: 'master'
  }
};



export default class ReleaseCommand extends Command {
  async runCommand() {
    const appConfigPath = this.workspace.getKWSCommandValue('release.appConfig.path');
    this.appConfigFile = appConfigPath ? findUp.sync(appConfigPath, { cwd: process.cwd() }) : '';

    const changelogComponentPath = this.workspace.getKWSCommandValue('release.changeLog.htmlPath');
    this.changelogComponentFile = changelogComponentPath ? findUp.sync(changelogComponentPath, { cwd: process.cwd() }) : '';

    this.changelogFile = findUp.sync('CHANGELOG.md', { cwd: process.cwd() });
    this.configsToUpdate = {};

    const currentBranch = (await this.workspace.runShellCommnad('git name-rev --name-only HEAD')).trim();
    const pkg = loadJsonFile.sync(findUp.sync('package.json', { cwd: process.cwd() }));
    let version = pkg.version;

    if (this.options.branch !== currentBranch) {
      this.logger.error('Specified branch is different from active. Please checkout to specified branch or provide relevant branch name.');
      this.logger.error(`Specified branch: ${this.options.branch}. Active branch: ${currentBranch}`);
      return;
    }

    if (this.options.prepare) {
      this.logger.info('Prepare phase');

      if (!(await this.lintCommitsSinceLastRelease())) {
        this.logger.warn('Some of commits since last release is NOT tapping into conventional-commits. Consider following conventional-commits standard http://conventionalcommits.org/.');
      }

      this.logger.info('Get new version.');
      version = await this.getNewVersion(version);

      this.logger.info('Update configs.');
      this.updateConfigs(version);

      this.logger.info('Update changelog.');
      const changelog = await this.updateChangelog(version);

      this.logger.info('Update changelog component.');
      this.updateChangelogComponent(changelog);

      this.logger.info('Update app-config with new version.');
      if (this.updateAppConfigVersion(version)) {
        this.logger.info('Commit changes.');
        await this.commitChanges(version);
      }
    }

    if (this.options.publish) {
      this.logger.info('Publish phase.');

      if (!!(await this.workspace.runShellCommnad('git status -s', true))) {
        this.logger.error('It seems that you have uncommitted changes. To perform this command you should either commit your changes or reset them. Aborting command.');
        return;
      }

      this.logger.info(`Tagging release. Current version: ${ version }.`);
      await this.workspace.runShellCommnad(`git tag -a v${ version } -m 'v${ version }'`);

      this.logger.info('Publishing release.');
      // await this.workspace.runShellCommnad(`git push --follow-tags origin ${this.options.branch}`);
    }

  }

  async lintCommitsSinceLastRelease() {
    const commits = await this.workspace.runShellCommnad('git log `git describe --match="v?.?.?" --abbrev=0`..HEAD --oneline');
    const result = lint(commits, rules);

    return result.valid;
  }


  async getNewVersion(currentVersion) {
    const release = await this.bumpVersion();
    console.log(this.workspace.version);
    return semver.valid(release.releaseType) || semver.inc(currentVersion, release.releaseType, false);
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
    this.configsToUpdate[findUp.sync('package.json', { cwd: process.cwd() })] = false;
    this.configsToUpdate[findUp.sync('package-lock.json', { cwd: process.cwd() })] = false;

    Object.keys(this.configsToUpdate).forEach(configPath => {
      try {
        const stat = fs.lstatSync(configPath);
        if (stat.isFile()) {
          const config = loadJsonFile.sync(configPath);
          config.version = newVersion;
          writeJsonFile.sync(configPath, config, { indent: 2 });
          this.configsToUpdate[configPath] = true;
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
      const changelogFile = this.changelogFile;
      let oldContent = fs.readFileSync(changelogFile, 'utf-8');
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
      accessSync(this.changelogFile, fs.F_OK)
    } catch (err) {
      if (err.code === 'ENOENT') {
        fs.writeFileSync(this.changelogFile, '\n');
      }
    }
  }

  updateChangelogComponent(changelog) {
    if (this.changelogComponentFile) {
      const converter = new showdown.Converter();
      const html = converter.makeHtml(changelog).replace(/[{}]+/g, '');
      fs.writeFileSync(this.changelogComponentFile, html, 'utf8');
    } else {
      this.logger.warn('Changelog component file was not found. Skip step')
    }
  }

  updateAppConfigVersion(newVersion) {
    const filePath = this.appConfigFile;
    const appVersionKey = this.workspace.getKWSCommandValue('release.appConfig.key');

    if (!filePath || !appVersionKey) {
      this.logger.warn('Cannot update application version. Reason: missing filePath or appVersion key.');
      return false;
    }

    const appVersionPattern = new RegExp(`"${appVersionKey}":.*,`, 'g');
    let result;

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return this.logger.error(err);
      }

      if (appVersionPattern.test(data)) {
        result = data.replace(appVersionPattern, `"${appVersionKey}": "${ newVersion }",`);
      } else {
        result = data.replace(/^export const environment = {/, `export const environment = {\n"${appVersionKey}": "${ newVersion }",`);
      }

      fs.writeFileSync(filePath, result, 'utf8');
    });

    return true;
  }

  async commitChanges(newVersion) {
    const paths = [this.changelogFile, this.changelogComponentFile, this.appConfigFile].filter(Boolean);
    const commitMessage = `chore(release): ${newVersion}`;
    let msg = 'committing %s';
    let toAdd = `${this.changelogFile} ${this.changelogComponentFile} ${this.appConfigFile}`.trim();

    Object.keys(this.configsToUpdate).forEach(config => {
      if (this.configsToUpdate[config]) {
        msg += ' and %s';
        paths.unshift(path.basename(config));
        toAdd += ' ' + path.relative(process.cwd(), config);
      }
    });

    await this.workspace.runShellCommnad(`git add ${toAdd}`);
    await this.workspace.runShellCommnad(`git commit ${toAdd} -m '${this.formatCommitMessage(commitMessage, newVersion)}'`);
  }

  formatCommitMessage(msg, newVersion) {
    return String(msg).indexOf('%s') !== -1 ? util.format(msg, newVersion) : msg;
  }
}