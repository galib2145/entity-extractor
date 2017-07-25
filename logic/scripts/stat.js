const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');

const resFilePath = path.join(process.env.HOME, '/res/match');
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
