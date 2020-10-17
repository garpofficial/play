// Establishing connection to the database
var logger = require("./logger");
var mysql = require('mysql');
var util= require('util');

class Database {
    constructor() {
        this.connection = mysql.createPool({
            connectionLimit: config.connectionLimit,
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            multipleStatements: config.multipleStatements,
            timezone: config.timezone
        });
    }
    mysqlSecElapsed(timestr) {
        if (timestr===null)
            return(1000);
        var date = new Date();
        var date_sec = date.getTime();
        var timestr_sec = timestr;

        console.log(date_sec);
        console.log(timestr_sec);
        console.log((timestr_sec-date_sec)/1000);
        return((timestr_sec-date_sec)/1000);
    }
    mysqlNow() {
        var date;
        date = new Date();
        date = date.getUTCFullYear() + '-' +
            ('00' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
            ('00' + date.getUTCDate()).slice(-2) + ' ' +
            ('00' + date.getUTCHours()).slice(-2) + ':' +
            ('00' + date.getUTCMinutes()).slice(-2) + ':' +
            ('00' + date.getUTCSeconds()).slice(-2);
        return(date);
    }
    query( sql, args ) {
        logger.info('#server.database.query: SQL: %s',sql);
        return new Promise( ( resolve, reject ) => {
            this.connection.query( sql, args, ( err, rows ) => {
                if ( err )
                    return reject( err );
                resolve( rows );
            } );
        } );
    }
    queryuser( userId, cb) {
        return new Promise((resolve, reject) => {
            var sql = "SELECT *, TIMESTAMPDIFF(SECOND, blockchaintransact, UTC_TIMESTAMP()) AS blockchaintransactsecs FROM user WHERE id=" + userId;

            this.query(sql)
                .then(async function (rows) {
                    if (rows.length == 0) {
                        logger.error('#server.database.queryuser: Could not find user');
                        reject("Coudn't find userid " + userId);
                    }
                    if (rows.length > 1) {
                        logger.error('#server.database.queryuser: Multiple userids found');
                        reject("Multiple IDs found for: " + userId);
                    }
                    resolve(rows);
                })
                .catch(function (error) {
                    logger.error('#server.database.queryuser: Issue with query: ', sql);
                    reject(err);
                })
        })
    }

    queryaddr( userId, coin ,cb) {
        return new Promise((resolve, reject) => {
            var sql = "SELECT * FROM user WHERE id=" + userId;
            this.query(sql)
                .then(function (rows) {
                    if (rows.length == 0) {
                        logger.error('#server.database.queryaddr: Could not find userid: %s', userId);
                        reject("Coudn't find userid " + userId);
                    }
                    if (rows.length > 1) {
                        logger.error('#server.database.queryaddr: Severe problem with userid: %s, %s', userId, rows.length);
                        reject("Too many userids for " + userId);
                    }
                    // Check if the ath address is valid
                    if (rows[0].athaddr === "") {
                        athGetAddress(coin)
                            .then(function (address) {
                                var vsql = "UPDATE user SET athaddr='" + address + "' WHERE id=" + userId;
                                this.query(vsql)
                                    .then(function(rows1) {
                                        return(address);
                                    })
                                    .catch(function(error) {
                                        return(error);
                                    })
                                });
                    } else {
                        switch (coin) {
                            case "ATH":
                                resolve(rows[0].athaddr);
                                break;
                            case "ETHO":
                                resolve(rows[0].ethoaddr);
                                break;
                        }
                    }
                })
                .catch(function (error) {
                    return(error);
                })
        });
    }

    logging(userid, str) {
        return new Promise( ( resolve, reject ) => {
            var date;
            date = new Date();
            date = date.getUTCFullYear() + '-' +
                ('00' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
                ('00' + date.getUTCDate()).slice(-2) + ' ' +
                ('00' + date.getUTCHours()).slice(-2) + ':' +
                ('00' + date.getUTCMinutes()).slice(-2) + ':' +
                ('00' + date.getUTCSeconds()).slice(-2);
            if (str.length>255) {
                if (debugon)
                    console.log(" >>> DEBUG (fn=logging) String is to long for logging: ", str);
            } else {
                this.connection.query("INSERT INTO logs (userid, log, date) VALUES (" + userid + ", '" + str + "','" + date + "')", (err, rows) => {
                    if (err)
                        return reject(err);
                    resolve(rows);
                });
            }
        });
    }
    escape(arg) {
        return(this.connection.escape(arg));
    }

}

module.exports = Database;