const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const getDirectories = (srcpath) => {
  const directoryNames = fs.readdirSync(srcpath)
    .filter(file => fs.lstatSync(path.join(srcpath, file)).isDirectory());

  return directoryNames.map(directoryName => `${srcpath}/${directoryName}`);
};

exports.getDirectories = getDirectories;

const deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index) {
      const curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

exports.deleteFolderRecursive = deleteFolderRecursive;

const getUserIdList = () => {
  const analysisDir = path.join(process.env.HOME, 'entity-analysis-2');
  const userDirectories = getDirectories(analysisDir);
  return userDirectories.map(dir => dir.split('/')[4]);
};

exports.getUserIdList = getUserIdList;
