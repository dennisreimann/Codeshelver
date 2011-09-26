require.paths.unshift(__dirname + '/lib/node/');

var
  config = require(__dirname + '/config/app.js');
  connect = require('connect'),
  utils = require('utils'),
  session = require('connect/middleware/session'),
  express = require('express'),
  OAuth2 = require('node-oauth').OAuth2,
  auth = require('index'),
  couchdb = require('node-couchdb');

var
  app = module.exports = express.createServer(),
  pubDir = __dirname + '/public',
  client = couchdb.createClient(5984, 'localhost'),
  db = client.db('codeshelver');


// FIXME: Using the format parameter is just a workaround for the problem described here:
// https://github.com/senchalabs/connect/issues#issue/83
var repoNameFix = function(name, format) {
  return format ? name + '.' + format : name;
}

// Helpers
var apostrophize = function(s) {
  return s.charAt(s.length-1) == 's' ? s + "' " : s + "'s ";
}

app.dynamicHelpers({
  messages: function(req) {
    var msg = req.flash('info');
    return msg.length ? '<p class="info">' + msg + '</p>': '';
  },
  user: function(req) {
    return req.session.user;
  }
});

app.helpers({
  apostrophize: apostrophize,
  linkTo: function(text, url) { return '<a href=' + url + '>' + text + '</a>'; },
  linkRepo: function(owner, name, text) {
    var url = 'https://github.com/' + owner + '/' + name;
    if (!text) text = owner + '/' + name;
    return '<a href=' + url + '>' + text + '</a>';
  }
});

// Authentication middleware
var signinFromCookie = function(req, res) {
  var userCookie = req.cookies.user;
  if (userCookie) {
    try {
      req.session.user = JSON.parse(userCookie);
    } catch (e) {
      res.clearCookie('user');
    }
  }
  return req.session.user;
}

var requireLogin = function(req, res, next) {
  var user = req.session.user;
  if (!user) {
    if (app.set('debug')) console.log("Not signed in by session");
    user = signinFromCookie(req, res);
  }
  if (!user) {
    if (app.set('debug')) console.log("Not signed in by cookie");
    // Buffer the request and authenticate
    var tags = req.body && req.body.tags ? req.body.tags : null;
    req.session.buffer = { returnURL: req.url, tags: tags };
    res.redirect('/signin');
  } else {
    next();
  }
}

// Configuration
app.configure(function() {
  app.set('debug', true);
  app.set('oauth baseURL', 'https://github.com/');
  app.set('oauth authorizePath', 'login/oauth/authorize');
  app.set('oauth accessTokenPath', 'login/oauth/access_token');
  app.set('oauth callbackPath', '/oauth/callback');
  app.set('port', process.env.EXPRESS_PORT ? parseInt(process.env.EXPRESS_PORT) : 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
});

app.configure('development', function() {
  app.set('baseURL', 'http://codeshelver.dev:' + app.set('port'));
  app.set('reload views', 1000);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
  app.set('baseURL', 'https://www.codeshelver.com');
});

// Middleware - take care, the order of these matters!
app.use(express.favicon(pubDir + '/favicon.ico'));
app.use(express.compiler({ src: pubDir, enable: ['sass'] }));
app.use(express.logger({ format: ':method :url :response-time' }));
app.use(express.bodyDecoder());
app.use(express.staticProvider(pubDir));
app.use(express.methodOverride());
app.use(express.cookieDecoder());
app.use(express.session());
app.use(auth([auth.Github({
  appId: config[app.set('env')].oauth.clientId,
  appSecret: config[app.set('env')].oauth.secret,
  callback: app.set('baseURL') + app.set('oauth callbackPath')
})]));

// GitHub OAuth 2.0, see: http://github.com/account/applications
var oauth = new OAuth2(config[app.set('env')].oauth.clientId, config[app.set('env')].oauth.secret,
  app.set('oauth baseURL'), app.set('oauth authorizePath'), app.set('oauth accessTokenPath'));

app.get('/signin', function(req, res) {
  req.authenticate(['github'], function(error, authenticated) {});
});

app.get('/signout', function(req, res) {
  req.logout();
  req.session.destroy();
  res.clearCookie('user');
  res.redirect('/');
});

app.get(app.set('oauth callbackPath'), function(req, res) {
  req.authenticate(['github'], function(error, authenticated) {
    if (error && app.set('debug')) console.log('Github authentication failed: ' + error);
    if (authenticated) {
      var user = req.getAuthDetails().user;
      var userData = {
        id: user.id,
        login: user.login,
        gravatar: user.gravatar_id,
        accessToken: req.session.access_token };
      req.session.user = userData;
      res.cookie('user', JSON.stringify(userData), { path: '/', expires: new Date(Date.now() + 24*60*60*10) });
      req.flash('info', 'Welcome, you are signed in now!');
    } else {
      req.flash('info', 'Unfortunately we could not sign you in, did you allow Codeshelver to access your GitHub account?');
    }
    // Redirect back or default to root url
    var returnTo = req.session.buffer ? req.session.buffer.returnURL : '/';
    res.redirect(returnTo);
  });
});

// Actions
app.get('/', function(req, res) {
  res.render('index', {
    locals: {
      title: 'Codeshelver'
    }
  });
});

app.get('/popular', function(req, res) {
  var tag = req.query.tag;
  var title = tag ? 'Popular ' + tag + ' repositories' : 'Popular repositories';
  var repoQueryURL = tag ? '/_design/repos/_view/popular_tagged' : '/_design/repos/_view/popular';
  var opts = tag ? { startkey: [tag], endkey: [tag, "\u9999"], group: true } : { group: true };
  // popular repos
  db.request(repoQueryURL, opts, function(error, data) {
    if (error && app.set('debug')) console.log(JSON.stringify(error));
    var repos = data.rows.sort(function(a, b) { return b.value - a.value; });
    var reposLimit = 25;
    var popularRepos = tag ? repos : repos.slice(0, reposLimit); // Limit the repos if there is no tag
    // popular tags
    db.request('/_design/tags/_view/popular', { group: true }, function(error, data) {
      if (error && app.set('debug')) console.log(JSON.stringify(error));
      var tags = data.rows.sort(function(a, b) { return b.value - a.value; });
      var tagsLimit = 25;
      var popularTags = tags.slice(0, tagsLimit); // Limit the tags
      var maxTagCount = popularTags[0].value;
      var minTagCount = popularTags[popularTags.length-1].value;
      popularTags = popularTags.sort(function(a, b) { // Resort the alphabetically
        var A = a.key.toLowerCase();
        var B = b.key.toLowerCase();
        if (A < B){
          return -1;
        } else if (A > B) {
          return  1;
        } else {
          return 0;
        }
      });
      // render page
      res.render('popular', {
        locals: {
          title: title,
          tag: tag,
          tags: popularTags,
          repos: popularRepos,
          reposLimit: reposLimit,
          totalRepos: parseInt(repos.length),
          minTagCount: minTagCount,
          maxTagCount: maxTagCount
        }
      });
    });
  });
});

app.get('/shelf.:format?', requireLogin, function(req, res) {
  var user = req.session.user;
  var tag = req.query.tag;
  var title = tag ? 'Your ' + tag + ' shelf' : 'Your shelf';
  var queryURL = tag ? '/_design/shelve/_view/by_user_id_and_tag' : '/_design/shelve/_view/by_user_id';
  var opts = tag ? { startkey: [user.id, tag], endkey: [user.id, tag] } : { startkey: [user.id], endkey: [user.id] }
  db.request(queryURL, opts, function(error, data) {
    if (error && app.set('debug')) console.log(JSON.stringify(error));
    if (req.query.json) {
      res.contentType('javascript');
      return res.send('Codeshelver.shelf = ' + (data ? JSON.stringify(data.rows) : null) + ';', {}, 200);
    } else {
      if (error) req.flash('info', error.error + ': ' + error.reason);
      res.render('shelf', {
        locals: {
          title: title,
          login: null,
          tag: tag,
          repos: data.rows,
          totalRepos: parseInt(data.rows.length)
        }
      });
    }
  });
});

app.get('/shelf/:login.:format?', function(req, res) {
  var user = req.session.user;
  var tag = req.query.tag;
  var login = req.params.login;
  var title = tag ? apostrophize(login) + tag + ' shelf' : apostrophize(login) + 'shelf';
  var queryURL = tag ? '/_design/shelve/_view/by_user_login_and_tag' : '/_design/shelve/_view/by_user_login';
  var opts = tag ? { startkey: [login, tag], endkey: [login, tag] } : { startkey: [login], endkey: [login] }
  db.request(queryURL, opts, function(error, data) {
    if (error && app.set('debug')) console.log(JSON.stringify(error));
    if (req.query.json) {
      res.contentType('javascript');
      return res.send('Codeshelver.users["' + login + '"] = ' + (data ? JSON.stringify(data.rows) : null) + ';', {}, 200);
    } else {
      if (error) req.flash('info', error.error + ': ' + error.reason);
      res.render('shelf', {
        locals: {
          title: title,
          login: login,
          tag: tag,
          repos: data.rows,
          totalRepos: parseInt(data.rows.length)
        }
      });
    }
  });
});

app.get('/shelves/:owner/:repo.:format?', function(req, res) {
  var owner = req.params.owner;
  var repo = repoNameFix(req.params.repo, req.params.format);
  db.request('/_design/repos/_view/users', { startkey: [owner, repo], endkey: [owner, repo] }, function(error, data) {
    if (error && app.set('debug')) console.log(JSON.stringify(error));
    if (error) req.flash('info', error.error + ': ' + error.reason);
    res.render('shelves', {
      locals: {
        title: 'Shelves with ' + owner + '/' + repo,
        owner: owner,
        repo: repo,
        shelves: data.rows,
        totalShelves: parseInt(data.rows.length)
      }
    });
  });
});

app.get('/shelve/:owner/:repo.:format?', requireLogin, function(req, res) {
  var user = req.session.user;
  var owner = req.params.owner;
  var repo = repoNameFix(req.params.repo, req.params.format);
  var key = user.id + '-' + owner + '-' + repo;
  db.getDoc(key, function(error, doc) {
    if (error && app.set('debug')) console.log(JSON.stringify(error));
    if (req.query.json) {
      // load shelf count
      db.request('/_design/repos/_view/popular', { startkey: [owner, repo], endkey: [owner, repo] }, function(error, data) {
        if (error && app.set('debug')) console.log(JSON.stringify(error));
        var count = data && data.rows[0] ? data.rows[0].value : 0;
        if (doc) {
          doc.shelvesCount = count;
        } else {
          doc = { shelvesCount: count };
        }
        // return the result
        res.contentType('javascript');
        return res.send('Codeshelver.repos["' + owner + '/' + repo +  '"] = ' + JSON.stringify(doc) + ';', {}, 200);
      });
    } else {
      var tags = doc ? doc.tags.join(" ") : '';
      if (req.session.buffer && req.session.buffer.tags) {
        tags = req.session.buffer.tags;
        req.session.buffer = null;
      }
      res.render('shelve', {
        locals: {
          title: 'Shelve ' + owner + '/' + repo,
          owner: owner,
          repo: repo,
          tags: tags
        }
      });
    }
  });
});

app.post('/shelve/:owner/:repo.:format?', requireLogin, function(req, res) {
  var user = req.session.user;
  var owner = req.params.owner;
  var repo = repoNameFix(req.params.repo, req.params.format);
  var tags = req.body.tags ? req.body.tags.toLowerCase().trim().replace(/,/g, " ").split(/\s+/) : [];
  var repoURL = 'https://github.com/api/v2/json/repos/show/' + owner + '/' + repo;
  oauth.getProtectedResource(repoURL, user.accessToken, function(error, data, response) {
    // Hande errors
    if (error) {
      if (app.set('debug')) console.log('Retrieving repository data failed: ' + error);
    } else {
      try {
        var repository = JSON.parse(data).repository;
      } catch (e) {
        if (app.set('debug')) console.log('Could not parse repository data: ' + data);
      }
    }
    // Proceed
    if (repository) {
      var key = user.id + '-' + owner + '-' + repo;
      db.getDoc(key, function(error, doc) {
        var newDoc = !doc;
        if (newDoc) {
          // Initialize a new document, here go the values that won't change
          doc = {
            user: {
              id: user.id,
              login: user.login },
            repo: {
              owner: repository.owner,
              name: repository.name }
          };
        }
        // Set or update all values that are changable,
        // in this case the tags and the description
        doc.tags = tags;
        doc.repo.description = repository.description;
        db.saveDoc(key, doc, function(error, ok) {
          if (error) {
            if (app.set('debug')) console.log('Could not save document: ' + JSON.stringify(error));
            req.flash('info', 'Could not shelve the repository: ' + error.reason);
            req.session.buffer = { tags: tags };
            res.redirect('/shelve/' + owner + '/' + repo);
          } else {
            // Redirect back or default to repository
            var returnTo = req.back ? req.back : 'http://github.com/' + owner + '/' + repo;
            req.flash('info', 'You ' + (newDoc ? 'shelved' : 'updated') + ' ' + owner + '/' + repo);
            res.redirect(returnTo);
          }
        });
      });
    } else {
      req.flash('info', 'Unfortunately we could not load the repository information: ' + error);
      res.redirect('/shelve/' + owner + '/' + repo);
    }
  });
});

app.del('/shelve/:owner/:repo.:format?', requireLogin, function(req, res) {
  var user = req.session.user;
  var owner = req.params.owner;
  var repo = repoNameFix(req.params.repo, req.params.format);
  var key = user.id + '-' + owner + '-' + repo;
  db.getDoc(key, function(error, doc) {
    if (error) {
      req.flash('info', 'Could not retrieve document: ' + error.reason);
      res.redirect('/shelve/' + owner + '/' + repo);
    } else {
      db.removeDoc(doc._id, doc._rev, function(error, ok) {
        if (error) {
          if (app.set('debug')) console.log('Could not delete document ' + doc._id + ': ' + JSON.stringify(error));
          req.flash('info', 'Could not remove ' + owner + '/' + repo + ': ' + error.reason);
        } else {
          req.flash('info', 'You removed ' + owner + '/' + repo + ' from your shelf.');
        }
        res.redirect('/shelf');
      });
    }
  });
});

// Error handling
app.error(function(err, req, res, next) {
  if (app.set('env') != 'production') next(err);
  res.render('error.jade', {
    locals: {
      title: 'An error occurred',
      error: err
    }
  });
});

// Only listen on $ node server.js
if (!module.parent) app.listen(app.set('port'));