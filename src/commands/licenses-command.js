#!/usr/bin/env node
import path from 'path';
import fs from  'fs';
import json2csv from 'json2csv';
import checker  from 'license-checker';
import findRoot from 'find-root';
import glob from 'glob';
import readPkg  from "read-pkg";

import Command from '../command';

export async function handler(argv) {
	await new LicensesCommand(argv._, argv).run();
}

export const command = 'licenses';

export const description = 'extract licenses of package';

export default class LicensesCommand extends Command {
	async runCommand() {
		const packageRootPath = findRoot(process.cwd());
		const pkgData = fs.existsSync(packageRootPath) ? readPkg.sync(packageRootPath, {normalize: false}) : null;

		if (pkgData && pkgData.name) {
			this.logger.verbose('licenses', `handling package in path '${packageRootPath}'`);
			const packageLicenses = await this.getPackageLicenses(packageRootPath, pkgData);

			const subPackagesLicenses = await this.getSubPackagesLicenses(packageRootPath);

			this.logger.info('licenses', `got ${subPackagesLicenses.length} sub-packages licesnses`);
			subPackagesLicenses.forEach(subPackageLicenses => {

				Object.keys(subPackageLicenses).forEach(subPackageLicenseName => {
					const subPackageLicense = subPackageLicenses[subPackageLicenseName];
					const existsLicense = packageLicenses[subPackageLicenseName];
					if (!existsLicense) {
						packageLicenses[subPackageLicenseName] = subPackageLicense;
					} else {
						existsLicense.packages = `${existsLicense.packages}, ${subPackageLicense.packages}`;
						existsLicense.type = this.getUnifiedLicenseType(existsLicense, subPackageLicense);

						if (existsLicense.licenses.indexOf(subPackageLicense.licenses) === -1) {
							existsLicense.licenses = `${existsLicense.licenses}, ${subPackageLicense.licenses}`;
						}
					}
				});
			});
			const csvFile = this.convertToCsv(packageLicenses);
			fs.writeFileSync('licenses.csv', csvFile, 'utf8');
			this.logger.info('licenses', `create file 'licenses.csv'`);
		} else {
			this.logger.warn('licenses', `failed to find root package from path '${process.cwd()}', aborting`);
		}
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

	convertToCsv(jsonData) {
		const dataAsArray = [];
		for (let dependencyNameAndVersion in jsonData) {
			const dependencyName = dependencyNameAndVersion.substr(0, dependencyNameAndVersion.lastIndexOf('@'));
			const dependencyVersion = dependencyNameAndVersion.substr(dependencyName.length + 1, dependencyNameAndVersion.length - dependencyName.length);
			dataAsArray.push(Object.assign(jsonData[dependencyNameAndVersion], {
				name: dependencyName,
				version: dependencyVersion
			}));
		}

		dataAsArray.sort(item => {
			return item.name;
		});

		return json2csv({
			data: dataAsArray,
			fields: ['name', 'type', 'publisher', 'licenses', 'guessedLicenses', 'version', 'packages', 'repository'],
			excelStrings: false,
			del: '\t'
		})
	}

	async getSubPackagesLicenses(packagePath) {
		const result = [];
		this.logger.info('licenses', `get license for sub-packages`);

		const lernaFilePath = path.resolve(packagePath, 'lerna.json');
		const lernaData = fs.existsSync(lernaFilePath) ? JSON.parse(fs.readFileSync(lernaFilePath)) : null;

		if (lernaData && lernaData.packages) {
			const globOpts =
				{
					cwd: packagePath,
					strict: true,
					absolute: true,
					ignore: [
						"**/node_modules/**",
					]
				};

			for (let i = 0; i < lernaData.packages.length; i++) {
				const globPath = lernaData.packages[i];
				const globaSync = glob.sync(path.join(globPath, "package.json"), globOpts);
				for (let j = 0; j < globaSync.length; j++) {
					const globResult = globaSync[j];
					// https://github.com/isaacs/node-glob/blob/master/common.js#L104
					// glob always returns "\\" as "/" in windows, so everyone
					// gets normalized because we can't have nice things.
					const packageConfigPath = path.normalize(globResult);
					const packageDir = path.dirname(packageConfigPath);
					const packageJson = readPkg.sync(packageConfigPath, {normalize: false});

					result.push(await this.getPackageLicenses(packageDir, packageJson));
				}
			}
		} else {
			this.logger.verbose('licenses', `folder not containing 'lerna.json', assume package doesn't have sub-packages`);
		}

		return result;
	}

	async getPackageLicenses(packagePath, pkgData) {
		let result = {};

		if (!pkgData || !fs.existsSync(packagePath)) {
			this.logger.error('licenses', `missing valid package path and package.json data`);
			process.exit(1);
		}

		this.logger.info('licenses', `get license for package '${pkgData.name}'`, packagePath);
		this.logger.verbose('licenses', `package path '${packagePath}'`);

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

			this.logger.info('licenses', `package '${pkgData.name}' has ${Object.keys(result).length} licenses`);
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
