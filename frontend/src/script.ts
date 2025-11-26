for(const tableID of ["fieldL", "fieldR"]) {
    for(let y = 0; y < 6; y++) {
        const row = document.createElement("tr");
        for(let x = 0; x < 5; x++) {
            const column = document.createElement("td");
            column.id = `${tableID}-x${x}y${y}`;
            row.appendChild(column);
        }
        (document.querySelector("#" + tableID) as HTMLTableElement).appendChild(row);
    }
}

const msgcb = (text: string, error: boolean = false) => () => {
    if(error) {
        const field = document.querySelector("#field") as HTMLDivElement;
        field.classList.remove("shake");
        field.classList.add("shake");
    }
    (document.querySelector("#message") as HTMLSpanElement).innerText = text;
}

let canType: boolean = false;
let rows: number, orows: number;
let idx: number, ridx: number, oridx: number;
let word: string;

const updateRows = (n: number, field: string = "fieldL") => {
    for(let i = n; i < 6; i++)
        for(let x = 0; x < 5; x++)
            (document.querySelector(`#${field}-x${x}y${i}`) as HTMLTableCellElement).classList.add("disabled");
};

document.addEventListener("keydown", e => {
    if(!canType) return;
    if(e.key === "Backspace") {
        if(idx === 0) return;
        idx--;
        word = word.slice(0, -1);
        (document.querySelector(`#fieldL-x${idx}y${ridx}`) as HTMLTableCellElement).innerText = "";
    } else if(e.key === "Enter") {
        ws.send(word);
    } else if("abcdefghijklmnopqrstuvwxyz".split("").includes(e.key)) {
        if(idx === 5) return;
        (document.querySelector(`#fieldL-x${idx}y${ridx}`) as HTMLTableCellElement).innerText = e.key.toUpperCase();
        word += e.key;
        idx++;
    }
});

const codes: Record<number, (additionalData?: string) => (void | Promise<void>)> = {
    200: data => {
        if(!data) return;
        for(let x = 0; x < 5; x++) {
            (document.querySelector(`#fieldL-x${x}y${ridx}`) as HTMLTableCellElement).classList.add(data[x] === "-" ? "gray" : data[x] === "y" ? "yellow" : "green");
        }
        ridx++;
        idx = 0;
        word = "";
        if(data === "ggggg") setTimeout(() => {
            ridx = 0;
            for(let y = 0; y < 6; y++)
                for(let x = 0; x < 5; x++) {
                    (document.querySelector(`#fieldL-x${x}y${y}`) as HTMLTableCellElement).classList.remove("gray", "yellow", "green", "disabled");
                    if(y >= orows)
                        (document.querySelector(`#fieldL-x${x}y${y}`) as HTMLTableCellElement).classList.add("disabled");
                    (document.querySelector(`#fieldL-x${x}y${y}`) as HTMLTableCellElement).innerText = "";
                }
            }, 200);
    },
    201: msgcb("searching for opponent..."),
    202: () => {
        msgcb("opponent found!")();
        canType = true;
        rows = 6;
        orows = 6;
        idx = 0;
        word = "";
        ridx = 0;
        oridx = 0;
    },
    203: () => {
        msgcb("you win!")();
        canType = false;
        setTimeout(() => location.reload(), 5000);
    },
    204: data => {
        if(!data) return;
        const [word, mask] = data.split(";");
        for(let x = 0; x < 5; x++) {
            (document.querySelector(`#fieldR-x${x}y${oridx}`) as HTMLTableCellElement).classList.add(mask[x] === "-" ? "gray" : mask[x] === "y" ? "yellow" : "green");
            (document.querySelector(`#fieldR-x${x}y${oridx}`) as HTMLTableCellElement).innerText = word[x];
        }
        oridx++;
    },
    205: () => {
        oridx = 0;
        for(let y = 0; y < 6; y++) {
            for(let x = 0; x < 5; x++) {
                (document.querySelector(`#fieldR-x${x}y${y}`) as HTMLTableCellElement).classList.remove("gray", "yellow", "green", "disabled");
                if(y >= orows)
                    (document.querySelector(`#fieldR-x${x}y${y}`) as HTMLTableCellElement).classList.add("disabled");
                (document.querySelector(`#fieldR-x${x}y${y}`) as HTMLTableCellElement).innerText = "";
            }
        }
    },
    206: data => {
        if(!data) return;
        orows = parseInt(data);
        updateRows(orows, "fieldR");
    },
    400: msgcb("invalid word length", true),
    401: msgcb("not a real word", true),
    402: () => {
        msgcb("out of guesses", true)();
        ridx = 0;
        idx = 0;
        word = "";

        for(let y = 0; y < 6; y++)
            for(let x = 0; x < 5; x++) {
                (document.querySelector(`#fieldL-x${x}y${y}`) as HTMLTableCellElement).classList.remove("gray", "yellow", "green", "disabled");
                if(y >= orows)
                    (document.querySelector(`#fieldL-x${x}y${y}`) as HTMLTableCellElement).classList.add("disabled");
                (document.querySelector(`#fieldL-x${x}y${y}`) as HTMLTableCellElement).innerText = "";
            }
    },
    403: msgcb("opponent not found yet", true),
    404: msgcb("game over! refresh to try again", true),
    500: msgcb("opponent not found, refresh to try again", true),
    501: data => {
        if(!data) return;
        rows = parseInt(data);
        updateRows(rows);
    },
    502: () => {
        msgcb("opponent disconnected", true)();
        canType = false;
        setTimeout(() => location.reload(), 5000);
    },
};

const ws = new WebSocket((location.protocol === "http:" ? "ws:" : "wss:") + "//" + location.host);
ws.addEventListener("message", msg => {
    const text = msg.data;
    const code = parseInt(text); // everything after the space is ignored
    const additionalData = text.match(/(?<=\()[^)]*(?=\))/)?.[0];
    for(const k in codes)
        if(k === code.toString())
            additionalData ? codes[k](additionalData) : codes[k]();
});