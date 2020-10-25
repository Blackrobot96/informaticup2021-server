const WebSocketServer = require('websocket').server;
const http = require('http');
const delay = ms => new Promise(res => setTimeout(res, ms));

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

interface SpeedPlayer {
    x: number;
    y: number;
    direction: SpeedDirection;
    speed: number;
    active: boolean;
}

interface SpeedData {
    width: number;
    height: number;
    cells: number[][];
    players: { [key: number]: SpeedPlayer };
    you: number;
    running: boolean;
    deadline: string;
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

async function startGame() {
    await delay(10000);
    gameState.running = true;
    sendRoundData();
    while (gameState.running) {
        await delay(3000);
        processRound();
        sendRoundData();
    }
}

function sendRoundData() {
    clients.forEach(function(client) {
        client.emit('sendGameState');
    });
}

let gameState: SpeedData = {
    width: 50,
    height: 50,
    cells: initializeCells(50, 50),
    players: {},
    you: 0,
    running: false,
    deadline: "heute"
}

function initializeCells(width, height): number[][] {
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

function addPlayer(): number {
    let you = Object.keys(gameState.players).length + 1;
    let x: number, y: number;

    do {
        x = Math.floor(Math.random() * Math.floor(gameState.width));
        y = Math.floor(Math.random() * Math.floor(gameState.height));
    } while (gameState.cells[y][x] !== 0)

    gameState.cells[y][x] = you;
    gameState.players[you] = {
        x: x,
        y: y,
        direction: SpeedDirection.DOWN,
        speed: 1,
        active: true
    }
    return you;
}

function processAction(you: number, action: SpeedAction) {
    switch (action) {
        case SpeedAction.SPEED_UP: {
            if (gameState.players[you].speed < 10)
                gameState.players[you].speed++;
            return true;
        };
        case SpeedAction.SLOW_DOWN: {
            if (gameState.players[you].speed > 1)
                gameState.players[you].speed--;
            return true;
        };
        case SpeedAction.TURN_LEFT: {
            switch (gameState.players[you].direction) {
                case SpeedDirection.UP: { gameState.players[you].direction = SpeedDirection.LEFT }; break;
                case SpeedDirection.LEFT: { gameState.players[you].direction = SpeedDirection.DOWN }; break;
                case SpeedDirection.DOWN: { gameState.players[you].direction = SpeedDirection.RIGHT }; break;
                case SpeedDirection.RIGHT: { gameState.players[you].direction = SpeedDirection.UP }; break;
            }
            return true;
        };
        case SpeedAction.TURN_RIGHT: {
            switch (gameState.players[you].direction) {
                case SpeedDirection.UP: { gameState.players[you].direction = SpeedDirection.RIGHT }; break;
                case SpeedDirection.LEFT: { gameState.players[you].direction = SpeedDirection.UP }; break;
                case SpeedDirection.DOWN: { gameState.players[you].direction = SpeedDirection.LEFT }; break;
                case SpeedDirection.RIGHT: { gameState.players[you].direction = SpeedDirection.DOWN }; break;
            }
            return true;
        };
        case SpeedAction.NOTHING: {
            return true;
        };
        default: return false;
    }
}

function processRound() {
    let running = false;
    for (let playerKey in gameState.players) {
        let player: SpeedPlayer = gameState.players[playerKey];
        if (player.active) {
            running = true;
            for (let step = 0; step < player.speed; step++) {
                switch (player.direction) {
                    case SpeedDirection.UP: { player.y--; }; break;
                    case SpeedDirection.DOWN: { player.y++; }; break;
                    case SpeedDirection.LEFT: { player.x--; }; break;
                    case SpeedDirection.RIGHT: { player.x++; }; break;
                }
                if (player.y < 0 || player.y >= gameState.height || player.x < 0 || player.x >= gameState.width || gameState.cells[player.y][player.x] !== 0) {
                    player.active = false;
                } else {
                    gameState.cells[player.y][player.x] = Number.parseInt(playerKey);
                }
            }
        }
    }
    gameState.running = running;
}

wsServer.on('request', async function (request) {
    var connection = request.accept(null, null);
    console.log((new Date()) + ' Connection accepted.');
    
    let you = addPlayer();
    
    connection.on('message', function (message) {
        try {
            let action: SpeedAnswer = JSON.parse(message.utf8Data);
            console.log(action);
            let valid = processAction(you, action.action);
            if (!valid)
                throw "Not a valid action!";
        }
        catch (ex) {
            connection.drop(1007, ex);
        }
    });

    connection.on('sendGameState', function() {
        console.log("sendGameState");
        let myState = gameState;
        myState.you = you;
        connection.send(JSON.stringify(myState));
    });
    clients.push(connection);
    startGame();
});