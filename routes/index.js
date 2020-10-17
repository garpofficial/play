const logger = require("../logger");
const {MISC_validation, MISC_checkOrigin} = require('../misc');


var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var currency;
  var title;

  logger.info("#server.routes.index.get: %s", req.headers.host);

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

  res.render('index', {
    title: title,
    currency: currency
  });
});

module.exports = router;
