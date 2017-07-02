import loadJsonFile from "load-json-file";
import log from "npmlog";
import path from 'path';
import shelljs from 'shelljs';
import fs from 'fs';
import findUp from 'find-up';
import writeJsonFile from 'write-json-file';

const repositoryUriPattern = new RegExp('https:[/][/]github.com[/].*?[/](.*?)[.]git','i');

export default class Repository
{
  constructor()
  {

    this.lernaDirPath = path.resolve(__dirname,"../");
    log.silly("lernaDirPath",this.lernaDirPath);

    this.loadRepositories();
    this.ensureAllRepositoriesExists();

    this.createLernaJsonFile();

  }

  loadRepositories()
  {
    const kwsJsonPath = findUp.sync("kaltura-ws.json", { cwd: process.cwd() });

    if (!kwsJsonPath)
    {
      log.error(`file 'kaltura-ws.json' is missing, aborting command.`);
      process.exit(1);
      return;
    }

    this.rootPath = path.dirname(kwsJsonPath);
    log.verbose("rootPath", this.rootPath);

    const kalturaWSJson = loadJsonFile.sync(kwsJsonPath);
    log.verbose(`extracting 'kaltura-ws.json' repositories list`,kalturaWSJson);
    const repositories = [];

    kalturaWSJson.repositories.forEach(gitRepoUri =>
    {
      const repoTokens = repositoryUriPattern.exec(gitRepoUri);

      if (!repoTokens)
      {
        log.error(`invalid repository uri, expected format 'https://github.com/{user}/{repo_name}.git'`);
        process.exit(1);
        return;
      }

      const repoName = repoTokens[1];
      const repoPath = path.join(this.rootPath,repoName);
      repositories.push({ name : repoName, path : repoPath, gitRepoUri});
    });
    this.repositories = repositories;

    log.info(`extracted ${repositories.length} repositories`);
  }

  createLernaJsonFile()
  {
    const tracker = log.newItem('syncLernaJsonFile');
    const lernaJson = {
      "NOTICE" : "This file is used internally by kaltura-ng-workspace. you should avoid using lerna cli directly",
      "lerna": "2.0.0-rc.5",
      packages : [],
      "npmClient": "yarn",
      "commands": {
        "publish": {
          "ignore": [
            "**/*",
            "*"
          ]
        }
      }
    };

    tracker.addWork(this.repositories.length);


    this.repositories.forEach(repo =>
    {
      tracker.silly('repository',repo.name);
      const repoLernaFilePath = path.join(repo.path,'lerna.json');
      const isMonoRepo = fs.existsSync(repoLernaFilePath);

      tracker.silly('isMonoRepo',isMonoRepo);

      if (isMonoRepo)
      {
        const repoLernaJson = loadJsonFile.sync(repoLernaFilePath);
        tracker.silly('repoLernaJson',repoLernaJson);
        repoLernaJson.packages.forEach(repoLernaJsonPackge =>
        {
          const monoRepoPackageName = `${repo.name}/${repoLernaJsonPackge}`;
          tracker.verbose(`adding repo to lerna packages`,monoRepoPackageName);
          lernaJson.packages.push(`${this.rootPath}/${monoRepoPackageName}`);
        });

      }else {
        tracker.verbose(`adding repo to lerna packages`,repo.name);
        lernaJson.packages.push(`${this.rootPath}/${repo.name}`);
      }

      tracker.completeWork(1);
    });
    tracker.finish();

    log.verbose('creating file lerna.json. This file is used internally by kaltura-ng-workspace. you should avoid using lerna cli directly.');
    log.verbose('new file lerna.json content',lernaJson);
    writeJsonFile.sync(path.join(this.lernaDirPath,'lerna.json'), lernaJson, { indent: 2 });
  }

  ensureAllRepositoriesExists()
  {
    const tracker = log.newItem('ensureAllRepositoriesExists');

    tracker.addWork(this.repositories.length);

    this.repositories.forEach(repo =>
    {
      tracker.silly('repository path',path.join(this.rootPath,repo.name));
      if (fs.existsSync(path.join(this.rootPath,repo.name)))
      {
        tracker.info(`repository folder '${repo.name}' exists, skip creation of repository`);
      }else
      {
        tracker.info(`git clone repository '${repo.name}' from '${repo.repoUri}`);
        shelljs.exec(`git clone ${repo.repoUri} ${repo.name}`);
      }
      tracker.completeWork(1);
    });

    tracker.finish();
  }

  runLernaCommand(lernaArgs)
  {
    // we are using custom lerna package for now which so we need to run that
    // specific lerna version.
    const customLernaBinPath = __dirname;

    log.silly(`running lerna from ${customLernaBinPath} with arguments '${lernaArgs}'`);
    log.silly(`node lerna ${lernaArgs} --loglevel ${log.level}`);
    try {
      shelljs.pushd(__dirname);
      shelljs.exec(`node ../node_modules/lerna/bin/lerna ${lernaArgs} --loglevel=${log.level}`);
    }catch (err) {
      shelljs.popd();
      throw err;
    }
  }
}