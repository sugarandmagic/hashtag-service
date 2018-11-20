const init = require('./server').init;

init()
    .then(() => console.info('Server is listening'))
    .catch((err) => console.error('Server failed to start', err));
