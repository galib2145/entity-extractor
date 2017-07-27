const Promise = require('bluebird');

const dbLogic = Promise.promisifyAll(require('../db.js'));
const mathLogic = require('../math.js');

const temporal = Promise.promisifyAll(require('./temporal'));

// Given a set of mentions and an entity  
// this method will return the number
// of mentions for each sentiment
const makeEntitySentimentInfo = (mentions, entry) => {
  return {
    total: mentions[entry].totalPosts,
    positive: mentions[entry].positive || 0,
    negative: mentions[entry].negative || 0,
    neutral: mentions[entry].neutral || 0,
  };
};

const getEntityMentionIntersection = (disqusMentions, twitterMentions) => {
  let intersection = [];

  for (let disqusEntry in disqusMentions) {
    for (let twitterEntry in twitterMentions) {
      if (twitterEntry === disqusEntry) {
        intersection.push({
          entity: disqusEntry,
          disqusInfo: makeEntitySentimentInfo(disqusMentions, disqusEntry),
          twitterInfo: makeEntitySentimentInfo(twitterMentions, twitterEntry),
        });
      }
    }
  }

  return intersection;
};

const calSentimentInfo = (mentions) => {
  const positiveMentions = mentions.filter(
    (m) => m.sentiment.type === 'positive');

  const negativeMentions = mentions.filter(
    (m) => m.sentiment.type === 'negative');

  const neutralMentions = mentions.filter(
    (m) => m.sentiment.type === 'neutral');

  return {
    positive: positiveMentions.length,
    negative: negativeMentions.length,
    neutral: neutralMentions.length,
  };
};

// s = how many posts in time range with sentiment s
// t, s = how many posts in time range with sentiment s and topic t
// u = how many posts in total by user
// ∑sj ∈ S [P( s | u ) * P( t, s | u )] 
const calcValForEntityWithSentiment = (
  entityInfo, disqusSentimentInfo, twitterSentimentInfo, ud, ut) => {
  const sentiments = ['positive', 'negative', 'neutral'];
  const sValsDisqus = sentiments.map((sentiment) => {
    const s = disqusSentimentInfo[sentiment];
    const st = entityInfo.disqusInfo[sentiment];
    return (s / ud) * (st / ud);
  });

  const sValsTwitter = sentiments.map((sentiment) => {
    const s = twitterSentimentInfo[sentiment];
    const st = entityInfo.twitterInfo[sentiment];
    return (s / ut) * (st / ut);
  });

  return mathLogic.getDotProduct(sValsDisqus, sValsTwitter);
};

const getUniqueMentions = (mentions) => {
  let uniqueMentions = {};
  mentions.forEach((a) => {
    const entity = a.entity;
    const sentiment = a.sentiment.type;

    if (entity in uniqueMentions) {
      uniqueMentions[entity].totalPosts += 1;
      if (uniqueMentions[entity][sentiment]) {
        uniqueMentions[entity][sentiment] += 1;
      } else {
        uniqueMentions[entity][sentiment] = 1;
      }
    } else {
      uniqueMentions[entity] = {};
      uniqueMentions[entity].totalPosts = 1;
      uniqueMentions[entity][sentiment] = 1;
    }
  });

  return uniqueMentions;
};

const calcEntitySimWithSentimentAndTimeRange = (
  twitterData, disqusData,
  startTime, endTime) => {
  const startDate = new Date(startTime.year, startTime.month, startTime.day);
  const endDate = new Date(endTime.year, endTime.month, endTime.day);

  const disqusMentions = disqusData.mentions.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const twitterMentions = twitterData.mentions.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const twitterPosts = twitterData.posts.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  const disqusComments = disqusData.posts.filter((m) =>
    m.date >= startDate && m.date <= endDate
  );

  if (twitterPosts.length === 0 ||
    disqusComments.length === 0 ||
    disqusMentions.length === 0 ||
    twitterMentions.length === 0) {
    return 0;
  }

  const uniqueDisqusMentions = getUniqueMentions(disqusMentions);
  const uniqueTwitterMentions = getUniqueMentions(twitterMentions);

  const entityIntersectionInfoList = getEntityMentionIntersection(uniqueDisqusMentions, uniqueTwitterMentions);

  if (entityIntersectionInfoList.length === 0) {
    return 0;
  }

  const disqusSentimentInfo = calSentimentInfo(disqusMentions);
  const twitterSentimentInfo = calSentimentInfo(twitterMentions);

  const uEPList = entityIntersectionInfoList.map((e) => {
    return calcValForEntityWithSentiment(
      e,
      disqusSentimentInfo,
      twitterSentimentInfo,
      disqusComments.length,
      twitterPosts.length);
  });

  return uEPList.reduce((prevVal, elem) => prevVal + elem, 0);
};

const calculateEntitySimilarity = (twitterUserId, disqusUserId, callback) => {
  let analysisTimeRange = null;
  temporal.getAnalysisTimeRangeAsync(twitterUserId, disqusUserId)
    .then((timeRange) => {
      analysisTimeRange = timeRange;
      return Promise.all([
        dbLogic.getUserDataForTimeRangeAsync(twitterUserId, 'twitter', timeRange),
        dbLogic.getUserDataForTimeRangeAsync(disqusUserId, 'disqus', timeRange),
      ]);
    })
    .then((results) => {
      const twitterUserData = results[0];
      const disqusUserData = results[1];
      const timeSlots = temporal.getTimeSlotsByDays(analysisTimeRange, 7);
      const simList = timeSlots.map((timeSlot) => {
        return calcEntitySimWithSentimentAndTimeRange(
          twitterUserData,
          disqusUserData,
          timeSlot.windowStart,
          timeSlot.windowEnd
        );
      });

      const nonzeroes = simList.filter(r => r > 0);
      const sum = nonzeroes.reduce((prevVal, elem) => prevVal + elem, 0);
      const avg = sum / simList.length;

      callback(null, avg);
    })
    .catch((err) => {
      callback(err);
      return;
    });

};

const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
const matchingResults = [];
const errors = [];

const processStart = new Date();
const userIdList = fileLogic.getUserIdList().slice(0, 100);
async.forEachOfSeries(userIdList, (userId, index, callback) => {
  const startTime = new Date();
  console.log(`\nStarting matching for : ${userId}`);
  generateEntitySimilarityRankingWithTwitter(userId, userIdList, (err, res) => {
    if (err) {
      errors.push({
        userId,
        err,
      });
      callback();
      return;
    }

    console.log(`Start time: ${startTime}`);
    console.log(`End time : ${new Date()}`);
    matchingResults.push({
      userId,
      res,
    });

    callback();
  });
}, (err) => {
  if (err) {
    console.log(err.message);
    return;
  }

  fs.writeFileSync(
    path.join(path.join(process.env.HOME, '/res/error-sentiment')),
    JSON.stringify(errors, null, 2)
  );
  fs.writeFileSync(
    path.join(path.join(process.env.HOME, '/res/match-sentiment')),
    JSON.stringify(matchingResults, null, 2)
  );

  console.log(`\nStart time: ${processStart}`);
  console.log(`End time : ${new Date()}`);
  console.log('Tasks executed successfully');
});
