var async   = require('async');
var express = require('express');
var util    = require('util');
//var jQuery = require('jQuery');


// Example useage of getJSON.  Important for querying Volunteer Match
//jQuery.getJSON('http://twitter.com/status/user_timeline/treason.json?count=10&callback=?',function(data) {
//  console.log(data);
//});

// create an express webserver
var app = express.createServer(
  express.logger(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  express.cookieParser(),
  // set this to a secret value to encrypt session cookies
  express.session({ secret: process.env.SESSION_SECRET || 'secret123' }),
  require('faceplate').middleware({
    app_id:  process.env.FACEBOOK_APP_ID,
    secret:  process.env.FACEBOOK_SECRET,
    scope:  'user_likes,user_photos,user_photo_video_tags'
  })
);

// Connect app to Volunteer Match 
// Stores account information for Volunteer Match
//var volunteerMatch = {
//  accountName: process.env.VOLUNTEER_MATCH_ACCOUNT,
//  accountKey: process.env.VOLUNTEER_MATCH_KEY,
//  accountSecret: process.env.VOLUNTEER_MATCH_SECRET
//};
/*
var name = volunteerMatch.accountName;
var key = volunteerMatch.accountKey;
var secret  = volunteerMatch.accountSecret;
var path = ;

function SendRequest(action, query, type) {
var timestamp = time();
var nonce = hash('sha1', openssl_random_pseudo_bytes(20));
var date = date('Y-m-d\TH:i:sO', timestamp);
var digest = base64_encode(hash('sha256', $nonce . $date . self::$key, TRUE));
var header_array = array( 'Content-Type' => 'application/json',
					  'Authorization' => 'WSSE profile="UsernameToken"',
					  'X-WSSE' => 
					  'UsernameToken Username="' . self::$username . 
					  '", PasswordDigest="' . $digest .
					  '", Nonce="' . $nonce .
					  '", Created="' . $date .
					  '"');
var url = path + "?action=" + action;
if (query != NULL) {
   var json_query = JSON.stringify(query);
   url = url + "&query=" +  urlencode(json_query);
}  

}


function DisplayResponse() {

}

*/


// Create database instance
if(process.env.VCAP_SERVICES)
{
	var env = JSON.parse(process.env.VCAP_SERVICES);
	var mongo = env['mongodb-1.8'][0]['credentials'];
}
else{
	var mongo = {
		"hostname":"localhost",
		"port":27017,
		"username":"",
		"password":"",
		"name":"",
		"db":"db"
	}
    }

//    var generate_mongo_url = function(obj){
//	obj.hostname = (obj.hostname || 'localhost');
//	obj.port = (obj.port || 27017);
//	obj.db = (obj.db || 'users');
//
//	if(obj.username && obj.password){
//		return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
//	}
//	else{
//		return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
//	}
//    }
//
//var mongourl = generate_mongo_url(mongo);
//
    	var params = {
		host: mongo.hostname,
		port: mongo.port,
		username: mongo.username,
		password: mongo.password,
		db: mongo.db
	}

//initiate database connection.
var collections = ["users"];
var db = require("mongojs").connect(params, collections);

db.users.ensureIndex({"fb_uid" : 1}, {unique:true}, function(err, log) {
	console.log('Error: ' + err);
	console.log('log: ' + log);
});

db.users.ensureIndex({"visit_count" : 1}, function(err, log) {
	console.log('Error: ' + err);
	console.log('log: ' + log);
});

// listen to the PORT given to us in the environment
var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var http = require('http');

app.listen(port, function() {
  console.log("Listening on " + port);
});

app.dynamicHelpers({
  'host': function(req, res) {
    return req.headers['host'];
  },
  'scheme': function(req, res) {
    return req.headers['x-forwarded-proto'] || 'http';
  },
  'url': function(req, res) {
    return function(path) {
      return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(req, res)(path);
    }
  },
  'url_no_scheme': function(req, res) {
    return function(path) {
      return '://' + app.dynamicViewHelpers.host(req, res) + (path || '');
    }
  },
});

function render_page(req, res) {
  req.facebook.app(function(app) {
    req.facebook.me(function(user) {
      res.render('index.ejs', {
        layout:    false,
        req:       req,
        app:       app,
        user:      user
      });
    });
  });
}

var url = 'http://www.facebook.com';

//function db_get_everything(id) {
//	db.users.find({'fb_uid': id}, function(err, result) { /*Empty*/});
//	console.log(ret);
//}

function handle_facebook_request(req, res) {
 
  // if the user is logged in
  if (req.facebook.token) {

  req.facebook.get('/me', function(me) {
// 	db.users.save({"fb_uid" : me.id});
//	db.users.findAndModify({
//			      query: {fb_uid: me.id},
//			      update: {fb_uid: me_id, visit_count: 1},
//			      upsert: true}, function(err,log){
//			      console.log('Error - ' + err);
//			      console.log('Log - ' + log)});
	  //db_get_everything(me.id);
	  console.log("trying to save.." + me.id);
	  db.users.find({'fb_uid': me.id}, function(err, result) {
		       if(err) console.log('error: ' + err);
			else if(result.length == 0) {
				console.log("Record not found");
 				db.users.save({"fb_uid" : me.id, "visit_count": ['http://fb.com']}, function(err,log) {console.log("Callback");});
			}
			else { console.log("Found, " + result);
	  			db.users.update({'fb_uid': me.id}, {$set: {'fb_uid': me.id}, $push: {'visit_count': url}}, true, function(err,log) {console.log("Callback");});
			}
	  		});
//	  db.users.update({'fb_uid': 1}, {$set: {'fb_uid': 1}, $inc: {'visit_count': 1}}, true, function(err,log) {console.log("Callback");});

//	  if(cur == null) {
//		  console.log('Object does not exist adding..' + me.id);
//		  db.users.save({"fb_uid": me.id, "visit_count": 1}, function(err, saved) {
//			         if( err || !saved ) console.log("User not saved");
//			         else console.log("User saved");
//		  });
//	  } else {
//		  console.log("Object found, updating.." + cur.fb_uid);
//		  db.users.save({"fb_uid": cur.fb_uid}, {$inc: {visiting_count: 1}});
//	  }
	  console.log(me.id);
    });
    async.parallel([
      function(cb) {
        // query 4 friends and send them to the socket for this socket id
        req.facebook.get('/me/friends', { limit: 4 }, function(friends) {
          req.friends = friends;
          cb();
        });
      },
      function(cb) {
        // query 16 photos and send them to the socket for this socket id
        req.facebook.get('/me/photos', { limit: 16 }, function(photos) {
          req.photos = photos;
          cb();
        });
      },
      function(cb) {
        // query 4 likes and send them to the socket for this socket id
        req.facebook.get('/me/likes', { limit: 4 }, function(likes) {
          req.likes = likes;
          cb();
        });
      },
      function(cb) {
        // use fql to get a list of my friends that are using this app
        req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function(result) {
          req.friends_using_app = result;
          cb();
        });
      }
    ], function() {
      render_page(req, res);
    });

  } else {
    render_page(req, res);
  }
}

app.get('/', handle_facebook_request);
app.post('/', handle_facebook_request);
