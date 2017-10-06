const Promise = require('bluebird');
const MongoClient = Promise.promisifyAll(require('mongodb').MongoClient);
const path = require('path');
const async = require('async');

const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
const instance = null;

const utils = require('../utils');

const genericLogic = Promise.promisifyAll(require('./analysis/generic'));
const fileLogic = require('./file');
const twitterAnalysisLogic = Promise.promisifyAll(require('./analysis/twitter'));
const disqusAnalysisLogic = Promise.promisifyAll(require('./analysis/disqus'));

const timeParser = require('./parsing/timeParser');

let db = null;

const cleanDB = (db, callback) => {
  const twitterEntityMentionCollection = Promise.promisifyAll(db.collection('twitterEntityMentions'));
  const disqusEntityMentionCollection = Promise.promisifyAll(db.collection('disqusEntityMentions'));

  const removalTasks = [
    disqusEntityMentionCollection.removeAsync({ type: 'TwitterHandle' }),
    twitterEntityMentionCollection.removeAsync({ type: 'TwitterHandle' }),
    disqusEntityMentionCollection.removeAsync({ type: 'Quantity' }),
    twitterEntityMentionCollection.removeAsync({ type: 'Quantity' })
  ];

  Promise.all(removalTasks)
    .then(() => callback(null, db))
    .catch((err) => callback(err));
};

exports.cleanDB = cleanDB;

const createDBIndexes = (db, callback) => {
  const twitterPostCollection = Promise.promisifyAll(db.collection('twitterPosts'));
  const disqusPostCollection = Promise.promisifyAll(db.collection('disqusPosts'));
  const twitterEntityMentionCollection = Promise.promisifyAll(db.collection('twitterEntityMentions'));
  const disqusEntityMentionCollection = Promise.promisifyAll(db.collection('disqusEntityMentions'));

  const indexCreationTasks = [
    twitterPostCollection.ensureIndexAsync({ userId: 1 }),
    twitterPostCollection.ensureIndexAsync({ date: 1 }),
    disqusPostCollection.ensureIndexAsync({ userId: 1 }),
    disqusPostCollection.ensureIndexAsync({ date: 1 }),
    disqusPostCollection.ensureIndexAsync({ userId: 1, date: 1 }),
    twitterPostCollection.ensureIndexAsync({ userId: 1, date: 1 }),
    disqusEntityMentionCollection.ensureIndexAsync({ userId: 1, date: 1 }),
    twitterEntityMentionCollection.ensureIndexAsync({ userId: 1, date: 1 })
  ];

  Promise.all(indexCreationTasks)
    .then(() => callback(null, db))
    .catch((err) => callback(err));
};

const initDB = (callback) => {
  const createDBIndexesAsync = Promise.promisify(createDBIndexes);
  if (db) {
    callback(null, db);
    return;
  }

  const dbOptions = {
    connectTimeoutMS: 100000,
  };

  const url = 'mongodb://localhost:27017/temporal_analysis_db';
  MongoClient.connectAsync(url, dbOptions)
    .then((newDB) => createDBIndexesAsync(newDB))
    .then((newDB) => {
      db = newDB;
      callback(null, newDB);
    })
    .catch((err) => {
      callback(err);
    })
};

exports.initDB = initDB;

const getDB = (callback) => {
  if (db) {
    callback(null, db);
    return;
  }

  initDB(callback);
};

exports.getDB = getDB;


const saveData = (collectionName, data, callback) => {
  getDB((err, db) => {
    if (err) {
      callback(err);
      return;
    }
    const collection = db.collection(collectionName);
    collection.insertMany(data, (err, results) => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, results);
    });
  });
};

const getData = (collectionName, query, callback) => {
  getDB((err, db) => {
    if (err) {
      callback(err);
      return;
    }

    db.collection(collectionName, (err, collection) => {
      collection.find(query).sort({ date: 1 }).toArray((error, resultSet) => {
        if (error) {
          callback(error);
          return;
        }

        callback(null, resultSet);
      });
    });
  });
};


const getAggregateData = (collectionName, query, callback) => {
  getDB((err, db) => {
    if (err) {
      callback(err);
      return;
    }

    db.collection(collectionName, (err, collection) => {
      collection.aggregate(query).toArray((error, resultSet) => {
        if (error) {
          callback(error);
          return;
        }

        callback(null, resultSet);
      });
    });
  });
};

const getMentionsFromEntityData = (userId, entityData) => {
  const entityMentions = [];
  for (let i = 0; i < entityData.length; i++) {
    const entity = entityData[i];
    for (let j = 0; j < entity.mentionTimes.length; j++) {
      const mentionTime = entity.mentionTimes[j];
      const userMention = {
        entity: entity.entity,
        userId,
        type: entity.type,
        details: entity.details,
        date: new Date(mentionTime.year, mentionTime.month, mentionTime.day),
        sentiment: entity.sentiments[j],
        emotion: entity.emotions[j],
      };
      entityMentions.push(userMention);
    }
  }

  return entityMentions;
};

const saveUserEntityMentions = (userId, media, callback) => {
  const saveDataAsync = Promise.promisify(saveData);
  genericLogic.getEntityDataForUserAsync(userId, media)
    .then((entityData) => {
      const entityMentions = getMentionsFromEntityData(userId, entityData);
      return saveDataAsync(`${media}EntityMentions`, entityMentions);
    })
    .then((result) => {
      callback(null, result);
    })
    .catch((err) => callback(err));
};

exports.saveUserEntityMentions = saveUserEntityMentions;

const saveUserPosts = (userId, media, callback) => {
  const saveDataAsync = Promise.promisify(saveData);
  let posts = null;
  let postFetchTask = null;

  (media === 'disqus' ?
    disqusAnalysisLogic.getDisqusCommentsAsync(userId) :
    twitterAnalysisLogic.getTwitterPostsAsync(userId))
  .then((posts) => {
      const formattedPosts = posts.map((post) => {
        const time = post.time;
        const intrTime = timeParser.parseTimeString(time);
        const postDate = new Date(intrTime.year, intrTime.month, intrTime.day);
        post.date = postDate;
        post.userId = userId;
        if (post.post) {
          post.wordList = utils.getUniqueWordListFromStr(post.post);
        } else {
          post.wordList = utils.getUniqueWordListFromStr(post.text);
        }
        return post;
      });
      return saveDataAsync(`${media}Posts`, formattedPosts);
    })
    .then((result) => {
      callback(null, result);
    })
    .catch((err) => callback(err));
};

exports.saveUserPosts = saveUserPosts;

const getUserPostsFromDb = (userId, media, startDate, endDate, callback) => {
  const getDataAsync = Promise.promisify(getData);
  const query = {
    userId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  const collectionName = `${media}Posts`;
  getDataAsync(collectionName, query)
    .then((posts) => {
      callback(null, posts);
    })
    .catch(err => callback(err));
};

exports.getUserPostsFromDb = getUserPostsFromDb;

const getMentionListFromDb = (userId, media, startDate, endDate, callback) => {
  const getDataAsync = Promise.promisify(getData);
  const query = {
    userId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  const collectionName = `${media}EntityMentions`;
  getDataAsync(collectionName, query)
    .then((mentions) => {
      callback(null, mentions);
    })
    .catch(err => callback(err));
};

exports.getMentionListFromDb = getMentionListFromDb;

const getUserMentionMapFromDb = (userId, media, startDate, endDate, callback) => {
  const getAggregateDataAsync = Promise.promisify(getAggregateData);
  const query = [
    {
      $match: {
        userId,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      }
    },
    {
      $group: {
        _id: '$entity',
        count: { $sum: 1 },
      }
    }
  ];


  const collectionName = `${media}EntityMentions`;
  getAggregateDataAsync(collectionName, query)
    .then((entityData) => {
      const entityMap = entityData.map((x) => {
        return {
          entity: x._id,
          postCount: x.count,
        }
      });

      callback(null, entityMap);
    })
    .catch(err => callback(err));
};

exports.getUserMentionMapFromDb = getUserMentionMapFromDb;

const saveUserDataInDB = (userId, callback) => {
  const saveUserPostsAsync = Promise.promisify(saveUserPosts);
  const saveUserEntityMentionsAsync = Promise.promisify(saveUserEntityMentions);
  const dataSavingTasks = [
        saveUserPostsAsync(userId, 'disqus'),
        saveUserPostsAsync(userId, 'twitter'),
        saveUserEntityMentionsAsync(userId, 'disqus'),
        saveUserEntityMentionsAsync(userId, 'twitter'),
      ];

  Promise.all(dataSavingTasks)
    .then(() => {
      callback();
    })
    .catch((err) => {
      console.log(err);
      callback();
    });
};

exports.saveUserDataInDB = saveUserDataInDB;

const getUserDataForTimeRange = (userId, media, timeRange, callback) => {
  const startDate = utils.getDateFromTime(timeRange.startTime);
  const endDate = utils.getDateFromTime(timeRange.endTime);

  const getUserPostsFromDbAsync = Promise.promisify(getUserPostsFromDb);
  const getMentionListFromDbAsync = Promise.promisify(getMentionListFromDb);

  const dataFetchingTasks = [
    getUserPostsFromDbAsync(userId, media, startDate, endDate),
    getMentionListFromDbAsync(userId, media, startDate, endDate)
  ];

  Promise.all(dataFetchingTasks)
    .then((taskResults) => {
      const userData = {
        posts: taskResults[0],
        mentions: taskResults[1],
      };

      callback(null, userData);
    })
    .catch((err) => {
      callback(err);
    });
};

exports.getUserDataForTimeRange = getUserDataForTimeRange;
