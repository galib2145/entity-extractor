const path = require('path');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const request = require('request');
var querystring = require('querystring');

const getDirectories = (srcpath) => {
  const directoryNames = fs.readdirSync(srcpath)
    .filter(file => fs.lstatSync(path.join(srcpath, file)).isDirectory());

  return directoryNames.map(directoryName => `${srcpath}/${directoryName}`);
};

exports.getDirectories = getDirectories;

const getCommentTextForDisqus = (filePath) => {
  const disqusDataFilePath = `${filePath}/disqus_comments.json`;
  const fileContent = fs.readFileSync(disqusDataFilePath).toString();
  const disqusProfileData = JSON.parse(fileContent);
  const comments = disqusProfileData.comments;

  let totalText = '';

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    const commentText = comment.post;
    const totalLength = totalText.length + commentText.length + 1;

    if (totalLength > 10000) {
      break;
    }

    totalText += commentText;
  }

  return totalText;
};

exports.getCommentTextForDisqus = getCommentTextForDisqus;

const getAnalysisOfDisqusComments = (commentText, callback) => {
  const form = {
    linkedData: 1,
    text: commentText,
  };

  const formData = querystring.stringify(form);
  const contentLength = formData.length;

  const options = {
    headers: {
      'Content-Length': contentLength,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    uri: 'https://alchemy-language-demo.mybluemix.net/api/entities',
    body: formData,
    method: 'POST',
  }

  request(options, (err, response, body) => {
    if (err) {
      callback(err);
      return;
    }

    callback(null, body);
  });
};

exports.getAnalysisOfDisqusComments = getAnalysisOfDisqusComments;

const getDisqusAnalysisForUser = (userDirectory, callback) => {
  const getAnalysisOfDisqusCommentsAsync = Promise.promisify(getAnalysisOfDisqusComments);
  const disqusCommentText = getCommentTextForDisqus(userDirectory);
  getAnalysisOfDisqusCommentsAsync(disqusCommentText)
    .then((response) => {
      const writePath = `${userDirectory}/disqusAnalysis.json`;
      const parsedResponse = JSON.parse(response);
      const responseToPrint = JSON.stringify(parsedResponse, null, 2);
      fs.writeFile(writePath, responseToPrint);
      const status = parsedResponse.status;

      if (!status || status !== 'OK' || !parsedResponse.entities) {
        console.log('Failed to fetch entities');
        console.log(JSON.stringify(response, null, 2));
        callback(null, {
          status: false,
          response: parsedResponse,
        });
        return;
      }

      callback(null, {
        status: true,
        response: parsedResponse,
      });
    })
    .catch((err) => {
      callback(err);
    })

};

exports.getDisqusAnalysisForUser = getDisqusAnalysisForUser;
