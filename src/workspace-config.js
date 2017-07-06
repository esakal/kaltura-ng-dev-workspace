import loadJsonFile from "load-json-file";
import log from "npmlog";
import path from 'path';
import shelljs from 'shelljs';
import fs from 'fs';
import findUp from 'find-up';
import writeJsonFile from 'write-json-file';
import findNodeModules from 'find-node-modules';
import readPkg  from "read-pkg";
import glob from 'glob';
import semver from "semver";


const repositoryUriPattern = new RegExp('(https:[/][/]github.com[/].*?[/](.*?)[.]git)(?:#(.*))?$','i');

export default class WorkspaceConfig
{
  constructor()
  {
  }

  async load()
  {
    const kwsJsonPath = findUp.sync("kaltura-ws.json", { cwd: process.cwd() });

    if (!kwsJsonPath)
    {
      log.error(`file 'kaltura-ws.json' is missing, aborting command.`);
      process.exit(1);
      return;
    }

    this.kwsVersion = require("../package.json").version;

    this.rootPath = path.dirname(kwsJsonPath);
    log.verbose("rootPath", this.rootPath);
    this._config = loadJsonFile.sync(kwsJsonPath);
    log.silly('kaltura-ws', this._config);

    this.version = this._config.version;
    this.licenses = this._config.licenses || null;

    log.verbose(`matching kws version ${this.kwsVersion} with config version ${this.version}`);
    if (!semver.satisfies(this.version, `^${this.kwsVersion}`))
    {
      log.error(`Major version mismatch: The current version '@kaltura-ng/dev-workspace' is ${this.kwsVersion}, but the version in 'kaltura-ws.json' is ${this.version}. You can either update your json file or install '@kaltura-ng/dev-workspace@${this.version}'`);
      process.exit(1);
    }

    await this.loadRepositories();
    this.createLernaJsonFile();

  }

  async loadRepositories()
  {
    log.verbose(`extracting repositories list`);

    const repositories = [];

    await Promise.all((this._config.repositories || ['.']).map(repositoryData =>
    {
      return new Promise(async (resolve, reject) =>
      {
        log.silly('repositoryData',repositoryData);
        let repoPath = null;
        if (typeof repositoryData === 'string')
        {
          repoPath = path.resolve(this.rootPath,repositoryData);
        }else if (repositoryData.origin && ['fs','github'].indexOf(repositoryData.origin))
        {
          switch (repositoryData.origin)
          {
            case 'fs':
              repoPath = path.resolve(this.rootPath,repositoryData.path);
              break;
            case 'github':
              repoPath = (await this.loadGithubRepo(repositoryData.uri)).repoPath;
              break;
          }
        }else
        {
          reject(new Error('repository list contains invalid value. ' + JSON.stringify(repositoryData)));
          return;
        }

        log.silly('repoPath',repoPath);

        if (repoPath && fs.existsSync(repoPath))
        {
          const pkgData = readPkg.sync(path.join(repoPath, 'package.json'), {normalize: false});
          const repoName = pkgData.name;

          const repoLernaFilePath = path.join(repoPath,'lerna.json');
          const isMonoRepo = fs.existsSync(repoLernaFilePath);

          log.silly('isMonoRepo',isMonoRepo);

          const repoPackages = isMonoRepo ?   this.extractMonoRepoPackages(repoLernaFilePath) : [];

          repositories.push({ name : repoName, path : repoPath,  pkgData, isMonoRepo, packages : repoPackages});
          resolve();
        }else
        {
          reject(new Error('failed to get repository path'));
          return;
        }
      });
    }));

    this.repositories = repositories;

    log.info(`extracted ${repositories.length} repositories`);
    log.silly('repositories', JSON.stringify(this.repositories,(key,value) =>
    {
      return key !== 'pkgData' ? value : "{removed from log}";
    },2));
  }


  async loadGithubRepo(githubUri) {
    const repoGitUriToken = repositoryUriPattern.exec(githubUri);
    if (repoGitUriToken) {
      const repoUri = repoGitUriToken[1];
      const repoName = repoGitUriToken[2];
      const repoDefaultBranch = repoGitUriToken.length >= 3 ? repoGitUriToken[3] : null;
      const repoPath = path.join(this.rootPath, repoName);
      log.silly('ff1');

      if (repoPath && fs.existsSync(repoPath)) {
        log.info(`repository folder '${repoName}' exists, skip creation of repository`);
      } else {
        log.info(`git clone repository '${repoName}' from '${repoUri}'`, {defaultBranch: repoDefaultBranch});

        const command = ['git clone',
          repoDefaultBranch ? `-b ${repoDefaultBranch}` : '',
          repoUri,
          repoName];
        log.silly("command", command.join(" "));
        shelljs.exec(command.join(" "));
      }

      return {repoPath};
    } else {
      log.error(`repository with origin 'github' must have valid 'uri' property`, githubUri);
      process.exit(1);
    }
  }

  extractMonoRepoPackages(repoLernaFilePath) {
    const result = [];
    log.silly('repoLernaFilePath',repoLernaFilePath);
    if (fs.existsSync(repoLernaFilePath)) {
      const repoLernaJson = loadJsonFile.sync(repoLernaFilePath);
      log.silly('repoLernaJson', repoLernaJson);

      const repoPath = path.dirname(repoLernaFilePath);
      const globOpts =
        {
          cwd: repoPath,
          strict: true,
          absolute: true,
          ignore: [
            "**/node_modules/**",
          ]
        };

      repoLernaJson.packages.forEach(repoLernaJsonPackge => {
        const globPath = repoLernaJsonPackge;
        const globaSync = glob.sync(path.join(globPath, "package.json"), globOpts);
        for (let j = 0; j < globaSync.length; j++) {
          const globResult = globaSync[j];
          // https://github.com/isaacs/node-glob/blob/master/common.js#L104
          // glob always returns "\\" as "/" in windows, so everyone
          // gets normalized because we can't have nice things.
          const packageConfigPath = path.normalize(globResult);
          const packagePath = path.dirname(packageConfigPath);
          const packageName = path.relative(repoPath, packagePath);
          const pkgData = readPkg.sync(packageConfigPath, {normalize: false});

          result.push({name: packageName, path: packagePath, pkgData})
        }
      });
    }
    return result;
  }

  createLernaJsonFile()
  {
    const tracker = log.newItem('syncLernaJsonFile');
    const lernaJson = {
      "NOTICE" : "This file is used internally by kaltura-ng-workspace. you should avoid using lerna cli directly",
      "lerna": "0.0.2",
      packages : [],
      "npmClient": "yarn"
    };

    tracker.addWork(this.repositories.length);


    this.repositories.forEach(repo =>
    {
      tracker.silly('repository',repo.name);

      if (repo.isMonoRepo)
      {
        repo.packages.forEach(repoPackage =>
        {
          const monoRepoPackageName = `${repo.name}/${repoPackage.name}`;
          tracker.verbose(`adding package to lerna packages`,monoRepoPackageName);
          lernaJson.packages.push(`${this.rootPath}/${monoRepoPackageName}`);
        });

      }else {
        tracker.verbose(`adding repo to lerna packages`,repo.name);
        lernaJson.packages.push(`${this.rootPath}/${repo.name}`);
      }

      tracker.completeWork(1);
    });
    tracker.finish();

    this.lernaDirPath = path.resolve(__dirname,"../");
    log.silly("lernaDirPath",this.lernaDirPath);

    log.verbose('creating file lerna.json. This file is used internally by kaltura-ng-workspace. you should avoid using lerna cli directly.');
    log.verbose('new file lerna.json content',lernaJson);
    writeJsonFile.sync(path.join(this.lernaDirPath,'lerna.json'), lernaJson, { indent: 2 });
  }

  runLernaCommand(lernaArgs) {

    const customLernaPath = path.resolve(__dirname,'../');

    log.silly('lernaArgs', lernaArgs);

    const lernaPackagePaths = findNodeModules({
      cwd: customLernaPath,
      searchFor: 'node_modules/lerna'
    });

    if (lernaPackagePaths && lernaPackagePaths.length)
    {
      const lernaScriptPath = path.join(lernaPackagePaths[0],'bin/lerna');
      log.silly('lernaScriptPath',lernaScriptPath);
      shelljs.pushd(customLernaPath)
      try {
        shelljs.exec(`node ${lernaScriptPath} ${lernaArgs} --loglevel=${log.level}`);
      }catch(err)
      {
        shelljs.popd;
        throw err;
      }

    }else {
      throw new Error("failed to find valid 'lerna' package installation");
    }

  }
}