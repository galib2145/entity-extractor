const dbLogic = require('../db');

dbLogic.removeData((err) => {
    if (err) {
        console.log(err.message);
        return;
    }

    console.log('Data removed successfully');
});