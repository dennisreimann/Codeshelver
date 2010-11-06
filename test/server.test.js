// Run $ expresso

/**
 * Module dependencies.
 */

var app = require('../server');

module.exports = {
  'GET /': function(assert) {
    assert.response(app,
      { url: '/' },
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }},
      function(res) {
        assert.includes(res.body, '<title>Codeshelver</title>');
      }
    );
  }
};
