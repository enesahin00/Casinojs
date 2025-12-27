// --- SES TANIMLAMALARI ---
const sounds = {
    deal: new Audio('sounds/deal.mp3'),      //
    win: new Audio('sounds/win.wav'),        //
    lose: new Audio('sounds/lose.wav'),      //
    blackjack: new Audio('sounds/blackjack.wav'), //
    push: new Audio('sounds/push.wav')       //
};

function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.warn("Ses çalma engellendi"));
    }
}
// --- VERİTABANI SİMÜLASYONU ---
function saveGameToHistory(gameName, betAmount, resultStatus, winAmount) {
    let history = JSON.parse(localStorage.getItem('casino_history')) || [];
    const newEntry = {
        game: gameName,
        bet: betAmount,
        result: resultStatus, // "WIN", "LOSE", "PUSH", "BLACKJACK"
        amount: winAmount,
        date: new Date().toLocaleString()
    };
    history.unshift(newEntry); // En yeni kaydı başa ekle
    if (history.length > 20) history.pop(); // Sadece son 20 oyunu tut
    localStorage.setItem('casino_history', JSON.stringify(history));
    displayHistory(); // Tabloyu güncelle
}

// --- OYUN MANTIĞI ---
const Suits = ["♥", "♦", "♣", "♠"];
const Ranks = { "A": 11, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 10, "Q": 10, "K": 10 };

class Deck {
    constructor() {
        this.cards = [];
        for (let s of Suits) for (let r in Ranks) this.cards.push({suit: s, rank: r, val: Ranks[r]});
        this.cards.sort(() => Math.random() - 0.5);
    }
    deal() { return this.cards.pop(); }
}

class Hand {
    constructor() { this.cards = []; this.result = ""; }
    add(c) { this.cards.push(c); }
    score() {
        let t = this.cards.reduce((sum, c) => sum + c.val, 0);
        let aces = this.cards.filter(c => c.rank === "A").length;
        while (t > 21 && aces > 0) { t -= 10; aces--; }
        return t;
    }
}

let balance = 1000, currentBet = 0, deck, playerHands, dealerHand, curIdx, isPlaying = false;
let isProcessing = false; // TIKLAMA KİLİDİ
const wait = (ms) => new Promise(res => setTimeout(res, ms));

function drawCard(card, hide = false, anime = false) {
    if (hide) return `<div class="card ${anime?'card-anim':''}" style="background:#2c3e50"></div>`;
    const red = (card.suit==="♥" || card.suit==="♦") ? "red" : "";
    return `<div class="card ${red} ${anime?'card-anim':''}"><div>${card.rank}</div><div>${card.suit}</div></div>`;
}

// --- ARAYÜZ VE KİLİT SİSTEMİ ---
function updateUI(final = false, isNewPlayerCard = false, isNewDealerCard = false) {
    document.getElementById('balance').innerText = balance;
    
    // Dealer Cards
    document.getElementById('dealer-cards').innerHTML = dealerHand.cards.map((c, i) => 
        drawCard(c, i === 1 && !final, isNewDealerCard && i === dealerHand.cards.length - 1)).join('');
    document.getElementById('dealer-score').innerText = final ? dealerHand.score() : "?";

    // Player Hands
    document.getElementById('player-area').innerHTML = playerHands.map((h, i) => {
        const active = (i === curIdx && isPlaying && !final) ? 'active-hand' : '';
        let labelClass = h.result.includes("WIN") || h.result.includes("BLACKJACK") ? "win-label" : 
                         h.result.includes("LOSE") || h.result.includes("BUST") ? "lose-label" : 
                         h.result.includes("PUSH") ? "push-label" : "";
        const resultHTML = h.result ? `<div class="result-label ${labelClass}">${h.result}</div>` : "";

        return `<div class="hand-container ${active}">
            ${resultHTML}
            <strong>HAND ${i+1}</strong>
            <div class="cards-row">${h.cards.map((c, idx) => drawCard(c, false, i === curIdx && idx === h.cards.length-1 && isNewPlayerCard)).join('')}</div>
            <div class="score">SCORE: ${h.score()}</div>
        </div>`;
    }).join('');

    // Buton ve Giriş Alanlarını Kilitler
    document.getElementById('bet-ui').style.display = isPlaying ? 'none' : 'flex';
    document.getElementById('game-ui').style.display = isPlaying ? 'flex' : 'none';
    
    // KRİTİK: isProcessing aktifse tüm butonları fiziksel olarak kapat
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => btn.disabled = isProcessing);

    if(isPlaying && !final) {
        const h = playerHands[curIdx];
        document.getElementById('btn-split').style.display = (h.cards.length === 2 && h.cards[0].val === h.cards[1].val && balance >= currentBet) ? 'block' : 'none';
        document.getElementById('btn-double').style.display = (h.cards.length === 2 && balance >= currentBet) ? 'block' : 'none';
    }
}

// --- OYUN AKIŞI ---
async function startGame() {
    if (isProcessing) return;
    let betValue = parseInt(document.getElementById('bet-input').value);
    if(isNaN(betValue) || betValue <= 0 || betValue > balance) return alert("Invalid Bet!");
    
    isProcessing = true; // KİLİTLE
    isPlaying = true; currentBet = betValue; balance -= betValue;
    deck = new Deck(); dealerHand = new Hand(); playerHands = [new Hand()]; curIdx = 0;
    document.getElementById('msg-box').innerText = "Dealing...";
    updateUI();

    playerHands[0].add(deck.deal()); playSound('deal'); updateUI(false, true); await wait(450);
    dealerHand.add(deck.deal()); playSound('deal'); updateUI(false, false, true); await wait(450);
    playerHands[0].add(deck.deal()); playSound('deal'); updateUI(false, true); await wait(450);
    dealerHand.add(deck.deal()); playSound('deal'); updateUI(false, false, true); await wait(450);

    isProcessing = false; // AÇ
    document.getElementById('msg-box').innerText = "";
    updateUI();
    if(playerHands[0].score() >= 21) setTimeout(stand, 600);
}

async function hit() {
    if (isProcessing || !isPlaying || playerHands[curIdx].score() >= 21) return;
    
    isProcessing = true;
    updateUI(); 

    playerHands[curIdx].add(deck.deal());
    playSound('deal');
    
    updateUI(false, true); 
    await wait(450); 

    if (playerHands[curIdx].score() >= 21) {

        await stand(); 
    } else {
        isProcessing = false;
        updateUI();
    }
}

async function stand() {
    if (!isPlaying) return; // Oyun zaten bitmişse işlem yapma
    
    // İşlem kilidini burada da kontrol edebiliriz
    isProcessing = true; 
    updateUI();
    
    if (curIdx < playerHands.length - 1) { 
        curIdx++; 
        isProcessing = false; // Diğer ele geçerken kilidi aç
        updateUI(); 
        if (playerHands[curIdx].score() >= 21) await stand(); 
    } else { 
        await dealerTurn(); 
    }
}

async function dealerTurn() {
    isProcessing = true; // Kasa oynarken butonları tamamen kilitle
    isPlaying = false;
    updateUI(true); await wait(800);
    
    const playerHasBJ = playerHands[0].cards.length === 2 && playerHands[0].score() === 21;
    const allHandsBust = playerHands.every(h => h.score() > 21);

    while(dealerHand.score() < 17 && !playerHasBJ && !allHandsBust) {
        dealerHand.add(deck.deal());
        playSound('deal');
        updateUI(true, false, true); await wait(600);
    }
    isProcessing = false;
    finish();
}

function finish() {
    let d = dealerHand.score();
    let finalSound = "lose";

    playerHands.forEach((h) => {
        let p = h.score(), bj = h.cards.length === 2 && p === 21;
        let winAmount = 0;
        let status = "";

        if(p > 21) { 
            h.result = "BUST / LOSE"; 
            status = "LOSE";
            winAmount = 0;
        }
        else if(bj) { 
            h.result = "BLACKJACK!"; 
            balance += currentBet * 2.5; //
            finalSound = "blackjack";
            status = "BLACKJACK";
            winAmount = currentBet * 2.5;
        }
        else if(d > 21 || p > d) { 
            h.result = "WIN!"; 
            balance += currentBet * 2; 
            if(finalSound !== "blackjack") finalSound = "win";
            status = "WIN";
            winAmount = currentBet * 2;
        }
        else if(d > p) { 
            h.result = "LOSE"; 
            status = "LOSE";
            winAmount = 0;
        }
        else { 
            h.result = "PUSH"; 
            balance += currentBet; //
            if(finalSound !== "blackjack" && finalSound !== "win") finalSound = "push";
            status = "PUSH";
            winAmount = currentBet;
        }

        // --- VERİYİ KAYDET ---
        saveGameToHistory("Blackjack", currentBet, status, winAmount);
    });

    playSound(finalSound); //
    document.getElementById('msg-box').innerText = "Round Finished";
    updateUI(true);
}

async function doubleDown() {
    if (isProcessing) return;
    isProcessing = true;
    balance -= currentBet; currentBet *= 2; 
    playerHands[curIdx].add(deck.deal()); 
    playSound('deal');
    updateUI(false, true); 
    await wait(450);
    isProcessing = false;
    setTimeout(stand, 600);
}

async function splitHand() {
    if (isProcessing) return;
    isProcessing = true;
    balance -= currentBet; 
    let nh = new Hand(); 
    nh.add(playerHands[curIdx].cards.pop()); 
    playerHands[curIdx].add(deck.deal()); 
    nh.add(deck.deal()); 
    playSound('deal'); 
    playerHands.push(nh); 
    updateUI();
    await wait(450);
    isProcessing = false;
    updateUI();
}
// Paneli aç/kapat
function toggleHistory() {
    const panel = document.getElementById('history-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        displayHistory();
    }
}

// Veriyi LocalStorage'a Kaydet
function saveGameToHistory(gameName, betAmount, resultStatus, winAmount) {
    let history = JSON.parse(localStorage.getItem('casino_history')) || [];
    const newEntry = {
        game: gameName,
        bet: betAmount,
        result: resultStatus,
        amount: winAmount,
        date: new Date().toLocaleTimeString()
    };
    history.unshift(newEntry);
    if (history.length > 20) history.pop();
    localStorage.setItem('casino_history', JSON.stringify(history));
    displayHistory();
}

// Tabloyu Güncelle
function displayHistory() {
    const body = document.getElementById('history-body');
    if (!body) return;
    const history = JSON.parse(localStorage.getItem('casino_history')) || [];
    body.innerHTML = history.map(h => {
        const resClass = h.amount > h.bet ? 'text-win' : (h.amount === h.bet ? 'text-push' : 'text-lose');
        return `
            <tr>
                <td>${h.game}</td>
                <td>${h.bet}</td>
                <td class="${resClass}">${h.amount}</td>
                <td>${h.result}</td>
            </tr>
        `;
    }).join('');
}

// Sayfa yüklendiğinde geçmişi göster
document.addEventListener('DOMContentLoaded', displayHistory);
updateUI();