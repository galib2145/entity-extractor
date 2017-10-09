const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const async = require('async');
const bfj = require('bfj');

const temporal = Promise.promisifyAll(require('../experiment/temporal'));
const dbLogic = Promise.promisifyAll(require('../db.js'));

const utils = require('../../utils');
const fileLogic = Promise.promisifyAll(require('../file.js'));

const twitter = require('./twitter');
const disqus = require('./disqus');
const timeParser = require('../parsing/timeParser');
const mainUserList = fileLogic.getUserIdList();

const getAllDisqusPostsForUser = (disqusId, callback) => {
  let disqusTimeRange = null;
  temporal.getDisqusTimeRangeAsync(disqusId)
    .then((timeRange) => {
      disqusTimeRange = timeRange;
      const startDate = utils.getDateFromTime(timeRange.start);
      const endDate = utils.getDateFromTime(timeRange.end);
      return dbLogic.getUserPostsFromDbAsync(disqusId, 'disqus', startDate, endDate);
    })
    .then((postList) => {
      callback(null, postList);
    })
    .catch((err) => {
      callback(err);
      return;
    });
};

exports.getAllDisqusPostsForUser = getAllDisqusPostsForUser;

const getRequiredDisqusData = (disqusId, callback) => {
  let disqusTimeRange = null;
  temporal.getDisqusTimeRangeAsync(disqusId)
    .then((timeRange) => {
      disqusTimeRange = timeRange;
      const startDate = utils.getDateFromTime(timeRange.start);
      const endDate = utils.getDateFromTime(timeRange.end);
      const dataFetchingTasks = [
        dbLogic.getUserPostsFromDbAsync(disqusId, 'disqus', startDate, endDate),
        dbLogic.getMentionListFromDbAsync(disqusId, 'disqus', startDate, endDate)
      ];

      return Promise.all(dataFetchingTasks);
    })
    .then((results) => {
      const disqusMentions = results[1];
      const disqusComments = results[0];

      callback(null, {
        userId: disqusId,
        timeRange: disqusTimeRange,
        mentions: disqusMentions,
        posts: disqusComments,
      });
    })
    .catch((err) => {
      callback(err);
      return;
    });
};

exports.getRequiredDisqusData = getRequiredDisqusData;

const getEntityIntersection = (disqusData, twitterId, callback) => {
  let analysisTimeRange = null;
  temporal.getAnalysisTimeRangeGivenDisqusAsync(twitterId, disqusData.timeRange)
    .then((timeRange) => {
      if (!timeRange) {
        return null;
      }
      const startDate = utils.getDateFromTime(timeRange.startTime);
      const endDate = utils.getDateFromTime(timeRange.endTime);
      return dbLogic.getMentionListFromDbAsync(twitterId, 'twitter', startDate, endDate);
    })
    .then((twitterMentions) => {
      if (!twitterMentions || twitterMentions.length === 0) {
        callback(null, 0);
        return;
      }

      const disqusMentions = disqusData.mentions;
      disqusMentions.sort((a, b) => {
        return a.entity.localeCompare(b.entity);
      });

      const uniqueDisqusMentions = temporal.makeUniqueEntityMap(disqusMentions);

      twitterMentions.sort((a, b) => {
        return a.entity.localeCompare(b.entity);
      });

      let uniqueTwitterMentions = temporal.makeUniqueEntityMap(twitterMentions);
      const entityIntersection = temporal.getEntityMentionIntersection(uniqueDisqusMentions, uniqueTwitterMentions);
      callback(null, entityIntersection.length);
    })
    .catch((err) => {
      callback(err);
      return;
    });
};

const generateEntityIntersectionList = (userId, userIdList, callback) => {
  const getEntityIntersectionAsync = Promise.promisify(getEntityIntersection);
  const getRequiredDisqusDataAsync = Promise.promisify(getRequiredDisqusData);
  getRequiredDisqusDataAsync(userId)
    .then((disqusData) => {
      return Promise.map(userIdList, (twitterId) => getEntityIntersectionAsync(disqusData, twitterId), { concurrency: 1 })
    })
    .then((intersectionList) => {
      callback(null, intersectionList);
    })
    .catch((err) => {
      callback(err);
    })
};

exports.generateEntityIntersectionList = generateEntityIntersectionList;

const storeEntityIntersectionList = (userId, intersectionList, callback) => {
  const outDir = path.join(process.env.HOME, 'entity-analysis-2');
  const outPath = `${outDir}/${userId}/intersection`;
  const str = JSON.stringify(intersectionList, null, 2);
  fs.writeFileAsync(outPath, str)
    .then(() => callback())
    .catch((err) => callback(err));
};

exports.storeEntityIntersectionList = storeEntityIntersectionList;

const getEntityIntersectionList = (userId, callback) => {
  const readDir = path.join(process.env.HOME, 'entity-analysis-2');
  const readPath = `${readDir}/${userId}/intersection`;
  fs.readFileAsync(readPath)
    .then((ct) => {
      const intersectionList = JSON.parse(ct);
      callback(null, intersectionList);
    })
    .catch((err) => {
      callback(err);
    });
};

exports.getEntityIntersectionList = getEntityIntersectionList;

const generateZeroIntersectionData = (callback) => {
  const getEntityIntersectionListAsync = Promise.promisify(getEntityIntersectionList);
  const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
  const totalUserList = fileLogic.getUserIdList();
  const userIdList = totalUserList;
  const tasks = userIdList.map(u => getEntityIntersectionListAsync(u));

  Promise.all(tasks)
    .then((resultList) => {
      const graphData = resultList.map((r, index) => {
        console.log(r);
        const numZeroes = (r.filter(x => x === 0)).length;
        return [index, numZeroes];
      });

      callback(null, graphData);
    });
};

const processEntityIntersectionListForUser = (userId, userIdList, callback) => {
  const generateEntityIntersectionListAsync =
    Promise.promisify(generateEntityIntersectionList);
  const storeEntityIntersectionListAsync =
    Promise.promisify(storeEntityIntersectionList);

  generateEntityIntersectionListAsync(userId, userIdList)
    .then((l) => storeEntityIntersectionListAsync(userId, l))
    .then(() => callback())
    .catch((err) => {
      callback(err);
    });
}

const getAllPostData = () => {
  const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
  const totalUserList = mainUserList;

  const postData = {};

  totalUserList.forEach((u, index) => {
    postData[u] = {
      twitterPosts: twitter.getTwitterPostsSync(u),
      disqusPosts: disqus.getDisqusCommentsSync(u)
    };
  });

  return postData;
};

const generateTimeRangeData = (callback) => {
  const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
  const timeRangeData = {};
  console.time('Fetching post Data');
  const postData = getAllPostData();
  console.timeEnd('Fetching post Data');

  mainUserList.forEach((ud, index) => {
    console.time(`User ${index}: ${ud}`);
    mainUserList.forEach((ut) => {
      const tp = postData[ut]['twitterPosts'];
      const dp = postData[ud]['disqusPosts'];

      const ttr = {
        start: timeParser.parseTimeString(tp[tp.length - 1].time),
        end: timeParser.parseTimeString(tp[0].time)
      };

      const dtr = {
        start: timeParser.parseTimeString(dp[dp.length - 1].time),
        end: timeParser.parseTimeString(dp[0].time)
      };

      const doesOverlap = temporal.doesTimeRangesOverlap(dtr, ttr);

      let tr = null;

      if (doesOverlap) {
        tr = {
          startTime: temporal.compareTime(dtr.start, ttr.start) > 0 ?
            dtr.start : ttr.start,
          endTime: temporal.compareTime(dtr.end, ttr.end) > 0 ?
            ttr.end : dtr.end,
        };
      }

      if (!timeRangeData[ud]) {
        timeRangeData[ud] = {};
      }

      timeRangeData[ud][ut] = tr;
    });
    console.timeEnd(`User ${index}: ${ud}`);
  });

  return timeRangeData;
};

exports.generateTimeRangeData = generateTimeRangeData;

const saveTrData = (trData) => {
  mainUserList.forEach((u, index) => {
    console.time(`Saving result for user ${index}: ${u}`);
    const trDataForU = trData[u];
    const trDataForUString = JSON.stringify(trDataForU, null, 2);
    const readPath = path.join(process.env.HOME, '/tr-data/${u}.json');
    fs.writeFileSync(readPath, trDataForUString);
    console.timeEnd(`Saving result for user ${index}: ${u}`);
  });
};

const readTrData = () => {
  const trDataAll = {};
  mainUserList.forEach((u, index) => {
    const readPath = path.join(process.env.HOME, `/tr-data/${u}.json`);
    const trDataStr = fs.readFileSync(readPath);
    const trDataForU = JSON.parse(trDataStr);
    trDataAll[u] = trDataForU;
  });

  return trDataAll;
};

exports.readTrData = readTrData;

// console.time('Calculate time range');
// const timeRangeData = generateTimeRangeData();
// console.timeEnd('Calculate time range');

// console.time('Saving result');
// saveTrData(timeRangeData);
// console.timeEnd('Saving result');
