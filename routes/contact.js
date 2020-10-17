var express = require('express');
var router = express.Router();
const {MISC_checkOrigin} = require('../misc');

router.get('/contact', function(req, res, next) {
    var currency;
    var title;

    switch(MISC_checkOrigin(req.headers.host)) {
        case "ATH":
            currency = "ATH";
            title = "Atheios Play | Contact";
            break;
        case "ETHO":
            currency = "ETHO";
            title = "Ether-1 Play | Contact";
            break;
    }

    res.render('contact', {
        title: title,
        currency: currency
    });

});

module.exports = router;
