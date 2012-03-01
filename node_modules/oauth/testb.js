//var OAuth= require('./lib/oauth').OAuth;
var sys= require('sys');
var OAuth= require('oauth').OAuth;

oa= new OAuth("https://twitter.com/oauth/request_token",
                 "https://twitter.com/oauth/access_token", 
                 "JiYmll7CX3AXDgasnnIDeg",  "mWPBRK5kG2Tkthuf5zRV1jYWOEwnjI6xs3QVRqOOg", 
                 "1.0A", "http://localhost:3000/oauth/callback", "HMAC-SHA1");       

var access_token= '23186482-ZXEosOnO34TIzAAMEVMilrXcHezMF4odlDwvKNyA';
var access_token_secret= 'PnNN2GWYlfNCyhN6dAiMLQdvvDLy67dpaALies';


var request= oa.get("http://stream.twitter.com/1/statuses/sample.json", access_token, access_token_secret );
request.addListener('response', function (response) {
  response.setEncoding('utf8');
  response.addListener('data', function (chunk) {
    console.log(chunk);
  });
  response.addListener('end', function () {
    console.log('--- END ---')
  });
});

request.end();

oa.get("http://api.twitter.com/1/statuses/retweeted_by_me.json", access_token, access_token_secret, function(error, data) {
  console.log(sys.inspect(data));
});