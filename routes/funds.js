const express = require('express');
const router = express.Router();
const {athGetBalance, athdoWithdraw} = require('../ath');
const { check, validationResult } = require('express-validator');
const logger = require("../logger");
const {MISC_validation, MISC_checkOrigin} = require('../misc');
const Mail=require('../mail');


const TX_FINISHED=1;
const TX_ONGOING=2;


// Funds page
router.get('/funds', async function(req, res) {
    var confmail;
    var currency;
    var title;
    var amount;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Funds";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Funds";
            break;
    }

    if (req.user) {
        // Check if username is already taken
        var sql = "SELECT * FROM user WHERE id=" + req.user.id;
        await pool.query(sql)
        .then(async function (rows) {
            await athGetBalance("ATH", rows[0].athaddr)
                .then(function(athamount) {
                    amount=athamount;
                    return;
                })
                .catch(function (error) {
                    res.render("error", {
                        title: 'Play | Fund management',
                        currency: currency,
                        message: "Atheios connection not working",
                        error: error
                    });
                    confmail = new Mail();
                    confmail.sendMail('play@atheios.org', "Atheios PLAY error (funds)", error + '\nDetails:\n' + error.stack);
                })
            return (rows);
        })
        .then(async function () {
            var vsql = "SELECT *, DATE_FORMAT(startdate, '%d/%m/%Y %H:%i:%s') AS startdate FROM currencytransfer WHERE userid=" + req.user.id + " AND currency='ATH' ORDER BY startdate DESC LIMIT 10";
            await pool.query(vsql)
                .then(function (rows1) {
                    res.render("funds", {
                        title: title,
                        currency: currency,
                        coin: "ATH",
                        version: version,
                        amount: amount,
                        user: req.user,
                        log: rows1,
                        local: config.ATHADDRESS
                    });
                })
                .catch(function (error) {
                    logger.error("#server.funds.get.funds: Error: %s", error);
                    req.flash('danger', 'An error occured: ' + error);
                    res.redirect('/');
                })
        })

    } else {
        req.flash('danger', 'You are logged out');
        res.redirect('/login');

    }
});

// Funds page
router.get('/fundsetho', async function(req, res) {
    var confmail;
    var currency;
    var title;
    var amount;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Funds";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Funds";
            break;
    }

    if (req.user) {
        // Check if username is already taken
        var sql = "SELECT * FROM user WHERE id=" + req.user.id;
        await pool.query(sql)
            .then(async function (rows) {
                await athGetBalance("ETHO", rows[0].ethoaddr)
                    .then(function (ethoamount) {
                        amount=ethoamount;
                        return;
                    })
                    .catch(function (error) {
                        res.render("error", {
                            title: 'Play | Fund management',
                            currency: currency,
                            message: "ETHO connection not working",
                            error: error
                        });
                        confmail = new Mail();
                        confmail.sendMail('play@ether1.org', "Ether1 PLAY error (funds)", error + '\nDetails:\n' + error.stack);
                    });
            })
            .then(async function () {
                var vsql = "SELECT *, DATE_FORMAT(startdate, '%d/%m/%Y %H:%i:%s') AS startdate FROM currencytransfer WHERE userid=" + req.user.id + " AND currency='ETHO' ORDER BY startdate DESC LIMIT 10";
                await pool.query(vsql)
                    .then(function (rows1) {
                        res.render("funds", {
                            title: title,
                            currency: currency,
                            coin: "ETHO",
                            version: version,
                            amount: amount,
                            user: req.user,
                            log: rows1,
                            local: config.ETHOADDRESS
                        });
                    })
                    .catch(function (error) {
                        logger.error("#server.funds.get.funds: Error: %s", error);
                        req.flash('danger', 'An error occured: ' + error);
                        res.redirect('/');
                    })
            })

    } else {
        req.flash('danger', 'You are logged out');
        res.redirect('/logout');

    }
});


// Transfer from B to A account
router.post('/funds/withdraw', [
    check('transferamount').isNumeric().withMessage("Please check the transfer amount. The input should be numeric."),
    check('depositaddr').notEmpty().withMessage("The depositaddress can't be empty.")
], function(req, res){
    if (!MISC_validation(req)) {
        switch (req.body.coin) {
            case "ATH":
                res.redirect('/funds');
                break;
            case "ETHO":
                res.redirect("/fundsetho");
                break;
        }
    } else {
        if (req.user) {
            // Lets first check if the user is already doing a transaction on the blockchain
            pool.queryuser(req.user.id)
                .then(function(rows) {
                    if (rows[0].blockchaintransactsecs!=null && rows[0].blockchaintransactsecs < 60) {
                        // We have a problem, too fast transaction
                        req.flash('danger', 'Wait! Currently You already process with the blockchain, wait for 60 sec.');
                        switch (req.body.coin) {
                            case "ATH":
                                res.redirect('/funds');
                                break;
                            case "ETHO":
                                res.redirect("/fundsetho");
                                break;
                        }
                    }

                    const amount = req.body.transferamount;
                    const depositaddr = req.body.depositaddr;
                    pool.queryathaddr(req.user.id, req.body.coin)
                        .then(async function (address) {
                            var coinaddress;

                            switch (req.body.coin) {
                                case "ATH":
                                    coinaddress = config.ATHADDRESS;
                                    break;
                                case "ETHO":
                                    coinaddress = config.ETHOADDRESS;
                                    break;
                            }
                            logger.info("#server.funds.post.funds.withdraw: Starting withdraw from %s.", address);
                            await athdoWithdraw(req.body.coin, address, coinaddress, transferamount)
                                .then(async function (tx) {
                                    var vsql = "INSERT INTO currencytransfer (userid, amount,fromaddr, toaddr, startdate, enddate, status, tx) VALUES ('" + req.user.id + "','" + amount + "', '" + req.user.athaddr + "', '" + depositaddr + "','" + pool.mysqlNow() + "','" + pool.mysqlNow() + "'," + TX_FINISHED + ",'" + tx + "')";
                                    logger.info("#server.funds.post.funds.withdraw: SQL: %s", vsql);
                                    await pool.query(vsql)
                                        .then(function (rows) {
                                            req.flash('success', 'Funds are withdrawn. It might take a minute to let the blockchain to settle it.');
                                            switch (req.body.coin) {
                                                case "ATH":
                                                    res.redirect('/funds');
                                                    break;
                                                case "ETHO":
                                                    res.redirect("/fundsetho");
                                                    break;
                                            }
                                        })
                                        .catch(function (error) {
                                            logger.error("#server.funds.post.funds.withdraw: Error: %s", error);
                                            req.flash('danger', 'An error occured: ' + error);
                                            switch (req.body.coin) {
                                                case "ATH":
                                                    res.redirect('/funds');
                                                    break;
                                                case "ETHO":
                                                    res.redirect("/fundsetho");
                                                    break;
                                            }
                                        })

                                })
                                .catch(function (error) {
                                    logger.error("#server.funds.post.funds.withdraw: Error: %s", error);
                                    switch (req.body.coin) {
                                        case "ATH":
                                            res.redirect('/funds');
                                            break;
                                        case "ETHO":
                                            res.redirect("/fundsetho");
                                            break;
                                    }
                                })
                        })
                        .catch(function (error) {
                            logger.error("#server.funds.post.funds.withdraw: Error: %s", error);
                            req.flash('danger', 'Please logout and in again');
                            res.redirect('/logout');
                        })
                })
                .catch(function(error) {

                })
            } else {
            req.flash('success', 'User logged out');
            res.redirect('/login');
        }
    }
});

//Transfer from transfer to hot account
router.post('/funds/movetogaming',[
    check('blockchainamount').isNumeric(),
    check('transferamount').isNumeric(),
    check('hotamount').isNumeric()],
    async function(req, res) {
        if (!MISC_validation(req)) {
            switch (req.body.coin) {
                case "ATH":
                    res.redirect('/funds');
                    break;
                case "ETHO":
                    res.redirect("/fundsetho");
                    break;
            }
        } else {
            if (req.user) {
                // Lets firs check if the user is already doing a transaction on the blockchain
                await pool.queryuser(req.user.id)
                    .then(async function (rows) {
                        logger.info("#server.funds.post.funds.movetogaming: Queried: %s", rows[0].blockchaintransactsecs);
                        if (rows[0].blockchaintransactsecs!=null && rows[0].blockchaintransactsecs < 60) {
                            req.flash('danger', "Wait! Currently You already process with the bloxxchain, wait for 60 sec.");
                            switch (req.body.coin) {
                                case "ATH":
                                    res.redirect('/funds');
                                    break;
                                case "ETHO":
                                    res.redirect("/fundsetho");
                                    break;
                            }
                        } else {
                            const blockchainamount = req.body.blockchainamount;
                            const hotamount = req.body.hotamount;
                            var transferamount = req.body.transferamount;

                            errstr = "";
                            if (transferamount > blockchainamount - 0.2)
                                errstr = "Oops, You need to consider the transfer fees. Max transfer amount You can transfer is: " + (blockchainamount - 0.2) + "";
                            if (transferamount < 0)
                                errstr = "Transfer amount needs to be positive.";
                            if (errstr) {
                                req.flash('danger', errstr);
                                switch (req.body.coin) {
                                    case "ATH":
                                        res.redirect('/funds');
                                        break;
                                    case "ETHO":
                                        res.redirect("/fundsetho");
                                        break;
                                }
                            } else {
                                await pool.queryaddr(req.user.id, req.body.coin)
                                    .then(async function (address) {
                                        var coinaddress;

                                        switch (req.body.coin) {
                                            case "ATH":
                                                coinaddress = config.ATHADDRESS;
                                                break;
                                            case "ETHO":
                                                coinaddress = config.ETHOADDRESS;
                                                break;
                                        }
                                        logger.info("#server.funds.post.funds.movetogaming: Starting withdraw from %s.", address);
                                        await athdoWithdraw(req.body.coin, address, coinaddress, transferamount)
                                            .then(async function (tx) {
                                                switch (req.body.coin) {
                                                    case "ATH":
                                                        var vsql = "UPDATE user SET athamount=athamount+" + transferamount.toString() + ", blockchaintransact='" + pool.mysqlNow() + "' WHERE id=" + req.user.id;
                                                        break;
                                                    case "ETHO":
                                                        var vsql = "UPDATE user SET ethoamount=ethoamount+" + transferamount.toString() + ", blockchaintransact='" + pool.mysqlNow() + "' WHERE id=" + req.user.id;
                                                        break;
                                                }
                                                logger.info("#server.funds.post.funds.movetogaming: Update database");
                                                await pool.query(vsql)
                                                    .then(function (rows1) {
                                                        return;
                                                    })
                                                    .catch(function (error) {
                                                        logger.error("#server.funds.post.funds.movetogaming: Error: %s", error);
                                                        req.flash('danger', 'An error occured: ' + error);
                                                        res.redirect('/');
                                                    });
                                                switch (req.body.coin) {
                                                    case "ATH":
                                                        var vsql = "INSERT INTO currencytransfer (userid, currency, amount,fromaddr, toaddr, startdate, enddate, status, tx) VALUES ('" + req.user.id + "','" + req.body.coin + "','" + transferamount + "', '" + req.user.athaddr + "', '" + config.ATHADDRESS + "','" + pool.mysqlNow() + "','" + pool.mysqlNow() + "'," + TX_FINISHED + ",'" + tx + "')";
                                                        break;
                                                    case "ETHO":
                                                        var vsql = "INSERT INTO currencytransfer (userid, currency, amount,fromaddr, toaddr, startdate, enddate, status, tx) VALUES ('" + req.user.id + "','" + req.body.coin + "','" + transferamount + "', '" + req.user.ethoaddr + "', '" + config.ETHOADDRESS + "','" + pool.mysqlNow() + "','" + pool.mysqlNow() + "'," + TX_FINISHED + ",'" + tx + "')";
                                                        break;
                                                }

                                                await pool.query(vsql)
                                                    .then(function (rows1) {
                                                        req.flash('success', 'Funds are withdrawn. It might take a minute to let the blockchain to settle it.');
                                                        switch (req.body.coin) {
                                                            case "ATH":
                                                                res.redirect('/funds');
                                                                break;
                                                            case "ETHO":
                                                                res.redirect("/fundsetho");
                                                                break;
                                                        }
                                                    })
                                                    .catch(function (error) {
                                                        logger.error("#server.funds.post.funds.movetogaming: Error: %s", error);
                                                        req.flash('danger', 'An error occured: ' + error);
                                                        res.redirect('/');
                                                    });

                                            })
                                            .catch(function (error) {
                                                logger.error("#server.funds.post.funds.movetogaming: Error: %s", error);
                                                req.flash('danger', 'An error occured: ' + error);
                                                res.redirect('/');
                                            })

                                    })
                                    .catch(function (error) {
                                            logger.error("#server.funds.post.funds.movetogaming: Error: %s", error);
                                            req.flash('danger', 'An error occured: ' + error);
                                            switch (req.body.coin) {
                                                case "ATH":
                                                    res.redirect('/funds');
                                                    break;
                                                case "ETHO":
                                                    res.redirect("/fundsetho");
                                                    break;
                                            }

                                    })
                            }
                        }
                    })
                    .catch(function (error) {
                            logger.error("#server.funds.post.funds.movetogaming: Error: %s", error);
                            req.flash('danger', 'Please logout and in again');
                            res.redirect('/logout');

                    })
            } else {
                req.flash('danger', 'Please login');
                res.redirect('/login');
            }
        }

    })

// Transfer C to B account
router.post('/funds/movetotransfer', [
    check('athamount').isNumeric(),
    check('transferamount').isNumeric(),
    check('hotamount').isNumeric()],
    async function(req, res){
    if (!MISC_validation(req)) {
        switch (req.body.coin) {
            case "ATH":
                res.redirect('/funds');
                break;
            case "ETHO":
                res.redirect("/fundsetho");
                break;
        }
    } else {

        if (req.user) {
            // Lets firs check if the user is already doing a transaction on the blockchain
            await pool.queryuser(req.user.id)
                .then(async function(rows) {
                    if (rows[0].blockchaintransactsecs!=null && rows[0].blockchaintransactsec < 60) {
                        // We have a problem, too fast transaction
                        req.flash('danger', 'Wait! Currently You already process with the bloxxchain, wait for 60 sec.');
                        switch (req.body.coin) {
                            case "ATH":
                                res.redirect('/funds');
                                break;
                            case "ETHO":
                                res.redirect("/fundsetho");
                                break;
                        }
                    } else {
                        const athamount = req.body.athamount;
                        const hotamount = req.body.hotamount;
                        var transferamount = req.body.transferamount;
                        const depositaddr = req.body.depositaddr;

                        errstr = "";
                        if (transferamount > hotamount - 0.2)
                            errstr = "Max transfer amount is " + (hotamount - 0.2) + " coins";
                        if (transferamount < 0)
                            errstr = "Transfer amount needs to be positive.";
                        if (errstr) {
                            req.flash('danger', errstr);
                            switch (req.body.coin) {
                                case "ATH":
                                    res.redirect('/funds');
                                    break;
                                case "ETHO":
                                    res.redirect("/fundsetho");
                                    break;
                            }
                        } else {

                            await pool.queryaddr(req.user.id, req.body.coin)
                                .then(async function (address) {
                                    var coinaddress;

                                    switch (req.body.coin) {
                                        case "ATH":
                                            coinaddress = config.ATHADDRESS;
                                            break;
                                        case "ETHO":
                                            coinaddress = config.ETHOADDRESS;
                                            break;
                                    }
                                    logger.info("#server.funds.post.funds.movetogaming: Starting withdraw from %s.", address);
                                    var transferamountwithfee = Number(transferamount) + 0.2;
                                    await athdoWithdraw(req.body.coin, coinaddress, address, transferamount)
                                        .then(async function (tx) {

                                            switch (req.body.coin) {
                                                case "ATH":
                                                    var vsql = "UPDATE user SET athamount=athamount-" + transferamountwithfee.toString() + ", blockchaintransact='" + pool.mysqlNow() + "' WHERE id=" + req.user.id;
                                                    break;
                                                case "ETHO":
                                                    var vsql = "UPDATE user SET ethoamount=ethoamount-" + transferamountwithfee.toString() + ", blockchaintransact='" + pool.mysqlNow() + "' WHERE id=" + req.user.id;
                                                    break;
                                            }
                                            logger.info("#server.funds.post.funds.movetotransfer: Update database");
                                            await pool.query(vsql)
                                                .then(function (rows1) {
                                                    return;
                                                })
                                                .catch(function (error) {
                                                    logger.error("#server.funds.post.funds.movetotransfer: Error: %s", error);
                                                    req.flash('danger', 'An error occured: ' + error);
                                                    res.redirect('/');
                                                });
                                            switch (req.body.coin) {
                                                case "ATH":
                                                    var vsql = "INSERT INTO currencytransfer (userid, currency, amount,fromaddr, toaddr, startdate, enddate, status, tx) VALUES ('" + req.user.id + "','" + req.body.coin + "','" + transferamount + "', '" + config.ATHADDRESS + "', '" + req.user.athaddr + "','" + pool.mysqlNow() + "','" + pool.mysqlNow() + "'," + TX_FINISHED + ",'" + tx + "')";
                                                    break;
                                                case "ETHO":
                                                    var vsql = "INSERT INTO currencytransfer (userid, currency, amount,fromaddr, toaddr, startdate, enddate, status, tx) VALUES ('" + req.user.id + "','" + req.body.coin + "','" + transferamount + "', '" + config.ETHOADDRESS + "', '" + req.user.ethoaddr + "','" + pool.mysqlNow() + "','" + pool.mysqlNow() + "'," + TX_FINISHED + ",'" + tx + "')";
                                                    break;
                                            }

                                            await pool.query(vsql)
                                                .then(function (rows1) {
                                                    req.flash('success', 'Funds are withdrawn. It might take a minute to let the blockchain to settle it.');
                                                    switch (req.body.coin) {
                                                        case "ATH":
                                                            res.redirect('/funds');
                                                            break;
                                                        case "ETHO":
                                                            res.redirect("/fundsetho");
                                                            break;
                                                    }
                                                })
                                                .catch(function (error) {
                                                    logger.error("#server.funds.post.funds.movetotransfer: Error: %s", error);
                                                    req.flash('danger', 'An error occured: ' + error);
                                                    res.redirect('/');
                                                });

                                        })
                                        .catch(function (error) {
                                            logger.error("#server.funds.post.funds.movetotransfer: Error: %s", error);
                                            req.flash('danger', 'An error occured: ' + error);
                                            res.redirect('/');
                                        })

                                })
                                .catch(function (error) {
                                    logger.error("#server.funds.post.funds.movetotransfer: Error: %s", error);
                                    req.flash('danger', 'An error occured: ' + error);
                                    switch (req.body.coin) {
                                        case "ATH":
                                            res.redirect('/funds');
                                            break;
                                        case "ETHO":
                                            res.redirect("/fundsetho");
                                            break;
                                    }

                                })
                        }
                    }
                })
                .catch(function (error) {
                    logger.error("#server.funds.post.funds.movetotransfer: Error: %s", error);
                    req.flash('danger', 'Please logout and in again');
                    res.redirect('/logout');

                })
        } else {
            req.flash('danger', 'Please login');
            res.redirect('/login');
        }
    }

})








module.exports = router;
