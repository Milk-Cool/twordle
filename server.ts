import express from "express";
import ViteExpress from "vite-express";
import WebSocket, { WebSocketServer } from "ws";
import { readFileSync } from "fs";

const WORD_LENGTH = 5;

const words = readFileSync("words.txt", "utf-8").split("\n").filter(x => x.length === WORD_LENGTH);
const randomWord = () => {
    let word: string;
    do {
        word = words[Math.floor(Math.random() * words.length)];
    } while(Array.from(new Set(word.split(""))).length !== WORD_LENGTH);
    return word.toUpperCase();
};

const PORT = 12701;
const app = express();

const server = ViteExpress.listen(app, PORT, () => {
    console.log("listening at", PORT);
});

type Player = {
    ws: WebSocket;
    opponent: number | null; // index in players[]
    word: string;
    rows: number;
    guesses: number;
};
const players: Player[] = [];

const generatePlayer = (ws: WebSocket) => ({
    ws,
    opponent: null,
    word: randomWord(),
    rows: 6,
    guesses: 0
} as Player);

const reduceRows = (player: Player) => {
    player.rows--;
    player.ws.send(`501 Rows reduced (${player.rows})`);
    if(player.guesses < player.rows) return;
    outOfGuesses(player);
};
const outOfGuesses = (player: Player) => {
    player.ws.send("402 Out of guesses");
    player.guesses = 0;
    if(player.rows > 3) reduceRows(player);
    player.word = randomWord();
};

const wss = new WebSocketServer({ server });
wss.on("connection", ws => {
    ws.on("error", console.error);

    ws.send("299 Welcome to twordle");

    const player = generatePlayer(ws);
    const index = players.push(player) - 1;

    ws.on("close", () => {
        if(player.opponent !== null) {
            players[player.opponent].ws.send("502 Opponent disconnected");
            players[player.opponent].ws.close();
            delete players[player.opponent];
        }
        delete players[index];
    });

    let opponentIndex = players.findIndex((x, i) => x.opponent === null && i !== index);
    if(opponentIndex !== -1) {
        player.opponent = opponentIndex;
        players[opponentIndex].opponent = index;
        ws.send("202 Opponent found");
        players[opponentIndex].ws.send("202 Opponent found");
    } else {
        ws.send("201 Searching for opponent");
        setTimeout(() => {
            if(player.opponent !== null) return;
            ws.send("500 Opponent not found");
            ws.close();
            delete players[index];
        }, 20000);
    }

    ws.on("message", data => {
        if(Array.isArray(data)) data = Buffer.concat(data);
        if(data instanceof ArrayBuffer) data = Buffer.from(data);
        const str = (data as Buffer).toString();

        if(player.opponent === null) return ws.send("403 Opponent not found yet");

        if(str.length !== 5) return ws.send("400 Invalid word length");
        if(!words.includes(str)) return ws.send("401 Not a real word");
        player.guesses++;
        const mask = str.toUpperCase().split("").map((x, i) => {
            if(x === player.word[i]) return "g";
            if(player.word.includes(x)) return "y";
            return "-";
        }).join("");
        ws.send("200 " + mask);
        if(mask === "ggggg") {
            player.guesses = 0;
            if(players[player.opponent].rows > 3) reduceRows(players[player.opponent]);
        }
        if(player.guesses < player.rows) return;
        outOfGuesses(player);
    });
});