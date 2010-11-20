// Taken from @hagenburger, see:
// http://gist.github.com/500716
var JavaScript = {
  load: function(src, callback) {
    var script = document.createElement('script'), loaded;
    script.setAttribute('src', src);
    if (callback) {
      script.onreadystatechange = script.onload = function() {
        if (!loaded) { callback(); }
        loaded = true;
      };
    }
    document.getElementsByTagName('head')[0].appendChild(script);
  }
};

// Here goes the real userscript
var Codeshelver = {
  // Config
  baseURL: "http://codeshelver.com",
  urlRegex: /https?:\/\/github.com\//,
  currentShelf: [],

  init: function() {
    var self = this;
    // GreaseKit compatibility
    if (typeof(unsafeWindow) === 'undefined') {
      unsafeWindow = window;
    }
    // Include jQuery
    self.includeGitHubJquery();
    // Let's rock!
    self.adjustDashboard();
    self.addShelveLink();
    self.addShelvedReposList();
    self.adjustRepoPage();
    self.adjustUserPage();
    self.observeButtons();
  },

  // Include GitHub's jQuery (no extra load)
  includeGitHubJquery: function() {
    $ = unsafeWindow.jQuery;
  },

  // Parsing GitHub URLs
  repoIdForURL: function(url) {
    var parts = url.replace(this.urlRegex, '').split('/');
    var owner = parts[0];
    var name = parts[1];
    return owner + '/' + name;
  },

  shelveURLForRepoURL: function(url) {
    return this.baseURL + '/shelve/' + this.repoIdForURL(url);
  },

  // Append shelve links to every repo news item
  adjustDashboard: function() {
    var self = this;
    var addShelveButton = function(titleItem) {
      var repoURL = $(titleItem).find('a').last().attr('href');
      var repoId = self.repoIdForURL(repoURL);
      var shelveURL = self.shelveURLForRepoURL(repoURL);
      var shelveLink = '<a class="button btn-shelve" data-repoid="' + repoId + '" href="' + shelveURL + '">shelve</a>';
      $(titleItem).append(shelveLink);
    };
    $('.news .push .title').each(function() { addShelveButton(this) });
    $('.news .fork .title').each(function() { addShelveButton(this) });
    $('.news .watch_started .title').each(function() { addShelveButton(this) });
    $('.news .issues_opened .title').each(function() { addShelveButton(this) });
    $('.news .issues_closed .title').each(function() { addShelveButton(this) });
    $('.news .fork .details .message').each(function() { addShelveButton(this) });
    if ($('#watched_repos').length) {
      JavaScript.load(self.baseURL + '/shelf.js', function() { self.addShelvedReposList() });
    }
  },

  addShelveLink: function() {
    $('.topsearch .nav li:nth-child(2)').after('<li><a href="' + this.baseURL + '/shelf">Shelf</a></li>');
  },

  addShelvedReposList: function() {
    if (!Codeshelver.currentShelf.length) return;
    var self = this;
    var shelfURL = this.baseURL + '/shelf';
    var maxCount = 10;
    var shelfCount = Codeshelver.currentShelf.length;
    var leftCount = shelfCount - maxCount;
    var repoList = '';
    $.each(Codeshelver.currentShelf, function(i, item) {
      if (i >= maxCount) return false;
      var repo = item.value.repo;
      repoList += '' +
        '   <li class="public source">' +
        '     <a href="http://github.com/' + repo.owner + '/' + repo.name + '">' +
        '       <span class="owner">' + repo.owner + '</span>/<span class="repo">' + repo.name + '</span>' +
        '     </a>' +
        '   </li>';
    });
    var shelvedRepos = '' +
      '<div class="repos shelved" id="shelved_repos">' +
      ' <div class="top-bar">' +
      '   <h2>Shelved Repositories <em>(' + shelfCount + ')</em></h2>' +
      ' </div>' +
      ' <div class="filter-bar">' +
      '   <form method="get" action="' + shelfURL + '" style="margin-bottom:10px">' +
      '     <input type="search" name="tag" class="filter_input">' +
      '   </form>' +
      ' </div>' +
      ' <ul class="repo_list" id="shelved_repo_listing">' +
      '   ' + repoList +
      ' </ul>' +
      ' <div class="bottom-bar">' +
      '   <a href="' + shelfURL + '" class="show-more" id="inline_shelved_repos">Show ' + 
      '   ' + (leftCount > 0 ? leftCount : '') +
      '   more repositories&hellip;</a>' +
      ' </div>' +
      '</div>';
    $('#watched_repos').after(shelvedRepos);
  },

  // Append shelve link on repo page
  adjustRepoPage: function() {
    var self = this;
    $('.site ul.actions li.for-owner').each(function() {
      var button = function(text) { return '<span><span class="icon"></span> ' + text + '</span>'; };
      var buttonId = 'shelve_button';
      var repoURL = location.href;
      var repoId = self.repoIdForURL(repoURL);
      var shelveURL = self.shelveURLForRepoURL(repoURL);
      var iconStyle = '<style type="text/css">.btn-shelve .icon{background:url(' + self.baseURL + '/images/minibutton_icons.png) no-repeat scroll 0 0 transparent;}.btn-shelve:hover .icon{background-position:0 -25px;}</style>';
      var shelveItem = '<li><a class="minibutton btn-watch btn-shelve" id="' + buttonId + '" data-repoid="' + repoId + '" href="' + shelveURL + '">' + button('Shelve') + '</a></li>';
      $(this).after(shelveItem);
      $('body').append(iconStyle);
      JavaScript.load(shelveURL + '.js', function() {
        if (Codeshelver.repos[repoId]) {
          $('#' + buttonId).html(button('Shelved'));
        }
      });
    });
  },

  // Append shelf link on user page
  adjustUserPage: function() {
    if (!$('.userpage').length) return;
    var self = this;
    var parts = location.href.replace(this.urlRegex, '').split('/');
    var login = parts[0];
    var shelfURL = self.baseURL + '/shelf/' + login;
    $('.userpage ul.actions').append('<li><a class="minibutton" href="' + shelfURL + '"><span>Shelf</span></a></li>');
  },

  observeButtons: function() {
    var self = this;
    $('a.btn-shelve').live('click', function(e) {
      var id = 'shelver';
      var shelver = $('#' + id);
      if (shelver.length) {
        shelver.remove();
      } else {
        var shelveURL = $(this).attr('href');
        var repoId = $(this).attr('data-repoid');
        var top = e.pageY + 10;
        var style = 'position:absolute;top:' + top + 'px;z-index:100000;opacity:1;';
        var shelveForm = 
          '<div id="' + id + '" style="' + style + '" class="tipsy tipsy-north"><div class="tipsy-inner">' +
          '<form method="post" action="' + shelveURL + '">' +
          '<p style="margin:.35em .25em;"><label for="shelve_tags">Tags:</label> ' +
          '<input type="text" id="shelve_tags" name="tags" /> ' +
          '<input type="submit" value="shelve" />' +
          '</p></form></div></div>';
        var addTagsToShelveForm = function() {
          var repo = Codeshelver.repos[repoId];
          if (!repo) return;
          var tags = repo.tags.join(" ");
          if (tags.length > 0) tags += " ";
          $('#shelve_tags').val(tags);
        };
        $('body').append(shelveForm);
        $('#' + id).css({left: (e.pageX - $('#' + id).width() / 2) + 'px'})
        if (typeof(Codeshelver.repos[repoId]) == "undefined") {
          JavaScript.load(shelveURL + '.js', addTagsToShelveForm);
        } else {
          addTagsToShelveForm();
        }
        $('#shelve_tags').focus();
      }
      return false;
    });
  }
};

Codeshelver.repos = {};
Codeshelver.init();
