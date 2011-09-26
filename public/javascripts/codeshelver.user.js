// ==UserScript==
// @name        Codeshelver
// @description Cleans up your GitHub watchlist and gives you a place to remember repositories
// @include     https://github.com/*
// @include     http://github.com/*
// @author      Codeshelver by Dennis Bloete (http://dennisbloete.de, https://www.codeshelver.com/)
// ==/UserScript==

(function() {
  // Load the real userscript from the server, so that the users
  // do not have to update their userscripts when new features are
  // added or GitHub changes something (like their markup). Also 
  // disables the buttons in case codeshelver.com is not available.
  var script = document.createElement('script');
  script.src = 'https://www.codeshelver.com/javascripts/userscript.js';
  script.type = 'text/javascript';
  document.getElementsByTagName('head')[0].appendChild(script);
})();