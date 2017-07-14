const MongoClient = require('mongodb').MongoClient;
const Promise = require('bluebird');
const path = require('path');

const dataDirectory = path.join(process.env.HOME, 'entity-analysis-2');
const instance = null;

const genericLogic = Promise.promisifyAll(require('./analysis/generic'));
const twitterAnalysisLogic = Promise.promisifyAll(require('./analysis/twitter'));
const disqusAnalysisLogic = Promise.promisifyAll(require('./analysis/disqus'));

const timeParser = require('./parsing/timeParser');

const db = null;

const getDB = (callback) => {
  if (db) {
    callback(null, db);
    return;
  }

  const url = 'mongodb://localhost:27017/temporal_analysis_db';
  MongoClient.connect(url, {
    connectTimeoutMS: 100000,
  }, (err, db) => {
    if (err) {
      callback(err);
      return;
    }

    callback(null, db);
  });
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
      collection.find(query).toArray((error, resultSet) => {
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

const getUserMentionsFromDb = (userId, media, startDate, endDate, callback) => {
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

exports.getUserMentionsFromDb = getUserMentionsFromDb;

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
    .then(() => callback())
    .catch((err) => {
      callback(err);
    })
};

saveUserDataInDB('1000_bigyahu', (err) => {
  if (err) {
    console.log(err);
  }

  console.log('Done');
})

