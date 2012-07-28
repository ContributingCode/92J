var async   = require('async');
var express = require('express');
var util    = require('util');
var http = require('http');  
var querystring = require('querystring');


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
function SendRequest(action, query) {
	 if (query.length !=  0) {
	 	 var url = path + '?action=' + action + '&key=' + key
		  + '&query=' + JSON.stringify(query);
	} else {
	 	 var url = path + '?action=' + action + '&key=' + key;
	}		  
	console.log('url:, ' + url);
	var get_options = {
      	     host: 'www.volunteermatch.org',
      	     path: url,
  	 };	     


       var get_req = http.get(get_options, function(res) {
       console.log('STATUS: ' + res.statusCode);	      
       console.log('HEADERS: ' + JSON.stringify(res.headers));      
       res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
	  return chunk;
      	});
      });
     
     // for debugging
      get_req.on('error', function(e) {
      	      console.log("Got error: " + e.message);
	});
      console.log('host :' + get_options.host); 
      return -1;
}

// input the location string
function searchOrganizations(loc) {
	 fd = ["name", "location", "title", "parentOrg", "vmUrl", "imageUrl"];
	 conds = { location : loc,  nbOfResults : 20, pageNumber : 3, fieldsToDisplay : fd };
	 return data = SendRequest('searchOrganizations', conds);
}

function searchOpportunities(loc) {
	 fd = ["name", "location", "title", "parentOrg", "vmUrl", "imageUrl"];
	 conds = { location : loc,  nbOfResults : 20, pageNumber : 3, fieldsToDisplay : fd };
	 return data = SendRequest('searchOpportunities', conds);
}


// Test

// query = { name : "VolunteerMatch"};
// SendRequest('helloWorld', query);
// query = {};
// SendRequest('getKeyStatus', query);
// searchOrganizations("Springfield");
//searchOrganizations("San Francisco");
var loc = { city : 'Chicago', region : 'IL', country : 'US' };
searchOpportunities(loc);
