const express = require('express');
const router = express.Router();
const Database=require('../database');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const {athGetAddress, athGetBalance, athdoWithdraw} = require('../ath');
const { check, validationResult } = require('express-validator');
const logger = require("../logger");
const {MISC_validation, MISC_checkOrigin} = require('../misc');

// Serve stats page
router.get('/stats', async function(req, res){

    var currency;
    var title;
    var athamount;
    var ethoamount;

    logger.info("#server.routes.stats.get: %s", req.headers.host)
    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Stats";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Stats";
            break;
    }

    await athGetBalance("ATH", config.ATHADDRESS)
        .then(function(amount) {
            athamount=amount;
            return;
        })
        .catch(function (error) {
            logger.error("#server.routes.stats: Error: %s", error);
            return;
        })

    await athGetBalance("ETHO", config.ETHOADDRESS)
        .then(function(amount) {
            ethoamount=amount;
            return;
        })
        .catch(function (error) {
            logger.error("#server.routes.stats: Error: %s", error);
            return;
        })

    var vsql = "SELECT *, DATE_FORMAT(register, \"%d/%m/%Y %H:%i:%s\") AS startdate FROM user ORDER BY register";
    await pool.query(vsql, function (error, rows, fields) {
        if (error) {
            if (debugon)
                console.log('>>> Error: ' + error);
            req.flash('danger', 'An error occured: ' + error);
            res.redirect('/');
        } else {
            var count = 0;
            for (var i = 0; i < rows.length; i++) {
                count += rows[0].logincnt;

            }
            res.render("stats", {
                title: title,
                currency: currency,
                registeredUser: rows.length,
                logincnt: count,
                athamount: athamount,
                ethoamount: ethoamount
            });
        }
    });
});


module.exports = router;