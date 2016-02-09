import tweepy

auth = tweepy.OAuthHandler("23wysyPCMUjcJCuUTX9HKDIVK", "jyk4XkjVeM239dzzOanfB2ab8kb9ePMl4u1FeF04pzsuXugNoc")
auth.set_access_token("3949975300-HiLLjf8GwbmG93XBf7qJqXGKIvFu0k1edA89jgW", "46lrwJCm3CgxFnv8tigQEbQRUJkpmTOz9SNodoSHbwqVp")

class TweetStreamListener(tweepy.StreamListener):
    def on_status(self, tweet):
        print(tweet.text)

tweetStreamListener = TweetStreamListener()
tweetStream = tweepy.Stream(auth = auth, listener=tweetStreamListener)
tweetStream.filter(locations=[-85,30,-84,31])