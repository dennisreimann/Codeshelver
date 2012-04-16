appEnv = process.env.NODE_ENV or 'development'
config = require("#{__dirname}/config/app.js")[appEnv]
connect = require 'connect'
utils = require 'util'
express = require 'express'
OAuth2 = require('oauth').OAuth2
auth = require 'connect-auth'
couchdb = require 'felix-couchdb'
jade = require 'jade'
fs = require 'fs'

# server config
serverOpts = {}
if config.server and config.server.keyFile and config.server.certFile
  serverOpts['key'] = fs.readFileSync(config.server.keyFile)
  serverOpts['cert'] = fs.readFileSync(config.server.certFile)

app = module.exports = express.createServer()
pubDir = "#{__dirname}/public"
client = couchdb.createClient 5984, 'localhost'
db = client.db 'codeshelver'

# FIXME: Using the format parameter is just a workaround for the problem described here:
# https://github.com/senchalabs/connect/issues#issue/83
repoNameFix = (name, format) ->
  if format and format isnt 'json' then "#{name}.#{format}" else name

# Helpers
apostrophize = (s) ->
  if s.charAt(s.length-1) is 's' then "#{s}' " else "#{s}'s "

app.dynamicHelpers
  messages: (req) ->
    msg = req.flash('info')
    if msg.length then "<p class='info'>#{msg}</p>" else ''
  user: (req) ->
    req.session.user

app.helpers
  apostrophize: apostrophize
  linkTo: (text, url) -> "<a href='#{url}'>#{text}</a>"
  linkRepo: (owner, name, text) ->
    url = "https://github.com/#{owner}/#{name}"
    text = "#{owner}/#{name}" unless text
    "<a href='#{url}'>#{text}</a>"

# Configuration
app.configure ->
  app.set 'debug', true
  app.set 'oauth baseURL', 'https://github.com/'
  app.set 'oauth authorizePath', 'login/oauth/authorize'
  app.set 'oauth accessTokenPath', 'login/oauth/access_token'
  app.set 'oauth callbackPath', '/oauth/callback'
  app.set 'port', if process.env.EXPRESS_PORT then parseInt(process.env.EXPRESS_PORT) else 3000
  app.set 'views', "#{__dirname}/views"
  app.set 'view engine', 'jade'

app.configure 'development', ->
  app.set 'baseURL', "http://codeshelver.dev:#{app.set('port')}"
  app.set 'reload views', 1000
  app.use express.errorHandler(dumpExceptions: true, showStack: true)
  app.use express.logger('dev')

app.configure 'production', ->
  app.set 'baseURL', 'https://www.codeshelver.com'
  app.use express.logger()

# Authentication middleware
signinFromCookie = (req, res, next) ->
  userCookie = req.cookies.user
  if userCookie
    try
      req.session.user = JSON.parse(userCookie)
    catch e
      res.clearCookie('user')
  next()

requireLogin = (req, res, next) ->
  user = req.session.user
  if user
    next()
  else
    # Buffer the request and authenticate
    req.session.buffer =
      returnURL: req.url
      tags: if req.body and req.body.tags then req.body.tags else null
    res.redirect "#{app.set('baseURL')}/signin"

# Middleware - take care, the order of these matters!
app.use express.favicon("#{pubDir}/favicon.ico")
app.use express.compiler({ src: pubDir, enable: ['sass'] })
app.use express.bodyParser()
app.use express.static(pubDir)
app.use express.methodOverride()
app.use express.cookieParser()
app.use express.session({ secret: config.sessionKey, cookie: { secure: true }})
app.use auth([auth.Github({
  appId: config.oauth.clientId,
  appSecret: config.oauth.secret,
  callback: "#{app.set('baseURL')}#{app.set('oauth callbackPath')}"
})])
app.use signinFromCookie

# GitHub OAuth 2.0, see: http://github.com/account/applications
oauth = new OAuth2(config.oauth.clientId, config.oauth.secret,
  app.set('oauth baseURL'), app.set('oauth authorizePath'), app.set('oauth accessTokenPath'));

app.get '/signin', (req, res) ->
  req.authenticate ['github'], (error, authenticated) -> null

app.get '/signout', (req, res) ->
  req.logout()
  req.session.destroy()
  res.clearCookie 'user'
  res.redirect app.set('baseURL')

app.get app.set('oauth callbackPath'), (req, res) ->
  req.authenticate ['github'], (error, authenticated) ->
    console.log "Github authentication failed: #{error}" if error and app.set('debug')
    if authenticated
      user = req.getAuthDetails().user
      userData =
        id: user.id
        login: user.login
        gravatar: user.gravatar_id
        accessToken: req.session.access_token
      req.session.user = userData
      res.cookie 'user', JSON.stringify(userData), path: '/', expires: new Date(Date.now() + 24*60*60*10)
      req.flash 'info', 'Welcome, you are signed in now!'
    else
      req.flash 'info', 'Unfortunately we could not sign you in, did you allow Codeshelver to access your GitHub account?'
    # Redirect back or default to root url
    returnTo = app.set('baseURL')
    if req.session.buffer
      returnTo += req.session.buffer.returnURL if req.session.buffer.returnURL
      req.session.buffer = null
    res.redirect returnTo

# Actions
app.get '/', (req, res) ->
  res.render 'index',
    locals:
      title: 'Codeshelver'

app.get '/popular', (req, res) ->
  tag = req.query.tag
  title = if tag then 'Popular ' + tag + ' repositories' else 'Popular repositories'
  repoQueryURL = if tag then '/_design/repos/_view/popular_tagged' else '/_design/repos/_view/popular'
  opts = if tag then startkey: [tag], endkey: [tag, "\u9999"], group: true else group: true
  # popular repos
  db.request repoQueryURL, opts, (error, data) ->
    console.log JSON.stringify(error) if error and app.set('debug')
    repos = data.rows.sort (a, b) -> b.value - a.value
    reposLimit = 25
    popularRepos = repos.slice(0, reposLimit)
    # popular tags
    db.request '/_design/tags/_view/popular', group: true, (error, data) ->
      console.log JSON.stringify(error) if error and app.set('debug')
      tags = data.rows.sort (a, b) -> b.value - a.value
      tagsLimit = 25;
      popularTags = tags.slice(0, tagsLimit) # Limit the tags
      maxTagCount = popularTags[0].value
      minTagCount = popularTags[popularTags.length-1].value
      popularTags = popularTags.sort (a, b) -> # Resort the alphabetically
        A = a.key.toLowerCase()
        B = b.key.toLowerCase()
        if A < B
          -1
        else if A > B
          1
        else
          0
      # render page
      res.render 'popular',
        locals:
          title: title
          tag: tag
          tags: popularTags
          repos: popularRepos
          reposLimit: reposLimit
          totalRepos: parseInt(repos.length)
          minTagCount: minTagCount
          maxTagCount: maxTagCount

app.get '/shelf.:format?', requireLogin, (req, res) ->
  user = req.session.user
  tag = req.query.tag
  title = if tag then "Your #{tag} shelf" else "Your shelf"
  queryURL = if tag then '/_design/shelve/_view/by_user_id_and_tag' else '/_design/shelve/_view/by_user_id'
  opts = if tag then startkey: [user.id, tag], endkey: [user.id, tag] else startkey: [user.id], endkey: [user.id]
  db.request queryURL, opts, (error, data) ->
    console.log JSON.stringify(error) if error and app.set('debug')
    if req.is('json') or req.params.format is 'json'
      res.contentType 'javascript'
      res.send "Codeshelver.shelf = #{if data then JSON.stringify(data.rows) else null};", {}, 200
    else
      req.flash('info', "#{error.error}: #{error.reason}") if (error)
      res.render 'shelf',
        locals:
          title: title
          login: null
          tag: tag
          repos: data.rows
          totalRepos: parseInt(data.rows.length)

app.get '/shelf/:login.:format?', (req, res) ->
  user = req.session.user
  tag = req.query.tag
  login = req.params.login
  title = if tag then "#{apostrophize(login)}#{tag} shelf" else "#{apostrophize(login)}shelf"
  queryURL = if tag then '/_design/shelve/_view/by_user_login_and_tag' else '/_design/shelve/_view/by_user_login';
  opts = if tag then startkey: [login, tag], endkey: [login, tag] else startkey: [login], endkey: [login]
  db.request queryURL, opts, (error, data) ->
    console.log JSON.stringify(error) if error and app.set('debug')
    if req.is('json') or req.params.format is 'json'
      res.contentType 'javascript'
      res.send "Codeshelver.users['#{login}'] = #{if data then JSON.stringify(data.rows) else null};", {}, 200
    else
      req.flash('info', "#{error.error}: #{error.reason}") if (error)
      res.render 'shelf',
        locals:
          title: title
          login: login
          tag: tag
          repos: data.rows
          totalRepos: parseInt(data.rows.length)

app.get '/shelves/:owner/:repo.:format?', (req, res) ->
  owner = req.params.owner
  repo = repoNameFix(req.params.repo, req.params.format)
  db.request '/_design/repos/_view/users', startkey: [owner, repo], endkey: [owner, repo], (error, data) ->
    console.log JSON.stringify(error) if error and app.set('debug')
    req.flash('info', "#{error.error}: #{error.reason}") if (error)
    res.render 'shelves',
      locals:
        title: "Shelves with #{owner}/#{repo}"
        owner: owner
        repo: repo
        shelves: data.rows
        totalShelves: parseInt(data.rows.length)

app.get '/shelve/:owner/:repo.:format?', requireLogin, (req, res) ->
  user = req.session.user
  owner = req.params.owner
  repo = repoNameFix(req.params.repo, req.params.format)
  key = "#{user.id}-#{owner}-#{repo}"
  db.getDoc key, (error, doc) ->
    console.log JSON.stringify(error) if error and app.set('debug')
    if req.is('json') or req.params.format == 'json'
      # load shelf count
      db.request '/_design/repos/_view/popular', startkey: [owner, repo], endkey: [owner, repo], (error, data) ->
        console.log JSON.stringify(error) if error and app.set('debug')
        count = if data and data.rows[0] then data.rows[0].value else 0
        if doc
          doc.shelvesCount = count
        else
          doc = shelvesCount: count
        # return the result
        res.contentType 'javascript'
        res.send "Codeshelver.repos['#{owner}/#{repo}'] = #{JSON.stringify(doc)};", {}, 200
    else
      tags = if doc then doc.tags.join(" ") else ''
      if req.session.buffer and req.session.buffer.tags
        tags = req.session.buffer.tags
        req.session.buffer = null
      res.render 'shelve',
        locals:
          title: "Shelve #{owner}/#{repo}"
          owner: owner
          repo: repo
          tags: tags

app.post '/shelve/:owner/:repo', requireLogin, (req, res) ->
  user = req.session.user
  owner = req.params.owner
  repo = repoNameFix(req.params.repo, req.params.format)
  tags = if req.body.tags then req.body.tags.toLowerCase().trim().replace(/,/g, " ").split(/\s+/) else []
  repoURL = "https://api.github.com/repos/#{owner}/#{repo}"
  oauth.get repoURL, user.accessToken, (error, data, response) ->
    # Hande errors
    if error
      console.log "Retrieving repository data failed: #{error.data}" if app.set('debug')
    else
      try
        repository = JSON.parse(data)
      catch e
        console.log "Could not parse repository data: #{data}" if app.set('debug')
    # Proceed
    if repository
      key = "#{user.id}-#{owner}-#{repo}"
      db.getDoc key, (error, doc) ->
        newDoc = !doc
        if newDoc
          # Initialize a new document, here go the values that won't change
          doc =
            user:
              id: user.id
              login: user.login
            repo:
              owner: repository.owner
              name: repository.name
        # Set or update all values that are changable,
        # in this case the tags and the description
        doc.tags = tags
        doc.repo.description = repository.description
        db.saveDoc key, doc, (error, ok) ->
          if error
            console.log "Could not save document: #{JSON.stringify(error)}" if app.set('debug')
            req.flash 'info', "Could not shelve the repository: #{error.reason}"
            req.session.buffer = tags: tags
            res.redirect "/shelve/#{owner}/#{repo}"
          else
            # Redirect back or default to repository
            returnTo = if req.back then req.back else "https://github.com/#{owner}/#{repo}"
            req.flash 'info', "You #{if newDoc then 'shelved' else 'updated'} #{owner}/#{repo}"
            res.redirect returnTo
    else
      req.flash 'info', "Unfortunately we could not load the repository information: #{error}"
      res.redirect "/shelve/#{owner}/#{repo}"

app.del '/shelve/:owner/:repo.:format?', requireLogin, (req, res) ->
  user = req.session.user
  owner = req.params.owner
  repo = repoNameFix(req.params.repo, req.params.format)
  key = "#{user.id}-#{owner}-#{repo}"
  db.getDoc key, (error, doc) ->
    if error
      req.flash 'info', "Could not retrieve document: #{error.reason}"
      res.redirect "/shelve/#{owner}/#{repo}"
    else
      db.removeDoc doc._id, doc._rev, (error, ok) ->
        if error
          console.log "Could not delete document #{doc._id}: #{JSON.stringify(error)}" if app.set('debug')
          req.flash 'info', "Could not remove #{owner}/#{repo}: #{error.reason}"
        else
          req.flash 'info', "You removed #{owner}/#{repo} from your shelf."
        res.redirect '/shelf'

# Error handling
app.error (err, req, res, next) ->
  return next(err) if app.set('env') isnt 'production'
  res.render 'error.jade',
    locals:
      title: 'An error occurred'
      error: err

# Only listen on $ node server.js
app.listen app.set('port') unless module.parent
