/***************************************************************
 * Baccarat Chop Chop Suey Strategy
 * MrBtcGambler (1st Jan 2025)
 * Version 1.0
 * 
 * Instructions:
 * Download and install Node.js from https://nodejs.org
 * npm install crypto
 * node baccartChopChopSuey_v_1.0.mjs
 *
 *  1) We store the last two results (twoAgoResult, prevResult).
 *  2) If they match => run => skip bet,
 *     else => chop => bet on prevResult side (except Tie => skip).
 *  3) If first or second hand => skip automatically (not enough history).
 *  4) Tie refunds your bet if placed. No nextBet changes on a Tie.
 ***************************************************************/

import crypto from 'crypto';

// -------------- Configuration --------------
const debugMode       = false;        // Show detailed logs
const debugDelay      = 1000;         // ms delay for debug
const noBets          = 86_400_000;   //1 day = 240_000 , 1 Week = 1_680_000, 1 Month = 7_200_000, 1 Year = 86_400_000
const startBalance    = 3090000;
const baseBet         = 0.0005;
const increaseOnLoss  = 2.0527;   // Martingale multiplier
const resetSeedAfter  = 1_000;    // Reseed interval

// -------------- System Variables --------------
let balance             = startBalance;
let nextBet             = baseBet;
let profit              = 0;
let wager               = 0;
let betCount            = 0;
let loseCount           = 0;
let currentStreak       = 0;
let highestLosingStreak = 0;
let lowestBalance       = startBalance;
let largestBetPlaced    = 0;

// Track overall Banker/Player/Tie wins
let dealerWinCount = 0;
let playerWinCount = 0;
let tieWinCount    = 0;

// Seeds & Reseeding
let serverSeed   = generateRandomServerSeed(64);
let clientSeed   = generateRandomClientSeed(10);
let nonce        = 1;
let seedReset    = 0;

// Keep track of last two results for run/chop detection
let twoAgoResult = null;  // "Banker", "Player", or "Tie"
let prevResult   = null;  // "Banker", "Player", or "Tie"

// -------------- Card & RNG Functions --------------
const CARDS = [
  'D2','H2','S2','C2','D3','H3','S3','C3',
  'D4','H4','S4','C4','D5','H5','S5','C5',
  'D6','H6','S6','C6','D7','H7','S7','C7',
  'D8','H8','S8','C8','D9','H9','S9','C9',
  'D10','H10','S10','C10','DJ','HJ','SJ','CJ',
  'DQ','HQ','SQ','CQ','DK','HK','SK','CK',
  'DA','HA','SA','CA'
];

function generateRandomServerSeed(length) {
  const hexRef = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++){
    result += hexRef.charAt(Math.floor(Math.random()*16));
  }
  return result;
}

function generateRandomClientSeed(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i=0; i<length; i++){
    result += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return result;
}

function bytesToFloat(bytes) {
  const [b1,b2,b3,b4] = bytes;
  return (
    (b1 / 256) +
    (b2 / 256**2) +
    (b3 / 256**3) +
    (b4 / 256**4)
  );
}

function getRawFloats(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}:0`);
  const buffer = hmac.digest();

  let floats = [];
  for(let i=0; i<6; i++){
    const slice = buffer.slice(i*4, (i+1)*4);
    floats.push(bytesToFloat(slice));
  }
  return floats;
}

function mapFloatToCard(float){
  const index = Math.floor(float*52);
  return CARDS[index];
}

function calculateBaccaratScore(cards){
  let values = cards.map(card=>{
    let face = card.slice(1);
    if(['J','Q','K'].includes(face)) return 0;
    if(face==='A') return 1;
    return parseInt(face,10);
  });
  return values.reduce((acc,v)=> acc+v,0) %10;
}

/** Returns "Banker", "Player", or "Tie" */
function determineBaccaratResult(serverSeed, clientSeed, nonce){
  let floats = getRawFloats(serverSeed, clientSeed, nonce);
  let deck   = floats.map(mapFloatToCard);

  let playerCards = [deck[0], deck[1]];
  let bankerCards = [deck[2], deck[3]];

  let pScoreInit  = calculateBaccaratScore(playerCards);
  let bScoreInit  = calculateBaccaratScore(bankerCards);

  if(pScoreInit<8 && bScoreInit<8){
    // Possibly draw more
    let pThird = null;
    if(pScoreInit<=5){
      pThird = deck[4];
      playerCards.push(pThird);
    }
    let finalPscore = calculateBaccaratScore(playerCards);
    let bThirdIndex = pThird? 5:4;

    let bThird = null;
    if(bScoreInit<=2){
      bThird = deck[bThirdIndex];
    }
    else if(bScoreInit===3 && (!pThird||pThird[1]!=='8')){
      bThird = deck[bThirdIndex];
    }
    else if(bScoreInit===4 && pThird && ['2','3','4','5','6','7'].includes(pThird[1])){
      bThird = deck[bThirdIndex];
    }
    else if(bScoreInit===5 && pThird && ['4','5','6','7'].includes(pThird[1])){
      bThird = deck[bThirdIndex];
    }
    else if(bScoreInit===6 && pThird && ['6','7'].includes(pThird[1])){
      bThird = deck[bThirdIndex];
    }
    else if(!pThird && bScoreInit<=5){
      bThird = deck[bThirdIndex];
    }
    if(bThird){
      bankerCards.push(bThird);
    }
  }

  let finalP = calculateBaccaratScore(playerCards);
  let finalB = calculateBaccaratScore(bankerCards);
  if(debugMode) console.log(`Final Player: ${finalP}, Final Banker: ${finalB}`);
  if(finalP > finalB) return "Player";
  if(finalB > finalP) return "Banker";
  return "Tie";
}

// -------------- Main Betting Loop --------------
async function runBets(){
  const startTime = Date.now();

  while(betCount < noBets){
    // Reseed if needed
    seedReset++;
    if(profit > 0 && seedReset > resetSeedAfter){
      serverSeed = generateRandomServerSeed(64);
      clientSeed = generateRandomClientSeed(10);
      nonce=1;
      seedReset=0;
    }

    // Decide bet side & amount
    let thisRoundSide = "None";
    let thisRoundBet  = 0;

    // If we have fewer than 2 prior results, we skip automatically
    if(betCount < 2){
      thisRoundSide = "None";
      thisRoundBet  = 0;
    }
    else {
      // Run detection: If twoAgoResult === prevResult => skip
      if(twoAgoResult === prevResult){
        // It's a run => skip
        thisRoundSide = "None";
        thisRoundBet  = 0;
      }
      else {
        // It's a chop => bet on prevResult side if it's Banker or Player
        if(prevResult==="Banker" || prevResult==="Player"){
          thisRoundSide = prevResult;
          thisRoundBet  = nextBet;
        } 
        else {
          // If prevResult==="Tie", skip
          thisRoundSide = "None";
          thisRoundBet  = 0;
        }
      }
    }

    // Subtract bet from balance
    balance -= thisRoundBet;
    profit  -= thisRoundBet;
    wager   += thisRoundBet;

    // Increment nonce every hand
    nonce++;
    let currResult = determineBaccaratResult(serverSeed, clientSeed, nonce);

    // Tally Banker/Player/Tie wins
    if(currResult==="Banker") dealerWinCount++;
    else if(currResult==="Player") playerWinCount++;
    else tieWinCount++;

    // If we placed a bet > 0, resolve it
    if(thisRoundBet>0){
      if(currResult==="Tie"){
        // Tie => break even, refund
        balance += thisRoundBet;
        profit  += thisRoundBet;
        // No change to loseCount or nextBet
      }
      else if(thisRoundSide===currResult){
        // Win
        let multiplier = (currResult==="Banker")? 1.95 : 2.0;
        let winnings   = thisRoundBet * multiplier;
        balance += winnings;
        profit  += winnings;
        nextBet   = baseBet;
        currentStreak = currentStreak >= 0 ? currentStreak+1 : 1;
      }
      else {
        // Lost
        loseCount++;
        nextBet  *= increaseOnLoss;
        currentStreak = currentStreak <= 0 ? currentStreak-1 : -1;
        if(currentStreak < highestLosingStreak) highestLosingStreak= currentStreak;
      }
    }
    // If bet=0 => skip => no changes to nextBet or loseCount

    // Track largestBet & lowestBalance
    if(thisRoundBet> largestBetPlaced){
      largestBetPlaced = thisRoundBet;
    }
    if(balance< lowestBalance){
      lowestBalance = balance;
    }

    // Debug logging
    if(debugMode){
      let sideColor = currResult==="Banker" ? "\x1b[31m"
                    : currResult==="Player" ? "\x1b[36m"
                    : "\x1b[33m";
      let resetCol  = "\x1b[0m";
      console.log(
        sideColor + "%s" + resetCol,
        [
          `\n----- BET #${betCount+1} -----`,
          `nonce=${nonce}`,
          //`twoAgoResult=${twoAgoResult || "None"}`,
          //`PrevResult=${prevResult || "None"}`,
          `BetOn=${thisRoundSide} @ ${thisRoundBet.toFixed(4)}`,
          `GameResult=${currResult}`,
          `Balance=${balance.toFixed(4)}`,
          `Profit=${profit.toFixed(4)}`,
          `nextBet=${nextBet.toFixed(4)}`,
          //`loseCount=${loseCount}`,
          `currentStreak=${currentStreak}`,
          `highestLosingStreak=${highestLosingStreak}`,
          `wager=${wager.toFixed(4)}`,
          `nonce=${nonce}`,
          'serverSeed='+serverSeed,
          'clientSeed='+clientSeed,
          `nonce=${nonce}`
        ].join(" | ")
      );

      await betDelay(debugDelay);
    } else {
      // Minimal logs
      if(betCount % 10_000 === 0){
        let elapsed   = (Date.now() - startTime)/1000;
        let bps       = ((betCount+1)/elapsed).toFixed(2);
        let progress  = ((betCount/noBets)*100).toFixed(2);
        console.log(
          `Bets: ${betCount} | Bal: ${balance.toFixed(4)} | Profit: ${profit.toFixed(4)} | BPS: ${bps} | ${progress}% | WLS: ${highestLosingStreak}`
        );
      }
    }

    // Shift results for next iteration
    twoAgoResult = prevResult;
    prevResult   = currResult;
    betCount++;

    // Bust check
    if(nextBet> balance){
      bustLog();
      process.exit();
    }
  }

  // Final summary
  summaryLog();
}

// -------------- Helpers --------------
function betDelay(ms) {
  return new Promise(resolve=> setTimeout(resolve, ms));
}

function bustLog(){
  const red   = "\x1b[31m";
  const green = "\x1b[32m";
  const reset = "\x1b[0m";

  console.log(`${red}BUST!${reset}`);
  console.log(`Server Seed: ${serverSeed}, Client Seed: ${clientSeed}, Nonce: ${nonce}`);
  console.log(`${red}##########################################${reset}`);
  console.log(`${red}# Bet Summary:${reset}`);
  console.log(`${red}# Total Bets: ${betCount}${reset}`);
  console.log(`${red}# Total Profits: ${profit.toFixed(4)}${reset}`);
  console.log(`${green}# Total Wager: ${wager.toFixed(4)}${reset}`);
  console.log(`${red}# No. Banker Wins: ${dealerWinCount}${reset}`);
  console.log(`${red}# No. Player Wins: ${playerWinCount}${reset}`);
  console.log(`${red}# No. Ties: ${tieWinCount}${reset}`);
  console.log(`${red}# Lowest Balance: ${lowestBalance.toFixed(4)}${reset}`);
  console.log(`${red}# Largest Bet: ${largestBetPlaced.toFixed(4)}${reset}`);
  console.log(`${red}# Closing Server Seed: ${serverSeed}${reset}`);
  console.log(`${red}# Closing Client Seed: ${clientSeed}${reset}`);
  console.log(`${red}# Closing Nonce: ${nonce}${reset}`);
  console.log(`${red}##########################################${reset}`);
}

function summaryLog(){
  const green = "\x1b[32m";
  const reset = "\x1b[0m";
  const red   = "\x1b[31m";

  console.log(`${green}##########################################${reset}`);
  console.log(`${green}# Bet Summary:${reset}`);
  console.log(`${green}# Total Bets: ${betCount}${reset}`);
  console.log(`${red}# Highest Losing Streak: ${highestLosingStreak}${reset}`);
  console.log(`${green}# Total Profits: ${profit.toFixed(4)}${reset}`);
  console.log(`${green}# Total Wager: ${wager.toFixed(4)}${reset}`);
  console.log(`${green}# No. Banker Wins: ${dealerWinCount}${reset}`);
  console.log(`${green}# No. Player Wins: ${playerWinCount}${reset}`);
  console.log(`${green}# No. Ties: ${tieWinCount}${reset}`);
  console.log(`${green}# Lowest Balance: ${lowestBalance.toFixed(4)}${reset}`);
  console.log(`${green}# Largest Bet: ${largestBetPlaced.toFixed(4)}${reset}`);
  console.log(`${green}# Closing Server Seed: ${serverSeed}${reset}`);
  console.log(`${green}# Closing Client Seed: ${clientSeed}${reset}`);
  console.log(`${green}# Closing Nonce: ${nonce}${reset}`);
  console.log(`${green}##########################################${reset}`);
}

// -------------- Kick off --------------
runBets();
