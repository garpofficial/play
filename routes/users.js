const express = require('express');
const router = express.Router();
const logger = require("../logger");
const bcrypt = require('bcryptjs');
const passport = require('passport');
const {athGetAddress, athGetBalance, athdoWithdraw} = require('../ath');
const Mail=require('../mail');
const {MISC_validation, MISC_makeid, MISC_maketoken, MISC_checkOrigin} = require('../misc');
const { check } = require('express-validator');

const TX_FINISHED=1;
const TX_ONGOING=2;



//     /$$$$$$  /$$$$$$$$ /$$$$$$$$
//     /$$__  $$| $$_____/|__  $$__/
//    | $$  \__/| $$         | $$
//    | $$ /$$$$| $$$$$      | $$
//    | $$|_  $$| $$__/      | $$
//    | $$  \ $$| $$         | $$
//    |  $$$$$$/| $$$$$$$$   | $$
//     \______/ |________/   |__/

// Register Form
router.get('/register', function(req, res){
    var currency;
    var title;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Register";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Register";
            break;
    }

    res.render('register', {
        title: title,
        currency: currency
    });

});

// Register Form
router.get('/reset', function(req, res){
    var currency;
    var title;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Reset";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Reset";
            break;
    }

    res.render('reset', {
        title: title,
        currency: currency
    });

});


// Register Form
router.get('/consistency', async function(req, res){
    var currency;
    var title;
    var text;

    var currency;
    var title;

    logger.info("#server.routes.index.get: %s", req.headers.host)
    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Consistency";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Consistency";
            break;
    }

    // Check if username is already taken
    var sql = "SELECT * FROM user";
    logger.info("SQL: %s", sql);
    text="";
    await pool.query(sql)
        .then(async function(rows) {
            logger.info("#server.routes.users.get.consistency: Queried");

            text += "Starting ...<br>";
            for (let i = 0, id=1; i < rows.length; i++, id++) {
                logger.info("#server.routes.users.get.consistency: %i", id);
                text += "id: " + id;
                if (rows[i].athaddr == null || rows[i].athaddr == 'undefined') {
                    await athGetAddress("ATH")
                        .then(async function(athaddress) {
                            text += ", New ATH address: " + athaddress;
                            var vsql = "UPDATE user SET athaddr='" + athaddress + "', athamount=0 WHERE id=" + id;
                            await pool.query(vsql)
                                .then(function (rows) {
                                    logger.info("server.routes.users.get.activate: ATH address stored for %s", id);
                                })
                        })
                        .catch(function(error) {
                            logger.error("#server.routes.users.get.consistency: Error %s", error);
                            throw(error);
                        })
                } else {
                    text += ", Existing ATH address: " + rows[i].athaddr + "\n";
                    logger.info("Existing ATH address: %s", rows[i].athaddr);
                }

                if (rows[i].ethoaddr == null || rows[i].ethoaddr == 'undefined') {
                    logger.info("ETHO is null: %s", id);
                    await athGetAddress("ETHO")
                        .then(async function(ethoaddress) {
                            logger.info("Assigning ETHO: %s", ethoaddress);

                            text += ", New ETHO address: " + ethoaddress;
                            var vsql = "UPDATE user SET ethoaddr='" + ethoaddress + "', ethoamount=0 WHERE id=" + id;
                            logger.info("SQL: %s", vsql);

                            await pool.query(vsql)
                                .then(function (rows) {
                                    logger.info("server.routes.users.get.activate: ETHO address stored for %s", id);
                                })
                        })
                        .catch(function(error) {
                            logger.error("#server.routes.users.get.consistency: Error %s", error);
                            throw(error);
                        })

                } else {
                    text += ", Existing ETHO address: " + rows[i].ethoaddr + "";
                    logger.info("Existing ETHO address: %s", rows[i].ethoaddr);

                }

                logger.info("#server.routes.users.get.consistency: Next");
            }
            logger.info("#server.routes.users.get.consistency: Loop finished");
            return(text);
        })
        .then(function(text) {
            logger.info("#server.routes.users.get.activate: Render: %s", text);
            res.render('consistency', {
                title: title,
                currency: currency,
                consistencyinfo: text
            });
        })
        .catch(function(error) {
            logger.error("#server.routes.users.get.consistency: Error %s", error);
        })

});


// Reset Form
router.get('/resetpassword', function(req, res){
    var currency;
    var title;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Reset password";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Reset password";
            break;
    }

    res.render('resetpassword', {
        title: title,
        currency: currency
    });

});


// logout
router.get('/logout', function(req, res){
    req.logout();
    req.flash('success', 'You are logged out');
    res.redirect('/login');
});

// Confirmation Proccess
router.get('/activate', function(req, res){
    var option=0;
    var currency;
    var title;
    var athaddress;
    var ethoaddress;
    var tx;

    logger.info("#server.routes.get.activate: %s", req.headers.host)
    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Home";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Home";
            break;
    }

    logger.info("#server.routes.users.get.activate: id: %s",req.query.id);
    var sql = "SELECT * FROM user WHERE rand = " + pool.escape(req.query.id);
    pool.query(sql, async function (error, rows, fields) {
        if (error) {
            logger.error("#server.routes.users.get.activate: %s",error);
            throw error;
        }
        if (rows.length == 1) {
            if (rows[0].options & 8 == 0) {
                req.flash('danger', 'Account already activated.');
                res.redirect('/register');
            } else {
                // clear the activation pending flag
                var newoption = rows[0].options & 247;
                var athamount = 0;
                if (rows[0].options & 4) {
                    athamount = 10;
                }

                // We need to get for the user all available coind addreses
                athaddress = await athGetAddress("ATH")
                    .then(async function (address) {
                        return (address);
                    })
                    .catch(function (error) {
                        logger.error("#server.routes.users.get.activate: %s", error);
                        req.flash('danger', 'An error occured: ' + error + ' Retry in a couple of minutes.');
                        res.redirect('/login');
                    })
                if (athaddress!=undefined) {
                    ethoaddress = await athGetAddress("ETHO")
                        .then(async function (address) {
                            return (address);
                        })
                        .catch(function (error) {
                            logger.error("#server.routes.users.get.activate: %s", error);
                            req.flash('danger', 'An error occured: ' + error + ' Retry in a couple of minutes.');
                            res.redirect('/login');
                        })
                    if (ethoaddress!=undefined) {
                        if (athamount > 0) {
                            tx = await athdoWithdraw(currency, config.NEWUSERFUNDADDRESS, config.ATHADDRESS, athamount)
                                .then(async function (tx) {
                                    return (tx);
                                })
                                .catch(function (error) {
                                    logger.error("#server.routes.users.get.activate: %s", error);
                                    req.flash('danger', 'An error occured: ' + error + ' Retry in a couple of minutes.');
                                    res.redirect('/login');
                                })
                            if (tx!=undefined) {
                                var vsql = "INSERT INTO currencytransfer (userid, amount,fromaddr, toaddr, startdate, enddate, status, tx) VALUES ('" + req.user.id + "','" + athamount + "', '" + config.NEWUSERFUNDADDRESS + "', '" + config.ATHADDRESS + "','" + pool.mysqlNow() + "','" + pool.mysqlNow() + "'," + TX_FINISHED + ",'" + tx + "')";
                                await pool.query(vsql)
                                    .then(function (rows) {
                                        req.flash('success', 'Funds are withdrawn. It might take a minute to let the blockchain to settle it.');
                                        res.redirect('/funds');
                                    })
                                    .catch(function (error) {
                                        logger.error("#server.funds.post.funds.withdraw: Error: %s", error);
                                        req.flash('danger', 'An error occured: ' + error);
                                        res.redirect('/funds');
                                    })
                            }
                        }

                        logger.info('#server.routes.user.activate: Update registration.');
                        // In no money needs to be moved and we activate the account
                        var vsql;
                        switch (currency) {
                            case "ATH":
                                vsql = "UPDATE user SET athaddr='" + athaddress + "', ethoaddr='" + ethoaddress + "', athamount=" + athamount + ", ethoamount=0, rand=0, options=" + newoption + " WHERE rand='" + req.query.id + "'";
                                break;
                            case "ETHO":
                                vsql = "UPDATE user SET athaddr='" + athaddress + "', ethoaddr='" + ethoaddress + "', athamount=0, ethoamount=0, rand=0, options=" + newoption + " WHERE rand='" + req.query.id + "'";
                                break;
                        }
                        await pool.query(vsql)
                            .then(function (rows) {
                                req.flash('success', 'Account is activated');
                                res.redirect('/login');
                            })
                            .catch(function (error) {
                                logger.error("#server.routes.users.get.activate: %s", error);
                            })
                    }
                }
            }
        } else {
            logger.error("#server.routes.users.get.activate: Number of matches to large: %s",rows.length);
            switch (currency) {
                case "ATH":
                    req.flash('danger', 'Account problem. Please contact: contact@atheios.org');
                    break;
                case "ETHO":
                    req.flash('danger', 'Account problem. Please contact: play@ether1.org');
                    break;
            }
            res.redirect('/login');

        }
    });
});

// Login Form
router.get('/login', function(req, res){
    var currency;
    var title;

    logger.info("#server.routes.index.get: %s", req.headers.host)
    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Login";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Login";
            break;
    }

    res.render('login', {
        title: title,
        currency: currency
    });

});

// Login Form
router.get('/register', function(req, res){
    var currency;
    var title;

    logger.info("#server.routes.index.get: %s", req.headers.host)
    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Register";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Register";
            break;
    }

    var captcha=true;
    res.render('register', {
        title: title,
        currency: currency,
        version: version,
        captcha: true
    });
});



// Account Form
router.get('/account', function(req, res){
    var currency;
    var title;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Account";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Account";
            break;
    }

    if (req.user) {
        var vsql="SELECT * FROM user WHERE id="+req.user.id;

        pool.query(vsql, async function (error, rows, fields) {
            if (error) {
                logger.error('#server.users.get.account: Error %s', error);
                throw error;
            }

            res.render("account", {
                title: title,
                version: version,
                currency: currency
            });

        });
    } else {
        req.flash('success', 'You are logged out');
        res.redirect('/login');
    }
});


//    /$$$$$$$   /$$$$$$   /$$$$$$  /$$$$$$$$
//    | $$__  $$ /$$__  $$ /$$__  $$|__  $$__/
//    | $$  \ $$| $$  \ $$| $$  \__/   | $$
//    | $$$$$$$/| $$  | $$|  $$$$$$    | $$
//    | $$____/ | $$  | $$ \____  $$   | $$
//    | $$      | $$  | $$ /$$  \ $$   | $$
//    | $$      |  $$$$$$/|  $$$$$$/   | $$
//    |__/       \______/  \______/    |__/

// Register Proccess
router.post('/register', [
    check('email', 'Email is not valid').isEmail().isLength({min:3, max:255}).withMessage('The email should be between 3 and 255 char long'),
    check('displayname', 'Displayname is required').notEmpty().isLength({min:3, max:20}).withMessage('The display name should be between 3 and 20 char long'),
    check('username', 'Username is required').notEmpty().isLength({min:3, max:20}).withMessage('The user name should be between 3 and 20 char long'),
    check('password', 'Password is required').notEmpty().isLength({min:3, max:255}).withMessage('The password should be between 3 and 20 char long')
],function(req, res){
    const emailaddr = req.body.email;
    const username = req.body.username;
    const displayname = req.body.displayname;
    const password = req.body.password;
    const depositaddr = req.body.depositaddr;
    // Some explaining here
    // The option field in the user database
    // bit 0
    // bit 1
    // bit 2 User has asked for 10 ATH deposit
    // bit 3 User has registered but is not yet confirmed
    var option;
    if (req.body.newuser==="on")
        option=4+8;
    else
        option=8;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            sender="contact@atheios.org";
            currency="ATH";
            baseurl="https://play.atheios.org";
            break;
        case "ETHO":
            sender="play@ether1.org";
            currency="ETHO";
            baseurl="https://play.ether1.org";
            break;
    }

    if (!MISC_validation(req)) {
        res.redirect('/register');
    } else {
        // Check if username is already taken
        var sql = "SELECT * FROM user WHERE email = " + pool.escape(emailaddr);
        pool.query(sql, function (error, rows, fields) {
            if (error) {
                logger.error('#server.users.post.register: Error %s', error);
                throw error;
            } else {
                if (rows.length == 0) {
                    var sql = "SELECT * FROM user WHERE username = " + pool.escape(username);
                    pool.query(sql, function (error, rows, fields) {
                        if (error) {
                            logger.error('#server.users.post.register: Error %s', error);
                            throw error;
                        } else {
                            if (rows.length == 0) {
                                bcrypt.genSalt(10, function (err, salt) {
                                    bcrypt.hash(password, salt, function (err, hash) {
                                        if (err) {
                                            logger.error('#server.users.post.register: Error %s', err);
                                        }
                                        var rand = makeid(50);
                                        var vsql = "INSERT INTO user (username, displayname, email, password, depositaddr, ethodepositaddr, athamount, ethoamount, logincnt, lastlogin, register, rand, options) VALUES (" + pool.escape(username) + "," + pool.escape(displayname) + "," + pool.escape(emailaddr) + ", '" + hash + "', '', '', 0, 0, 0,'" + pool.mysqlNow() + "','" + pool.mysqlNow() + "', '" + rand + "'," + option + ")";
                                        pool.query(vsql, function (error, rows, fields) {
                                            if (error) {
                                                logger.error('#server.users.post.register: Error %s', error);
                                                throw error;
                                            } else {
                                                email
                                                    .send({
                                                        template: 'register',
                                                        message: {
                                                            to: emailaddr,
                                                            from: sender
                                                        },
                                                        locals: {
                                                            name: displayname,
                                                            baseurl: baseurl,
                                                            activationurl: baseurl + '/activate?id=' + rand,
                                                            currency: currency,
                                                            date: pool.mysqlNow()
                                                        }
                                                    })
                                                    .then(logger.info("#server.route.post.register: Activation email sent."))
                                                    .catch(console.error);

                                                req.flash('success', 'Account is registered, but needs to be activated. Check Your email address: ' + emailaddr);
                                                res.redirect('/account');
                                            }
                                        });
                                    });
                                });
                            } else {
                                req.flash('danger', 'The username is already taken.');
                                res.redirect('/register');
                            }
                        }
                    });
                } else {
                    req.flash('danger', 'Email is already taken.');
                    res.redirect('/register');
                }
            }
        });
    }
});




router.post('/updateemail', [
    check('email', 'Email is required').notEmpty(),
    check('email', 'Email is not valid').isEmail()
], async function(req, res){
    if (req.user) {
        const email = req.body.email;

        if (!MISC_validation(req)) {
            res.redirect('/update');
        } else {
            // First check if the email is already taken
            var vsql = "SELECT * FROM user WHERE email=" + pool.escape(email);
            rows= await pool.query(vsql)
                .then(function(rows) {
                    return(rows);
                })
                .catch(function(error) {
                    logger.error('#server.routes.users.post.update: Error: %s',error);
                })
            if (rows.length>0) {
                req.flash('danger', 'Email already taken. Choose another one.');
                res.redirect('/account');
            }


            var vsql = "UPDATE user SET email=" + pool.escape(email) + " WHERE id=" + parseInt(req.user.id);
            rows=await pool.query(vsql)
                .then(function(rows) {
                    req.flash('success', 'Email updated.');
                    res.redirect('/account');
                })
                .catch(function(error) {
                    logger.error('#server.routes.users.post.updateemail: Error: %s',error);
                })
        }
    }
    else {
        req.flash('success', 'User logged out');
        res.redirect('/login');

    }
});

router.post('/updateusername', [
    check('username').notEmpty(),
    check('username').isLength( {min: 1, max:20}).withMessage("Your username should be at least 1 max 20 char long")
], async function(req, res){
    if (req.user) {
        const username = req.body.username;

        if (!MISC_validation(req)) {
            res.redirect('/update');
        } else {
            // First check if the username is already taken
            var vsql = "SELECT * FROM user WHERE username=" + pool.escape(username);
            rows= await pool.query(vsql)
                .then(function(rows) {
                    return(rows);
                })
                .catch(function(error) {
                    logger.error('#server.routes.users.post.update: Error: %s',error);
                })
            if (rows.length>0) {
                req.flash('danger', 'Username already taken. Choose another one.');
                res.redirect('/account');
            }


            var vsql = "UPDATE user SET username=" + pool.escape(username) + " WHERE id=" + parseInt(req.user.id);
            rows=await pool.query(vsql)
                .then(function(rows) {
                    req.flash('success', 'User name updated.');
                    res.redirect('/account');
                })
                .catch(function(error) {
                    logger.error('#server.routes.users.post.updateusername: Error: %s',error);
                })
        }
    }
    else {
        req.flash('success', 'User logged out');
        res.redirect('/login');

    }
});


// Reset password Process
router.post('/resetpassword', [
    check('username').isLength({min:3,max:20})
],function(req, res, next){
    var sender;
    var currency;
    const receipient = req.body.email;

    if (!MISC_validation(req)) {
        res.redirect('/login');
    } else {
        if ( req.headers.host.search(/atheios/) !== -1 ) {
            sender="contact@atheios.org";
            currency="ATH";
        }
        else {
            sender="play@ether1.org";
            currency="ETHO";
        }

        var sql = "SELECT * FROM user WHERE username = " + pool.escape(req.body.username);
        pool.query(sql, function (error, rows, fields) {
            if (error) {
                if (debugon)
                    logger.error('Error: %s', error);
                throw error;
            }
            if (rows.length == 1) {
                if ((rows[0].options & 8) == 1) {
                    req.flash('danger', 'You try to reset an account which is not yet activated.');
                    res.redirect('/login');
                } else {

                    // send a mail and move to the password resetting procedure
                    var rand = MISC_makeid(50);
                    // write to database
                    var vsql = "UPDATE user SET reset='" + rand + "', resetcnt=resetcnt+1 WHERE id=" + rows[0].id;
                    pool.query(vsql, function (error, rows1, fields) {
                        if (error) {
                            if (debugon)
                                logger.error('Error: %s', error);
                        }

                        email
                            .send({
                                template: 'resendpassword',
                                message: {
                                    to: rows[0].email,
                                    from: sender
                                },
                                locals: {
                                    name: rows[0].displayname,
                                    rand: rand,
                                    currency: currency,
                                    date: pool.mysqlNow()
                                }
                            })
                            .then(logger.info("#server.app: Restart email sent."))
                            .catch(console.error);
                    });


                    req.flash('danger', 'We sent an email to Your registered email address. Check Your email for the reset code.');
                    res.redirect('/resetpassword');
                }
            } else {
                // send a mail and move to the poaasword resetting procedure
                req.flash('danger', 'We cannot find Your username. Check Your email for the registration mail or contact our support.');
                res.redirect('/login');
            }

        });
    }
});


// Reset password Process
router.post('/resendusername', [
    check('email').isEmail(),
    check('email').notEmpty()
],async function(req, res, next) {
    var sender;
    var currency;
    const receipient = req.body.email;

    if (!MISC_validation(req)) {
        res.redirect('/login');
    } else {
        if ( req.headers.host.search(/atheios/) !== -1 ) {
            sender="contact@atheios.org";
            currency="ATH";
        }
        else {
            sender="play@ether1-org";
            currency="ETHO";
        }

        var sql = "SELECT * FROM user WHERE email = " + pool.escape(receipient);
        await pool.query(sql)
            .then(function(rows) {
                if (rows.length == 1) {
                    if ((rows[0].options & 8) == 1) {
                        req.flash('danger', 'You try to query an account which is not yet activated.');
                        res.redirect('/login');
                    } else {
                        return (rows);
                    }
                }
                if (rows.length==0) {
                    req.flash('danger', 'Your email is not registered with us. Please register instead.');
                    res.redirect('/log');
                } else {
                    req.flash('danger', 'Please contact support: ' + sender);
                    res.redirect('/login');
                }

            })
            .then(function(rows) {
                email
                    .send({
                        template: 'resendusername',
                        message: {
                            to: rows[0].email,
                            from: sender
                        },
                        locals: {
                            name: rows[0].displayname,
                            username: rows[0].username,
                            currency: currency,
                            date: pool.mysqlNow()
                        }
                    })
                    .then(function() {
                        logger.info("#server.app: Restart email sent.");
                        req.flash('danger', 'We resent Your username to Your email address.');
                        res.redirect('/login');

                    })
                    .catch(function(error) {
                        logger.error('#server.app: Error sending mail: %s',error);
                        return(error);
                    })
            })
            .catch(function(error) {
                logger.error('Error: %s', error);
                return;
            })
    }
});

// Register Proccess
router.post('/resettedpassword', [
    check('password').notEmpty(),
    check('password2').notEmpty()
],function(req, res) {
    const password = req.body.password;
    const password2 = req.body.password2;

    if (password === password2) {
        // Check if resetcode is the one we sent
        var sql = "SELECT * FROM user WHERE reset =" + pool.escape(req.body.resetcode);
        logger.info("SQL: %s", sql);
        pool.query(sql, function (error, rows, fields) {
            if (error) {
                if (debugon)
                    logger.error('Error: %s', error);
                throw error;
            }
            if (rows.length == 1) {
                bcrypt.genSalt(10, function (err, salt) {
                    bcrypt.hash(password, salt, function (err, hash) {
                        if (err) {
                            logger.error("BCRyPT error: %s", err);
                        }
                        // write to database
                        var vsql = "UPDATE user SET password='" + hash + "' WHERE id=" + rows[0].id;
                        logger.info("SQL: %s", vsql);
                        pool.query(vsql, function (error, rows, fields) {
                            if (error) {
                                if (debugon)
                                    logger.error('Error: %s', error);
                                throw error;
                            }
                            req.flash('success', 'Account update');
                            res.redirect('/account');

                        });
                    });
                });
            } else {
                req.flash('danger', 'Reset code is not matching');
                res.redirect('/resetpassword');
            }
        });
    } else {
        req.flash('danger', 'Passwords are not alike! Please retype.');
        res.redirect('/resetpassword');
    }
});


// Register Proccess
router.post('/updatepassword', [
    check('password', 'Password is required').notEmpty(),
    check('password2', 'Passwords is required').notEmpty()
],function(req, res) {
    const password = req.body.password;
    const password2 = req.body.password2;

    logger.info("#server.routes.users.post.updatepassword");
    if (req.user) {
        if (!MISC_validation(req)) {
            res.redirect('/login');
        } else {
            // Check password
            if (password==password2) {
                bcrypt.genSalt(10, function (err, salt) {
                    if (err) {
                        logger.error('#server.routes.users.post.updatepassword: Error: %s', err);
                    }
                    bcrypt.hash(password, salt, function (err, hash) {
                        if (err) {
                            logger.error('#server.routes.users.post.updatepassword: Error: %s', err);
                        }
                        // write to database
                        var vsql = "UPDATE user SET password='" + hash + "' WHERE id=" + pool.escape(req.user.id);
                        logger.info("SQL: %s", vsql);
                        pool.query(vsql, function (error, rows, fields) {
                            if (error) {
                                logger.error('#server.routes.users.post.updatepassword: Error %s', error);
                                throw error;
                            }
                        });
                        req.flash('success', 'Account update');
                        res.redirect('/account');
                    });
                });
            } else {
                req.flash('danger', 'The two password entries are not the same. Please re-check.');
                res.redirect('/account');
            }
        }
    }
    else {
        req.flash('success', 'User logged out');
        res.redirect('/login');

    }
});



// Login Process
router.post('/login', [
    check('username').isLength({min:3,max:20}).withMessage("Check the length of the username."),
    check('password').notEmpty().withMessage("Please specify password")
],function(req, res, next){

    if (!MISC_validation(req)) {
        res.redirect('/login');
    } else {
        var sql = "SELECT * FROM user WHERE username =" + pool.escape(req.body.username);
        logger.info("#server.user.get.login: SQL: %s", sql);
        pool.query(sql, function (error, rows, fields) {
            if (error) {
                logger.error('#server.users.post.login: Error %s', error);
                throw error;
            }
            if (rows.length == 1 && (rows[0].options & 8) == 0) {
                passport.authenticate('local', {
                    successRedirect: '/',
                    failureRedirect: '/login',
                    failureFlash: true
                })(req, res, next);
            } else {
                req.flash('danger', 'Your account seems either not to be activated or Your username or password are wrong. Check Your email for the activation code.');
                res.redirect('/login');
            }
        });
    }
});


function makeid(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}



module.exports = router;
