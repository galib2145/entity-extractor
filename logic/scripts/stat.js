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

const getAllTemporalResults = (callback) => {
  const doesFileExistAsync = Promise.promisify(doesFileExist);
  const sourcePath = path.join(process.env.HOME, 'entity-analysis-2');
  let validDirList = [];
  let resultData = [];
  fs.readdirAsync(sourcePath)
    .then((dirList) => {
      validDirList = dirList;
      const fileExistTaskList = dirList.map((dir) => {
        const location = `${sourcePath}/${dir}/test`;
        return doesFileExistAsync(location);
      })

      return Promise.all(fileExistTaskList);
    })
    .then((doesExistList) => {
      const resultFetchTaskList = validDirList.map((dir, index) => {
        if (doesExistList[index]) {
          return fs.readFileAsync(`${sourcePath}/${dir}/test`);
        }

        return null;
      })

      return Promise.all(resultFetchTaskList);
    })
    .then((resultListStrList) => {
      resultListStrList.map((r) => {
        if (r) { 
          resultData.push(JSON.parse(r));
        }
      });

      console.log(resultData.length);
      callback(null, resultData);
    });
};

const getGraphDataFromResult = (callback) => {
  const resFilePath = path.join(process.env.HOME, '/res/match-whole-ov-100');
  fs.readFileAsync(resFilePath)
    .then((fileContent) => {
      const resultData = JSON.parse(fileContent);
      const posList = resultData.map((r) => {
        return r.res.findIndex((e) => e.user === r.userId) + 1;
      });

      const graphData = [];
      for (let i = 1; i <= resultData.length; i++) {
        const count = posList.filter((p) => p <= i).length;
        graphData.push([i, count]);
      }

      callback(null, graphData);
    })
    .catch((err) => {
      callback(err);
    });;
};

// const resFilePath = path.join(process.env.HOME, '/res/match-sentiment-2');
// fs.readFileAsync(resFilePath)
//   .then((fileContent) => {
//     const resultList = JSON.parse(fileContent);
//     const rrList = resultList.map((r) => {
//       const userId = r.userId;
//       const index = r.res.findIndex((e) => e.user === userId) + 1;
//       return 1 / index;
//     });

//     const sumRR = rrList.reduce((prevVal, elem) => prevVal + elem, 0);
//     const mRR = sumRR / rrList.length;
//     console.log(mRR);
//   })
//   .catch((err) => {
//     console.log(err);
//   });

// getAllTemporalResults((err, resultList) => {
//   const rrList = resultList.map((r) => {
//       const userId = r.userId;
//       const index = r.res.findIndex((e) => e.user === userId) + 1;
//       return 1 / index;
//     });

//     const sumRR = rrList.reduce((prevVal, elem) => prevVal + elem, 0);
//     const mRR = sumRR / rrList.length;
//     console.log(mRR);
// })
