const moment = require('moment');

const getMonthFromString = (monthStr) => {
  return new Date(Date.parse(`${monthStr} 1, 2012`)).getMonth() + 1;
}

const getDayFromString = (dayStr) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.indexOf(dayStr) + 1;
}

const getHour = (timeStr) => {
  const hrStr = timeStr.split(':')[0];
  return parseInt(hrStr);
}

// Fri Nov 04 02:41:08 +0000 2016
const parseTwitterTimeSting = (timeStr) => {
  const parts = timeStr.split(' ');
  const time = {
    day: getDayFromString(parts[0]),
    month: getMonthFromString(parts[1]),
    hour: getHour(parts[3]),
    year: parts[5],
  }

  return time;
}


// 2012-11-16T17:31:40
const parseDisqusTimeString = (timeStr) => {
  try {
    const parts = timeStr.split('T');
    const dateStr = parts[0];
    const date = moment(dateStr);
    const time = {
      year: dateStr.split('-')[0],
      month: dateStr.split('-')[1],
      day: date.day(),
      hour: getHour(parts[1]),
    }

    return time;
  } catch (err) {
    console.log(err);
  }
};

const parseTimeString = (timeStr) => {
  const formattedTimeStr = timeStr.trim();
  if (formattedTimeStr.includes(' ')) {
    return parseTwitterTimeSting(timeStr);
  }

  return parseDisqusTimeString(timeStr);
};

exports.parseTimeString = parseTimeString;
