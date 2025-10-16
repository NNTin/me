https://vegeta897.medium.com/d-zone-2015-retrospective-3671b0f9306c

I joined Discord in August 2015. One of the first project I experienced was d-zone.

[November 2018](https://github.com/d-zone-org/d-zone/pull/65) I gathered some technical knowhow and contributed to the project by offering a one-click deployment to Heroku.

Shortly afterwards I started my work life. The software engineering world has changed quite drastically. Because the use of AI tools in my work life is quite limited (gotta protect sensitive data) I want to expand my AI horizont by taking on a bigger project.

I re-discovered d-zone again and think it is a suitable project for my AI endeavor.

D-zone is divided into two components: a server and a client. The client is a static single page app. It has the majority of the logic.  
The server is based Eris. The library is no longer well-maintained and it is not easy to use.

This is why I rewrite the server. This way it is possible to integrate d-zone in more libraries.

My end-goal is to write a Cog for Red-DiscordBot. But to get there I have to solve some technical difficulties.

## Understanding the websocket communication

In order to insert as the new websocket server I need to understand the websocket communication between the old server and client first.

My first technical insight how the websocket communication works was swiftly solved by the prompt:

```
Can you look at websock.js and main.js and tell me the websocket interface between the server and client?
I'm interested in the payload that is needed when a client connects and the payload when events are emitted.
```

```
Can you create me a websocket server in Python with mock data that simulates the websocket server? Create a new folder python and put the files there.

When the mock sends the message it is not received by the client. Can you adjust the mock so it sends the message correctly?

I cannot change the client. Can you do the change in the server?



The websocket server is utilized in websock.js. The clients are implemented in main.js and mock_websocket_server.py. Based on these 3 files can you create me the websocket api docs as a markdown file and save it in root?


Can you write me a mock websocket client in python and place the file in the folder python? The address it connects to is ws://192.168.178.1:3000. I want it to log all the communication.

in mock_websocket_server can you update the mock server data? I tested with a mock client on a real websocket server and received the following data:
{"type":"server-list","data":{"232769614004748288":{"id":"DS","name":"Dev Server"},"482241773318701056":{"id":"t","name":"test","default":true}}}



in mock_websockert_server.py can you update the get_users()? I tested with a mock client on a real websocket server and received the following data:
{"type":"server-join","data":{"users":{"77488778255540224":{"id":"77488778255540224","username":"b6d","status":"online","roleColor":"#9b59b6"},"235148962103951360":{"id":"235148962103951360","username":"Carl-bot","status":"online","roleColor":false},"301022161391452160":{"id":"301022161391452160","username":"Music","roleColor":false},"484294583505649664":{"id":"484294583505649664","username":"MeepoDev","roleColor":false},"492349095365705738":{"id":"492349095365705738","username":"Dissentin","status":"online","roleColor":false},"506432803173433344":{"id":"506432803173433344","username":"Soundboard","roleColor":false},"518858360142168085":{"id":"518858360142168085","username":"Red-kun","roleColor":false},"620253379083370516":{"id":"620253379083370516","username":"Pastecord","roleColor":false}},"request":{"server":"default"}}}



in mock_websocket_server.py can you send a message every 3 seconds? I tested with a mock client on a real websocket server and received the following data:
{"type":"message","server":"482241773318701056","data":{"uid":"77488778255540224","message":"hello","channel":"527964146659229701"}}


```

```
I want you to create me the following file structure
d_back/
├── d_back/
│ ├── init.py
│ └── server.py # Your websocket logic here
├── tests/
│ └── test_server.py # Optional tests
├── pyproject.toml # Modern build system
├── README.md # Project description
├── LICENSE # Optional but recommended
└── .gitignore # If using git


I added requirements.txt. Can you updated the dependencies that is needed when installing the python package?

I updated server.py. How would I build the python package and test it locally?

I would like to publish this package. Can you help me publish the package? I need a pipeline that automatically publishes it for me to PyPi


with the publish.yml I can tag a version. How do I make the version match with the version in pyproject.toml?



```
