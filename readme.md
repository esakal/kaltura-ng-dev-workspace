# Kaltura Dev Workspace

[![Gitter chat](https://badges.gitter.im/kaltura-ng/dev-tools.png)](https://gitter.im/kaltura-ng/kaltura-ng) ![npm (scoped)](https://img.shields.io/npm/v/@kaltura-ng/dev-workspace.svg?maxAge=86400)

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
- [x] Ensure you have [yarn installed](https://yarnpkg.com/lang/en/docs/install/) (we use it for node package management) version 0.24.6 and above. 

#### Setup your workspace
1. create a folder to hold your packages (your workspace root folder).
2. create `package.json` in your root folder by running the following command:
```
 $ yarn init -y
 ```
3. add this tool to your folder in your root folder by running the following command:
```
$ yarn add @kaltura-ng/dev-workspace
```

4. create file `kaltura-ws.json` in your root folder with the following format:

```json
{
  "version" : "1.0.1",
  "repositories": [
    "https://github.com/kaltura/kaltura-ng.git",
    "https://github.com/kaltura/kaltura-ng-mc-theme.git",
    "https://github.com/kaltura/kmc-ng.git"
  ]
}
```
**Notes**: 
- **you should modify repositories property to hold a list of relevant repositories to your kaltura project ordering them by the dependency constraints**.
- the sample above will setup your workspace to develop [kmc-ng application](https://github.com/kaltura/kmc-ng).
  
5. add the following to your `package.json`:
```json
{
  ...
  "scripts" : {
    "kws" : "kws",
    "setup" : "kws setup",
    "build" : "kws run build",
    "clean" : "kws clean"
  }
}
```

6. run setup command to build & symlink your repositories
```bash
$ yarn run setup 
```

  
## Commands

#### init

#### setup

#### run

#### licenses

#### clean
 
 