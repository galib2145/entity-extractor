const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');

const doesFileExist = (path, callback) => {
  fs.stat(path, (err, stat) => {
    if (err == null) {
      callback(null, true);
    } 

    callback(null, false);
  });
};

const calcMRR = (resultList) => {
  const rrList = resultList.map((r) => {
    const userId = r.userId;
    const index = r.res.findIndex((e) => e.user === userId) + 1;
    return 1 / index;
  });

  const sumRR = rrList.reduce((prevVal, elem) => prevVal + elem, 0);
  const mRR = sumRR / rrList.length;
  return mRR;
}

const getMRR = (exp, callback) => {
  const sourcePath = path.join(process.env.HOME, `experiment-results/${exp}`);
  fs.readdirAsync(sourcePath)
  .then((dirList) => {
    const fileReadTaskList = dirList.map((dir) => {
      const location = `${sourcePath}/${dir}`;
      return fs.readFileAsync(location);
    });

    return Promise.all(fileReadTaskList);
  })
  .then((resultStrList) => {
    const resultList = resultStrList.map((r, index) => {
      return JSON.parse(r);
    });
    const mRR = calcMRR(resultList);
    callback(null, mRR);
  })
};

const renameAllFiles = (callback) => {
  const doesFileExistAsync = Promise.promisify(doesFileExist);
  const sourcePath = path.join(process.env.HOME, 'entity-analysis-2');
  let validDirList = [];
  let resultData = [];
  fs.readdirAsync(sourcePath)
    .then((dirList) => {
      validDirList = dirList;
      const fileExistTaskList = dirList.map((dir) => {
        const location = `${sourcePath}/${dir}/cosine-7-ov`;
        return doesFileExistAsync(location);
      })

      return Promise.all(fileExistTaskList);
    })
    .then((doesExistList) => {
      const resultFetchTaskList = validDirList.map((dir, index) => {
        if (doesExistList[index]) {
          return fs.renameAsync(`${sourcePath}/${dir}/cosine-7-ov`, `/home/saad/cosine-7-ov/${dir}`);
        }

        return null;
      })

      return Promise.all(resultFetchTaskList);
    })
    .then(() => {
      callback();
    })
    .catch((err) => {
      callback(err);
    });
};

getMRR('temporal-30-ov', (err, m) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log(m);
});