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

/*
APIs that are exposed to the web browser or clients to fetch histogram, rate, entropy and probability related data. In total there are four apis for each of the data item.
*/
router.get('/rate', function(req, res) {rate(function(data) {res.send(JSON.stringify(data));});});
router.get('/histogram', function(req, res) {buildHistogram(function(data) {res.send(JSON.stringify(data));});});
router.get('/entropy', function(req, res) {entropy(function(data) {res.send(JSON.stringify(data));});});
router.get('/probability', function(req, res) {probability(req, res);});
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
This method takes in a rawtweet from the twitter stream which contains information about the tweet. It extracts relevant infromation such as username, tweet text, user geo location and tweet source. It publishes this information to all clients connected to the server by emitting in the web socket on tweet channel. All clients who are subscribed to this channel will recieve this extracted tweet data to display. We then identify the city from which the tweet is created. Finally, we create a key for the city in redis with value as 1 or increment the value of the city in redis if it already exists.
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

/*
probability method calcuates the probability of a tweet occuring at a city. This is being calculated by dividing the city's count with the sum of values of all the cities.
*/
var probability = function(req, res) {
    if(req.query != null && req.query.city == null) {
        res.status(501).send("Invalid City").end();
        return;
    } else {
        clientRedis.keys("*", function(error, keys) {
            if(error) console.log("Error fetching keys = " + JSON.stringify(error));
            else if(keys == null || keys.length == 0) return res.status(200).send(JSON.stringify(0)).end();
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

/*
entropy method calculates the total entropy of the distribution by multiplying each value of the city with its logarithmic value and summing up the products of all cities.
*/
var entropy = function(func) {
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else if(keys == null || keys.length == 0) return func(0);
        else clientRedis.mget(keys, function(error, values) {
            if(error) console.log("Error fetching values = " + JSON.stringify(error));
            else {
                var sum = 0;
                for(var value of values) {
                    sum += parseInt(value) * Math.log(parseInt(value));
                }
                func(sum);
            }
        });
    });
}

/*
buildHistogram method calculates for every city its histogram value by summing up all the values for all cities and dividing each value of the city with the total sum. Finally, we are returning a hashmap of cities along with their calculated values.
*/
var buildHistogram = function(func) {
    var histogram = {};
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else if(keys == null || keys.length == 0) return func(histogram);
        else clientRedis.mget(keys, function(error, values) {
            if(error) console.log("Error fetching values = " + JSON.stringify(error));
            else {
                var sum = 0;
                for(var value of values) {
                    sum += parseInt(value);
                }
                for(var i = 0; i < keys.length; i++) {
                    histogram[keys[i]] = parseInt(values[i]) / sum;
                }
                func(histogram);
            }
        });
    });
};

/*
We calculate the rate of the stream as the total sum of the values in the redis. However we consider those values which are greater than 2 because those values less than or equal to 2 are the existing ones which are not deleted.
*/
var rate = function(func) {
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else if(keys == null || keys.length == 0) return func(0);
        else {
            clientRedis.mget(keys, function(error, values) {
                if(error) console.log("Error fetching values = " + JSON.stringify(error));
                else {
                    var sum = 0;
                    for(var value of values) {
                        if(parseInt(value) > 2) sum += parseInt(value);
                    }
                    func(sum);
                }
            });
        }
    });
};

/*
decrementer method loops through all the keys stored in the redis database based on the keys. For each key which is mapped to a city, we decerement the value by one during periodic intervals of 2 seconds. We decrement only if the value of the key is greated than 2, because otherwise the value becomes less than or equal to one which makes the logarithm of the value as 0 which disturbs the entropy calculation.
*/
var decrementer = function() {
    clientRedis.keys("*", function(error, keys) {
        if(error) console.log("Error fetching keys = " + JSON.stringify(error));
        else if(keys == null || keys.length == 0) return;
        else {
            clientRedis.mget(keys, function(error, values) {
                if(error) console.log("Error fetching values = " + JSON.stringify(error));
                else {
                    for(var i = 0; i < keys.length; i++) {
                        if(parseInt(values[i]) > 2) clientRedis.decr(keys[i]);
                    }
                }
            });
        }
    });
};

/*
Emits rate and entropy of the stream to the clients. Also the method checks if the entropy value has breached the threshold. If so it sends alerts to all the clients connected.
*/
var emitStreamRateandEntropy = function() {
    rate(function(rate) {
        entropy(function(entropy) {
            var rateandentropy = "<p> rate = " + rate + 
                    " tweets per sec <br>" + 
                    " entropy = " + entropy + " </p>";
            io.emit('rateandentropy', rateandentropy);
            var thresholdEntropy = 400;
            var entropyandthreshold = "<p> Entropy = " + entropy + "<br>" + 
                    " Threshold Entropy = " + thresholdEntropy + " </p>";
            if(entropy > thresholdEntropy)
                io.emit('alert', entropyandthreshold);
        });
    });
};

/*
Emits histogram data to clients.
*/
var emitStreamHistogram = function() {
    buildHistogram(function(data) {
        console.log('histogram data = ' + JSON.stringify(data));
        io.emit('histogram', data);
    });
};

/*
We call the decrementer and emit methods periodically to decrement the values in redis and to emit data to the clients through websocket.
*/
setInterval(decrementer, 2000);
setInterval(emitStreamRateandEntropy, 1000);
setInterval(emitStreamHistogram, 5000);

/*
We call the Twitter streaming api with the filter on #hiring hashtag. So, this informs the streaming api that my application is only interested in tweets which contain the #hiring hastag. Then we call the processTweet function on each of the tweet we recieve.
*/
client.stream('statuses/filter', {track:'hiring'},function(stream){
    stream.on('data', processTweet);
});
