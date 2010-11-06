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
    //self.includeLatestJquery();
    // Let's rock!
    self.adjustDashboard();
    self.addShelveLink();
    self.addShelvedReposList();
    self.adjustRepoPage();
    self.observeButtons();
    
    if ($('#watched_repos').length) {
      JavaScript.load(self.baseURL + '/shelf.js', function() { self.addShelvedReposList() });
    }
  },
  
  // Include GitHub's jQuery (no extra load)
  includeGitHubJquery: function() {
    $ = unsafeWindow.jQuery;
  },
  
  // Include the latest jQuery (in case GitHubs version is not sufficient)
  includeLatestJquery: function() {
    var script = document.createElement('script');
    script.src = 'http://code.jquery.com/jquery-latest.min.js';
    script.type = 'text/javascript';
    script.addEventListener("load", function() {
      unsafeWindow.jQuery.noConflict();
      $ = unsafeWindow.jQuery;
    }, false);
    document.getElementsByTagName('head')[0].appendChild(script);
  },
  
  // Parsing GitHub URLs
  getRepoPartsFromURL: function(url) {
    var parts = url.replace(this.urlRegex, '').split('/');
    return parts;
  },

  shelveURLForRepoURL: function(url) {
    var repoParts = this.getRepoPartsFromURL(url);
    var repoOwner = repoParts[0];
    var repoName = repoParts[1];
    var shelveURL = this.baseURL + '/shelve/' + repoOwner + '/' + repoName;
    return shelveURL;
  },
  
  // Append shelve links to every repo news item
  adjustDashboard: function() {
    var self = this;
    var addShelveButton = function(titleItem) {
      var repoURL = $(titleItem).find('a').last().attr('href');
      var shelveLink = '<a class="button btn-shelve" href="' + self.shelveURLForRepoURL(repoURL) + '">shelve</a>';
      $(titleItem).append(shelveLink);
    };
    $('.news .push .title').each(function() { addShelveButton(this) });
    $('.news .fork .title').each(function() { addShelveButton(this) });
    $('.news .watch_started .title').each(function() { addShelveButton(this) });
    $('.news .issues_opened .title').each(function() { addShelveButton(this) });
    $('.news .issues_closed .title').each(function() { addShelveButton(this) });
    $('.news .fork .details .message').each(function() { addShelveButton(this) });
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
      var buttonId = 'shelve_button';
      var repoURL = location.href;
      var repoParts = self.getRepoPartsFromURL(repoURL);
      var repoOwner = repoParts[0];
      var repoName = repoParts[1];
      var shelveURL = self.shelveURLForRepoURL(repoURL);
      var iconStyle = '<style type="text/css">.btn-shelve .icon{background:url(' + self.baseURL + '/images/minibutton_icons.png) no-repeat scroll 0 0 transparent;}.btn-shelve:hover .icon{background-position:0 -25px;}</style>';
      var shelveItem = '<li><a id="' + buttonId + '" class="minibutton btn-watch btn-shelve" href="' + shelveURL + '"><span><span class="icon"></span> Shelve</span></a></li>';
      $(this).after(shelveItem);
      $('body').append(iconStyle);
    });
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
        var shelfURL = shelveURL.replace(self.baseURL + "/shelve", self.baseURL + "/shelf"); // I admit, this is a little hackish…
        var top = e.pageY + 10;
        var style = 'position:absolute;top:' + top + 'px;z-index:100000;opacity:1;';
        var shelveForm = 
          '<div id="' + id + '" style="' + style + '" class="tipsy tipsy-north"><div class="tipsy-inner">' +
          '<form method="post" action="' + shelveURL + '">' +
          '<p style="margin:.35em .25em;"><label for="shelve_tags">Tags:</label> ' +
          '<input type="text" id="shelve_tags" name="tags" /> ' +
          '<input type="submit" value="shelve" />' +
          '</p></form></div></div>';
        $('body').append(shelveForm);
        $('#' + id).css({left: (e.pageX - $('#' + id).width() / 2) + 'px'})
        $('#shelve_tags').focus();
        JavaScript.load(shelfURL + '.js', function() {
          if (!Codeshelver.currentRepo) return;
          var tags = Codeshelver.currentRepo.tags.join(" ");
          if (tags.length > 0) tags += " ";
          $('#shelve_tags').val(tags);
        });
      }
      return false;
    });
  }
};

Codeshelver.init();