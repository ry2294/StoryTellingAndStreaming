# Stream Rate: Assignment - 2 (Rakesh Yarlagadda - ry2294)
For this assignment I have selected Twitter Stream filtered on #Hiring hashtag. So, my application will recieve tweets which contain #Hiring hastag. The server.js serves as the nodejs server application which listens to the Twitter api, processes each tweet, records its timestamp, pushes it to redis with its delta, queries redis for every 10secs time interval to calculate the stream rate and emits alerts to users connected to the server. More explanaiton of the server.js is present in the comments in that file itself. The home.html page is served to the user which displays the tweets recieved by the application, the rate of the stream for each 10secs time interval and finally the alerts recieved from the server whenever the rate threshold value is breached by the Twitter stream.

### Commands
To run this application, download the assignment-2 folder and run the below commands.

1. npm install // installs the node modules required

2. install redis-server and start redis

3. node server.js // runs the server and starts consuming tweets

4. open url: localhost:8080/ in browser
