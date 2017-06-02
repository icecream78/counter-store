const _ = require('lodash');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const validator = require('express-validator');
const yaml = require('js-yaml');

const loggerMiddleware = require('./app/middleware/logger');
const corsMiddleware = require('./app/middleware/cors');
const logger = require('./app/logger');

const pollRoute = require('./app/routes/poll');
const registerRoute = require('./app/routes/register');

const uniqueEmailValidator = require('./app/validators/uniqueEmail');
const existingEmailValidator = require('./app/validators/existingEmail');
const validLanguageValidator = require('./app/validators/validLanguage');

const readFile = promisify(fs.readFile);

const app = express();


app.use(bodyParser.json());
app.use(validator({
  customValidators: {
    uniqueEmail: uniqueEmailValidator(app),
    existingEmail: existingEmailValidator(app),
    validLanguage: validLanguageValidator(app),
  },
}));

app.use(loggerMiddleware);
app.use(corsMiddleware);
app.use(pollRoute.router);
app.use(registerRoute.router);


function initDb(config) {
  const db = config.db;

  return MongoClient.connect(`mongodb://${db.host}:${db.port}/${db.name}`);
}


async function init(path) {
  const content = await readFile(path);
  const config = yaml.safeLoad(content);
  const db = await initDb(config);

  app.set('config', config);
  app.set('db', db);
  app.set('languages', _(config.languages)
    .map((v, k) => ({ id: parseInt(k, 10), lang: v, votes: 0 }))
    .value());

  if (process.env.NODE_ENV === 'production') {
    logger.info('Started server');
    app.listen(config.socket);
  } else {
    logger.info('Started server, listening on port 3000');
    app.listen(3000);
  }
}


let configName = 'config.yml';

if (process.env.NODE_ENV === 'production') {
  configName = 'config.production.yml';
}


init(configName)
  .catch(err => logger.error(err));
