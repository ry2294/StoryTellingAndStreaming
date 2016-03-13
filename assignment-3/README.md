# Stream Rate: Assignment - 3 (Rakesh Yarlagadda - ry2294)
In this assignment, I have selected the Twitter stream with a filter on #hiring hashtag. So, all the tweets contaning #hiring hashtag are processed where its geo location of the city (from which the tweet is created) is extracted and stored in the redis. Now, we have a distribution of number of tweets created over a set of cities along with their counts stored in redis. For this data set I have exposed multiple apis which are below. I have also created web page which shows the histogram of tweet data distribution across the cities. I have done this using Plotly.js library which takes the histogram hashmap data and plots a histogram graph. More about the individual methods and apis are present in the comments of the server.js file.

/rate (which gives the rate of the stream) 

/probability (which takes city name as inut and gives )

/entropy (which returns the entropy of the system)

/histogram (which returns the hashmap that represents the histogram)

### Commands
To run this application, download the assignment-2 folder and run the below commands.

1. npm install // installs the node modules required

2. install redis-server

3. redis-server // to start redis

3. node server.js // runs the server and starts consuming tweets

4. open url: localhost:8080/ in browser
