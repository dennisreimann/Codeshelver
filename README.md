# Codeshelver

Codeshelver lets you clean up your GitHub watchlist by storing repositories
you would like to remember on your shelve. You can tag any repository and
search for it later on - until then it won't spam your dashboard timeline.

## Installation

  * Copy `config/app.example.js` to `config/app.js` and enter your credentials
  * Install and start couchdb
  * Install dependencies with npm:

    $ sudo npm install

  * Install the development/deployment dependencies

    $ bundle install

  * Setup the database (see the Rakefile for more information)

    $ rake db:setup

  * Start the server

    $ node server.js
  or for developmet purposes:

    $ supervisor server.js
  You will have to `npm install supervisor` for that

## Extending the app

Go ahead and add the features you are missing. Send me pull requests and I'll
be glad to integrate your additions and deploy them to [codeshelver.com](https://www.codeshelver.com).