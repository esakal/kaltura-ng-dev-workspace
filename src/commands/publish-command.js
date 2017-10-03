#!/usr/bin/env node

import Command from '../command';
import conventionalRecommendedBump from 'conventional-recommended-bump';
import semver from 'semver';
import path from 'path';
import fs from 'fs';
import conventionalChangelog from 'conventional-changelog';
import { accessSync } from 'fs-access';
import showdown from 'showdown';

export async function handler(argv) {
  await new PublishCommand(argv._, argv).run();
}

export const command = 'publish';

export const description = 'publish a new version';

export const builder = {
  "prepare": {
    group: "Command Options:",
    describe: "Prepare phase",
    type: "boolean",
    default: true,
  },
  "publish": {
    group: "Command Options:",
    describe: "Publish phase",
    type: "boolean",
    default: true
  }
};

const pkgPath = path.resolve(process.cwd(), './package.json');
const pkg = require(pkgPath);
const changelogFile = path.resolve(process.cwd(), './CHANGELOG.md');
const changelogComponentFile = path.resolve(process.cwd(), './src/app/components/changelog/changelog-content/changelog-content.component.html');
let configsToUpdate = {};

export default class PublishCommand extends Command {
  async runCommand() {
    if (this.options.prepare) {
      // 1. determine next version according to commit history +
      // 2. modify changelog.md file according to changes in github +
      //    2.1. if possible: run check to make sure messages follow the conventional commit syntax
      // 3. modify angular component that holds the change log content. (md to html conversion) +
      // 4. update the app-config file with the application version
      // 5. commit changes (without pushing)
      this.logger.verbose('Prepare phase');

      const newVersion = await getNewVersion();
      const changelog = await outputChangelog(newVersion);
      updateChangelogComponent(changelog);
      updateAppConfigVersion(newVersion);
    }

    if (this.options.publish) {
      this.logger.verbose('Publish phase');

      // 0. [optional]: make sure no changes pending commit
      // 1. tag the version. include the relevant part from the changelog
      // 2. invoke the publish command as suggested by standard version.
    }

  }
}

// <editor-fold desc="Bump version">
async function getNewVersion() {
  const release = await bumpVersion();
  const newVersion = semver.valid(release.releaseType) || semver.inc(pkg.version, release.releaseType, false);
  updateConfigs(newVersion);

  return newVersion;
}

function bumpVersion() {
  return new Promise((resolve, reject) => {
    conventionalRecommendedBump(
      { preset: 'angular' },
      (err, release) => err ? reject(err) : resolve(release)
    );
  });
}

function updateConfigs(newVersion) {
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

// </editor-fold>

// <editor-fold desc="Write changelog">
function outputChangelog(newVersion) {
  return new Promise((resolve, reject) => {
    createIfMissing();
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

function createIfMissing() {
  try {
    accessSync(changelogFile, fs.F_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.writeFileSync(changelogFile, '\n');
    }
  }
}

// </editor-fold>

// <editor-fold desc="Update changelog component">
function updateChangelogComponent(changelog) {
  const converter = new showdown.Converter();
  const html = converter.makeHtml(changelog).replace(/[{}]+/g, '');
  fs.writeFileSync(changelogComponentFile, html, 'utf8');
}

// </editor-fold>

// <editor-fold desc="Update app config version">
function updateAppConfigVersion(newVersion) {
  const filePath = path.resolve(process.cwd(), './src/app-config/index.ts');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return this.logger.error(err);
    }

    const result = data.replace(/"appVersion":.*,/g, `"appVersion": "${ newVersion }",`);

    fs.writeFileSync(filePath, result, 'utf8');
  });
}

// </editor-fold>