exports.dateFormat = function() {
	const date = new Date();
	var year = ('' + date.getFullYear()).substring(2, 4);
	var month = date.getMonth() + 1;
	var day = date.getDate();

	if(month < 10) month = '0' + month;
	if(day < 10) day = '0' + day;

	const fullDate = [year, month, day].join('');

	return fullDate;
}

exports.timeFormat = function () {
	const date = new Date();
	var hour = date.getHours();
	var minute = date.getMinutes();
	var second = date.getSeconds();

	if(hour < 10) hour = '0' + hour;
	if(minute < 10) minute = '0' + minute;
	if(second < 10) second = '0' + second;

	const fullTime = [hour, minute, second].join('');

	return fullTime;
}

