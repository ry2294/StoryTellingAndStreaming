var express = require('express'); // Handles HTTP requests Eg: GET, PUT etc.
var Twitter = require('twitter'); // Handles connecting with twitter streaming api
var path = require("path"); // Manipulates file path names

// create server and handle the HTTP GET request for homepage
var app = express();
var router = express.Router();
router.get('/', function(req, res) {
  res.sendfile(path.join(__dirname + '/home.html'));
});
app.use('/', router);
var http = require('http').Server(app);
var server = http.listen(process.env.PORT || 5000, function(){
  console.log('App listening at http://%s:%s', server.address().address, server.address().port);
});

// create web socket when a user connects to the server
var io = require('socket.io').listen(server);
io.on('connection', function(socket){
  console.log('user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

// create twitter client for streaming tweets
var client = new Twitter({
    consumer_key: "23wysyPCMUjcJCuUTX9HKDIVK",
    consumer_secret: "jyk4XkjVeM239dzzOanfB2ab8kb9ePMl4u1FeF04pzsuXugNoc",
    access_token_key: "3949975300-HiLLjf8GwbmG93XBf7qJqXGKIvFu0k1edA89jgW",
    access_token_secret: "46lrwJCm3CgxFnv8tigQEbQRUJkpmTOz9SNodoSHbwqVp"
});

// process a tweet raw data and extract relevant information
var processTweet = function(rawTweet) {
    if(rawTweet.geo != null && rawTweet.user != null && rawTweet.user.name != null 
        && rawTweet.text!= null && rawTweet.source != null) {
            var tweet = "<p>";
            tweet += "{name: " + rawTweet.user.name + "<br>";
            tweet += "tweet: " + rawTweet.text + "<br>";
            tweet += "geo: " + JSON.stringify(rawTweet.geo) + "<br>";
            tweet += "source: " + rawTweet.source + "}";
            tweet += "</p>";
            console.log(tweet); // outputs tweet data onto stdout
            io.emit('tweet', tweet); // emits tweet to all the websockets
        }
};

// stream tweets of the entire world, process them and 
// publich it to all the web sockets connected to the server.
client.stream('statuses/filter', {'locations':'-180,-90,180,90'},function(stream){
    stream.on('data', function(data) {
        processTweet(data);
    });
});