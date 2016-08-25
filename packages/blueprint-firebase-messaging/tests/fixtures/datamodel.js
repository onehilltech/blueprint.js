var async      = require ('async')
  , path       = require ('path')
  , winston    = require ('winston')
  , blueprint  = require ('@onehilltech/blueprint')
  , gatekeeper = require ('@onehilltech/gatekeeper')
  ;

var appFixture = require ('./app')
  ;

var app;

var data = {
  clients: [
    {
      name: 'client1',
      email: 'contact@client1.com',
      secret: 'client1',
      redirect_uri: 'https://client1.com/gatekeeper',
      roles: [gatekeeper.roles.client.account.create]
    },
    {
      name: 'client2',
      email: 'contact@client2.com',
      secret: 'client2',
      redirect_uri: 'https://client2.com/gatekeeper'},
    {
      name: 'client3',
      email: 'contact@client3.com',
      secret: 'client3',
      redirect_uri: 'https://client3.com/gatekeeper',
      enabled: false
    }
  ],

  accounts: [
    { username: 'account1', password: 'account1', email: 'contact@account1.com'},
    { username: 'account2', password: 'account2', email: 'contact@account2.com'},
    { username: 'account3', password: 'account3', email: 'contact@account3.com'},
    { username: 'account4', password: 'account4', email: 'contact@account4.com'},
    { username: 'account5', password: 'account5', email: 'contact@account5.com'}
  ],
};

exports.models = {};

exports.data = data;

function cleanup (done) {
  winston.log ('info', 'wiping data from the database');

  async.series ([
    // We need a method for removing all the files in GridFS.
    function (cb) { app.models.Account.remove ({}, cb); },
    function (cb) { app.models.Client.remove ({}, cb); },
    function (cb) { app.models.oauth2.AccessToken.remove ({}, cb); }
  ], done);
}

function seed (callback) {
  winston.log ('info', 'seeding database with test data');

  async.waterfall ([
    // Add the clients to the database.
    function (callback) {
      app.models.Client.create (data.clients, function (err, clients) {
        if (err) return callback (err);

        exports.models.clients = clients;
        callback (null, clients[0]);
      });
    },

    // Add the accounts to the database.
    function (client, callback) {
      // Update the created_by path on the accounts to the first client.
      data.accounts.forEach (function (account) {
        account.created_by = client._id;
      });

      // Insert the participants into the database.
      app.models.Account.create (data.accounts, function (err, accounts) {
        if (err) return callback (err);

        exports.models.accounts = accounts;
        callback (null, accounts[0]);
      });
    }
  ], callback);
}

exports.apply = function (done) {
  async.series ([
    function (callback) {
      appFixture (function (err, result) {
        if (err) return callback (err);
        app = result;
        return callback ();
      });
    },
    function (callback) { cleanup (callback); },
    function (callback) { seed (callback); }
  ], function (err) {
    return done (err);
  });
};

exports.cleanup = cleanup;
