//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
// var socketio = require('socket.io');
var express = require('express');
var bodyParser = require('body-parser');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
// var io = socketio.listen(server);

router.use(bodyParser.json()); // for parsing application/json
router.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
router.use(express.static(path.resolve(__dirname, 'client')));
var messages = [];
var sockets = [];

// io.on('connection', function (socket) {
//     messages.forEach(function (data) {
//       socket.emit('message', data);
//     });

//     sockets.push(socket);

//     socket.on('disconnect', function () {
//       sockets.splice(sockets.indexOf(socket), 1);
//       updateRoster();
//     });

//     socket.on('message', function (msg) {
//       var text = String(msg || '');

//       if (!text)
//         return;

//       socket.get('name', function (err, name) {
//         var data = {
//           name: name,
//           text: text
//         };

//         broadcast('message', data);
//         messages.push(data);
//       });
//     });

//     socket.on('identify', function (name) {
//       socket.set('name', String(name || 'Anonymous'), function (err) {
//         updateRoster();
//       });
//     });
//   });

// function updateRoster() {
//   async.map(
//     sockets,
//     function (socket, callback) {
//       socket.get('name', callback);
//     },
//     function (err, names) {
//       broadcast('roster', names);
//     }
//   );
// }

// function broadcast(event, data) {
//   sockets.forEach(function (socket) {
//     socket.emit(event, data);
//   });
// }

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});

// create the reference to google nodejs
var storage = require('@google-cloud/storage');

// authenticate
var gcs = storage({
  projectId: 'LgUrBikeDev',
  keyFilename: __dirname + '/keys.json'
});

// load the bucket
var bucket = gcs.bucket('lgurbikedev.appspot.com');

router.all('/getWorld', function(req, res) {
  // load the world asked for
  var name = req.param('worldName', undefined);
  
  console.log('req body',req.body);
  
  if (!name && req.body) {
    name = req.body['worldName']||undefined;
  }
  
  if (!name) {
    res.status(400).json({'error' : 'no world name provided to load'});
    res.end();
  } else {
    var file = bucket.file(name);
    // download the file content
    file.download(function(err, content) {
      if (err) {
        console.error('google error: ' + err);
        res.status(500).json({'error' : 'error downloading file from google'});
        res.end();
      } else {
        content = JSON.parse(content.toString());
        // download the file metadata
        file.getMetadata(function(err, metadata, apiResponse) {
          if (err) {
            console.error('google error: ' + err);
            res.status(500).json({'error' : 'error downloading metadata from google'});
            res.end();
          } else {
            var data = {
              'XZData' : content.XZData,
              'VoxelData' : content.VoxelData,
              'Version' : metadata.generation
            };
            // return file data and metadata
            res.status(200).json({'data' : data});
            res.end();
          }
        });
      }
    });
  }
});

router.all('/updateWorld', function(req, res) {
  var name = req.param('worldName', undefined);
  var data = req.param('worldData', undefined);
  var version = req.param('worldVersion', undefined);
  
  if (!name && req.body) {
    name = req.body['worldName']||undefined;
    data = req.body['worldData']||undefined;
    version = req.body['worldVersion']||undefined;
  }
  
  if (!name || !data || version === undefined) {
    res.status(400).json({'error' : 'missing world name/data/version'});
    res.end();
  } else {
    var file = bucket.file(name,{'generation':version});
    // open write stream (hoping this is where we specify the condition)
    var returnMeta = {};
    var stream = file.createWriteStream({
      resumable : false
    });
    stream.on('finish', function() {
      res.status(200).json({'data' : {'Version':returnMeta.generation||'0'}});
      res.end();
    });
    stream.on('response', function(resp) {
      if (resp && resp.body) {
        returnMeta = JSON.parse(resp.body);
      }
    });
    stream.on('error', function(err) {
      console.error('google update error: ' + err);
      res.status(500).json({'error' : 'google returned error'});
      res.end();
    });
    stream.setDefaultEncoding('utf8');
    stream.write(data);
    stream.end();
  }
});
