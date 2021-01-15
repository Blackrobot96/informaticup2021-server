# LocalServer
## Docker image ready to go
Run `docker run -it -p 8081:8081 -e AGENTS=2 --rm robertkerzel/informaticup2021-server` anywhere in a command prompt like powershell or cmd. You can specify how many players will fit in your game by editing the `-e AGENTS=2` parameter. The Image will be downloaded from dockerhub. After it is successfully downloaded and has started you will see the message, that the server is listening to port 8081. You will now be able to connect to the game with an agent.
## Docker image build & push
After building with `npm run build` run `docker build --tag robertkerzel/informaticup2021-server .` and push it to dockerhub `docker push robertkerzel/informaticup2021-server`.
## Installation
Run `npm install` in the folder.

## Running the Server
Run `npm run start` to compile and launch the local server on port 8081.