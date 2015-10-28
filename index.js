var Async = require('async');
var Express = require('express');
var App = Express();
var Http = require('http').Server(App);
var IO = require('socket.io')(Http);

var Manager = require('./lib/manager.js');

var VERBOSE = false;
global.verbose = VERBOSE;

App.set('views', __dirname + '/views')
App.set('view engine', 'jade');
App.engine('jade', require('jade').__express);

App.get('/', function(req, res) {
  res.render('index');
})

IO.on('connection', function(socket){
  console.log('a user connected');
  setup(socket);
  socket.on('test', function(msg) {
    test();
  })
  socket.on('train', function(msg) {
    train();
  })
  socket.on('reset', function(msg) {
    setup(socket);
  })
});

Http.listen(3000, function(){
  console.log('listening on *:3000');
});

var manager;
var train = function() {
  manager.train(20, 2000, function() {
  });
}

var test = function() {
  Async.series(manager.trainingSamples.map(function(sample) {
    return function(acb) {
      manager.test(1, 6000, sample, acb);
    }
  }), function(err) {
  })
}

var setup = function(socket) {
  global.log = 'dist,error';
  manager = new Manager({socket: socket});
}
