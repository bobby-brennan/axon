var App = require('express')();
var Http = require('http').Server(App);
var IO = require('socket.io')(Http);
var M = require('mathjs');

var Neuron = require('./neuron.js');

var socket;
IO.on('connection', function(s){
  socket = s;
  var inputs = {};
  inputs.in1 = new Neuron({
    id: 'in1',
    port: 3002,
    io: {socket: s, refresh: 100},
    dimensions: {hidden: 2},
    interval: 250,
  })
  inputs.in2 = new Neuron({
    id: 'in2',
    port: 3001,
    io: {socket: s, refresh: 100},
    dimensions: {hidden: 2},
    interval: 250,
  })

  var neuron = new Neuron({
    id: 'singleton',
    port: 3003,
    io: {socket: s, refresh: 100},
    dimensions: {hidden: 2},
    interval: 250,
  })

  subscribe(inputs.in1, neuron);
  subscribe(inputs.in2, neuron);

  socket.on('set', function(msg) {
    inputs[msg.id].hold({id: 'const', signal: M.matrix(msg.value)});
  })

  socket.emit('neurons', {
    neurons: [
      {id: 'singleton'},
      {id: 'in1'},
      {id: 'in2'},
    ]
  })

});
var subscribe = function(fromNeuron, toNeuron) {
  fromNeuron.subscribe({id: toNeuron.id, location: 'http://127.0.0.1:' + toNeuron.options.port});
}

var connect = function(n1, n2) {
  this.subscribe(n1, n2);
  this.subscribe(n2, n1);
}


App.set('views', __dirname + '/../views')
App.set('view engine', 'jade');
App.engine('jade', require('jade').__express);

App.get('/', function(req, res) {
  res.render('singleton');
})

Http.listen(3000, function(){
  console.log('listening on *:3000');
});


