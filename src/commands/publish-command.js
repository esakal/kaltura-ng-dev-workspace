#!/usr/bin/env node

import Command from '../command';
import conventionalRecommendedBump from 'conventional-recommended-bump';
import semver from 'semver';
import fs from 'fs';
import conventionalChangelog from 'conventional-changelog';
import * as fsAccess from 'fs-access';
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
    describe: 'Preparing to release',
    type: 'boolean',
    default: true,
  },
  'publish': {
    group: 'Command Options:',
    describe: 'Create release and push changes',
    type: 'boolean',
    default: true
  },
  'branch': {
    group: 'Command Options:',
    describe: 'Change target branch',
    type: 'string',
    default: 'master'
  },
  'raw-changelog': {
    group: 'Command Options:',
    describe: 'Raw HTML output',
    type: 'boolean',
    default: false
  }
};


export default class ReleaseCommand extends Command {
  async runCommand() {
    this.filesToUpdate = [];

    const currentBranch = (await this.workspace.runShellCommand('git symbolic-ref --short HEAD')).trim();
    const pkg = loadJsonFile.sync(findUp.sync('package.json', { cwd: process.cwd() }));
    let version = pkg.version;
    let changelog;

    if (this.options.branch !== currentBranch) {
      this.logger.error('Specified branch is different from active. Please checkout to specified branch or provide relevant branch name.');
      this.logger.error(`Specified branch: ${this.options.branch}. Active branch: ${currentBranch}`);
      process.exit(1);
    }

    if (this.options.prepare) {
      this.logger.info('Prepare phase');
      await this.ensureCommittedChanges();

      const commitsValidation = await this.lintCommitsSinceLastRelease();
      if (!commitsValidation.result) {
        this.logger.warn('Those commits since last release is NOT tapping into conventional-commits. Consider following conventional-commits standard http://conventionalcommits.org/.');
        this.logger.warn(commitsValidation.invalidCommits);
      }

      version = await this.getNewVersion(version);

      this.updateConfigs(version);

      changelog = await this.updateChangelog(version);
      this.updateAppConfigVersion(version);
      await this.commitChanges(version);
    }

    if (this.options.publish) {
      this.logger.info('Publish phase.');

      await this.ensureCommittedChanges();

      const currentTag = await this.workspace.runShellCommand('git describe --match="v?.?.?" --abbrev=0');
      if (semver.gt(version, currentTag)) {
        await this.updateChangelogComponent(changelog);
        await this.createTag();
        await this.publish();
      } else {
        this.logger.error(`Current version (${version}) is less or equal than the last tag (${currentTag}). You need to bump version. Abort.`);
      }
    }
  }

  async createTag() {
    this.logger.info(`Tagging release. Current version: ${ version }.`);
    await this.workspace.runShellCommand(`git tag -a v${ version }`);
  }

  async publish() {
    this.logger.info('Publishing release.');
    await this.workspace.runShellCommand(`git push --follow-tags origin ${this.options.branch}`);
  }

  async ensureCommittedChanges() {
    if (!!(await this.workspace.runShellCommand('git status -s', true))) {
      this.logger.error('It seems that you have uncommitted changes. To perform this command you should either commit your changes or reset them. Abort.')
      process.exit(1);
    }
  }

  async lintCommitsSinceLastRelease() {
    const commits = await this.workspace.runShellCommand('git log `git describe --match="v?.?.?" --abbrev=0`..HEAD --oneline --pretty=format:"%s"');
    const result = await lint(commits, rules);
    let invalidCommits;

    if (!result.valid) {
      invalidCommits = (await Promise.all(
        commits
          .split('\n')
          .map(async (commit) => !(await lint(commit, rules)).valid ? commit : null)
      )).filter(Boolean).join('\n');
    }

    return { result: result.valid, invalidCommits };
  }

  async getNewVersion(currentVersion) {
    this.logger.info('Get new version.');

    const release = await this.bumpVersion();
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
    this.logger.info('Update configs.');

    ['package.json', 'package-lock.json'].forEach(config => {
      const configPath = findUp.sync(config, { cwd: process.cwd() })
      try {
        const stat = fs.lstatSync(configPath);
        if (stat.isFile()) {
          const config = loadJsonFile.sync(configPath);
          config.version = newVersion;
          writeJsonFile.sync(configPath, config, { indent: 2 });

          this.filesToUpdate.push(configPath);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.logger.error(err.message);
        }
      }
    });
  }

  updateChangelog(newVersion) {
    this.logger.info('Update changelog.');

    return new Promise((resolve, reject) => {
      this.createIfMissing('CHANGELOG.md');

      const filePath = findUp.sync('CHANGELOG.md', { cwd: process.cwd() });

      this.filesToUpdate.push(filePath);

      let oldContent = fs.readFileSync(filePath, 'utf-8');
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
        fs.writeFileSync(filePath, changelog);
        return resolve(changelog);
      })
    })
  }

  createIfMissing(file) {
    try {
      fsAccess.sync(file, fs.F_OK)
    } catch (err) {
      if (err.code === 'ENOENT') {
        fs.writeFileSync(file, '\n');
      }
    }
  }

  prepareChangelog(changelog) {
    let preparedChangelog = changelog;

    // leave only features sections
    preparedChangelog.match(/##(#)?\s*(.*?)[\s\S]*?(?=##(#)?|<a|$)/gi)
      .forEach(section => {
        if (!/(Features)/.test(section)) {
          preparedChangelog = preparedChangelog.replace(section, '');
        }
      });

    // replace header link with version
    preparedChangelog.match(/\[(\d\.\d\.\d(-.*)*?)\]\([\s\S]*?\)/gi)
      .forEach(header => {
        preparedChangelog = preparedChangelog.replace(header, header.match(/\[(.*?)\]/)[1]);
      });

    // remove all links
    preparedChangelog = preparedChangelog.replace(/\(?\[.*?\]\)?\(.*?\)\)?/gi, '');

    return preparedChangelog;
  }

  async updateChangelogComponent(changelog) {
    this.logger.info('Update changelog component.');

    const changelogComponentPath = this.workspace.getKWSCommandValue('release.changeLog.htmlPath');
    const filePath = changelogComponentPath ? findUp.sync(changelogComponentPath, { cwd: process.cwd() }) : '';

    if (!filePath) {
      this.logger.warn('Changelog component file was not found. Skip step');
      return;
    }

    let changelogContent = changelog;

    if (!changelogContent) {
      const changelogPath = findUp.sync('CHANGELOG.md', { cwd: process.cwd() });
      if (changelogPath) {
        changelogContent = fs.readFileSync(changelogPath, 'utf-8');
      } else {
        this.logger.warn('CHANGELOG.md file was not found. Make sure it exists. Skip step');
        return;
      }
    }

    this.filesToUpdate.push(filePath);

    if (!this.options['raw-changelog']) {
      changelogContent = this.prepareChangelog(changelogContent);
    }

    const converter = new showdown.Converter();
    const html = converter.makeHtml(changelogContent).replace(/[{}]+/g, '');
    fs.writeFileSync(filePath, html, 'utf8');

    await this.commitChanges(null, 'chore(changelog): update changelog component');
  }

  updateAppConfigVersion(newVersion) {
    this.logger.info('Update app-config with new version.');

    const appConfigPath = this.workspace.getKWSCommandValue('release.appConfig.path');
    const filePath = appConfigPath ? findUp.sync(appConfigPath, { cwd: process.cwd() }) : '';
    const appVersionKey = this.workspace.getKWSCommandValue('release.appConfig.key');

    if (!filePath || !appVersionKey) {
      this.logger.warn('Cannot update application version. Reason: missing filePath or appVersion key. Skip step');
      return;
    }

    this.filesToUpdate.push(filePath);

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
  }

  async commitChanges(newVersion, message) {
    this.logger.info('Commit changes.');

    const commitMessage = message || `chore(release): ${newVersion}`;
    const toAdd = this.filesToUpdate.join(' ');

    await this.workspace.runShellCommand(`git add ${toAdd}`);
    await this.workspace.runShellCommand(`git commit -m '${this.formatCommitMessage(commitMessage, newVersion)}'`);
  }

  formatCommitMessage(msg, newVersion) {
    return String(msg).indexOf('%s') !== -1 ? util.format(msg, newVersion) : msg;
  }
}