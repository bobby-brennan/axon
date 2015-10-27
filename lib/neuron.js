var Express = require('express');
var Request = require('request');
var Async = require('async');
var M = require('mathjs');

var MAX_NORM = 10;
var DECAY_RATE = .2;
var ADJUST_RATE = .2;

var Neuron = module.exports = function(opts) {
  this.options = opts;
  this.id = opts.id;
  this.io = opts.io;
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
  this.log('CREATED', this.options);
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
  clearTimeout(self.timeout);
  self.timeout = null;
}
Neuron.prototype.play = function() {
  if (this.timeout) return;
  this.setTimeout(this.options.interval);
}
Neuron.prototype.setTimeout = function(ms) {
  var self = this;
  if (!ms) return;
  self.timeout = setTimeout(function() {
    self.maybeFire();
  }, ms);
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
  var trans = self.state.transforms[input.id];
  if (!trans) {
    trans = M.zeros(input.signal.size()[0], self.options.dimensions.hidden);
    var adders = M.random(trans._size, -1, 1);
    trans = M.add(trans, adders);
    self.state.transforms[input.id] = trans;
  }
  return M.multiply(input.signal, trans);
}

Neuron.prototype.adjustTransform = function(input, transformed) {
  var self = this;
  input.distance = self.getDistance(transformed);
  if (input.distance === 0) return;
  var trans = self.state.transforms[input.id];
  var maxTries = 5;
  var movementIncr = input.distance * 10 / maxTries;
  var newDist = input.distance + 1;
  var iter = 0;
  while(newDist > input.distance) {
    if (iter++ > maxTries) {
      self.log('error', 'couldn\'t upgrade!')
      self.state.transforms[input.id] = trans;
      break;
    }
    var movement = movementIncr * iter;
    var adders = M.random(trans._size, -movement, movement);
    self.state.transforms[input.id] = M.add(trans, adders);
    newDist = self.getDistance(self.transform(input));
  } 
}

Neuron.getDistance = function(v1, v2) {
  var dot = M.dot(v1, v2)
  var norm1 = M.norm(v1);
  var norm2 = M.norm(v2);
  if (norm1 === 0 || norm2 === 0) return 0;
  var sim = dot / (norm1 * norm2);
  var dist = -1 * sim;
  return (dist + 1) / 2;
}

Neuron.prototype.getDistance = function(vec) {
  if (M.norm(vec) === 0.0) return 1.0;
  return Neuron.getDistance(vec, this.state.hidden);
}

Neuron.prototype.signal = function(input) {
  var self = this;
  var norm = M.norm(input.signal);
  self.io.socket.emit('signal', {
    from: input.id,
    to: self.id,
    signal: input.signal._data,
    norm: norm,
    normalized: M.divide(input.signal, norm)._data,
    transforms: self.getTransforms(),
  })
  self.log('signal from', input.id)
  if (self.state.history.input.length > self.options.maxHistory) {
    self.state.history.input.shift();
  }
  var state = self.transform(input);

  if (!self.state.holding) {
    var contribState = M.multiply(state, ADJUST_RATE);
    var contribHidden = M.multiply(self.state.hidden, 1 - ADJUST_RATE);
    if (self.id !== 'output') self.log('update', self.state.hidden._data, state._data);
    self.state.hidden = M.add(contribState, contribHidden);
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
      //var translated = self.inverseTransform({id: sub.id, signal: signal});
      var translated = signal;
      Request.post(sub.location + '/signal', {
        json: {id: self.options.id, signal: translated._data},
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
  var nextFire = self.options.interval;
  if (norm > 1.0) {
    if (norm > MAX_NORM) {
      self.state.hidden = M.multiply(self.state.hidden, MAX_NORM / norm);
      norm = MAX_NORM;
    }
    nextFire = nextFire / norm;
    self.fire(self.state.hidden, function() {
      if (!self.state.holding) self.state.hidden = M.multiply(self.state.hidden, DECAY_RATE);
      self.setTimeout(nextFire);
      if (callback) callback();
    });
  } else {
    self.setTimeout(nextFire);
    if (callback) callback();
  }
}

Neuron.prototype.log = function(label) {
  var self = this;
  if (!global.verbose && !self.options.verbose) {
    if (!global.log) return;
    if (global.log.indexOf(label) === -1) return;
  };
  var args = Array.prototype.slice.call(arguments);
  args.unshift('    ' + this.id);
  console.log.apply(console, args)
}

Neuron.prototype.logHistory = function() {
  var self = this;
  self.log('history', self.state.history.input.map(function(h) {return {s: h.signal._data, d: h.distance}}));
}

Neuron.prototype.getTransforms = function() {
  var transforms = {};
  var self = this;
  for (var id in self.state.transforms) {
    transforms[id] = self.state.transforms[id]._data;
  }
  return transforms;
}
