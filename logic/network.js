const request = require('request');
var querystring = require('querystring');

const getAlchemyAnalysis = (text, callback) => {
  const form = {
    linkedData: 1,
    text,
    sentiment: 1,
    emotion: 1,
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
    timeout: 60 * 1000,
  }

  request(options, (err, response, body) => {
    if (err) {
      if (err.message.includes('ETIMEDOUT') || err.message.includes('socket hang up') || err.message.includes('ESOCKETTIMEDOUT')) {
        setTimeout(() => {
          getAlchemyAnalysis(text, callback);
        }, 5 * 60 * 1000);
        return;
      }

      callback(err);
      return;
    }

    const responseJson = JSON.parse(body);
    callback(null, responseJson);
  });
};

exports.getAlchemyAnalysis = getAlchemyAnalysis;
