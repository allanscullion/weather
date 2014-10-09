//
// Location Iterator funtion 
//
var location_iterator = function(loc, callback) {

	pool.getConnection(function(err, connection) {

		var sql = 'select name from locations where id = ?';

		connection.query(sql, loc.id, function(error, rows, fields) {
			if (error == null) {
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