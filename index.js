var Async = require('async');

var Manager = require('./lib/manager.js');

var manager = new Manager();

var VERBOSE = false;

var nextRound = function() {
  global.verbose = VERBOSE;
  manager.train(30000, function() {
    global.verbose = false;
    Async.series(manager.samples.map(function(sample) {
      return function(acb) {
        manager.run(4000, sample, acb);
      }
    }), function(err) {
      console.log('ROUND DONE');
    })
  });
}

nextRound();
