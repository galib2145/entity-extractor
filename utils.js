const getDateFromTime = (time) => {
  return new Date(time.year, time.month - 1, time.day + 1);
};

exports.getDateFromTime = getDateFromTime;
