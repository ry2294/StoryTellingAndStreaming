var express = require('express'); // Handles HTTP requests Eg: GET, PUT etc.
var Twitter = require('twitter'); // Handles connecting with twitter streaming api
var path = require("path"); // Manipulates file path names
var redis = require("redis"); // Library of redis methods
var clientRedis = redis.createClient(); // Creating a redis client instance

/*
This applicaiton server handles only HTTP GET Request for URL localhost:5000/ and sends the home.html back to the client browser. 
*/
var app = express();
var router = express.Router();
router.get('/', function(req, res) {
  res.sendfile(path.join(__dirname + '/home.html'));
});

router.get('/histogram', function(req, res) {
    buildHistogram(res);
});

router.get('/entropy', function(req, res) {
    entropy(res);
});

router.get('/probability', function(req, res) {
    probability(req, res);
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
This method takes in a rawtweet from the twitter stream which contains information about the tweet. It extracts relevant infromation such as username, tweet text, user geo location and tweet source. It publishes this information to all clients connected to the server by emitting in the web socket on tweet channel. All clients who are subscribed to this channel will recieve this extracted tweet data to display. We then identify the city from which the tweet is created. Finally, we increment the counter for the city by one in redis.
*/
var processTweet = function(rawTweet) {
    if(rawTweet.place != null && rawTweet.place.name != null && rawTweet.user != null && rawTweet.user.name != null 
        && rawTweet.text!= null && rawTweet.source != null) {
            var tweet = "<p>";
            tweet += "name: " + rawTweet.user.name + "<br>";
            tweet += "place: " + JSON.stringify(rawTweet.place.name) + "<br>";
            tweet += "source: " + rawTweet.source + "<br>";
            tweet += "tweet: " + rawTweet.text + "<br>";
            tweet += "</p>";
            io.emit('tweet', tweet); // emits tweet to all the websockets
            clientRedis.incr(rawTweet.place.name);
        }
};

var probability = function(req, res) {
    console.log("parameters = " + req.query.city);
    if(req.query != null && req.query.city == null) {
        res.status(501).send("Invalid City").end();
        return;
    } else {
        clientRedis.keys("*", function(error, keys) {
            if(error) console.log("Error fetching keys = " + JSON.stringify(error));
            else {
                clientRedis.mget(keys, function(error, values) {
                    if(error) console.log("Error fetching values = " + JSON.stringify(error));
                    else {
                        var sum = 0;
                        for(var value of values) {
                            sum += parseInt(value);
                        }
                        clientRedis.get(req.query.city, function(error, value) {
                            if(error) console.log("Error fetching key = " + JSON.stringify(error));
                            else {
                                console.log("value = " + value);
                                var probability = parseInt(value) / sum;
                                return res.status(200).send(JSON.stringify(probability)).end();
                            }
                        });
                    }
                });
            }
        });
    }
};

var entropy = function(res) {
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else clientRedis.mget(keys, function(error, values) {
            if(error) console.log("Error fetching values = " + JSON.stringify(error));
            else {
                var sum = 0;
                for(var value of values) {
                    console.log("value = " + value + " log = " + Math.log(parseInt(value)));
                    sum += parseInt(value) * Math.log(parseInt(value));
                }
                res.status(200).send(JSON.stringify(sum)).end();
            }
        });
    });
}

/*

*/
var buildHistogram = function(res) {
    var histogram = {};
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else clientRedis.mget(keys, function(error, values) {
            if(error) console.log("Error fetching values = " + JSON.stringify(error));
            else {
                var sum = 0;
                console.log("values length = " + values.length);
                for(var value of values) {
                    sum += parseInt(value);
                    console.log(value);
                }
                for(var i = 0; i < keys.length; i++) {
                    console.log("value = " + values[i] + " sum = " + sum);
                    histogram[keys[i]] = parseInt(values[i]) / sum;
                }
                console.log(histogram);
                res.status(200).send(JSON.stringify(histogram)).end();
            }
        });
    });
};

/*
*/
var decrementer = function() {
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else {
            clientRedis.mget(keys, function(error, values) {
                if(error) console.log("Error fetching values = " + JSON.stringify(error));
                else {
                    for(var i = 0; i < keys.length; i++) {
                        if(parseInt(values[i]) > 1) clientRedis.decr(keys[i]);
                    }
                }
            });
        }
    });
};

/*
We call the decrementer method for every two seconds time interval.
*/
setInterval(decrementer, 1 * 2000);

/*
We call the Twitter streaming api with the filter on #hiring hashtag. So, this informs the streaming api that my application is only interested in tweets which contain the #hiring hastag. Then we call the processTweet function on each of the tweet we recieve.
*/
client.stream('statuses/filter', {track:'hiring'},function(stream){
    stream.on('data', processTweet);
});