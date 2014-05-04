var client = require('mongodb').MongoClient;
var connectionstring = "mongodb://127.0.0.1:27017/chat";
module.exports = {
    addUser: function (username, password, callback) {

        this.getUser(username, null, function (err, doc) {
            if (doc) {
                var newErr = new Error("User already exists");
                callback(newErr, null);
            }
            else {
                client.connect(connectionstring, function (err, db) {
                    if (err) throw err;
                    var collection = db.collection('users');

                    collection.count(function (err, count) {
                        if (err) throw err;
                        var id = count + 1;
                        var userObj = {
                            id: id,
                            username: username,
                            password: password
                        };
                        collection.insert(userObj, function (err, docs) {
                            callback(err, docs);
                        });
                    });
                });
            }
        });
    },
    getUser: function (username, password, callback) {
        client.connect(connectionstring, function (err, db) {
            if (err) throw err;
            var collection = db.collection('users');
            var queryObj = { username: username };
            if (password) {
                queryObj.password = password;
            }
            collection.find(queryObj).toArray(function (err, docs) {
                if (err) throw err;
                if (docs.length > 0) {
                    callback(null, docs[0]);
                }
                else {
                    callback(null, null);
                }
            });
        });
    }
};