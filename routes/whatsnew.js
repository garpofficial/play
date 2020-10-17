var express = require('express');
var router = express.Router();
const {MISC_validation, MISC_checkOrigin} = require('../misc');


/* GET home page. */
router.get('/whatsnew', function(req, res, next) {
    var currency;
    var title;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | News";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | News";
            break;
    }

    res.render('whatsnew', {
        title: title,
        currency: currency
    });
});

module.exports = router;