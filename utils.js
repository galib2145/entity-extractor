const getDateFromTime = (time) => {
  return new Date(time.year, time.month - 1, time.day + 1);
};

exports.getDateFromTime = getDateFromTime;

const intersect = (a, b) => {
  if (!a || !b) {
    return [];
  }
  let t;
  if (b.length > a.length) t = b, b = a, a = t;
  return a.filter(function(e) {
    return b.indexOf(e) > -1;
  });
};

exports.intersect = intersect;
