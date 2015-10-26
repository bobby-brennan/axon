var Express = require('express');
var Request = require('request');
var Async = require('async');
var M = require('mathjs');

var Neuron = module.exports = function(opts) {
  this.options = opts;
  this.id = opts.id;
  this.options.interval = this.options.interval || 1000;
  var dim = this.options.dimensions = this.options.dimensions || {};
  dim.hidden = dim.hidden || 10;
  this.setup();
  this.state = {
    history: {
      input: [],
      output: [],
    },
    subscribers: [],
    hidden: M.zeros(dim.hidden),
    transforms: {},
  };
}

Neuron.prototype.setup = function() {
  var self = this;
  var App = Express();
  App.use(require('body-parser').json());

  App.post('/:action', function(req, res) {
    if (req.body.signal) req.body.signal = M.matrix(req.body.signal);
    self[req.params.action](req.body);
    res.end();
  })
  App.listen(self.options.port);
  self.play();
}

Neuron.prototype.pause = function() {
  var self = this;
  clearInterval(self.timeout);
}

Neuron.prototype.play = function() {
  var self = this;
  if (!self.options.interval) return;
  self.timeout = setInterval(function() {
    self.maybeFire();
  }, self.options.interval);
}

Neuron.prototype.subscribe = function(sub) {
  this.state.subscribers.push(sub);
}
Neuron.prototype.unsubscribe = function(id) {
  var self = this;
  self.state.subscribers = self.state.subscribers.filter(function(sub) {
    return sub.id !== id;
  })
}

Neuron.prototype.transform = function(input) {
  var self = this;
  var trans = self.state.transforms[input.id] =
      self.state.transforms[input.id] || M.ones(input.signal.size()[0], self.options.dimensions.hidden);
  return M.multiply(input.signal, trans);
}

Neuron.prototype.adjustTransform = function(input, transformed) {
  var self = this;
  input.distance = self.getDistance(transformed);
  var trans = self.state.transforms[input.id];
  
  var movement = input.distance * 2;
  var newDist = input.distance + 1;
  var iter = 0;
  while(movement > 0 && newDist > input.distance) {
    ++iter;
    console.log('iter', iter);
    var adders = M.random(trans._size, -movement, movement);
    self.state.transforms[input.id] = M.add(trans, adders);
    newDist = self.getDistance(self.transform(input));
    if (iter > 10) break;
  } 
}

Neuron.prototype.getDistance = function(vec) {
  var self = this;
  var dot = M.dot(vec, this.state.hidden);
  var vecNorm = M.norm(vec);
  var hidNorm = M.norm(this.state.hidden);
  if (hidNorm === 0 || vecNorm === 0) return 0;
  var sim = dot / (vecNorm * hidNorm);
  var dist = -1 * sim;
  return (dist + 1) / 2;
}

Neuron.prototype.signal = function(input) {
  var self = this;
  self.log('signal', input.id, input.signal._data);
  if (self.state.history.input.length > self.options.maxHistory) {
    self.state.history.input.shift();
  }
  var state = self.transform(input);

  if (!self.state.holding) {
    var contribState = M.dotMultiply(state, .5);
    var contribHidden = M.dotMultiply(self.state.hidden, .5);
    //if (self.id !== 'output') self.log('update', self.state.hidden._data, state._data);
    self.state.hidden = M.add(contribState, contribHidden);
    //if (self.id !== 'output') self.log('updone', self.state.hidden._data);
  }
  
  self.adjustTransform(input, state);
  self.state.history.input.push(input);
  if (self.state.holding) self.log('dist', input.distance);
}

Neuron.prototype.hold = function(input) {
  var self = this;
  self.state.holding = input.id;
  self.state.hidden = input.signal;
  self.log('holding', self.state.hidden);
}

Neuron.prototype.release = function() {
  this.state.holding = false;
}

Neuron.prototype.probe = function(input) {
  var self = this;
  var state = self.transform(input);
  var dist = self.getDistance(state);
  return dist;
}

Neuron.prototype.fire = function(signal, callback) {
  var self = this;
  this.state.history.output.push(signal);
  if (this.state.history.output.length > this.options.maxHistory) {
    this.state.history.output.shift();
  }
  Async.parallel(self.state.subscribers.map(function(sub) {
    return function(acb) {
      Request.post(sub.location + '/signal', {
        json: {id: self.options.id, signal: signal._data},
      }, acb);
    }
  }), function(err) {
    if (err) throw err;
    if (callback) callback();
  })
}

Neuron.prototype.maybeFire = function(callback) {
  var self = this;
  var norm = M.norm(self.state.hidden);
  if (norm > 1.0) {
    //self.log('fire', self.state.hidden._data);
    self.fire(self.state.hidden, callback);
    if (!self.state.holding) self.state.hidden = M.multiply(self.state.hidden, .5);
  }
}

Neuron.prototype.log = function(label) {
  var self = this;
  if (!global.verbose && !self.options.verbose) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.id);
  console.log.apply(console, args)
}

Neuron.prototype.logHistory = function() {
  var self = this;
  self.log('history', self.state.history.input.map(function(h) {return {s: h.signal._data, d: h.distance}}));
}

