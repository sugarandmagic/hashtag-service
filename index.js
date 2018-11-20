const init = require('./server').init;
const delay = require('delay');
const syncFixtures = require('./server').syncFixtures;

init()
    .then(() => console.info('Server is listening'))
    .catch((err) => console.error('Server failed to start', err));

const keepUpdated = async () => {
    while (true) {
        await delay(60 * 500);
        await syncFixtures();
    }
}

keepUpdated();