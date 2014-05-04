var express = require('express');
var path = require('path');
var http = require('http');
var ejs = require('ejs');
var favicon = require('static-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var log4js = require('log4js');
var data = require('./data');
var socketio = require('socket.io');
var satelize = require('satelize');
var app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded());
app.use(cookieParser());
log4js.configure({
    appenders: [
            { type: 'console' },
            { type: 'file', filename: 'logs/applog.log', category: 'applog' }
            ]
});
/*satelize.satelize({ ip: '122.164.185.35' }, function (err, geoData) {
    var obj = JSON.parse(geoData);
    console.log(obj);
});*/
app.set('view engine', 'ejs');
{
    app.get('/', function (req, res) {
        var log = log4js.getLogger('applog');
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log.info(ip);
        if (req.cookies.username) {
            res.render('index', {
                username: req.cookies.username
            });
        }
        else {
            res.redirect('/login');
        }
    });
    app.get('/clients/city', function (req, res) {
        res.json(userByCity());
    });
    app.get('/clients', function (req, res) {
        res.json(clients);
    });
    app.get('/register', function (req, res) {
        res.render('register');
    });
    app.get('/login', function (req, res) {
        res.render('login');
    });

    app.get('/logout', function (req, res) {
        res.clearCookie('username');
        res.clearCookie('userid');
        res.redirect('/login');
    });
    
    //API calls
    app.get('/api/login', function (req, res) {
        var username = req.query.username;
        var password = req.query.password;
        data.getUser(username, password, function (err, docs) {
            if (docs) {
                res.cookie('username', docs.username, { maxAge: 60 * 60 * 1000 });
                res.cookie('userid', docs.id, { maxAge: 60 * 60 * 1000 });
                res.json({
                    success: true,
                    user: docs,
                    error: {
                        message: ''
                    }
                });
            }
            else {
                res.clearCookie('username');
                res.clearCookie('userid');
                res.json({
                    success: false,
                    user: null,
                    error: {
                        message: 'Invalid Username/Password'
                    }
                });
            }
        });
    });
    app.get('/api/register', function (req, res) {
        var username = req.query.username;
        var password = req.query.password;
        data.addUser(username, password, function (err, doc) {
            var responseObj = {
                success: false,
                error: {
                    message: ""
                }
            };
            if (err) {
                responseObj.error.message = err.message;
                responseObj.success = false;
                res.json(responseObj);
            }
            else {
                responseObj.success = true;
                res.json(responseObj);
            }
        });
    });
}


var server = app.listen(process.env.PORT || 3000, function () {
    var log = log4js.getLogger('applog');
    log.info("App initialized at " + Date());
});

var clients = [];

var io = socketio.listen(server);
{
    io.sockets.on('connection', function (socket) {
        var log = log4js.getLogger('applog');
        log.info('Socket connection initialized');

        socket.on('user connect', function (userdata) {
            log.info(userdata.username + ' has connected! - ' + new Date());
            var ipaddress = socket.handshake.address.address;
            satelize.satelize({ ip: ipaddress }, function (err, geoData) {
                var city = "";
                if (err) {
                    log.error(err);
                }
                else {
                    var obj = JSON.parse(geoData);
                    if (obj.city) {
                        city = obj.city;
                    }
                }
                if (clients.length > 0) {
                    var clientIndex = getClient(userdata.username, null);
                    if (clientIndex) {
                        clients.splice(clientIndex, 1);
                    }
                }
                clients.push({
                    username: userdata.username,
                    sid: socket.id,
                    city: city
                });
                userHasJoined(clients[getClient(null, socket.id)]);
            });
        });

        socket.on('disconnect', function () {
            var client = getClient(null, socket.id);
            var data = clients[client];
            if (client) {
                clients.splice(data, 1);
            }
            if (data) {
                log.info(data.username + ' has disconnected! - ' + new Date());
                userLeft(data);
            }
        });

        socket.on('sendmessage', function (obj) {
            var client = getClient(null, socket.id);
            var data = clients[client];
            if (data) {
                sendMessageToClient(data.username, obj.message);
            }
        });
    });
}
function userByCity() {
    var usertoCity = [];
    for(var i = 0; i < clients.length; i++) {
        var client = clients[i];
        var city = client.city == "" ? "Unknown" : client.city;
        if (usertoCity.length > 0) {
            for (var j = 0; j < usertoCity.length; j++) {
                var userinCity = usertoCity[j];
                if(userinCity.name == city) {
                    userinCity.numberofusers += 1;
                }
            }
        }
        else {
            usertoCity.push({
                name: city,
                numberofusers: 1
            });
        }
    }
    return usertoCity;
}
function sendMessageToClient(username, message) {
    if(username && message) {
        io.sockets.emit('receivemessage', { username: username, message: message });
    }
}
function userLeft(data) {
    if (data) {
        io.sockets.emit('userLeft', { "username": data.username, "count": clients.length, "citydata": userByCity() });
    }
}
function getClient(username, id) {
    for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (username && client.username == username) {
            return i;
        }
        if(id && client.sid == id) {
            return i;
        }
    }
    return null;
}
function userHasJoined(userdata) {
    io.sockets.emit('userHasJoined', { "username": userdata.username, "count": clients.length, "citydata": userByCity() });
}