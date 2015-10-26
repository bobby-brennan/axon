global.verbose = true;

var Manager = require('./lib/manager.js');

var manager = new Manager();

manager.train(10000);
