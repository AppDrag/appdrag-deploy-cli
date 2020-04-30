const { getDirectoryListing } = require('../../utils/filesystem/filesystem');
const { getFunctionsList } = require('../../utils/api/api');
const { parseDirectory, parseHtmlFiles, downloadResources, deployCloudBackend, downloadDb } = require('../../utils/deploy/deploy');
const { setupCheck, currFolder, config, refreshToken } = require('../../utils/common');
const fs = require('fs');
const chalk = require('chalk');

const deployFilesystem = async (args) => {
  if (args.length < 3) {
    console.log(chalk.red('Not enough arguments, please specify a file/folder'));
    return;
  }
  let appId = setupCheck();
  if (!appId) {
    return;
  }
  let token = config.get('token');
  if (args[2]) {
    if (!(fs.existsSync(args[2]))) {
      fs.mkdirSync(args[2]);
    }
    process.chdir(args[2]);
  }
  let files = await getDirectoryListing(token, appId, '');
  if (files.status == 'KO') {
    let token_ref = config.get('refreshToken');
    await refreshToken(token_ref);
    response = await getFunctionsList(appId, token);
    if (response.status == 'KO') {
      console.log(chalk.red('Please log-in again'));
      return;
    }
  }
  let lastfile = files[files.length - 1].path;
  await parseDirectory(token, appId, files, lastfile, '');
  parseHtmlFiles(appId);
  await downloadResources();

  return true;
}

const deployApi = async (args) => {
  if (args.length < 3) {
    console.log(chalk.red('Please refer to the help command'));
    return;
  }
  let appId = setupCheck();
  if (!appId) {
    return;
  }
  let token = config.get('token');
  let response = await getFunctionsList(appId, token);
  if (response.status == 'KO') {
    let token_ref = config.get('refreshToken');
    await refreshToken(token_ref);
    response = await getFunctionsList(appId, token);
    if (response.status == 'KO') {
      console.log(chalk.red('Please log-in again'));
      return;
    }
  }
  let functionList = response.Table;
  let baseFolder = '';
  if (args[2]) {
    baseFolder = args[2];
  }
  await deployCloudBackend(token, appId, functionList, baseFolder);

  return true;
}

const deployDb = async (args) => {
  if (args.length < 3) {
    console.log(chalk.red('Please refer to the help command'));
    return;
  }
  let appId = setupCheck();
  if (!appId) {
    return;
  }
  let token = config.get('token');
  let folder = '.';
  if (args[2]) {
    folder = args[2];
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
  }
  await downloadDb(appId, token, folder);
  return true;
}

module.exports = { deployApi, deployFilesystem, deployDb };