
var async = require('async');
var express = require('express');
var http = require('http');
var jsdom = require('jsdom');
var request = require('request');


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
express.session({
    secret: process.env.SESSION_SECRET || 'secret123'
}),
require('faceplate').middleware({
    app_id: process.env.FACEBOOK_APP_ID,
    secret: process.env.FACEBOOK_SECRET,
    scope: 'user_likes,user_photos,user_photo_video_tags'
}));

// Connect app to Volunteer Match 
// Stores account information for Volunteer Match
var volunteerMatch = {
    accountName: process.env.VOLUNTEER_MATCH_ACCOUNT,
    accountKey: process.env.VOLUNTEER_MATCH_KEY
};

var name = volunteerMatch.accountName;
var key = volunteerMatch.accountKey;
var path = '/api/call';

// Send request to ask information
function SendRequest(action, query, usrres) {
    if (query.length != 0) {
        var url = path + '?action=' + action + '&key=' + key + '&query=' + JSON.stringify(query);
    } else {
        var url = path + '?action=' + action + '&key=' + key;
    }
    console.log('url:, ' + url);
    var get_options = {
        host: 'www.volunteermatch.org',
        path: url,
    };


    var get_req = http.get(get_options, function (res) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        var total = '';
        res.on('data', function (chunk) {
            total += chunk;
        });

        res.on('end', function () {
            var formatted_data = JSON.parse(total);
            var count = 0;
            formatted_data.opportunities.forEach(function (opportunity) {
                get_address(decodeURIComponent(opportunity.vmUrl), function (address) {
                    opportunity.address = address;
                    count++;
                    if (count >= formatted_data.opportunities.length) {
                        console.log(formatted_data);
                        usrres.end(JSON.stringify(formatted_data));
                    }

                });
            });
        });
    });

    // for debugging
    get_req.on('error', function (e) {
        console.log("Got error: " + e.message);
    });
    console.log('host :' + get_options.host);
    return -1;
}

// input the location string
function searchOrganizations(loc, res) {
    fd = ["name", "location", "title", "beneficiary", "vmUrl", "imageUrl"];
    conds = {
        location: loc,
        nbOfResults: 20,
        pageNumber: 3,
        fieldsToDisplay: fd
    };
    data = SendRequest('searchOrganizations', conds, res);
}

function searchOpportunities(loc, res) {
    fd = ["name", "location", "title", "beneficiary", "vmUrl", "imageUrl"];
    conds = {
        location: loc,
        nbOfResults: 20,
        pageNumber: 3,
        fieldsToDisplay: fd
    };
    data = SendRequest('searchOpportunities', conds, res);
}

// Create database instance
if (process.env.VCAP_SERVICES) {
    var env = JSON.parse(process.env.VCAP_SERVICES);
    var mongo = env['mongodb-1.8'][0]['credentials'];
} else {
    var mongo = {
        "hostname": "localhost",
        "port": 27017,
        "username": "",
        "password": "",
        "name": "",
        "db": "db"
    }
}

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

db.users.ensureIndex({
    "fb_uid": 1
}, {
    unique: true
}, function (err, log) {
    console.log(err);
    console.log(log);
});

db.users.ensureIndex({
    "links": 1
}, function (err, log) {
    console.log('Error: ' + err);
    console.log('log: ' + log);
});

// listen to the PORT given to us in the environment
var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var http = require('http');

app.listen(port, function () {
    console.log("Listening on " + port);
});

app.dynamicHelpers({
    'host': function (req, res) {
        return req.headers['host'];
    },
    'scheme': function (req, res) {
        return req.headers['x-forwarded-proto'] || 'http';
    },
    'url': function (req, res) {
        return function (path) {
            return app.dynamicViewHelpers.scheme(req, res) + app.dynamicViewHelpers.url_no_scheme(req, res)(path);
        }
    },
    'url_no_scheme': function (req, res) {
        return function (path) {
            return '://' + app.dynamicViewHelpers.host(req, res) + (path || '');
        }
    },
});

function render_page(req, res) {
    req.facebook.app(function (app) {
        req.facebook.me(function (user) {
            res.render('index.ejs', {
                layout: false,
                req: req,
                app: app,
                user: user
            });
        });
    });
}


function addUser(id) {
    console.log('ID  = ' + id);
    //Searching if you exist..
    db.users.find({
        'fb_uid': id
    }, function (err, result) {
        if (err) {
            //Somethings broken
            console.log('error: ' + err);
        } else if (result.length == 0) {
            //Couldn't find ...hmmm must add you
            console.log('Record not found' + result);
            db.users.save({
                'fb_uid': id
            }, function (err, log) {
                var body = 'You are new, but dont worry everybody here was once new but now its their home coz you never leave ...Hotel California';
                console.log(body);
	    });
        }
    });
}

function favoriteEvent(id, event){
     db.users.update({'fb_uid': id}, {$addToSet:{"favorites": event}}, function(err, log){
        if(err)
            console.log(log);
        else
	   console.log('User: ' + id + ' favorited event: ' + event);
     });
}

function unfavoriteEvent(id, event){
    db.users.update({'fb_uid': id}, {$pull:{"favorites": event}}, function(err, log){
        if(err)
            console.log(log);
        else
	   console.log('User: ' + id + ' unfavorited event: ' + event);
     });
}


var debug_event = {
    location: 'vmware',
    title: 'ContributingCode',
    parentOrg: 'EMC',
    vmURL: 'contributingcode.cloudfoundry.com'
};



function handle_facebook_request(req, res) {

    // if the user is logged in
    if (req.facebook.token) {
        req.facebook.get('/me', function (me) {
            console.log(me.id);
        });
        async.parallel([

        function (cb) {
            // query 4 friends and send them to the socket for this socket id
            req.facebook.get('/me/friends', {
                limit: 4
            }, function (friends) {
                req.friends = friends;
                cb();
            });
        },

        function (cb) {
            // query 16 photos and send them to the socket for this socket id
            req.facebook.get('/me/photos', {
                limit: 16
            }, function (photos) {
                req.photos = photos;
                cb();
            });
        },

        function (cb) {
            // query 4 likes and send them to the socket for this socket id
            req.facebook.get('/me/likes', {
                limit: 4
            }, function (likes) {
                req.likes = likes;
                cb();
            });
        },

        function (cb) {
            // use fql to get a list of my friends that are using this app
            req.facebook.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function (result) {
                req.friends_using_app = result;
                cb();
            });
        },

        function (cb) {
            req.facebook.get('/me', function (me) {
		addUser(me.id);
		unfavoriteEvent(me.id, debug_event);
                db.users.find({
                    'fb_uid': me.id
                }, function (err, result) {
                    if (err || result.length == 0) {
                        req.user_events = [];
                    } else {
                        console.log(result[0].events);
                        req.user_events = result[0].events;
                    }
                    cb();
                });
            });
        }, ], function () {
            render_page(req, res);
        });

    } else {
        render_page(req, res);
    }
}

// /searchOpportunities?loc
app.get('/:fun/:loc', function (req, res) {
    var loc = req.route.params.loc;
    switch (req.route.params.fun) {
    case 'searchOpportunities':
        searchOpportunities(loc, res);
        break;
    case 'searchOrganizations':
        searchOrganizations(loc, res);
        break;
    default:
        searchOrganizations(loc, res);
    }
});




function get_address(url, callback) {
    request({
        uri: url
    }, function (err, response, body) {
        // Checks if page was found
        if (err && response.statusCode !== 200) {
            console.log('Request error.');
        }
        //Send the body param as the HTML code we will parse in jsdom
        //also tell jsdom to attach jQuery in the scripts
        jsdom.env({
            html: body,
            scripts: ['http://code.jquery.com/jquery-1.6.min.js']
        }, function (err, window) {
            //Use jQuery just as in any regular HTML page
            var $ = window.jQuery,
                $body = $('body'),
                $videos = $body.find('.section.details');

            //I will use regular jQuery selectors
            var s = $($videos[0]).find('address.adr').text();
            s = s.replace(/(^\s*)|(\s*$)/gi, "");
            s = s.replace(/[ ]{2,}/gi, " ");
            s = s.replace(/\n /, "\n");
            var address = s;
            //console.log(address);
            callback(address);
        });
    });
}




app.get('/', handle_facebook_request);
app.post('/', handle_facebook_request);

