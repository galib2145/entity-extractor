const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
var mkdirp = require('mkdirp');
var getDirName = require('path').dirname;

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
  return userDirectories.map(dir => { 
    const splitted = dir.split('/');
    return splitted[splitted.length - 1];
  });
};

exports.getUserIdList = getUserIdList;

const writeFile = (path, contents, cb) => {
  mkdirp(getDirName(path), function (err) {
    if (err) return cb(err);

    fs.writeFile(path, contents, cb);
  });
};

exports.writeFile = writeFile;
