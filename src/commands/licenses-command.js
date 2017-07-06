#!/usr/bin/env node
import fs from  'fs';
import json2csv from 'json2csv';
import checker  from 'license-checker';

import Command from '../command';

export async function handler(argv) {
	await new LicensesCommand(argv._, argv).run();
}

export const command = 'licenses';

export const description = 'extract licenses of package';


export const builder = {
  "types": {
    group: "Command Options:",
    describe: "what types of dependencies (all | direct)",
    type : "string",
    default : "direct"
  }
};

export default class LicensesCommand extends Command {
	async runCommand() {
    this.logger.verbose('licenses', `extracing licenses`);

    const licensesMapping = {};
    const getPackagesResponses = [];

    await Promise.all(this.workspace.repositories.map(async (repo) =>
    {
    	return new Promise(async (resolve,reject) =>
	    {
        const repoLicenses = await this.getPackageLicenses(repo.path, repo.pkgData);
        this.logger.info('licenses', `got ${Object.keys(repoLicenses).length} licenses for ${repo.name}`);
        this.mergeLicenses(licensesMapping, repoLicenses);

        await Promise.all(repo.packages.map(async (repoPackage) =>
        {
        	return new Promise(async (resolve) => {
            const repoPackageLicenses = await this.getPackageLicenses(repoPackage.path, repoPackage.pkgData);
            this.logger.info('licenses', `got ${Object.keys(repoPackageLicenses).length} licenses for ${repo.name}/${repoPackage.name}`);
            this.mergeLicenses(licensesMapping, repoPackageLicenses);
            resolve();
          });
        }));

        resolve();
	    });
    }));

    const licensesList = this.processLicenses(licensesMapping);
    const csvFile = this.convertToCsv(licensesList);
    fs.writeFileSync('dependency-licenses.csv', csvFile, 'utf8');
    this.logger.info('licenses', `create file 'dependency-licenses.csv'`);
	}

	mergeLicenses(licensesMapping, repoLicenses)
	{
    Object.keys(repoLicenses).forEach(licenseName => {
      const newLicenseData = repoLicenses[licenseName];
      const existsLicenseData = licensesMapping[licenseName];
      if (!existsLicenseData) {
        licensesMapping[licenseName] = newLicenseData;
      } else {
        existsLicenseData.packages = `${existsLicenseData.packages}, ${newLicenseData.packages}`;
        existsLicenseData.type = this.getUnifiedLicenseType(existsLicenseData, newLicenseData);

        if (existsLicenseData.licenses.indexOf(newLicenseData.licenses) === -1) {
          existsLicenseData.licenses = `${existsLicenseData.licenses}, ${newLicenseData.licenses}`;
        }
      }
    });
	}
	getUnifiedLicenseType(dependency, matchingDependency) {
		if (dependency.type === 'production' || matchingDependency.type === 'production') {
			return 'production';
		} else if (dependency.type === 'development' || matchingDependency.type === 'development') {
			return 'development';
		} else {
			return 'indirect';
		}

	}

	processLicenses(licensesMapping)
	{
    let result = [];
    for (let dependencyNameAndVersion in licensesMapping) {
      const dependencyName = dependencyNameAndVersion.substr(0, dependencyNameAndVersion.lastIndexOf('@'));
      const dependencyVersion = dependencyNameAndVersion.substr(dependencyName.length + 1, dependencyNameAndVersion.length - dependencyName.length);
      result.push(Object.assign(licensesMapping[dependencyNameAndVersion], {
        name: dependencyName,
        version: dependencyVersion
      }));
    }

    if (this.options.type !== 'all') {
      this.logger.info(`filter licenses by type '${this.options.type}'`);
      result = result.filter(item => {
        return ['production', 'development'].indexOf(item.type) > -1;
      });
    }


    if (this.workspace.licenses && this.workspace.licenses.ignoreList) {
      this.logger.info(`filter licenses by ignoreList from configuration file.`);
      result = result.filter(item => {
        return this.workspace.licenses.ignoreList.indexOf(item.name) === -1;
      });
    }

    result.sort((a, b) => {
      if(a.name < b.name) return -1;
      if(a.name > b.name) return 1;
      return 0;
    });

    this.logger.info(`extracted ${result.length} unique licenses`);
    return result;

  }

	convertToCsv(licensesList) {
		return json2csv({
			data: licensesList,
			fields: ['name', 'type', 'publisher', 'licenses', 'guessedLicenses', 'version', 'packages', 'repository'],
			excelStrings: false,
			del: '\t'
		})
	}

	async getPackageLicenses(packagePath, pkgData) {
		let result = {};

		if (!pkgData || !fs.existsSync(packagePath)) {
			this.logger.error('licenses', `missing valid package path and package.json data`);
			process.exit(1);
		}

		this.logger.verbose('licenses', `getting license for package '${pkgData.name}'`, packagePath);

		try {
			const packageToTypeMapping = {};
			Object.keys(pkgData.devDependencies || {}).forEach(packageName => packageToTypeMapping[packageName] = 'development');
			Object.keys(pkgData.dependencies || {}).forEach(packageName => packageToTypeMapping[packageName] = 'production');

			result = await this.getLicenses(packagePath);

			Object.keys(result).forEach(dependencyFullName => {
				const dependency = result[dependencyFullName];
				const dependencyName = dependencyFullName.substr(0, dependencyFullName.lastIndexOf('@'));
				dependency.type = packageToTypeMapping[dependencyName] || 'indirect';
				dependency.packages = pkgData.name;
				if (dependency.licenses.indexOf('*') !== -1) {
					dependency.guessedLicenses = dependency.licenses;
					dependency.licenses = 'unknown';
				}
			});
		}
		catch (e) {
			this.logger.error(e);
			process.exit(1);
		}

		return result;
	}

	async getLicenses(packageRoot) {
		return new Promise((resolve, reject) => {
			checker.init({
				unknown: false,
				start: packageRoot
			}, function (err, json) {
				if (err) {
					reject(err);
				} else {
					resolve(json);
				}
			});
		});
	}
}
