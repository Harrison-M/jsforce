var Faye = require('faye'),
    http = require('http');

if (Faye.Transport.NodeHttp) {
  Faye.Transport.NodeHttp.prototype.batching = false; // prevent streaming API server error
}

var fayeServer = new Faye.NodeAdapter({mount: '/cometd/30.0/', timeout: 90});
var server = http.createServer();
var port = process.env.STREAM_PORT || 3124;

var auth = '';
var shouldError = false;

// Start up proxy server
fayeServer.attach(server);

// Override the faye request handler to insert errors
var requestHandler = fayeServer.handle;
fayeServer.handle = function insertError(req, res) {
  console.log(req.url);
  auth = req.headers.authorization;
  console.log(req.headers.authorization);
  if (shouldError) {
    shouldError = false;
    res.statusCode = 500;
    return res.end();
  }
  shouldError = true;
  requestHandler.apply(fayeServer, arguments);
};

server.listen(port, function() {
  console.log('Stream listening on ' + port);
  var salesforceClient = new Faye.Client('https://cs16.salesforce.com/cometd/30.0', {});
  salesforceClient.on('error', console.error);
  fayeServer.on('subscribe', function(clientId, channel) {
    console.log('subscribed: ' + channel);
    salesforceClient.setHeader('Authorization', auth);
    console.log(auth);
    salesforceClient.subscribe(channel, function(message) {
      console.log(message);
      fayeServer.getClient().publish(channel, message);
    });
  });
});
