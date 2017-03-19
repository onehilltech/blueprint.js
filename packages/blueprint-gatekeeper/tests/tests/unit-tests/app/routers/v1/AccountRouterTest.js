var expect    = require ('chai').expect
  , async     = require ('async')
  , blueprint = require ('@onehilltech/blueprint')
  , mongodb   = require ('@onehilltech/blueprint-mongodb')
  , winston   = require ('winston')
  , util      = require ('util')
  ;

const datamodel = require ('../../../../../fixtures/datamodel')
  , bm = blueprint.messaging
  ;

function getToken (data, callback) {
  blueprint.testing.request ()
    .post ('/v1/oauth2/token')
    .send (data).end (function (err, res) {
      if (err)
        return callback (err);

      if (res.statusCode !== 200)
        winston.log ('error', util.inspect (res.body));

      return callback (null, res.body.access_token);
    });
}

describe ('AccountRouter', function () {
  var userToken;
  var superUserToken;
  var clientToken;
  var Account;

  before (function (done) {
    async.series ([
      function (callback) {
        winston.log ('info', 'applying data model for test cases');
        datamodel.apply (callback);
      },

      function (callback) {
        Account = blueprint.app.models.Account;
        return callback (null);
      },

      /**
       * Get a user token that has no special access rights. We are going to
       * use client 0 since it can create an account.
       *
       * @param callback
       */
      function (callback) {
        winston.log ('info', 'getting user token');

        var data = {
          grant_type: 'password',
          username: datamodel.data.accounts[0].username,
          password: datamodel.data.accounts[0].password,
          client_id: datamodel.models.clients[0].id
        };

        getToken (data, function (err, token) {
          if (err) return callback (err);

          userToken = token;
          return callback (null);
        });
      },

      /**
       * Get a user token that has superuser rights.
       *
       * @param callback
       */
      function (callback) {
        winston.log ('info', 'getting user token for super user');

        var data = {
          grant_type: 'password',
          username: datamodel.data.accounts[3].username,
          password: datamodel.data.accounts[3].password,
          client_id: datamodel.models.clients[0].id
        };

        getToken (data, function (err, token) {
          if (err) return callback (err);

          superUserToken = token;
          return callback (null);
        });
      },

      /**
       * Get a client-level access token.
       *
       * @param callback
       */
      function (callback) {
        winston.log ('info', 'getting client token');

        var data = {
          grant_type: 'client_credentials',
          client_id: datamodel.models.clients[0].id,
          client_secret: datamodel.models.clients[0].secret
        };

        getToken (data, function (err, token) {
          if (err) return callback (err);

          clientToken = token;

          return callback (null);
        });
      }
    ], done);
  });

  describe ('/v1/accounts', function () {
    describe ('GET', function () {
      it ('should return all the accounts for an admin', function (done) {
        Account.find ({}, function (err, accounts) {
          if (err) return done (err);

          blueprint.testing.request ()
            .get ('/v1/accounts')
            .set ('Authorization', 'Bearer ' + superUserToken)
            .expect (200, {'accounts': JSON.parse (JSON.stringify (accounts))}, done);
        });
      });

      it ('should not allow non-admin access to all accounts', function (done) {
        blueprint.testing.request ()
          .get ('/v1/accounts')
          .set ('Authorization', 'Bearer ' + userToken)
          .expect (403, done);
      });
    });

    describe ('POST', function () {
      var data = {
        username: 'tester1',
        password: 'tester1',
        email: 'james@onehilltech.com'
      };

      it ('should create a new account', function (done) {
        var account = null;

        // We know the account was created when we get an event for
        // sending an account activation email.
        bm.once ('gatekeeper.account.created', function (model) {
          account = model;
        });

        blueprint.testing.request ()
          .post ('/v1/accounts')
          .send ({account: data})
          .set ('Authorization', 'Bearer ' + clientToken)
          .expect (200)
          .end (function (err, res) {
            if (err) return done (err);

            // Wait until the gatekeeper.account.created message is handled.
            blueprint.testing.waitFor (function () { return account !== null },
              function (err) {
                if (err) return done (err);
                expect (res.body).to.eql ({account: mongodb.testing.lean (account)});

                return done (null);
              });
          });
      });

      it ('should not create an account [duplicate]', function (done) {
        blueprint.testing.request ()
          .post ('/v1/accounts').send (data)
          .set ('Authorization', 'Bearer ' + clientToken)
          .expect (400, done);
      });

      it ('should not create an account [missing parameter]', function (done) {
        var invalid = {
          password: 'tester1',
          email: 'james@onehilltech.com'
        };

        blueprint.testing.request ()
          .post ('/v1/accounts').send (invalid)
          .set ('Authorization', 'Bearer ' + clientToken)
          .expect (400, done);
      });

      it ('should not create an account [invalid role]', function (done) {
        async.waterfall ([
          function (callback) {
            var invalid = {
              grant_type: 'client_credentials',
              client_id: datamodel.models.clients[1].id,
              client_secret: datamodel.models.clients[1].secret
            };

            getToken (invalid, callback);
          },

          function (token, callback) {
            var account = {
              username: 'tester1',
              password: 'tester1',
              email: 'james@onehilltech.com'
            };

            blueprint.testing.request ()
              .post ('/v1/accounts').send ({account: account})
              .set ('Authorization', 'Bearer ' + token)
              .expect (403, { errors: { code: 'policy_failed', message: 'No scopes defined' } }, callback);
          }
        ], done);
      });
    });
  });

  describe ('/v1/accounts/:accountId', function () {
    var updated;

    describe ('GET', function () {
      it ('should return the owner account', function (done) {
        var account = datamodel.models.accounts[0];

        blueprint.testing.request ()
          .get ('/v1/accounts/' + account.id)
          .set ('Authorization', 'Bearer ' + userToken)
          .expect (200, {account: mongodb.testing.lean (account)}, done);
      });

      it ('should get my account', function (done) {
        var account = datamodel.models.accounts[0];

        blueprint.testing.request ()
          .get ('/v1/accounts/me')
          .set ('Authorization', 'Bearer ' + userToken)
          .expect (200, {account: mongodb.testing.lean (account)}, done);
      });

      it ('should retrieve a user account for an admin', function (done) {
        var accountId = datamodel.models.accounts[0].id;

        Account.findById (accountId, function (err, account) {
          if (err) return done (err);

          blueprint.testing.request ()
            .get ('/v1/accounts/' + accountId)
            .set ('Authorization', 'Bearer ' + superUserToken)
            .expect (200, {account: JSON.parse (JSON.stringify (account))}, done);
        });
      });

      it ('should not allow non-admin access to another account', function (done) {
        var accountId = datamodel.models.accounts[1].id;

        blueprint.testing.request ()
          .get ('/v1/accounts/' + accountId)
          .set ('Authorization', 'Bearer ' + userToken)
          .expect (403, done);
      });
    });

    describe ('UPDATE', function () {
      it ('should not update scope and created_by', function (done) {
        var account = datamodel.models.accounts[0];

        blueprint.testing.request ()
          .put ('/v1/accounts/' + account.id)
          .set ('Authorization', 'Bearer ' + userToken)
          .send ({account: {created_by: new mongodb.Types.ObjectId (), scope: ['the_new_scope']}})
          .expect (200, {account: mongodb.testing.lean (account)}, done);
      });

      it ('should update the email', function (done) {
        var account = datamodel.models.accounts[0];

        updated = account.toObject ();
        updated.email = 'foo@contact.com';

        blueprint.testing.request ()
          .put ('/v1/accounts/' + account.id)
          .set ('Authorization', 'Bearer ' + userToken)
          .send ({account: {email: updated.email}} )
          .expect (200, {account: mongodb.testing.lean (updated)}, done);
      });

      it ('should update the scope', function (done) {
        var account = datamodel.models.accounts[0];
        updated.scope.push ('the_new_scope');

        blueprint.testing.request ()
          .put ('/v1/accounts/' + account.id)
          .set ('Authorization', 'Bearer ' + superUserToken)
          .send ({account: {scope: updated.scope}})
          .expect (200, {account: mongodb.testing.lean (updated)}, done);
      });
    });

    describe ('/password', function () {
      it ('should not change the password because current is wrong', function (done) {
        var account = datamodel.models.accounts[0];

        blueprint.testing.request ()
          .post ('/v1/accounts/' + account.id + '/password')
          .set ('Authorization', 'Bearer ' + userToken)
          .send ({'change-password': { current: 'bad-password', new: 'new-password'}})
          .expect (400, { errors: { code: 'invalid_password', message: 'Current password is invalid' } }, done);
      });

      it ('should change the password', function (done) {
        var account = datamodel.models.accounts[0];

        async.series ([
          function (callback) {
            blueprint.testing.request ()
              .post ('/v1/accounts/' + account.id + '/password')
              .set ('Authorization', 'Bearer ' + userToken)
              .send ({'change-password': { current: datamodel.data.accounts[0].password, new: 'new-password'}})
              .expect (200, 'true')
              .end (callback);
          },

          function (callback) {
            async.waterfall ([
              function (callback) {
                Account.findById (account._id, callback);
              },

              function (changed, callback) {
                expect (changed.password).to.not.equal (account.password);
                return callback (null);
              }
            ], callback);
          }
        ], done);
      });
    });

    describe ('DELETE', function () {
      it ('should not allow non-admin to delete another user account', function (done) {
        var accountId = datamodel.models.accounts[2].id;

        blueprint.testing.request ()
          .delete ('/v1/accounts/' + accountId)
          .set ('Authorization', 'Bearer ' + userToken)
          .expect (403, done);
      });

      it ('should allow account owner to delete account', function (done) {
        var accountId = datamodel.models.accounts[0].id;

        blueprint.testing.request ()
          .delete ('/v1/accounts/' + accountId)
          .set ('Authorization', 'Bearer ' + userToken)
          .expect (200, 'true', done);
      });

      it ('should not allow admin to delete account', function (done) {
        var accountId = datamodel.models.accounts[2].id;

        blueprint.testing.request ()
          .delete ('/v1/accounts/' + accountId)
          .set ('Authorization', 'Bearer ' + superUserToken)
          .expect (403, { errors: { code: 'policy_failed', message: 'Not the account owner' } }, done);
      });
    });
  });
});