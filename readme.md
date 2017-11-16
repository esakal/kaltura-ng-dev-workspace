# Kaltura Dev Workspace

[![Gitter chat](https://badges.gitter.im/kaltura-ng/dev-tools.png)](https://gitter.im/kaltura-ng/dev-tools) [![npm version](https://badge.fury.io/js/%40kaltura-ng%2Fdev-workspace.svg)](https://badge.fury.io/js/%40kaltura-ng%2Fdev-workspace)

Tool for managing JavaScript projects with multiple packages. 

## About

Our code base for [kmc-ng](https://github.com/kaltura/kmc-ng) and [tvm-ng](https://github.com/kaltura/tvm-ng) is organized into multiple packages/repositories. However, making changes across many repositories is messy.

For [monorepos](https://github.com/babel/babel/blob/master/doc/design/monorepo.md) there is a great tool named [lerna](https://github.com/lerna/lerna) that optimizes the workflow around managing multi-package repositories with git and npm.
 
 But in our case with have a mix of:
 - single package repo.
 - single application repo.
 - multiple packages in monorepo.
 
 Unfortunately [lerna](https://github.com/lerna/lerna) only support monorepo so we cannot use it as-is.
  
 To overcome this issue we created this tool.
   
 > Kaltura dev workspace package is inspired deeply from `lerna` tool. We find `lerna` the best tool that simplify complicated dev-op operation. We recommend you to try `lerna` for your own projects.  
   
## Who should use this tool
This tool was created for Kaltura applications development and is not suppose to be used for other projects.

## Getting Started

#### Prerequisites

- [x] Ensure you have [node.js installed](https://nodejs.org/en/download/current/), version 7.0.0 or above. 
- [x] Ensure you have [git installed](https://git-for-windows.github.io/) 
- [x] Ensure you have npm installed, version 5.0.0 or above.

#### Setup your workspace
1. create a folder to hold your packages (your workspace root folder).
2. create `package.json` in your root folder by running the following command:
```
 $ npm init -y
 ```
3. add this tool to your folder in your root folder by running the following command:
```
$ npm install @kaltura-ng/dev-workspace
```

4. create file `kaltura-ws.json` in your root folder with the following format:

```json
 {
   "version" : "2.0.0",
   "repositories": [
     { "origin" : "github", "uri": "https://github.com/kaltura/kaltura-ng.git"},
     { "origin" : "github", "uri": "https://github.com/kaltura/kaltura-ng-mc-theme.git"},
     { "origin" : "github", "uri": "https://github.com/kaltura/kmc-ng.git"}
   ],
   "licenses" : {
     "ignoreList" : [      
       "kaltura-typescript-client"
     ]
   }
 }

```
**Notes**: 
- **you should modify repositories property to hold a list of relevant repositories to your kaltura project ordering them by the dependency constraints**.
- the sample above will setup your workspace to develop [kmc-ng application](https://github.com/kaltura/kmc-ng).
  
5. add the following to your `package.json`:
```json
{  
  "scripts" : {
    "kws" : "kws",
    "setup" : "kws setup",
    "build" : "kws run build",
    "licenses" : "kws licenses",
    "clean" : "kws clean"
  }
}
```

6. run setup command to build & symlink your repositories
```bash
$ npm run setup
```

  
## Commands

#### setup
Prepare your workspace for local development by running the following actions:
1. get libraries dependencies by running `npm install` in each library separately
1. link libraries locally by runing `npm link` in each library separately.
1. build a dependency graph and re-build all libraries.

> This command might take several minutes depending if you already have installed dependencies in your libraries or not.

#### npm-link
Re-create local links between libraries by running the following actions:
1. get libraries dependencies by running `npm install` in each library separately
1. link libraries locally by runing `npm link` in each library separately.

> This command might take several minutes depending if you already have installed dependencies in your libraries or not.

Use this command after running `npm install` in any library which revoke local links to other libraries.

#### run

#### licenses

#### clean
Delete `node_modules` folder of workspace libraries.
 