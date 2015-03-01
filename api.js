var assert = require('assert');
var fs = require('fs');
var path = require('path');
var util = require('util');
var mkdirp = require('mkdirp');
var optimist = require('optimist');
var config = require('./lib/config.js');
var index = require('./index');
var Migration = require('./lib/migration.js');
var Seeder = require('./lib/seeder.js');
var Migrator = require('./lib/migrator.js');
var log = require('./lib/log');
var pkginfo = require('pkginfo')(module, 'version');
var dotenv = require('dotenv');

//global declaration for detection like it's done in umigrate
dbm = require( './' );
async = require( 'async' );


var internals = {};

function dbmigrate(callback) {

  if(typeof(callback) === 'function')
    internals.onComplete = callback;

  dotenv.load();
  registerEvents();
  setDefaultArgv();
  loadConfig();
}


function registerEvents() {

  process.on('uncaughtException', function(err) {
    log.error(err.stack);
    process.exit(1);
  });
}

dbmigrate.prototype = {

  /**
    * Add a global defined variable to db-migrate, to enable access from
    * local migrations without configuring pathes.
    *
    * @return boolean
    */
  addGlobal: function(library) {

    try {
      require(library);
    } catch(e) {
      return false;
    }

    return true;
  },


  /**
    * Add a configuration option to dbmigrate.
    *
    * @return boolean
    */
  addConfiguration: function(description, args, type) {

    var name = args.shift();
    this.argv.describe(name, description);

    for(var i = 0; i < args.length; ++i) {

      this.argv.alias(args[i], name);
    }

    switch(type) {

      case 'string':
        this.argv.string(name);
        break;

      case 'boolean':
        this.argv.boolean(name);
        break;

      default:
        return false;
    }

    return true;
  },


  /**
    * Resets and sets argv to a specified new argv.
    */
  resetConfiguration: function(argv) {
    this.argv = argv;
  },

  /**
    * Executes up a given number of migrations or a specific one.
    *
    * Defaults to up all migrations if no count is given.
    */
  up: function() {

    if(arguments.length > 0)
    {
      if(typeof(arguments[0]) === 'string') {
        argv.destination = argument[0];
      }
      else if(typeof(arguments[0]) === 'number') {
        argv.count = arguments[0];
      }

      executeUp();
    }
  },

  /**
    * Executes up a given number of migrations or a specific one.
    *
    * Defaults to up all migrations if no count is given.
    */
  down: function() {

    if(arguments.length > 0)
    {
      if(typeof(arguments[0]) === 'number') {
        argv.count = arguments[0];
      }

      executeDown();
    }
  },

  /**
    * Executes down for all currently migrated migrations.
    */
  reset: function() {

    argv.count = Number.MAX_VALUE;
    executeDown();
  },

  /**
    * Creates a correctly formatted migration
    */
  create: function(migrationName) {

    argv._.push(migrationName);
    executeCreate();
  },

  /**
    * Creates a database of the given dbname.
    */
  createDatabase: function(dbname) {

    argv._.push(dbname);
    global.mode = 'create';
  },

  /**
    * Drops a database of the given dbname.
    */
  dropDatabase: function(dbname) {

    argv._.push(dbname);
    global.mode = 'drop';
  },

  /**
    * Sets a config variable to the given value.
    *
    * @return value
    */
  setConfigParam: function(param, value) {

    return (argv[param] = value);
  },

  setDefaultCallback: function() {

    internals.onComplete = onComplete;
  },

  setCustomCallback: function(callback) {

    internals.onComplete = callback;
  },

  /**
    * Executes the default routine.
    */
  run: run

};

function setDefaultArgv() {

  internals.argv = optimist
      .default({
        verbose: false,
        table: 'migrations',
        'seeds-table': 'seeds',
        'force-exit': false,
        'sql-file': false,
        'no-transactions': false,
        config: process.cwd() + '/database.json',
        'migrations-dir': process.cwd() + '/migrations',
        'vcseeder-dir': process.cwd() + '/VCSeeder',
        'staticseeder-dir': process.cwd() + '/Seeder'})
      .usage('Usage: db-migrate [up|down|reset|create|db] [[dbname/]migrationName|all] [options]')

      .describe('env', 'The environment to run the migrations under (dev, test, prod).')
      .alias('e', 'env')
      .string('e')

      .describe('migrations-dir', 'The directory containing your migration files.')
      .alias('m', 'migrations-dir')
      .string('m')

      .describe('count', 'Max number of migrations to run.')
      .alias('c', 'count')
      .string('c')

      .describe('dry-run', 'Prints the SQL but doesn\'t run it.')
      .boolean('dry-run')

      .describe('force-exit', 'Forcibly exit the migration process on completion.')
      .boolean('force-exit')

      .describe('verbose', 'Verbose mode.')
      .alias('v', 'verbose')
      .boolean('v')

      .alias('h', 'help')
      .alias('h', '?')
      .boolean('h')

      .describe('version', 'Print version info.')
      .alias('i', 'version')
      .boolean('version')

      .describe('config', 'Location of the database.json file.')
      .string('config')

      .describe('sql-file', 'Automatically create two sql files for up and down statements in /sqls and generate the javascript code that loads them.')
      .boolean('sql-file')

      .describe('coffee-file', 'Create a coffeescript migration file')
      .boolean('coffee-file')

      .describe('migration-table', 'Set the name of the migration table, which stores the migration history.')
      .alias('table', 'migration-table')
      .alias('t', 'table')
      .string('t')

      .describe('seeds-table', 'Set the name of the seeds table, which stores the seed history.')
      .string('seeds-table')

      .describe('vcseeder-dir', 'Set the path to the Version Controlled Seeder directory.')
      .string('vcseeder-dir')

      .describe('staticseeder-dir', 'Set the path to the Seeder directory.')
      .string('staticseeder-dir')

      .describe('no-transactions', 'Explicitly disable transactions')
      .boolean('no-transactions')

      .argv;

  if (argv.version) {
    console.log(module.exports.version);
    process.exit(0);
  }

  if (argv.help || argv._.length === 0) {
    optimist.showHelp();
    process.exit(1);
  }

  global.migrationTable = argv.table;
  global.seedsTable = argv['seeds-table'];
  global.dbm = dbm;
  global.matching = '';
  global.mode;
  global.verbose = argv.verbose;
  global.notransactions = argv['no-transactions']
  global.dryRun = argv['dry-run'];
  if(global.dryRun) {
    log.info('dry run');
  }

}

function createMigrationDir(dir, callback) {
  fs.stat(dir, function(err, stat) {
    if (err) {
      mkdirp(dir, callback);
    } else {
      callback();
    }
  });
}

function loadConfig() {
  if (process.env.DATABASE_URL) {
    config.loadUrl(process.env.DATABASE_URL, argv.env);
  } else {
    config.load(argv.config, argv.env);
  }
  if(verbose) {
    var current = config.getCurrent();
    var s = JSON.parse(JSON.stringify(current.settings));

    if (s["password"])
      s["password"] = "******";

    log.info('Using', current.env, 'settings:', s);
  }
}

function executeCreate() {
  var folder, path;

  if(argv._.length === 0) {
    log.error('\'migrationName\' is required.');
    optimist.showHelp();
    process.exit(1);
  }

  createMigrationDir(argv['migrations-dir'], function(err) {
    if (err) {
      log.error('Failed to create migration directory at ', argv['migrations-dir'], err);
      process.exit(1);
    }

    argv.title = argv._.shift();
    folder = argv.title.split('/');

    argv.title = folder[folder.length - 2] || folder[0];
    path = argv['migrations-dir'];

    if(folder.length > 1) {

      path += '/';

      for(var i = 0; i < folder.length - 1; ++i) {

        path += folder[i] + '/';
      }
    }

    var templateType = Migration.TemplateType.DEFAULT_JS;
    if (shouldCreateSqlFiles()) {
      templateType = Migration.TemplateType.SQL_FILE_LOADER;
    } else if (shouldCreateCoffeeFile()) {
      templateType = Migration.TemplateType.DEFAULT_COFFEE;
    }
    var migration = new Migration(argv.title + (shouldCreateCoffeeFile() ? '.coffee' : '.js'), path, new Date(), templateType);
    index.createMigration(migration, function(err, migration) {
      assert.ifError(err);
      log.info(util.format('Created migration at %s', migration.path));
    });
  });

  if (shouldCreateSqlFiles()) {
    createSqlFiles();
  }
}

function shouldCreateSqlFiles() {
  return argv['sql-file'] || config['sql-file'];
}

function shouldCreateCoffeeFile() {
  return argv['coffee-file'] || config['coffee-file'];
}

function createSqlFiles() {
  var sqlDir = argv['migrations-dir'] + '/sqls';
  createMigrationDir(sqlDir, function(err) {
    if (err) {
      log.error('Failed to create migration directory at ', sqlDir, err);
      process.exit(1);
    }

    var templateTypeDefaultSQL = Migration.TemplateType.DEFAULT_SQL;
    var migrationUpSQL = new Migration(argv.title + '-up.sql', sqlDir, new Date(), templateTypeDefaultSQL);
    index.createMigration(migrationUpSQL, function(err, migration) {
      assert.ifError(err);
      log.info(util.format('Created migration up sql file at %s', migration.path));
    });
    var migrationDownSQL = new Migration(argv.title + '-down.sql', sqlDir, new Date(), templateTypeDefaultSQL);
    index.createMigration(migrationDownSQL, function(err, migration) {
      assert.ifError(err);
      log.info(util.format('Created migration down sql file at %s', migration.path));
    });
  });
}

function executeUp() {

  if(!argv.count) {
    argv.count = Number.MAX_VALUE;
  }

  index.connect(config.getCurrent().settings, Migrator, function(err, migrator) {
    assert.ifError(err);

    if(global.locTitle)
        migrator.migrationsDir = path.resolve(argv['migrations-dir'], global.locTitle);
    else
      migrator.migrationsDir = path.resolve(argv['migrations-dir']);

    migrator.driver.createMigrationsTable(function(err) {
      assert.ifError(err);
      log.verbose('migration table created');
      migrator.up(argv, internals.onComplete.bind(this, migrator));
    });
  });
}

function executeDown() {

  if(!argv.count) {
    log.info('Defaulting to running 1 down migration.');
    argv.count = 1;
  }

  index.connect(config.getCurrent().settings, Migrator, function(err, migrator) {
    assert.ifError(err);

    migrator.migrationsDir = path.resolve(argv['migrations-dir']);

    migrator.driver.createMigrationsTable(function(err) {
      assert.ifError(err);
      migrator.down(argv, internals.onComplete.bind(this, migrator));
    });
  });
}

function executeDB() {

  if(argv._.length > 0) {
    argv.dbname = argv._.shift().toString();
  }
  else {

    log.info('Error: You must enter a database name!');
    return;
  }

  index.driver(config.getCurrent().settings, function(err, db)
  {
    if(global.mode === 'create')
    {
      db.createDatabase(argv.dbname, { ifNotExists: true }, function()
      {
        if(err) {
          log.info('Error: Failed to create database!');
        }
        else {
          log.info('Created database "' + argv.dbname + '"');
        }

        db.close();
      });
    }
    else if(global.mode === 'drop')
    {
      db.dropDatabase(argv.dbname, { ifExists: true }, function()
      {
        if(err) {
          log.info('Error: Failed to drop database!');
        }
        else {
          log.info('Deleted database "' + argv.dbname + '"');
        }

        db.close();
      });
    }
    else
      return;
  });

}

function executeSeed() {

  if(argv._.length > 0) {
    argv.destination = argv._.shift().toString();
  }

  index.connect(config.getCurrent().settings, Seeder, function(err, seeder)
  {
    assert.ifError(err);

    seeder.seedDir = path.resolve(argv[(global.mode !== 'static') ? 'vcseeder-dir': 'staticseeder-dir']);
    seeder.seed(argv, internals.onComplete.bind(this, seeder));
  });
}

internals.onComplete = onComplete;

function onComplete(migrator, originalErr) {
  migrator.driver.close(function(err) {
    assert.ifError(originalErr);
    assert.ifError(err);
    log.info('Done');
  });
};

function run() {
  var action = argv._.shift(),
      folder = action.split(':');

  action = folder[0];

  loadConfig();

  switch(action) {
    case 'create':
      executeCreate();
      break;
    case 'up':
    case 'down':
    case 'reset':

      if(action === 'reset')
        argv.count = Number.MAX_VALUE;

      if(argv._.length > 0) {
        if (action === 'down') {
          log.info('Ignoring migration name for down migrations.  Use --count to control how many down migrations are run.');
          argv.destination = null;
        } else {
          argv.destination = argv._.shift().toString();
        }
      }

      if(folder[1])
      {
        global.matching = folder[1];
        global.migrationMode = folder[1];
      }

      if(action == 'up') {
        executeUp();
      } else {
        executeDown();
      }
      break;

    case 'db':

      if(folder.length < 1) {

        log.info('Please enter a valid command, i.e. db:create|db:drop');
      }
      else {

        global.mode = folder[1];
        executeDB();
      }
      break;
    case 'seed':

      global.mode = folder[1] || 'vc';
      global.migrationMode = folder[2];
      executeSeed();
      break;

    default:
      log.error('Invalid Action: Must be [up|down|create].');
      optimist.showHelp();
      process.exit(1);
      break;
  }
}

if (argv['force-exit']) {
  log.verbose('Forcing exit');
  process.exit(0);
}


module.exports = dbmigrate;