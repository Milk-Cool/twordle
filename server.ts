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

const wss = new WebSocketServer({ server });
wss.on("connection", ws => {
    ws.on("error", console.error);
    ws.on("close", () => null);

    const player = generatePlayer(ws);
    players.push(player);

    ws.on("message", data => {
        if(Array.isArray(data)) data = Buffer.concat(data);
        if(data instanceof ArrayBuffer) data = Buffer.from(data);
        const str = (data as Buffer).toString();

        if(str.length !== 5) return ws.send("400 Invalid word length");
        if(!words.includes(str)) return ws.send("401 Not a real word");
        player.guesses++;
        ws.send("200 " + str.toUpperCase().split("").map((x, i) => {
            if(x === player.word[i]) return "g";
            if(player.word.includes(x)) return "y";
            return "-";
        }).join(""));
        if(player.guesses < player.rows) return;
        ws.send("402 Out of guesses");
        player.guesses = 0;
        if(player.rows > 3) player.rows--;
        player.word = randomWord();
    });
});