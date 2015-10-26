global.verbose = true;

var Async = require('async');

var Manager = require('./lib/manager.js');

var manager = new Manager();


var nextRound = function() {
  manager.train(10000, function() {
    Async.series(manager.samples.map(function(sample) {
      return function(acb) {
        manager.run(2000, sample, acb);
      }
    }), function(err) {
      console.log('ROUND DONE');
    })
  });
}

nextRound();
