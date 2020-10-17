"use strict";


var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
var logger = require("./logger");
const {MISC_ensureAuthenticated, MISC_validation, MISC_makeid, MISC_maketoken, MISC_checkOrigin} = require('./misc');

// Init email setup
const Email = require('email-templates');

// Default using the Atheios contact mail, but that can be overwritten
global.email = new Email({
  message: {
    from: 'contact@atheios.org'
  },
  // uncomment below to send emails in development/test env:
  send: true,
  preview: false,
  transport: {
    host: config.NODEMAIL_HOST,
    port: 587,
    secure: false,
    auth: {
      user: config.NODEMAIL_USER, // generated user
      pass: config.NODEMAIL_PASS // generated password
    },
    tls: {
      rejectUnauthorized: false
    }
  }});

// Define the globals
global.debugon=true;
global.version="0.2";


// Init database
if (global.config.development) {
    global.baseurl="http://localhost:"+global.config.PORT;
}
else {
    global.baseurl="https://play.atheios.org";
};

// Instatiate database
const Database=require('./database');
global.pool=new Database();

// Define express and routes
let indexRouter = require('./routes/index');
let whatsnew = require('./routes/whatsnew');
let users = require('./routes/users');
let contactRouter = require('./routes/contact');
let funds = require('./routes/funds');
let statsrouter = require('./routes/stats');
let gameplayrouter = require('./routes/gameplay');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Body Parser Middleware
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// Set Public Folder
app.use(express.static(path.join(__dirname, 'public')));
// Set Bootstrap Folder
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
// Set Bootstrap Folder
app.use(express.static(path.join(__dirname, 'node_modules/jquery')));

// Express Session Middleware
app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}));

// Express Messages Middleware
app.use(require('connect-flash')());
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});


// Passport Config
require('./config/passport')(passport);
// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

app.get('*', function(req, res, next){
  res.locals.user = req.user || null;
  next();
});

app.use( (req, res, done) => {
//  logger.info("#server.app: URL: %s", req.originalUrl);
  done();
});

app.use(express.json());
app.set('json spaces', 2)
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/', whatsnew);
app.use('/', users);
app.use('/', contactRouter);
app.use('/', statsrouter);
app.use('/', gameplayrouter);

app.use('/', funds);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = config.development ? err : {};

  // render the error page
  res.status(err.status || 500);
  var currency;
  var title;

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

  res.render('error', {
    title: title,
    currency: currency
  });

});

email
    .send({
      template: 'restart',
      message: {
        to: 'legacytrx@atheios.org'
      },
      locals: {
        name: 'Frank',
        date: pool.mysqlNow()
      }
    })
    .then(logger.info("#server.app: Restart email sent."))
    .catch(console.error);


module.exports = app;