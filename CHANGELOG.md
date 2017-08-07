# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="2.1.1"></a>
## [2.1.1](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v2.1.0...v2.1.1) (2017-08-07)


### Bug Fixes

* support symlink of repositories using scoped package naming ([8239baf](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/8239baf))



<a name="2.1.0"></a>
# [2.1.0](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v2.0.2...v2.1.0) (2017-07-13)


### Features

* add bookmark command that allow store/restore to specific commit using friendly names ([b461ecf](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/b461ecf))



<a name="2.0.2"></a>
## [2.0.2](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v2.0.1...v2.0.2) (2017-07-06)


### Bug Fixes

* fix checking competability betweent the package version and the user configuration version ([c95a2f0](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/c95a2f0))



<a name="2.0.1"></a>
## [2.0.1](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v2.0.0...v2.0.1) (2017-07-06)

* Bumping version to publish the right 'lib' folder (which is not under version control).

<a name="2.0.0"></a>
# [2.0.0](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v1.0.5...v2.0.0) (2017-07-06)


### Features

* extract dependency licenses from repo/monorepo ([d7f3596](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/d7f3596))


### BREAKING CHANGES

* the 'kaltura-ws.json' file format was updated to support both local repositories and github repositories



<a name="1.0.5"></a>
## [1.0.5](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v1.0.4...v1.0.5) (2017-07-03)


### Bug Fixes

* invoke lerna internally as part of the setup process ([6cc9543](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/6cc9543))



<a name="1.0.4"></a>
## [1.0.4](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v1.0.3...v1.0.4) (2017-07-03)


### Bug Fixes

* resolve lerna path(support hoist of packages) ([85587ca](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/85587ca))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/kaltura/kaltura-ng-dev-workspace/compare/v1.0.2...v1.0.3) (2017-07-03)


### Bug Fixes

* add lib folder to published package ([18c46e4](https://github.com/kaltura/kaltura-ng-dev-workspace/commit/18c46e4))



<a name="1.0.2"></a>
## 1.0.2 (2017-07-03)


### Features

* add 'setup' command to clone repositories bind them together and build the workspace.
* add 'licenses' command to fetch all licenses of 3rd party in the workspace and create a licenses summary file.
* add 'run' command to run npm script command on all workspace repos.
* add 'clean' command to remove all workspace repos node_modules folder.