var Twitter = require('twitter');
var _ = require('underscore');

var client = new Twitter({
    consumer_key: "23wysyPCMUjcJCuUTX9HKDIVK",
    consumer_secret: "jyk4XkjVeM239dzzOanfB2ab8kb9ePMl4u1FeF04pzsuXugNoc",
    access_token_key: "3949975300-HiLLjf8GwbmG93XBf7qJqXGKIvFu0k1edA89jgW",
    access_token_secret: "46lrwJCm3CgxFnv8tigQEbQRUJkpmTOz9SNodoSHbwqVp"
});

client.stream('statuses/filter', {'locations':'-180,-90,180,90'},function(stream){
    stream.on('data', function(data) {
        if(data.geo != null && data.user != null && data.user.name != null && data.text!= null &&
        data.source != null && data.entities != null && data.entities.hashtags != null && data.entities.hashtags.length > 0) {
            var tweet = {};
            tweet.username = data.user.name;
            tweet.text = data.text;
            tweet.geo = data.geo;
            //tweet.hashtags = data.entities.hashtags;
            tweet.source = data.source;
            console.log(tweet);
        }
    });
});