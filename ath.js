var logger = require("./logger");
var Web3 = require('web3');
const net = require('net');

var date;
date = new Date();
date = date.getUTCFullYear() + '-' +
    ('00' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
    ('00' + date.getUTCDate()).slice(-2) + ' ' +
    ('00' + date.getUTCHours()).slice(-2) + ':' +
    ('00' + date.getUTCMinutes()).slice(-2) + ':' +
    ('00' + date.getUTCSeconds()).slice(-2);

// create an instance of web3 using the HTTP provider.
//var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8696"));

var web3;
var web3etho;
if (!config.development) {
    web3 = new Web3(new Web3.providers.IpcProvider(process.env.HOME + '/.atheios/gath.ipc', net));
    web3etho = new Web3(new Web3.providers.IpcProvider(process.env.HOME + '/.ether1/geth.ipc', net));
}
else {
    web3 = new Web3(new Web3.providers.IpcProvider(process.env.HOME +'/Library/atheios/gath.ipc', net));
    web3etho = new Web3(new Web3.providers.IpcProvider(process.env.HOME +'/Library/Ether1/geth.ipc', net));
}



var version = web3.version;
const ATHPASS=config.ATHPASS;
const FEE= "0.2";

/*
var subscription = web3.eth.subscribe('pendingTransactions', function(error, result){
    if (!error) {
        logger.info("#server.ath: Subscription: %s",result);
    }
})
    .on("data", function(transaction){
        logger.info("#server.ath: Subscription TX: %s",transaction);
    });
*/

// unsubscribes the subscription
//subscription.unsubscribe(function(error, success){
//    if(success)
//        console.log('Successfully unsubscribed!');
//});

exports.athGetAddress = function(currency, cb) {
    var rows;
    var accounts;
    var athaddress;

    return new Promise( ( resolve, reject ) => {
        switch (currency) {
            case "ATH":
                web3.eth.personal.newAccount(ATHPASS, function (error, athaddress) {
                    if (error) {
                        logger.error("#server.ath.athGetAddress: Cannot create account");
                        reject(error);
                    } else {
                        logger.info("#server.ath.athGetAddress: New ATH address created: %s", athaddress);
                        resolve(athaddress);
                    }
                });
                break;
            case "ETHO":
                web3etho.eth.personal.newAccount(ATHPASS, function (error, ethoaddress) {
                    if (error) {
                        logger.error("#server.ath.athGetAddress: Cannot create account");
                        reject(error);
                    } else {
                        logger.info("#server.ath.athGetAddress: New ETHO address created: %s", ethoaddress);
                        resolve(ethoaddress);
                    }
                });
                break;
            default:
                logger.error('"#server.ath.athGetAddress: Unsupported currency');
                reject("Unsupported currency")
                break;
        }
    });
};

exports.athGetBalance = function(currency, fromaddress, cb) {
    var athamount;
    var ethoamount;


    return new Promise( ( resolve, reject ) => {

        logger.info("#server.ath.athGetBalance: Address to get balance: %s", fromaddress);
        switch (currency) {
            case "ATH":
                web3.eth.getBalance(fromaddress, function (error, weiamount) {
                    if (error) {
                        logger.error("#server.ath.athGetBalance: Error fetching ATH balance: %s", error);
                        reject(error);
                    } else {
                        logger.info("#server.ath.athGetBalance: ATH Amount in Wei %s", weiamount);
                        athamount = web3.utils.fromWei(weiamount.toString(), 'ether');
                        resolve(athamount);
                    }
                });
                break;
            case "ETHO":
                web3etho.eth.getBalance(fromaddress, function (error, weiamount) {
                    if (error) {
                        logger.error("#server.ath.athGetBalance: Error fetching ETHO balance: %s", error);
                        reject(error);
                    } else {
                        logger.info("#server.ath.athGetBalance: ETHO Amount in Wei %s", weiamount);
                        ethoamount = web3etho.utils.fromWei(weiamount.toString(), 'ether');
                        resolve(ethoamount);
                    }
                });

                break;
            default:
                logger.error('"#server.ath.athGetBalance: Unsupported currency');
                reject("Unsupported currency");
                break;

        }
    });
};

exports.athdoWithdraw= function(currency, fromaddress, depositaddr, depositamount, cb) {
    var rows;
    var wb3;

    return new Promise((resolve, reject) => {
        logger.info("#server.ath.athdoWithdraw: Start process for %s", currency);
        switch (currency) {
            case "ATH":
                wb3 = web3;
                break;
            case "ETHO":
                wb3 = web3etho;
                break;
        }
        if (fromaddress == undefined || fromaddress == "") {
            reject("Fromaddress is not valid");
        }
        if (depositaddr == undefined || depositaddr == "") {
            reject("Depositaddress is not valid");
        }
        if (depositamount == 0) {
            reject("Deposit amount is zero");
        }

        const depositweiamount = wb3.utils.toWei(depositamount.toString());
        const BN_depositamount = wb3.utils.toBN(depositweiamount);
        var BN_depositamountwithfee = BN_depositamount.add(wb3.utils.toBN(wb3.utils.toWei(FEE)));
        var depositamountwithfee = wb3.utils.fromWei(BN_depositamountwithfee,"ether");

        logger.info("#server.ath.athdoWithdraw: depositamount %s", depositamount);
        // Now let's check if we have enough money
        exports.athGetBalance(currency, fromaddress)
            .then(async function (amount) {
                var BN_amount = wb3.utils.toWei(amount.toString());
                logger.info("#server.ath.athdoWithdraw: Amount: %s, Withdraw (incl fee) %s", BN_amount.toString(), BN_depositamountwithfee.toString());
                if (BN_depositamountwithfee.lt(BN_amount)) {
                    logger.error("#server.ath.athdoWithdraw: Balance issue: Amount: %s, Withdraw (incl fee) %s", BN_amount.toString(), BN_depositamountwithfee.toString());
                    reject("Not anough money to trigger the transfer. Check Your account");
                } else {
                    // We have, so let's unlock the account
                    // Unlock account for data
                    logger.info("#server.ath.athdoWithdraw: Going to unlock account: %s", fromaddress);
                    await wb3.eth.personal.unlockAccount(fromaddress, ATHPASS, 50)
                        .then(async function () {
                            logger.info("#server.ath.athdoWithdraw: Transferring from: %s, to %s, amount %s", fromaddress, depositaddr, depositamountwithfee);

                            await transfer_ath(currency, fromaddress, depositaddr, depositamountwithfee)
                                .then(function (receipt) {
                                    resolve (receipt);
                                })
                                .catch(function (error) {
                                    reject ("Transfer failed: " + error);
                                })
                        })
                        .catch(function(error) {
                            logger.error("#server.ath.athdoWithdraw: Unlock not successful.");
                            reject("Can't unlock account: " + error);
                        })
                }
            })
            .catch(function (error) {
                logger.error("#server.ath.athdoWithdraw: Error: Unlock unsuccessful: %s", fromaddress);
                reject ("Can't unlock account: " + error);
            })
    });

}




// Send ath from an address to an address and with a certain amount
function transfer_ath(currency, fromaddress, toaddress, amount, cb) {
    var wb3;

    switch (currency) {
        case "ATH":
            wb3=web3;
            break;
        case "ETHO":
            wb3=web3etho;
            break;
    }
    var BN = web3.utils.BN;
    var lo_weiamount = wb3.utils.toWei(amount.toString(), 'ether');
    var BN_amount = wb3.utils.toBN(lo_weiamount);
    var lo_tx = null;

    return new Promise((resolve, reject) => {


        wb3.eth.getGasPrice()
            .then(async function(gasprice) {
                // The amount includes already the trnasfer fee
                logger.info("#server.ath.transfer_ath: Gasprice: %s: ", gasprice);
                const gasprovided=21000;
                var sendAmount = BN_amount.sub(new BN(gasprice*gasprovided*2));
                logger.info("#server.ath.transfer_ath: Send addr: %s, Rec addr %s, Total wei: %s, with fee reduced: %s", fromaddress, toaddress, BN_amount, sendAmount);
                // Prepare the transaction to send the balance
                lo_tx = {
                    from: fromaddress,
                    to: toaddress,
                    gas: gasprovided,
                    value: wb3.utils.toHex(sendAmount)
                };
                logger.info("#server.ath.transfer_ath: Sending transaction ...%s", JSON.stringify(lo_tx));
                await wb3.eth.personal.sendTransaction(lo_tx, ATHPASS, function (error, hash) {
                    if (error) {
                        logger.error("#server.ath.transfer_ath: Cannot send transaction: %s", error);
                        reject(error);

                    } else {
                        logger.info("#server.ath.transfer_ath: Successful transaction: %s", hash);
                        resolve(hash);
                    }
                });
            })
            .catch(function(error) {
                logger.error("#server.ath.transfer_ath: Cannot get pasprice: %s", error);
                reject(error);
            })
    });

}



exports.athGetBlockNumber = function(cb) {
    web3.eth.getBlockNumber(function(error, result) {
        if(!error) {
            logger.info("#server.ath.athGetBlockNumber: blockNumber: %s", result);
            cb(null, result);
        } else {
            logger.error("#server.ath.athGetBlockNumber: Error: %s", error);
            cb(error, null);
        }
    });
};

exports.athGetHashrate = function(cb) {
    web3.eth.getBlockNumber(function(error, blockNum) {
        let sampleSize=4;
        if(!error) {
            web3.eth.getBlock(blockNum, true, function(error, result) {
                let t1=result.timestamp;
                web3.eth.getBlock(blockNum-sampleSize, true, function(error, result2) {
                    let t2=result2.timestamp;
                    let blockTime=(t1-t2)/sampleSize;
                    let difficulty=result.difficulty;
                    let hashrate=difficulty / blockTime;
                    cb(null, hashrate);
                });
            });


        } else {
            logger.error("#server.ath.athGetHashrate: Error: %s", error);
            cb(error, null);
        }
    });

};

exports.athGetBlockTime = function(cb) {
    web3.eth.getBlockNumber(function(error, blockNum) {
        let sampleSize=4;
        if(!error) {
            web3.eth.getBlock(blockNum, true, function(error, result) {
                let t1=result.timestamp;
                web3.eth.getBlock(blockNum-sampleSize, true, function(error, result2) {
                    let t2=result2.timestamp;
                    let blockTime=(t1-t2)/sampleSize;
                    cb(null, blockTime);
                });
            });


        } else {
            logger.error("#server.ath.athGetBlockTima: Error: %s", error);
            cb(error, null);
        }
    });

};

exports.athGetDifficulty = function(cb) {
    web3.eth.getBlockNumber(function(error, blockNum) {
        if(!error) {
            web3.eth.getBlock(blockNum, true, function(error, result) {
                let difficulty=result.difficulty;
                cb(null, difficulty);
            });


        } else {
            console.log("error", error);
            cb(error, null);
        }
    });

};

exports.athGetTransaction = function(cb) {
    var gasUsed=[];

    web3.eth.getBlockNumber(function(error, blockNum) {
        if(!error) {
            web3.eth.getBlock(blockNum, function(error, res) {
                if(!error) {
                    gasUsed[0]=res.gasUsed;
                    web3.eth.getBlock(blockNum-1, function(error, res) {
                        if(!error) {
                            gasUsed[1]=res.gasUsed;
                            web3.eth.getBlock(blockNum-2, function(error, res) {
                                if(!error) {
                                    gasUsed[2]=res.gasUsed;
                                    web3.eth.getBlock(blockNum-3, function(error, res) {
                                        if(!error) {
                                            gasUsed[3]=res.gasUsed;
                                            jsonstr='{ "gas" : [{"blocknr" : '+blockNum+', "gasUsed" : '+gasUsed[0]+'},'+
                                                '{"blocknr" : '+(blockNum-1)+',"gasUsed" : '+gasUsed[1]+'},'+
                                                '{"blocknr" : '+(blockNum-2)+',"gasUsed" : '+gasUsed[2]+'},'+
                                                '{"blocknr" : '+(blockNum-3)+',"gasUsed" : '+gasUsed[3]+'}]}';
                                            cb(null, jsonstr);


                                        } else {
                                            logger.error("#server.ath.athGetTransaction: Error: %s", error);
                                            cb(error, null);
                                        }
                                    });

                                } else {
                                    logger.error("#server.ath.athGetTransaction: Error: %s", error);
                                    cb(error, null);
                                }
                            });

                        } else {
                            logger.error("#server.ath.athGetTransaction: Error: %s", error);
                            cb(error, null);
                        }
                    });


                } else {
                    logger.error("#server.ath.athGetTransaction: Error: %s", error);
                    cb(error, null);
                }
            });



        } else {
            logger.error("#server.ath.athGetTransaction: Error: %s", error);
            cb(error, null);
        }
    });


};

