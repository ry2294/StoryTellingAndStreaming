var express = require('express'); // Handles HTTP requests Eg: GET, PUT etc.
var Twitter = require('twitter'); // Handles connecting with twitter streaming api
var path = require("path"); // Manipulates file path names
var redis = require("redis"); // Library of redis methods
var clientRedis = redis.createClient(); // Creating a redis client instance
var lastTimeStamp = 0; // tracks the last timestamp recorded
var rateThreshold = 5; // 5 tweets per second

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
            tweet += "name: " + rawTweet.user.name + "<br>";
            tweet += "tweet: " + rawTweet.text + "<br>";
            tweet += "geo: " + JSON.stringify(rawTweet.geo) + "<br>";
            tweet += "source: " + rawTweet.source + "<br>";
            tweet += "timestamp_ms: " + rawTweet.timestamp_ms;
            tweet += "</p>";
            io.emit('tweet', tweet); // emits tweet to all the websockets
            if(lastTimeStamp == 0) {
                lastTimeStamp = rawTweet.timestamp_ms;
            } else {
                var delta = rawTweet.timestamp_ms - lastTimeStamp;
                clientRedis.set(rawTweet.timestamp_ms, delta);
                clientRedis.expire(rawTweet.timestamp_ms, 10);
                lastTimeStamp = rawTweet.timestamp_ms;
            }
        }
};

// stream tweets of the entire world, process them and 
// publish it to all the web sockets connected to the server.
client.stream('statuses/filter', {track:'hiring'},function(stream){
    stream.on('data', processTweet);
});

function calculateStreamRate() {
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error faced while fetching keys = " + JSON.stringify(error));
        else {
            clientRedis.mget(keys, function(error, values) {
                if(error) console.log("Error faced while fetching values for given keys = " + JSON.stringify(error));
                else if(values == null || values.length <= 0) console.log("No values present");
                else {
                    var sum = 0;
                    for(var i = 0; i < values.length; i++) {
                        sum += parseInt(values[i]);
                    }
                    sum /= 1000;

                    var rate = "<p> rate = " + values.length / sum + 
                    " tweets per sec <br> sum of deltas = " + sum + 
                    " secs <br> Total timestamps = " + values.length + 
                    " tweets <br> Redis Key Expiration Time = 10 secs </p>";
                    io.emit('rate', rate);
                    if(rateThreshold < (values.length / sum)) {
                        var ratealert = "<p> Alert <br> Threshold breach rate: " + values.length / sum + 
                        " <br> Threshold value: " + rateThreshold + "</p>";
                        io.emit('alert', ratealert);
                        console.log(ratealert);
                    }
                }
            });
        }
    });
}
setInterval(calculateStreamRate, 10 * 1000);