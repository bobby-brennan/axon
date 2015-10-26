var Async = require('async');
var Express = require('express');
var App = Express();
var Http = require('http').Server(App);
var IO = require('socket.io')(Http);

App.set('views', __dirname + '/views')
App.set('view engine', 'jade');
App.engine('jade', require('jade').__express);

App.get('/', function(req, res) {
  res.render('index');
})

IO.on('connection', function(socket){
  console.log('a user connected');
  setup(socket);
  socket.on('train', function(msg) {
    nextRound();
  })
});

Http.listen(3000, function(){
  console.log('listening on *:3000');
});

var nextRound;

var setup = function(socket) {
  var Manager = require('./lib/manager.js');

  var manager = new Manager({socket: socket});
  
  var VERBOSE = false;

  nextRound = function() {
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
}
