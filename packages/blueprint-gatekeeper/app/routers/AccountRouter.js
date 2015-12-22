var blueprint = require ('@onehilltech/blueprint')
  , auth      = require ('../../lib').auth
  ;

var passport  = blueprint.app.server.middleware.passport;
passport.use (auth.bearer ());

module.exports = exports = {
  // Define the router properties.
  ':accountId'    : { property : 'accountId' },

  // Define the different account routes. We are going to protect all routes
  // under the /accounts base uri.
  '/accounts' : {
    use  : [
      passport.authenticate ('bearer', {session: false})
    ],

    get : {action: 'AccountController@getAccounts'},
    post: {action: 'AccountController@createAccount'}
  },

  '/accounts/:accountId': {
    get   : {action: 'AccountController@getAccount'},
    delete: {action: 'AccountController@deleteAccount'}
  },

  '/accounts/:accountId': {
    get   : {action: 'AccountController@getAccount' },
    delete: {action: 'AccountController@deleteAccount' }
  },

  '/accounts/:accountId/profile' : {
    get : { action : 'AccountController@getProfile' }
  },

  '/accounts/:accountId/enable' : {
    post : { action: 'AccountController@enableAccount'}
  },

  '/accounts/:accountId/roles' : {
    post : { action: 'AccountController@updateRoles'}
  },
};
