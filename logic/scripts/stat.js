const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');

const getGraphDataFromResult = (callback) => {
  const resFilePath = path.join(process.env.HOME, '/res/match-100-100-4');
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

const resFilePath = path.join(process.env.HOME, '/res/match-t-100-whole');
fs.readFileAsync(resFilePath)
  .then((fileContent) => {
    const resultList = JSON.parse(fileContent);
    const rrList = resultList.map((r) => {
      const userId = r.userId;
      const index = r.res.findIndex((e) => e.user === userId) + 1;
      return 1 / index;
    });

    const sumRR = rrList.reduce((prevVal, elem) => prevVal + elem, 0);
    const mRR = sumRR / rrList.length;
    console.log(mRR);
  })
  .catch((err) => {
    console.log(err);
  });
