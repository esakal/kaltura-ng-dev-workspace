#!/usr/bin/env node
const log = require('npmlog');
const path = require('path');
const fs = require('fs');
const json2csv = require('json2csv');
const shell = require('shelljs');
const checker = require('license-checker');
const findRoot = require('find-root');
const glob = require('glob')
const readPkg = require("read-pkg");

(async() => {

	const packageRootPath = findRoot(process.cwd());
	const pkgData = fs.existsSync(packageRootPath) ? readPkg.sync(packageRootPath, {normalize: false}) : null;

	if (pkgData && pkgData.name) {
		log.verbose('licenses',`handling package in path '${packageRootPath}'`);
		const packageLicenses = await getPackageLicenses(packageRootPath, pkgData);

		const subPackagesLicenses = await getSubPackagesLicenses(packageRootPath);

		log.info('licenses',`got ${subPackagesLicenses.length} sub-packages licesnses`);
		subPackagesLicenses.forEach(subPackageLicenses => {

			Object.keys(subPackageLicenses).forEach(subPackageLicenseName => {
				const subPackageLicense = subPackageLicenses[subPackageLicenseName];
				const existsLicense = packageLicenses[subPackageLicenseName];
				if (!existsLicense) {
					packageLicenses[subPackageLicenseName] = subPackageLicense;
				} else {
					existsLicense.packages = `${existsLicense.packages}, ${subPackageLicense.packages}`;
					existsLicense.type = getUnifiedLicenseType(existsLicense, subPackageLicense);

					if (existsLicense.licenses.indexOf(subPackageLicense.licenses) === -1) {
						existsLicense.licenses = `${existsLicense.licenses}, ${subPackageLicense.licenses}`;
					}
				}
			});
		});
		const csvFile = convertToCsv(packageLicenses);
		fs.writeFileSync('licenses.csv', csvFile, 'utf8');
		log.info('licenses',`create file 'licenses.csv'`);
	}else
	{
		log.warn('licenses',`failed to find root package from path '${process.cwd()}', aborting`);
	}
})();

function getUnifiedLicenseType(dependency, matchingDependency)
{
	if (dependency.type === 'production' || matchingDependency.type === 'production')
	{
		return 'production';
	}else if (dependency.type === 'development' || matchingDependency.type === 'development')
	{
		return 'development';
	}else
	{
		return 'indirect';
	}

}

function convertToCsv(jsonData)
{
	const dataAsArray = [];
	for(let dependencyNameAndVersion in jsonData)
	{
		const dependencyName = dependencyNameAndVersion.substr(0,dependencyNameAndVersion.lastIndexOf('@'));
		const dependencyVersion = dependencyNameAndVersion.substr(dependencyName.length+1,dependencyNameAndVersion.length-dependencyName.length);
		dataAsArray.push(Object.assign(jsonData[dependencyNameAndVersion],{name : dependencyName, version : dependencyVersion}));
	}

	dataAsArray.sort(item =>
	{
		return item.name;
	});

	return json2csv({data : dataAsArray, fields : ['name','type','publisher', 'licenses','guessedLicenses','version','packages','repository'], excelStrings : false, del : '\t'})
}

async function getSubPackagesLicenses(packagePath) {
	const result = [];
	log.info('licenses', `get license for sub-packages`);

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

		for(let i=0;i<lernaData.packages.length;i++)
		{
			const globPath = lernaData.packages[i];
			const globaSync = glob.sync(path.join(globPath, "package.json"), globOpts);
			for(let j=0;j<globaSync.length;j++)
			{
				const globResult = globaSync[j];
				// https://github.com/isaacs/node-glob/blob/master/common.js#L104
				// glob always returns "\\" as "/" in windows, so everyone
				// gets normalized because we can't have nice things.
				const packageConfigPath = path.normalize(globResult);
				const packageDir = path.dirname(packageConfigPath);
				const packageJson = readPkg.sync(packageConfigPath, {normalize: false});

				result.push(await getPackageLicenses(packageDir, packageJson));
			}
		}
	} else {
		log.verbose('licenses', `folder not containing 'lerna.json', assume package doesn't have sub-packages`);
	}

	return result;
}
async function getPackageLicenses(packagePath, pkgData)
{
	let result = {};

	if (!pkgData || !fs.existsSync(packagePath)) {
		log.error('licenses',`missing valid package path and package.json data`);
		process.exit(1);
	}

	log.info('licenses',`get license for package '${pkgData.name}'`,packagePath);
	log.verbose('licenses',`package path '${packagePath}'`);

	try {
		const packageToTypeMapping = {};
		Object.keys(pkgData.devDependencies || {}).forEach(packageName => packageToTypeMapping[packageName] = 'development');
		Object.keys(pkgData.dependencies || {}).forEach(packageName => packageToTypeMapping[packageName] = 'production');

		result = await getLicenses(packagePath);

		Object.keys(result).forEach(dependencyFullName =>
		{
			const dependency = result[dependencyFullName];
			const dependencyName = dependencyFullName.substr(0,dependencyFullName.lastIndexOf('@'));
			dependency.type = packageToTypeMapping[dependencyName] || 'indirect';
			dependency.packages = pkgData.name;
			if (dependency.licenses.indexOf('*') !== -1)
			{
				dependency.guessedLicenses  = dependency.licenses;
				dependency.licenses = 'unknown';
			}
		});

		log.info('licenses',`package '${pkgData.name}' has ${Object.keys(result).length} licenses`);
	}
	catch(e)
	{
		log.error(e);
		process.exit(1);
	}

	return result;
}

async function getLicenses(packageRoot) {
	return new Promise((resolve, reject) => {
		checker.init({
			unknown : false,
			start: packageRoot
		}, function(err, json) {
			if (err) {
				reject(err);
			} else {
				resolve(json);
			}
		});
	});
}