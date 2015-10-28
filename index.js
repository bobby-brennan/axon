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
  var iterations = 20;
  var time = 4000;
  var iter = 0;
  var interval = setInterval(function() {
    manager.io.socket.emit('progress', {
      progress: ++iter / iterations,
    })
  }, time)
  manager.train(20, time, function() {
    clearInterval(interval);
  });
}

var test = function() {
  Async.series(manager.testSamples.map(function(sample) {
    return function(acb) {
      manager.test(1, 6000, sample, acb);
    }
  }), function(err) {
  })
}

var setup = function(socket) {
  global.log = 'dist,time,error';
  manager = new Manager({socket: socket});
}
