var express = require('express'); // Handles HTTP requests Eg: GET, PUT etc.
var Twitter = require('twitter'); // Handles connecting with twitter streaming api
var path = require("path"); // Manipulates file path names
var redis = require("redis"); // Library of redis methods
var clientRedis = redis.createClient(); // Creating a redis client instance
var lastTimeStamp = 0; // tracks the last timestamp recorded
var rateThreshold = 5; // 5 tweets per second

/*
This applicaiton server handles only HTTP GET Request for URL localhost:5000/ and sends the home.html back to the client browser. 
*/
var app = express();
var router = express.Router();
router.get('/', function(req, res) {
  res.sendfile(path.join(__dirname + '/home.html'));
});

/*
Creates the server and listens on port 5000. We are also logging this information once the server gets created.
*/
app.use('/', router);
var http = require('http').Server(app);
var server = http.listen(process.env.PORT || 5000, function(){
  console.log('App listening at http://%s:%s', server.address().address, server.address().port);
});

/*
Creates web socket using socket.io whenever a user connects to the server. We are logging messages whenever a user gets connected or disconnected from the server for debugging purposes.
*/
var io = require('socket.io').listen(server);
io.on('connection', function(socket){
  console.log('user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

/*
Create twitter client object which takes the authentication information for authenticating and authorizing our application for listening to twitter stream.
*/
var client = new Twitter({
    consumer_key: "23wysyPCMUjcJCuUTX9HKDIVK",
    consumer_secret: "jyk4XkjVeM239dzzOanfB2ab8kb9ePMl4u1FeF04pzsuXugNoc",
    access_token_key: "3949975300-HiLLjf8GwbmG93XBf7qJqXGKIvFu0k1edA89jgW",
    access_token_secret: "46lrwJCm3CgxFnv8tigQEbQRUJkpmTOz9SNodoSHbwqVp"
});

/*
This method takes in a rawtweet from the twitter stream which contains informaiton about the tweet. It extracts relevant infromation such as username, tweet text, user geo location, tweet source, and time stamp of the tweet. It publishes this information to all clients connected to the server by emitting in the web socket on tweet channel. All clients who are subscribed to this channel will recieve this extracted tweet data to display. Then we calculate the delta for this tweet from its timestamp and the last recorded timestamp. Finally, we push this information into redis with the key as this tweet's timestamp and value as the delta.
*/
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

/*
We call the Twitter streaming api with the filter on #hiring hashtag. So, this informs the streaming api that my application is only interested in tweets which contain the #hiring hastag. Then we call the processTweet function on each of the tweet we recieve.
*/
client.stream('statuses/filter', {track:'hiring'},function(stream){
    stream.on('data', processTweet);
});

/*
This method calculates the rate of a stream during a partucular time interval by calculating the total number of deltas present in redis and dividing it by the sum of all the deltas. This gives us the rate of tweets per second. Finally we check whether this rate has crossed the threshold value. If it breached the threshold value then we alert the user. Whenever this happens we can interpret that a particular company or a group of companies are conducting a hiring event at a large scal for multiple positions. I am making this interpretaiton after observing the stream for a week. My observation is that whenever a company or a group of companies announces a mass hiring event, or a career fair has been announced the rate of the stream breaches the threshold value.
*/
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
                    
                    // We are converting milli seconds into seconds by dividing by 1000
                    sum /= 1000;
                    
                    /* We compute the rate of the stream which is number of tweets per second as number of deltas divided by the sum of all the deltas. We emit this rate information through the websockets to all the clients listening on "rate" channel.
                    */
                    var rate = "<p> rate = " + values.length / sum + 
                    " tweets per sec <br> sum of deltas = " + sum + 
                    " secs <br> Total timestamps = " + values.length + 
                    " tweets <br> Redis Key Expiration Time = 10 secs </p>";
                    io.emit('rate', rate);
                    /*
                    We then check whether the rate of this time interval is more than the rate threshold. If it breaches the threshold we emit an alert to the users through websockets listening on "alert" channel.
                    */
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

/*
We call the calculateStreamRate method for every 10 seconds time interval.
*/
setInterval(calculateStreamRate, 10 * 1000);