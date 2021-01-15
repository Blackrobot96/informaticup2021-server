const WebSocketServer = require('websocket').server;
const http = require('http');
const delay = ms => new Promise(res => setTimeout(res, ms));
const AGENT_NUMBER = process.env.AGENTS || 8;
console.log(`The games have been configured to fit ${AGENT_NUMBER} players.`);
interface SpeedAnswer {
    action: SpeedAction;
}

enum SpeedAction {
    NOTHING = "change_nothing",
    SPEED_UP = "speed_up",
    SLOW_DOWN = "slow_down",
    TURN_LEFT = "turn_left",
    TURN_RIGHT = "turn_right"
}

enum SpeedDirection {
    UP = "up",
    DOWN = "down",
    LEFT = "left",
    RIGHT = "right"
}

class SpeedPlayer {
    x: number;
    y: number;
    direction: SpeedDirection;
    speed: number;
    active: boolean;
}

class SpeedData {
    width: number;
    height: number;
    cells: number[][];
    players: { [key: number]: SpeedPlayer };
    you: number;
    running: boolean;
    deadline: string;
}

interface ServerClients {
    connection: any;
    action: SpeedAction | null;
}

var clients = [];
var server = http.createServer(function (request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(8081, function () {
    console.log((new Date()) + ' Server is listening on port 8081');
});

var wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

let currentGame: SpeedGame = null;
wsServer.on('request', async function (request) {
    if (currentGame == null || currentGame.isRunning)
        currentGame = new SpeedGame();
    var connection = request.accept(null, null);
    currentGame.addPlayer(connection);
});

process.on('SIGINT', function() {
    console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
    process.exit(1);
});

class ServerPlayer {
    x: number;
    y: number;
    direction: SpeedDirection;
    speed: number = 1;
    active: boolean = true;
    connection: any;
    action: SpeedAction = null;

    constructor(connection: any, x: number, y: number, direction: SpeedDirection) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.connection = connection;
    }

    close() {
        this.connection.close();
    }

    sendGameData(data) {
        this.connection.send(JSON.stringify(data));
    }

    doAction(action: SpeedAction) {
        this.action = action;
        this.processAction();
    }

    private processAction() {
        switch (this.action) {
            case SpeedAction.SPEED_UP:
                if (this.speed < 10)
                    this.speed++;
                break;

            case SpeedAction.SLOW_DOWN:
                if (this.speed > 1)
                    this.speed--;
                break;

            case SpeedAction.TURN_LEFT:
                switch (this.direction) {
                    case SpeedDirection.UP: this.direction = SpeedDirection.LEFT; break;
                    case SpeedDirection.LEFT: this.direction = SpeedDirection.DOWN; break;
                    case SpeedDirection.DOWN: this.direction = SpeedDirection.RIGHT; break;
                    case SpeedDirection.RIGHT: this.direction = SpeedDirection.UP; break;
                }
                break;

            case SpeedAction.TURN_RIGHT:
                switch (this.direction) {
                    case SpeedDirection.UP: this.direction = SpeedDirection.RIGHT; break;
                    case SpeedDirection.LEFT: this.direction = SpeedDirection.UP; break;
                    case SpeedDirection.DOWN: this.direction = SpeedDirection.LEFT; break;
                    case SpeedDirection.RIGHT: this.direction = SpeedDirection.DOWN; break;
                }
                break;
            case SpeedAction.NOTHING:
                break;
        }
    }
}

class SpeedGame {
    players: ServerPlayer[] = [];
    width: number = 50;
    height: number = 50;
    cells: number[][] = this.initializeCells(this.width, this.height);
    isRunning: boolean = false;
    jumpCounter = 0;

    initializeCells(width, height): number[][] {
        let data = [];
        for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < width; x++) {
                row[x] = 0;
            }
            data[y] = row;
        }
        return data;
    }

    closeGame() {
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            let data = this.getGameData()
            data.you = i+1;
            player.sendGameData(data);
            player.close();
        }
        this.cells = null;
        this.players = null;
        delete this.cells;
        delete this.players;
    }

    addPlayer(connection): ServerPlayer {
        if (this.isRunning)
            return null;
        let x: number, y: number;

        do {
            x = Math.floor(Math.random() * Math.floor(this.width));
            y = Math.floor(Math.random() * Math.floor(this.height));
        } while (this.cells[y][x] !== 0)
        
        let dir: SpeedDirection;
        switch (Math.floor(Math.random() * Math.floor(4))) {
            case 1: dir = SpeedDirection.DOWN; break;
            case 2: dir = SpeedDirection.UP; break;
            case 3: dir = SpeedDirection.LEFT; break;
            case 4: dir = SpeedDirection.RIGHT; break;
            default: dir = SpeedDirection.DOWN; break;
        }

        let player = new ServerPlayer(connection, x, y, dir)
        let you = this.players.push(player) + 1;
        let scope = this;
        connection.on('message', function (message) {
            try {
                let action: SpeedAnswer = JSON.parse(message.utf8Data);
                let valid = player.doAction(action.action);
                scope.checkRoundAction();
            }
            catch (ex) {
                connection.drop(1007, ex);
                console.log(ex);
            }
        });

        this.cells[y][x] = you;

        if (this.players.length >= AGENT_NUMBER) {
            this.isRunning = true;
            for (let i = 0; i < this.players.length; i++) {
                let player = this.players[i];
                let data = this.getGameData()
                data.you = i+1;
                player.sendGameData(data);
            }            
        }
    }

    checkRoundAction() {
        let allDone = true;
        this.players.forEach(player => {
            allDone = allDone && (player.active == false || player.action != null);
        });

        if(allDone)
            this.processRound();
    }
    
    processRound() {
        this.jumpCounter = (this.jumpCounter + 1) % 6;
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            if (player.active) {
                player.action = null;
                for (let step = 0; step < player.speed; step++) {
                    
                    switch (player.direction) {
                        case SpeedDirection.UP: player.y--; break;
                        case SpeedDirection.DOWN: player.y++; break;
                        case SpeedDirection.LEFT: player.x--; break;
                        case SpeedDirection.RIGHT: player.x++; break;
                    }
                    if (this.jumpCounter == 0 && step < player.speed - 2)
                    {
                        //jumping
                    } else {
                        if (player.y < 0 || player.y >= this.height || player.x < 0 || player.x >= this.width) {
                            player.active = false;
                        } else if (this.cells[player.y][player.x] !== 0){
                            player.active = false;
                            this.cells[player.y][player.x] = -1;
                        } else {
                            this.cells[player.y][player.x] = i+1;
                        }
                    }
                }
            }
        }
        let running = false;
        this.players.forEach(player => {
            if (player.active) {
                if (this.cells[player.y][player.x] == -1){
                    player.active = false;
                } else
                    running = true;
            }
        })
        
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            let data = this.getGameData()
            data.you = i+1;
            player.sendGameData(data);
        }

        if (running == false)
            this.closeGame();
    }

    getGameData(): SpeedData {
        let data = new SpeedData();
        data.width = this.width;
        data.height = this.height;
        data.cells = this.cells;
        data.players = {};
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            let playerData = new SpeedPlayer();
            playerData.active = player.active;
            playerData.direction = player.direction;
            playerData.x = player.x;
            playerData.y = player.y;
            playerData.speed = player.speed;
            data.players[i+1] = playerData;
        }
        data.deadline = "heute";

        return data;
    }
}