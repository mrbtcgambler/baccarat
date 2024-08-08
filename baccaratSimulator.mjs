import crypto from 'crypto';
const debugMode = true; // Set to true for detailed logging, false for simpler logs

//Game Play Variables, try new ideas
let noBets = 1680000, //240000 = 1 day, 1680000 = 1 week, 7200000 = 1 Month 86400000 = 1 year
    startBalance = 40040,
    baseBet = 0.002,
    bankerBetAmount = baseBet,
    playerBetAmount = 0,
    tieBetAmount = 0,
    increaseOnLoss = 2.06, //for full recovery 105.3%
    debugDelay = 1000, //in milliseconds 1 second = 1000
//Sytem Variables - No need to modify
    balance = startBalance,
    nextBet = baseBet,
    previousBet = baseBet,
    tieBet = tieBetAmount,
    playerBet = playerBetAmount,
    bankerBet = bankerBetAmount,
    totalBet = (bankerBet + playerBet + tieBet),
    currentStreak = 0,
    highestLosingStreak = 0,
    dealerWinCount = 0,
    playerWinCount = 0,
    tieWinCount = 0,
    bankerWinStreak = 0,
    playerWinStreak = 0,
    winCount = 0,
    tiedCount = 0,
    loseCount = 0,
    maxBankerWinStreak = 0,
    maxPlayerWinStreak = 0,
    maxTieWinStreak = 0,
    lowestBalance = startBalance,
    largestBetPlaced = baseBet,
    profit = 0,
    wager = 0,
    win = false,
    tied = false,
    lose = false,
    progress;

    const CARDS = [
      'D2', 'H2', 'S2', 'C2', 'D3', 'H3', 'S3', 'C3',
      'D4', 'H4', 'S4', 'C4', 'D5', 'H5', 'S5', 'C5',
      'D6', 'H6', 'S6', 'C6', 'D7', 'H7', 'S7', 'C7',
      'D8', 'H8', 'S8', 'C8', 'D9', 'H9', 'S9', 'C9',
      'D10', 'H10', 'S10', 'C10', 'DJ', 'HJ', 'SJ', 'CJ',
      'DQ', 'HQ', 'SQ', 'CQ', 'DK', 'HK', 'SK', 'CK',
      'DA', 'HA', 'SA', 'CA'
    ];
    
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
    
    function bytesToFloat(bytes) {
      let [b1, b2, b3, b4] = bytes;
      return (
        (b1 / 256) +
        (b2 / Math.pow(256, 2)) +
        (b3 / Math.pow(256, 3)) +
        (b4 / Math.pow(256, 4))
      );
    }
    
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
    
    function mapFloatToCard(float) {
      const index = Math.floor(float * 52);
      const card = CARDS[index];
      return card;
    }
    
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
    
      if (finalPlayerScore > finalBankerScore) {
        gameResult = 'Player Win';
      } else if (finalPlayerScore < finalBankerScore) {
        gameResult = 'Banker Win';
      } else {
        gameResult = 'Tie';
      }
      return gameResult;
    }
    
    const serverSeed = generateRandomServerSeed(64);
    const clientSeed = generateRandomClientSeed(10);
    const startNonce = Math.floor(Math.random() * 1000000) + 1;
    const startTime = Date.now();
    let nonce = startNonce;
    
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
    }
    let gameResult;
    let tieWinStreak = 0;
    
  function betDelay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }      

async function runBets() {
  let betCount = 0;
  while (betCount < noBets) {
    nonce++;
    progress = (betCount / noBets) * 100;
    let result = determineBaccaratResult(serverSeed, clientSeed, nonce);
    let bankerWin = 0;
    let playerWin = 0;
    let tieWin = 0;
    let payoutMultiplier = 0;

    totalBet = bankerBet + playerBet + tieBet;
    wager += totalBet;

    if (totalBet > balance) {

      const redText = '\x1b[31m'; // ANSI escape code for red text
      const resetText = '\x1b[0m'; // ANSI escape code to reset text color
      console.log(`${redText}BUST!${resetText}`);
      console.log('Server Seed:', serverSeed, 'Client Seed:', clientSeed, 'Nonce:', nonce);
      console.log(`${redText}##########################################${resetText}`);
      console.log(`${redText}# Bet Summary:${resetText}`);
      console.log(`${redText}# Total Bets: ${betCount}`);
      console.log(`${redText}# Total Profits: ${profit.toFixed(4)}${resetText}`);
      console.log(`${redText}# Total Wager: ${wager.toFixed(4)}${resetText}`);
      console.log(`${redText}# Worst Lose Streak: ${highestLosingStreak}${resetText}`);
      console.log(`${redText}# No. Banker Wins: ${dealerWinCount}${resetText}`);
      console.log(`${redText}# Max Banker Win Streak: ${maxBankerWinStreak}${resetText}`);
      console.log(`${redText}# No. Player Wins: ${playerWinCount}${resetText}`);
      console.log(`${redText}# Max Player Win Streak: ${maxPlayerWinStreak}${resetText}`);
      console.log(`${redText}# No. Tied Wins: ${tieWinCount}${resetText}`);
      console.log(`${redText}# Max Tied Win Streak: ${maxTieWinStreak}${resetText}`);
      console.log(`${redText}# Lowest Balance during play: ${lowestBalance.toFixed(4)}${resetText}`);
      console.log(`${redText}# Largest Bet placed: ${largestBetPlaced.toFixed(4)}${resetText}`);
      console.log(`${redText}# Closing Server Seed: ${serverSeed}${resetText}`);
      console.log(`${redText}# Closing Client Seed: ${clientSeed}${resetText}`);
      console.log(`${redText}# Closing Nonce: ${nonce}${resetText}`);
      console.log(`${redText}##########################################${resetText}`);
      process.exit();
    }

    balance -= totalBet;

    if (result === "Banker Win") {
      if (bankerBet > 0) {
        payoutMultiplier = 1.95;
        bankerWin = bankerBet * payoutMultiplier;
        balance += bankerWin;
      }
      dealerWinCount++;
      bankerWinStreak++;
      playerWinStreak = 0;
      tieWinStreak = 0;
      if (bankerWinStreak > maxBankerWinStreak) {
        maxBankerWinStreak = bankerWinStreak;
      }
    } else if (result === "Player Win") {
      if (playerBet > 0) {
        payoutMultiplier = 2;
        playerWin = playerBet * payoutMultiplier;
        balance += playerWin;
      }
      playerWinCount++;
      playerWinStreak++;
      bankerWinStreak = 0;
      tieWinStreak = 0;
      if (playerWinStreak > maxPlayerWinStreak) {
        maxPlayerWinStreak = playerWinStreak;
      }
    } else {
      if (tieBet > 0) {
        payoutMultiplier = 9;
        tieWin = tieBet * payoutMultiplier;
        balance += tieWin;
      } else {
        payoutMultiplier = 1;
      }
      tieWinCount++;
      tieWinStreak++;
      bankerWinStreak = 0;
      playerWinStreak = 0;
      if (tieWinStreak > maxTieWinStreak) {
        maxTieWinStreak = tieWinStreak;
      }
    }

    const totalWin = bankerWin + playerWin + tieWin;
    profit = balance - startBalance;

    if (totalWin > totalBet) {
      win = true;
      winCount++;
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
    }
    if (totalWin === totalBet) {
      tied = true;
      tiedCount++;
      currentStreak = 0;
    }
    if (totalWin < totalBet) {
      lose = true;
      loseCount++;
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      if (currentStreak < highestLosingStreak) {
        highestLosingStreak = currentStreak;
      }
    }

    if (balance < lowestBalance) {
      lowestBalance = balance;
    }

    if (totalBet > largestBetPlaced) {
      largestBetPlaced = totalBet;
    }

    if (debugMode) {
      console.log ('Server Seed: ' + serverSeed, 'Client Seed: ' + clientSeed, 'Nonce: ' +nonce, 'Bet Count: ' + betCount, 'Ties: ' + tiedCount, 'Wins: ' + winCount, 'Losses: ' + loseCount);
      console.log('Game Result: ' + result);
      console.log('Bet Profit: ' + (totalWin - totalBet).toFixed(8));
      console.log('Multiplier: ' + payoutMultiplier);
      console.log('Total Profit: ' + profit.toFixed(8));
      console.log('Balance: ' + balance.toFixed(8));
      console.log('Variance: ' + (balance - startBalance).toFixed(8));
      console.log('Variance: ' + (balance - startBalance).toFixed(8));
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
      await betDelay(debugDelay); // Delay between each round when in debug mode    
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

    if (win){
      //previousBet =nextBet;
      //nextBet = baseBet;
      //bankerBet = nextBet;
      //playerBet = 0;
      //tieBet = 0;
    }
    if (tied){

    }
    if (lose){
      //previousBet =nextBet;
      //nextBet = (previousBet * increaseOnLoss);
      //bankerBet = nextBet;
      //playerBet = 0;
      //tieBet = 0;
    }

    if (profit >= 0) {
      nextBet = baseBet;
      bankerBet = nextBet;
      playerBet = 0;
      tieBet = 0;
    } else {
      nextBet = (nextBet + (nextBet * 0.2));
      bankerBet = nextBet;
      playerBet = 0;
      tieBet = 0;
    }

    betCount++;
  }

  // Display the summary log
  const greenText = '\x1b[32m'; // ANSI escape code for green text
  const resetText = '\x1b[0m'; // ANSI escape code to reset text color
  
  console.log(`${greenText}##########################################${resetText}`);
  console.log(`${greenText}# Bet Summary:${resetText}`);
  console.log(`${greenText}# Total Bets: ${noBets}${resetText}`);
  console.log(`${greenText}# Total Profits: ${profit.toFixed(4)}${resetText}`);
  console.log(`${greenText}# Total Wager: ${wager.toFixed(4)}${resetText}`);
  console.log(`${greenText}# Worst Lose Streak: ${highestLosingStreak}${resetText}`);
  console.log(`${greenText}# No. Banker Wins: ${dealerWinCount}${resetText}`);
  console.log(`${greenText}# Max Banker Win Streak: ${maxBankerWinStreak}${resetText}`);
  console.log(`${greenText}# No. Player Wins: ${playerWinCount}${resetText}`);
  console.log(`${greenText}# Max Player Win Streak: ${maxPlayerWinStreak}${resetText}`);
  console.log(`${greenText}# No. Tied Wins: ${tieWinCount}${resetText}`);
  console.log(`${greenText}# Max Tied Win Streak: ${maxTieWinStreak}${resetText}`);
  console.log(`${greenText}# Lowest Balance during play: ${lowestBalance.toFixed(4)}${resetText}`);
  console.log(`${greenText}# Largest Bet placed: ${largestBetPlaced.toFixed(4)}${resetText}`);
  console.log(`${greenText}# Closing Server Seed: ${serverSeed}${resetText}`);
  console.log(`${greenText}# Closing Client Seed: ${clientSeed}${resetText}`);
  console.log(`${greenText}# Closing Nonce: ${nonce}${resetText}`);
  console.log(`${greenText}##########################################${resetText}`);
  
}

runBets();
