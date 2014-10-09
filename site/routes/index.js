var express = require('express');
var mysql = require('mysql');
var async = require('async');
var maths = require('./maths');

var router = express.Router();

var pool = mysql.createPool({
    host : 'localhost',
    user : 'node',
    password : 'node',
    database : 'weather'
});

//
// GET: Home Page
//
router.get('/', function(req, res) {
	res.render('index', { title: 'Weather Data' });
});

//
// GET: Teperature Range Data for a given ID
//
router.get('/range/:id1', function(req, res) {
	res.render('range', { title: 'Temperature Range', loc_id: req.params.id1 });
});

//
// GET: Compare average temperature of two locations
//
router.get('/compare_avg/:id1/:id2', function(req, res) {
	res.render('compare_avg', { title: 'Compare Averages', 
			loc_id1: req.params.id1, loc_id2: req.params.id2 });
});

/* GET compare page. */
router.get('/compare_highs/:id1/:id2', function(req, res) {
	res.render('compare_highs', { title: 'Compare Highs', 
			loc_id1: req.params.id1, loc_id2: req.params.id2 });
});

/* GET compare page. */
router.get('/compare_range/:id1/:id2', function(req, res) {
	res.render('compare_range', { title: 'Compare Ranges', 
			loc_id1: req.params.id1, loc_id2: req.params.id2 });
});

/* GET compare page. */
router.get('/differences/:id1/:id2', function(req, res) {
	res.render('differences', { title: 'Compare Temperature Differences', 
			loc_id1: req.params.id1, loc_id2: req.params.id2 });
});

//
// Location Iterator function 
//
var location_iterator = function(loc, callback) {

	pool.getConnection(function(err, connection) {

		var sql = 'select name, id from locations where shortcode = ?';
		//console.log(sql);

		connection.query(sql, loc.shortcode, function(error, rows, fields) {
			if (error == null) {
				loc.id = rows[0].id;
				loc.name = rows[0].name;
			}
			else {
				console.log(error);
			}
			callback(error);
		});
		connection.release();
	});
}

function getLocationDetails(locations, callback) {
	async.each(locations, location_iterator, function(err) {
		callback();
	});
}


//
// JSON AJAX functions
//

/* Get range series for a location */
router.get('/series/range/:shortcode', function(req, res) {

	var locations = [ { shortcode: req.params.shortcode, id: 0, name: 'Unknown' } ];
	async.series([
		//
		// Before we do anything, translate the location names
		//
		function(callback) {
			getLocationDetails(locations, function(){
				callback();
			});
		},
		function(callback) {
			pool.getConnection(function(err, connection) {
				var sql = 'select date(snaptime) as temp_date, \
							round(avg(temp), 2) as avg_temp, \
							round(max(temp), 2) as max_temp, \
							round(min(temp), 2) as min_temp from vw_weather_data \
							where locationid = ? \
							group by temp_date;';

				//console.log(sql);
				connection.query(sql, [locations[0].id], function(error, rows, fields) {
					res.writeHead(200, {'Content-Type': 'text/plain'});

					var series = {
						range_data: { name: locations[0].name + ' Temp Range', data: [] },
						avg_data: { name: locations[0].name + ' Daily Average', data: [] },
						maavg_data: { name: locations[0].name + ' MA5 Daily Average', data: [] }
					}

					var sma5 = maths.simple_moving_averager(5);
					for (index = 0; index < rows.length; index++) {
						var row = rows[index];
						var dtvalue = new Date(row.temp_date).valueOf();
						series.range_data.data.push([ dtvalue, row.max_temp, row.min_temp ]);
						series.avg_data.data.push([ dtvalue, row.avg_temp ]);
						series.maavg_data.data.push([ dtvalue, sma5(row.avg_temp) ]);
					}
		    		res.end(JSON.stringify(series));
		    		callback();
				});
				connection.release();
			});
		}
	]);

});



/* Get the average temp of 2 locations for comparison */
router.get('/series/compare_avg/:shortcode1/:shortcode2', function(req, res) {

	var locations = [ { shortcode: req.params.shortcode1, id: 0, name: 'Unknown' }, { shortcode: req.params.shortcode2, id: 0, name: 'Unknown' } ];

	async.series([
		//
		// Before we do anything, translate the location names
		//
		function(callback) {
			getLocationDetails(locations, function(){
				callback();
			});
		},
		function(callback) {

			pool.getConnection(function(err, connection) {


				var sql = 'select date(snaptime) as temp_date, locationid, \
							round(avg(temp), 2) as avg_temp \
							from vw_weather_data \
							where locationid in (?, ?) \
							group by temp_date, locationid;';

				//console.log(locations);

				connection.query(sql, [locations[0].id, locations[1].id], function(error, rows, fields) {
					res.writeHead(200, {'Content-Type': 'text/plain'});
					var series = {
						series1: { name: locations[0].name, data: [] }, 
						series1ma: { name: locations[0].name + ' MA5', data: [] }, 
						series2: { name: locations[1].name, data: [] }, 
						series2ma: { name: locations[1].name + ' MA5', data: [] }
					};
					var sma5_1 = maths.simple_moving_averager(5);
					var sma5_2 = maths.simple_moving_averager(5);

					for (index = 0; index < rows.length; index++) {
						var row = rows[index];
						var dtvalue = new Date(row.temp_date).valueOf();
						var t = [ dtvalue, row.avg_temp ];
						if (row.locationid == locations[0].id) { 
							series.series1.data.push(t)
							series.series1ma.data.push([ dtvalue, sma5_1(row.avg_temp) ]);
						}
						else {
							series.series2.data.push(t)
							series.series2ma.data.push([ dtvalue, sma5_2(row.avg_temp) ]);
						}
					}
		    		res.end(JSON.stringify(series));
		    		callback();
				});
				connection.release();
			});
		}
	]);
	
});

router.get('/series/compare_range/:shortcode1/:shortcode2', function(req, res) {

	var locations = [ { shortcode: req.params.shortcode1, id: 0, name: 'Unknown' }, { shortcode: req.params.shortcode2, id: 0, name: 'Unknown' } ];
	async.series([
		//
		// Before we do anything, translate the location names
		//
		function(callback) {
			getLocationDetails(locations, function(){
				callback();
			});
		},
		function(callback) {
			pool.getConnection(function(err, connection) {
				var sql = 'select date(snaptime) as temp_date, \
							locationid, \
							round(max(temp), 2) as max_temp, \
							round(min(temp), 2) as min_temp \
							from vw_weather_data \
							where locationid in (?, ?) \
							group by temp_date, locationid;';

				//console.log(sql);
				connection.query(sql, [locations[0].id, locations[1].id], function(error, rows, fields) {
					res.writeHead(200, {'Content-Type': 'text/plain'});

					var series = {
						range_data1: { name: locations[0].name + ' Temp Range', data: [] },
						range_data2: { name: locations[1].name + ' Temp Range', data: [] },
					}

					for (index = 0; index < rows.length; index++) {
						var row = rows[index];
						var dtvalue = new Date(row.temp_date).valueOf();
						if (row.locationid == locations[0].id) { 
							series.range_data1.data.push([ dtvalue, row.max_temp, row.min_temp ]);
						}
						else {							
							series.range_data2.data.push([ dtvalue, row.max_temp, row.min_temp ]);
						}
					}
		    		res.end(JSON.stringify(series));
		    		callback();
				});
				connection.release();
			});
		}
	]);

});

router.get('/series/compare_highs/:shortcode1/:shortcode2', function(req, res) {

	var locations = [ { shortcode: req.params.shortcode1, id: 0, name: 'Unknown' }, { shortcode: req.params.shortcode2, id: 0, name: 'Unknown' } ];
	async.series([
		//
		// Before we do anything, translate the location names
		//
		function(callback) {
			getLocationDetails(locations, function(){
				callback();
			});
		},
		function(callback) {
			pool.getConnection(function(err, connection) {
				var sql = 'select date(snaptime) as temp_date, \
							locationid, \
							round(max(temp), 2) as max_temp \
							from vw_weather_data \
							where locationid in (?, ?) \
							group by temp_date, locationid;';

				//console.log(sql);
				connection.query(sql, [locations[0].id, locations[1].id], function(error, rows, fields) {
					res.writeHead(200, {'Content-Type': 'text/plain'});

					var series = {
						data1: { name: locations[0].name + ' Highs', data: [] },
						data2: { name: locations[1].name + ' Highs', data: [] },
					}

					for (index = 0; index < rows.length; index++) {
						var row = rows[index];
						var dtvalue = new Date(row.temp_date).valueOf();
						if (row.locationid == locations[0].id) { 
							series.data1.data.push([ dtvalue, row.max_temp ]);
						}
						else {							
							series.data2.data.push([ dtvalue, row.max_temp ]);
						}
					}
		    		res.end(JSON.stringify(series));
		    		callback();
				});
				connection.release();
			});
		}
	]);

});

router.get('/series/differences/:shortcode1/:shortcode2', function(req, res) {

	var locations = [ { shortcode: req.params.shortcode1, id: 0, name: 'Unknown' }, { shortcode: req.params.shortcode2, id: 0, name: 'Unknown' } ];
	async.series([
		//
		// Before we do anything, translate the location names
		//
		function(callback) {
			getLocationDetails(locations, function(){
				callback();
			});
		},
		function(callback) {
			pool.getConnection(function(err, connection) {
				var sql = 'select	v1.temp_date, \
									(v1.avg_temp - v2.avg_temp) as avg_diff, \
									(v1.max_temp - v2.max_temp) as high_diff, \
									(v1.min_temp - v2.min_temp) as low_diff	 \
							from vw_daily_summary v1 join vw_daily_summary v2 on v1.temp_date = v2.temp_date \
							where v1.locationid = ? and v2.locationid = ?;';

				//console.log(sql);
				connection.query(sql, [locations[0].id, locations[1].id], function(error, rows, fields) {
					res.writeHead(200, {'Content-Type': 'text/plain'});

					var series = {
						title: 'Temperature Differences: ' + locations[0].name + ' vs ' + locations[1].name,
						data_avg: { name: 'Avg Diff', data: [] },
						data_high: { name: 'High Diff', data: [] },
						data_low: { name: 'Low Diff', data: [] },
						data_avgma5: { name: 'Avg MA5', data: [] }
					}
					var sma5 = maths.simple_moving_averager(5);

					for (index = 0; index < rows.length; index++) {
						var row = rows[index];
						var dtvalue = new Date(row.temp_date).valueOf();
						series.data_avg.data.push([ dtvalue, row.avg_diff ]);
						series.data_high.data.push([ dtvalue, row.high_diff ]);
						series.data_low.data.push([ dtvalue, row.low_diff ]);
						series.data_avgma5.data.push([ dtvalue, sma5(row.avg_diff) ]);
					}
		    		res.end(JSON.stringify(series));
		    		callback();
				});
				connection.release();
			});
		}
	]);

});


module.exports = router;
