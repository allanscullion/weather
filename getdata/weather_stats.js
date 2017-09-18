var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
var mysql = require('mysql');

var root_url = "http://www.wunderground.com/weather/"


///
/// Save Weather data to MySQL
///
function save_weatherdata(d) {

	console.log(d);

	var connection = mysql.createConnection({
		host     : 'localhost',
		user     : 'node',
		password : 'node'
	});

	connection.connect(function(err) {
		if (err) {
			throw err;
		}
	});

	connection.query("use weather");

	var query = connection.query('INSERT INTO weather_data SET ?', d, function(err, result) {
		if (err) {
	  		throw err;
	  	}
	});
	
	connection.end();
}


///
/// Get Weather Data
///
function get_weatherdata(station, callback) {
	var u = root_url + station.url;
	console.log("Scraping: " + u);

	request(u, function(err, resp, body) {
	    if (err)
	        throw err;

	    $ = cheerio.load(body);

	    var stationname = $("#station-label").find("a").text().trim();
	    var current_cond = $("#curCond").children(".wx-value").text().trim();
	    var t = $("#curTemp").children(".wx-data").find(".wx-value").text();
	    var tempfeel = $("#curFeel").find(".wx-value").text();
	    var windspeed = $("#windCompassSpeed").find(".wx-value").text();

        var maingrid = $("#current .show-for-large-up");
        var hum = maingrid.find('span[data-variable="humidity"]').find(".wx-value").text();
        var rain = maingrid.find('span[data-variable="precip_today"]').find(".wx-value").text();


	    if (stationname.length > 0) {
	    	var dt = new moment();

		    var d = {
		    	locationid: station.id,
		    	snaptime: dt.format("YYYY-MM-DD HH:mm:ss"),
		    	station_name: stationname,
		    	current_conditions: current_cond,
		    	temp: t,
		    	temp_feelslike: tempfeel,
		    	wind_speed: windspeed,
		    	humidity: hum,
		    	rainfall: rain
		    }

		    save_weatherdata(d);

		} 
		else {
			console.log("Station name not found in " + u);
		}
	});
}

//
// Array of weather station targets
//
stations = 
[
	{
		location: "Milton Keynes",
		//url: "zmw:00000.12.03557?MR=1",
		url: "gb/shenley-church-end/ISHENLEY7",
		id: 2
	},
	{
		location: "Greenock",
		//url: "zmw:00000.10.03138?MR=1",
		url: "gb/greenock/IIVCGREE2",
		id: 1
	}
];

//
// Loop over the Weather Station targets, downloading and saving each datapoint
//
for (var i = 0, l = stations.length; i < l; i++) {
	var s = stations[i];

	get_weatherdata(s, function(s) { return function() { }}(s));
}
