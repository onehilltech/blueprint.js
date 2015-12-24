var mongoose  = require ('mongoose')
  , winston   = require ('winston')
  , util      = require ('util')
  , fs        = require ('fs')
  , async     = require ('async')
  ;

var GridFS = require ('./GridFS')
  , Path   = require ('./Path')
  ;

var SEED_SUFFIX = '.seed.js';

function Database (opts) {
  this._opts = opts;

  winston.log ('debug', 'database connection: %s', opts.connstr);
  winston.log ('debug', 'database options: %s', util.inspect (opts.options));

  // Create a new connection, and initialize GridFS on this connection.
  this._conn = mongoose.createConnection ();
  this._gridFS = new GridFS (this._conn);
}

Database.Schema = mongoose.Schema;

Database.prototype.setMessenger = function (messenger) {
  this._messenger = messenger;
};

Database.prototype.connect = function (callback) {
  var self = this;

  // Connect to the database.
  this._conn.open (this._opts.connstr, this._opts.options, function (err) {
    if (!err && self._messenger)
      self._messenger.emit ('database.connect', self);

    callback (err);
  });
};

Database.prototype.disconnect = function (callback) {
  var self = this;
  winston.log ('debug', 'disconnecting from database');

  this._conn.close (function (err) {
    if (!err && self._messenger)
      self._messenger.emit ('database.disconnect', self);

    callback (err);
  });
};

Database.prototype.registerModel = function (name, schema) {
  if (mongoose.models[name])
    return mongoose.models[name];

  winston.log ('debug', 'model registration: %s', name);

  var model = this._conn.model (name, schema);

  if (this._messenger)
    this._messenger.emit ('database.model', this, model);

  return model;
};

/**
 * Seed the database. Each separate file in the \a path contains the data for
 * each model (or collection) in the database. The name of the file is the
 * name of the target collection.
 *
 * @param path
 * @param env
 */
Database.prototype.seed = function (collectionName, seed, done) {
  done = done || function (err, seed) {};

  // Locate the collection model in the database, then use the data in the
  // seed to add the documents to the collection.
  var Model = this._conn.models[collectionName];

  if (!Model)
    return done (new Error (util.format ('collection does not exist [%s]', collectionName)));

  Model.create (seed.data, function (err, docs) {
    if (err) return done (err);

    // Save the created documents, and return the seed to the caller.
    seed.documents = docs;
    return done (undefined, seed);
  });

  /*
  try {
    var files = fs.readdirSync (path);

    async.each (
      files,
      function (filename, cb) {
        var filePath = Path.resolve (path, filename);

        // The filePath must be a .seed.json or .seed.js file, and not be a directory.
        if (!filePath.path.endsWith (SEED_SUFFIX))
          return cb ();

        try {
          var stat = fs.lstatSync (filePath.path);

          if (stat.isDirectory ())
            return cb ();

          // Get the model name from the file name.
          var collectionName = filename.substring (0, SEED_SUFFIX.length - 1);
          var seed = require (filePath.path);

          // Locate the collection model in the database, then use the data in the
          // seed to add the documents to the collection.
          var Model = this._conn.models[collectionName];

          if (!Model)
            return cb (new Error (util.format ('collection does not exist [%s]', collectionName)));

          Model.create (seed.data, function (err, docs) {
            if (err) return cb (err);

            // Save the created documents.
            seed.documents = docs;

            return cb ();
          });
        }
        catch (ex) {
          // Do nothing. The directory does not exist.
        }
      }, done);
  }
  catch (ex) {
    process.nextTick (function () {
      done ();
    });
  }*/
};

Database.prototype.__defineGetter__ ('gridfs', function () {
  return this._gridFS;
});

Database.prototype.__defineGetter__ ('models', function () {
  return this._conn.models;
});

/**
 * Create a GridFS write stream to the database.
 *
 * @param file
 * @param metadata
 * @returns {Stream}
 */
Database.prototype.createWriteStream = function (opts) {
  return this._gridFS.createWriteStream (opts);
};


// Export the database, and the different class types.
module.exports = exports = Database;
