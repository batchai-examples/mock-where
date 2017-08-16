/* eslint no-unused-vars:'off' */

global.PROJECT_PREFIX = 'mw';

const NodeConfigAny = require('node-config-any');
global.config = NodeConfigAny.load('config', undefined, true);

const Logger = require('json-log4js');
const LOG = new Logger('App');

const Beans = require('node-beans').DEFAULT;

Beans.create('./ApiServer');
Beans.create('./MockServerManager');

Beans.init();

LOG.info('app started');