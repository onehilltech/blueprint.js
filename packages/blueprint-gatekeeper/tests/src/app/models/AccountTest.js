var expect = require ('chai').expect
  , async  = require ('async')
  ;

var blueprint = require ('../../../fixtures/blueprint')
  , Account   = require ('../../../../app/models/Account')
  , Client    = require ('../../../../app/models/Client')
  ;

var data = {
  client : {
    name: 'client1',
    email: 'contact@client1.com',
    secret: 'client1',
    redirect_uri: 'https://client1.com/gatekeeper',
    roles: ['account.create']
  },

  account: {
    access_credentials: {username: 'account1', password: 'account1'},
    profile: {email: 'account1@gatekeeper.com'},
    internal_use: {}
  }
};


describe ('Account', function () {
  var account;
  var client;

  before (function (done) {
    async.series ([
      function (callback) {
        server = blueprint.app.server;
        blueprint.app.database.connect (callback);
      },
      function (cb) { Account.remove ({}, cb); },
      function (cb) { Client.remove ({}, cb); },
      function (callback) {
        client = new Client (data.client);

        client.save (function (err, model) {
          if (err) return callback (err);

          client = model;
          return callback ();
        });
      }
    ], done);
  });

  describe ('create and save', function () {
    it ('should save a new account to the database', function (done) {
      account = new Account (data.account);
      account.internal_use.created_by = client._id;

      account.save (function (err, model) {
        if (err) return done (err);

        account = model;
        return done ();
      });
    });
  });

  describe ('metadata', function () {
    var obj = {
      key1 : 'value1',
      key2 : 'value2'
    };

    it ('should put the metadata in the account', function (done) {
      account.metadata.test = obj;
      account.markModified ('metadata');

      account.save (function (err, model) {
        if (err) return done (err);

        account = model;
        return done ();
      });
    });

    it ('should get the metadata from the account', function (done) {
      Account.findById (account.id, function (err, account) {
        if (err) return done (err);

        expect (account.metadata).to.eql ({ test : obj });

        return done ();
      });
    });
  });
});