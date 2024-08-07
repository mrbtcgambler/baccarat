//********************************************************************************************
//** Baccarat PRB based on this video: TBD                                                  **
//** Version: 0.4                                                                           ** 
//** Date: 07/08/2024                                                                       **
//** Authour: MrBtcGambler                                                                  **
//** Start Balance: 40 TRX                                                                  **
//** Recovery Pot: 800 TRX                                                                  **
//** Bust Threshold: 11 TRX                                                                 **
//**                                                                                        **
//** Details:                                                                               **
//** Expirment using qBot: https://qbot.gg/?r=mrbtcgambler                                  **
//** Progressive Recovery Betting is a new concept that is much safer than Martingale       **
//** It flat bets on the basebet until profit is <0 and then adds 20% to the next bet       **
//** Until in profit, it then goes back to flat betting at the base bet                     **
//********************************************************************************************

// ---- game coding ----
let version = 0.4, 
    baseBet = 0.0001,
    tieBet = 0, //Baccarat tie bet amount
    playerBet = 0, //Baccarat player bet amount
    bankerBet = baseBet, //Baccarat banker bet amount
    increaseOnLoss = 2.06; //for full recovery 105.3%

async function doBet() {

    if (win) {
        winCount++;
    }

    if (lost) {
        // example: nextbet = previousBet * increaseOnLoss;
    }

    if (tied) {
        winCount++;
    }

    if (profit >= 0) {
        nextBet = baseBet;
        playerBet = 0; //Baccarat player bet amount
        bankerBet = nextBet; //Baccarat banker bet amount
        } else {
            nextBet = previousBet * 1.2;
            playerBet = 0; //Baccarat player bet amount
            bankerBet = nextBet; //Baccarat banker bet amount
        }

    if (balance >= 44 && profit >= 0){
        await apiClient.depositToVault(config.currency, config.funds.available - 40);
        nextBet = baseBet;
    }

}

// ---- Game functional coding, no need to change ----

import { unlink, access, constants } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import StakeApi from "./StakeApi.mjs";

const clientConfig = JSON.parse(await readFile(new URL('../client_config.json', import.meta.url)));
const serverConfig = JSON.parse(await readFile(new URL('../server_config.json', import.meta.url)));

let config = {
    apiKey: process.env.CLIENT_API_KEY || clientConfig.apiKey,
    password: process.env.CLIENT_PASSWORD || clientConfig.password,
    twoFaSecret: process.env.CLIENT_2FA_SECRET || clientConfig.twoFaSecret || null,
    currency: process.env.CLIENT_CURRENCY || clientConfig.currency,
    recoverAmount: process.env.SERVER_RECOVER_AMOUNT || serverConfig.recoverAmount,
    recoverThreshold: process.env.CLIENT_RECOVER_THRESHOLD || clientConfig.recoverThreshold,
    funds: null
};

const apiClient = new StakeApi(config.apiKey);
config.funds = await apiClient.getFunds(config.currency);

await apiClient.depositToVault(config.currency, config.funds.available - clientConfig.recoverThreshold);
await new Promise(r => setTimeout(r, 2000));

let balance = config.funds.available, //sytem variables - do not change
    game = "baccarat",
    stage = 1, //not used but on the main server page
    betDelay = 40, // delay in milliseconds
    currentStreak = 0,
    profit = 0,
    vaulted = 0,
    wager = 0,
    bets = 0,
    winCount = 0,
    highestLosingStreak = 0,
    lastHourBets = [],
    paused = false,
    win = false,
    tied = false,
    lost = false,
    pauseLogged = false,
    previousBet = baseBet,
    nextBet = baseBet,
    totalBet = (tieBet + playerBet + bankerBet);

function getBetsPerHour() {
    const now = +new Date();
    lastHourBets = lastHourBets.filter((timestamp) => now - timestamp <= 60 * 60 * 1000);

    return lastHourBets.length;
}


// Delete old state file
const dicebotStateFilename = new URL('/mnt/ramdrive/dicebot_state.json', import.meta.url);
access(dicebotStateFilename, constants.F_OK, (error) => {
    if (!error) {
        unlink(dicebotStateFilename, (err) => {
        });
    }
});

async function writeStatsFile() {
    await writeFile(dicebotStateFilename, JSON.stringify({
        bets: bets,
        stage: stage,
        wager: wager,
        vaulted: vaulted,
        profit: profit,
        betSize: nextBet,
        currentStreak: currentStreak,
        highestLosingStreak: highestLosingStreak,
        betsPerHour: getBetsPerHour(),
        lastBet: (new Date()).toISOString(),
        wins: winCount,
        losses: (bets - winCount),
        version: version,
        paused: paused
    }));
}

let newBalance = null,
    roundProfit = 0,
    pauseFileUrl = new URL('pause', import.meta.url);
while (true) {
    
    access(pauseFileUrl, constants.F_OK, (error) => {
        paused = !error;
    });

    if (paused) {
        if (!pauseLogged) {
            console.log('[INFO] Paused...');
            pauseLogged = true;
        }
        await writeStatsFile();
        await new Promise(r => setTimeout(r, 1000));
        continue;
    } else {
        pauseLogged = false; // Reset the flag when not paused
    }

    if (game === "baccarat") {
        try {

            let baccaratBet;
    
            baccaratBet = await apiClient.baccaratBet(tieBet, playerBet, bankerBet, config.currency).then(async (result) => {
                try {
                    const data = JSON.parse(result);
    
                    if (data.errors) {
                        console.error('[ERROR] baccaratBet response: ', data);
    
                        config.funds = await apiClient.getFunds(config.currency);
                        balance = config.funds.available;
    
                        return null;
                    }
    
                    return data.data.baccaratBet;
                } catch (e) {
                    console.error('[ERROR]', e, result);
    
                    config.funds = await apiClient.getFunds(config.currency);
                    balance = config.funds.available;
    
                    return null;
                }
            }).catch(error => console.error(error));
    
            if (!baccaratBet || !baccaratBet.state) {
                //aconsole.log('[ERROR] Pausing for 5 seconds...', baccaratBet);
                await new Promise(r => setTimeout(r, 5000));
    
                continue;
            }
    
            newBalance = baccaratBet.user.balances.filter((balance) => balance.available.currency === config.currency)[0];
            config.funds = {
                available: newBalance.available.amount,
                vault: newBalance.vault.amount,
                currency: config.currency
            };
    
            balance = config.funds.available;
            totalBet = (tieBet + playerBet + bankerBet);
            wager += totalBet;
            bets++;
            lastHourBets.push(+new Date());
    
            if (baccaratBet.payoutMultiplier >= 1.001) {
                win = true;
            } else {
                win = false;
            }
    
            if (baccaratBet.payoutMultiplier === 1) {
                tied = true;
            } else {
                tied = false;
            }
    
            if (baccaratBet.payoutMultiplier <= 0.99) {
                lost = true;
            } else {
                lost = false;
            }
   
            if (win) {
                profit = (profit + ((totalBet * baccaratBet.payoutMultiplier)) - nextBet); 
                if (currentStreak >= 0) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
            }
    
            if (tied) {
                //TBD
            }
    
            if (lost) {
                if (currentStreak <= 0) {
                    currentStreak--;
                } else {
                    currentStreak = -1;
                }
                if (baccaratBet.payoutMultiplier === 0){
                    profit = (profit - totalBet);
                }else {
                    profit = (profit - (totalBet * baccaratBet.payoutMultiplier));
                }
            }
    
            console.log(
                win ? '\x1b[32m%s\x1b[0m' : (tied ? '\x1b[33m%s\x1b[0m' : '\x1b[37m%s\x1b[0m'),
                [
                    'Game: ' + game,
                    'Banker: ' + bankerBet.toFixed(4),
                    'Player: ' + playerBet.toFixed(4),
                    'Tie: ' + tieBet.toFixed(4),
                    'Total Bet: ' + totalBet.toFixed(4),
                    'Game Result: ' + (win ? 'Win' : (tied ? 'Tied' : 'Lose')), // Added game result
                    'Payout: ' + baccaratBet.payoutMultiplier,
                    'Current streak: ' + currentStreak,
                    'Balance: ' + balance.toFixed(4),
                    'Profit: ' + previousBet.toFixed(6),
                ].join(' | ')
            );
    
            await doBet();
    
            previousBet = nextBet;
            if (currentStreak < 0) {
                highestLosingStreak = Math.max(highestLosingStreak, Math.abs(currentStreak));
            }
    
            await writeStatsFile();
            await new Promise(r => setTimeout(r, betDelay));
        } catch (e) {
            console.error('[ERROR]', e);
    
            config.funds = await apiClient.getFunds(config.currency);
            balance = config.funds.available;
        }
    }
    
}
