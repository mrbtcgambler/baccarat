//** Baccarat SIM based on this video: TBD                                                  **
//** Version: 0.1                                                                           ** 
//** Date: 07/08/2024                                                                       **
//** Authour: MrBtcGambler                                                                  **
//** Start Balance: 40                                                                      **
//**                                                                                        **
//** Details:                                                                               **
//** Expirment using qBot: https://qbot.gg/?r=mrbtcgambler                                  **
//** Progressive Recovery Betting is a new concept that is much safer than Martingale       **
//** It flat bets on the basebet until profit is <0 and then adds 20% to the next bet       **
//** Until in profit, it then goes back to flat betting at the base bet                     **
//********************************************************************************************

// ---- game coding ----
const debugMode = true; // Set to true for detailed logging, false for simpler logs
const startTime = Date.now();

let version = 0.1,
    noBets = 2000000, //set number of bets to test

    startBalance = 40,
    balance = startBalance,
    baseBet = 0.0001,
    nextBet = baseBet,
    previousBet = baseBet,
    tieBet = 0, //Baccarat tie bet amount
    playerBet = baseBet, //Baccarat player bet amount
    bankerBet = 0, //Baccarat banker bet amount
    totalBet = (bankerBet + playerBet + tieBet),
    increaseOnLoss = 2.06, //for full recovery 105.3%
    currentStreak = 0,
    highestLosingStreak = 0,
    winCount = 0,
    tiedCount = 0,
    loseCount = 0,
    win = false,
    lose = false,
    tied = false,
    progress;

import { Console } from 'console';
import crypto from 'crypto';

// Global variables to store the game result and payout multiplier
let gameResult;
let profit = 0,
    wager = 0,
    bankerWin = 0,
    playerWin = 0,
    tieWin = 0,
    totalWin = 0

// Utility function to introduce a delay
function betDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Constants for cards
const CARDS = [
  'D2', 'H2', 'S2', 'C2', 'D3', 'H3', 'S3', 'C3',
  'D4', 'H4', 'S4', 'C4', 'D5', 'H5', 'S5', 'C5',
  'D6', 'H6', 'S6', 'C6', 'D7', 'H7', 'S7', 'C7',
  'D8', 'H8', 'S8', 'C8', 'D9', 'H9', 'S9', 'C9',
  'D10', 'H10', 'S10', 'C10', 'DJ', 'HJ', 'SJ', 'CJ',
  'DQ', 'HQ', 'SQ', 'CQ', 'DK', 'HK', 'SK', 'CK',
  'DA', 'HA', 'SA', 'CA'
];

const randomClientSeed = generateRandomClientSeed(10);
const randomServerSeed = generateRandomServerSeed(64);
const startNonce = Math.floor(Math.random() * 1000000) + 1; // Random starting nonce position
let nonce = startNonce;

// Utility functions to generate random seeds
function generateRandomClientSeed(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
function generateRandomServerSeed(length) {
    let result = [];
    const hexRef = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
    
    for (let n = 0; n < length; n++) {
        result.push(hexRef[Math.floor(Math.random() * 16)]);
    }
    
    return result.join('');
};


// Function to calculate the Baccarat score
function calculateBaccaratScore(cards) {
  const cardValues = cards.map(card => {
    const face = card.slice(1);
    if (['J', 'Q', 'K'].includes(face)) return 0;
    if (face === 'A') return 1;
    return parseInt(face, 10);
  });
  const score = cardValues.reduce((acc, val) => acc + val, 0) % 10;
  return score;
}

// Function to convert bytes to a float
function bytesToFloat(bytes) {
  let [b1, b2, b3, b4] = bytes;
  return (
    (b1 / 256) +
    (b2 / Math.pow(256, 2)) +
    (b3 / Math.pow(256, 3)) +
    (b4 / Math.pow(256, 4))
  );
}

// Function to get raw floats from seeds and nonce
function getRawFloats(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}:0`);
  const buffer = hmac.digest();
  const rawFloats = [];

  // Extract six sets of four bytes
  for (let i = 0; i < 6; i++) {
    const bytes = buffer.slice(i * 4, (i + 1) * 4);
    const float = bytesToFloat(bytes);
    rawFloats.push(float);
  }

  return rawFloats;
}

// Function to map a float to a card
function mapFloatToCard(float) {
  const index = Math.floor(float * 52);
  const card = CARDS[index];
  return card;
}

// Function to simulate a Baccarat round and set the global game result
function determineBaccaratResult(serverSeed, clientSeed, nonce) {
  const rawFloats = getRawFloats(serverSeed, clientSeed, nonce);

  const cards = rawFloats.map(mapFloatToCard);

  const playerCards = [cards[0], cards[1]];
  const bankerCards = [cards[2], cards[3]];

  const initialPlayerScore = calculateBaccaratScore(playerCards);
  const initialBankerScore = calculateBaccaratScore(bankerCards);

  if (initialPlayerScore < 8 && initialBankerScore < 8) {
    let playerThirdCard = null;
    if (initialPlayerScore <= 5) {
      playerThirdCard = cards[4];
      playerCards.push(playerThirdCard);
    }

    const finalPlayerScore = calculateBaccaratScore(playerCards);

    let bankerThirdCard = null;
    const bankerDecisionCardIndex = playerThirdCard ? 5 : 4;

    if (initialBankerScore <= 2) {
      bankerThirdCard = cards[bankerDecisionCardIndex];
    } else if (initialBankerScore === 3 && (!playerThirdCard || playerThirdCard[1] !== '8')) {
      bankerThirdCard = cards[bankerDecisionCardIndex];
    } else if (initialBankerScore === 4 && playerThirdCard && ['2', '3', '4', '5', '6', '7'].includes(playerThirdCard[1])) {
      bankerThirdCard = cards[bankerDecisionCardIndex];
    } else if (initialBankerScore === 5 && playerThirdCard && ['4', '5', '6', '7'].includes(playerThirdCard[1])) {
      bankerThirdCard = cards[bankerDecisionCardIndex];
    } else if (initialBankerScore === 6 && playerThirdCard && ['6', '7'].includes(playerThirdCard[1])) {
      bankerThirdCard = cards[bankerDecisionCardIndex];
    } else if (!playerThirdCard && initialBankerScore <= 5) {
      bankerThirdCard = cards[bankerDecisionCardIndex];
    }

    if (bankerThirdCard) {
      bankerCards.push(bankerThirdCard);
    }
  }

  const finalPlayerScore = calculateBaccaratScore(playerCards);
  const finalBankerScore = calculateBaccaratScore(bankerCards);

  // Determine the result and payout multiplier
  if (finalPlayerScore > finalBankerScore) {
    gameResult = 'Player Win';
  } else if (finalPlayerScore < finalBankerScore) {
    gameResult = 'Banker Win';
  } else {
    gameResult = 'Tie';
  }
  return gameResult;
}

// Example usage
const serverSeed = randomServerSeed; 
const clientSeed = randomClientSeed;

// Main function to run the bets
async function runBets() {
    let betCount = 0; // Counter for the number of bets
  
    while (betCount < noBets) {
      nonce++;
      progress = (betCount  / noBets) * 100;  // update progress
      let result = determineBaccaratResult(serverSeed, clientSeed, nonce);
      let bankerWin = 0;
      let playerWin = 0;
      let tieWin = 0;
      let win = false;
      let tied = false;
      lose = false;
      let payoutMultiplier = 0; // Reset payout multiplier
   
      // Determine the total bet
      totalBet = bankerBet + playerBet + tieBet;
      wager += totalBet;

      if (totalBet > balance){
        console.log('Bust')
        console.log ('Server Seed: ' + serverSeed, 'Client Seed: ' + clientSeed, 'Nonce: ' +nonce);
        process.exit()
      }
  
      // Deduct total bet from balance at the start of the round
      balance -= totalBet;
  
      // Determine the result and payout multiplier
      if (result === "Banker Win") {
        if (bankerBet > 0) {
          payoutMultiplier = 1.95; // Banker wins pay 1:1 plus original bet
          bankerWin = bankerBet * payoutMultiplier;
          balance += bankerWin; // Update balance with winnings
        }
      } else if (result === "Player Win") {
        if (playerBet > 0) {
          payoutMultiplier = 2; // Player wins pay 0.95:1 plus original bet
          playerWin = playerBet * payoutMultiplier;
          balance += playerWin; // Update balance with winnings
        }
      } else { // Tie result
        if (tieBet > 0) {
          payoutMultiplier = 9; // Tie wins pay 8:1 plus original bet
          tieWin = tieBet * payoutMultiplier;
          balance += tieWin; // Update balance with winnings
        } else {
          payoutMultiplier = 1; // No payout if no tie bet
        }
      }
  
      const totalWin = bankerWin + playerWin + tieWin;
        
      // Update profit based on win or loss
      profit = balance - 40.0; // Profit is the difference from initial balance
  
      // Determine if the round was a win, tie, or loss
      if (totalWin > totalBet) {
        win = true;
        loseCount++;
        if (currentStreak >= 0) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } 
      if (totalWin === totalBet) {
        tied = true;
        tiedCount++;
        currentStreak = 0; // Reset streak on tie
      } 
      if (totalWin < totalBet){
        lose = true;
        loseCount++;
        if (currentStreak <= 0) {
          currentStreak--;
        } else {
          currentStreak = -1;
        }
        if (currentStreak < highestLosingStreak) {
          highestLosingStreak = currentStreak;
        }
      }
  
      if (debugMode) {
        console.log ('Server Seed: ' + serverSeed, 'Client Seed: ' + clientSeed, 'Nonce: ' +nonce);
        console.log(
        win ? '\x1b[32m%s\x1b[0m' : (tied ? '\x1b[33m%s\x1b[0m' : '\x1b[31m%s\x1b[0m'),
          [
            'Banker: ' + bankerBet.toFixed(8),
            'Player: ' + playerBet.toFixed(8),
            'Tie: ' + tieBet.toFixed(8),
            'Total Bet: ' + totalBet.toFixed(8),
            'Game Result: ' + result,
            'Payout: ' + payoutMultiplier,
            'Current Streak: ' + currentStreak,
            'Highest Losing Streak: ' + highestLosingStreak,
            'Balance: ' + balance.toFixed(8),
            'Profit: ' + profit.toFixed(8),
            'Wager: ' + wager.toFixed(4),
          ].join(' | ')
        );
        console.log('Game Result: ' + result);
        console.log('Bet Profit: ' + (totalWin - totalBet).toFixed(8));
        console.log('Multiplier: ' + payoutMultiplier);
        console.log('Total Profit: ' + profit.toFixed(8));
        console.log('Balance: ' + balance.toFixed(8));
        console.log('Variance: ' + (balance - startBalance).toFixed(8));
        console.log('Variance: ' + (balance - startBalance).toFixed(8));
        
        await betDelay(1000); // Delay between each round when in debug mode
      } else {
        if (betCount % 100000 === 0) {
            const endTime = Date.now();
            const runTimeSeconds = (endTime - startTime) / 1000;
            const betsPerSecond = ((nonce - startNonce + 1) / runTimeSeconds).toLocaleString('en-US', { maximumFractionDigits: 2 });
            const currentNonce = (nonce);
            const currentSeed = (serverSeed);
            
                console.log(
                    [
                    'Progress %: ' + progress.toFixed(2),
                    'Bet Count ' + betCount,
                    'Max Bets: ' + noBets,
                    'Balance: ' + balance.toFixed(4),
                    'profit: ' + profit.toFixed(4),
                    'Total Wagered: ' + wager.toFixed(4),
                    'Worst Loss Streak: ' + highestLosingStreak,
                    'Bets per Second: ' + betsPerSecond,
                ].join(' | ')
                );
            console.log('Profit: ' + profit.toFixed(4));
            console.log('Balance: ' + balance.toFixed(4));
            console.log('Variance: ' + (balance - startBalance.toFixed(4)));
        }
      }
  
      betCount++; // Increment the bet counter

      if (win){

      }
      if (tied){
  
      }
      if (lose){
  
      }

      if (profit >= 0){
          nextBet = baseBet;
          bankerBet = nextBet;
          playerBet = 0;
          tieBet = 0;
      }else{
          nextBet = (nextBet + (nextBet * 0.2));
          bankerBet = nextBet;
          playerBet = 0;
          tieBet = 0;
      }      

    }

  }
  
  // Start the betting simulation
  runBets();

