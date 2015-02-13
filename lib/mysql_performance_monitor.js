/*
 This script was developed by Guberni and is part of Tellki's Monitoring Solution

 February, 2015
 
 Version 1.0

 DEPENDENCIES:
		mysql v2.5.4 (https://www.npmjs.com/package/mysql)
 
 DESCRIPTION: Monitor MySQL Avalability utilization

 SYNTAX: node mysql_availability_monitor.js <HOST> <METRIC_STATE> <PORT> <USER_NAME> <PASS_WORD>
 
 EXAMPLE: node mysql_availability_monitor.js "10.10.2.5" "1,1" "3306" "user" "pass"

 README:
		<HOST> MySQL ip address or hostname.
 
		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
		1 - metric is on ; 0 - metric is off
		
		<PORT> MySQL port
		
		<USER_NAME> MySQL user to connect
		
		<PASS_WORD> MySQL user password
*/

var fs = require('fs');

var tempDir = "/tmp";


/*
* METRICS IDS
* List with all metrics to be retrieved.
*
* Attribute "id" represents the metric id
* Attribute "ratio" indicates if the metric value is absolute or a ratio (must be calculated)
*/
var metrics =[];

metrics["Com_delete"] =  {id:"43:Delete statements/Sec:4",ratio:true};
metrics["Com_insert"] =  {id:"192:Insert statements/Sec:4",ratio:true};
metrics["Com_select"] =  {id:"41:Select statements/Sec:4",ratio:true};
metrics["Com_update"] =  {id:"162:Update statements/Sec:4",ratio:true};
metrics["Connections"] =  {id:"93:Connections/Sec:4",ratio:true};	
metrics["Created_tmp_disk_tables"] = {id:"193:Temporary tables on disk/Sec:4",ratio:true};
metrics["Handler_read_first"] = {id:"210:Handler read first/Sec:4",ratio:true};
metrics["Innodb_buffer_pool_read_requests"] =  {id:"100:Buffer pool read requests/Sec (Innodb):4",ratio:true};
metrics["Innodb_buffer_pool_wait_free"] =  {id:"185:Buffer pool wait free (Innodb):4",ratio:false};
metrics["Innodb_data_pending_reads"] =  {id:"131:Data reads pending (Innodb):4",ratio:false};
metrics["Innodb_rows_read"] =  {id:"21:Innodb rows read/Sec:4",ratio:true};
metrics["Key_reads"] =  {id:"144:Key reads/Sec:4",ratio:true};
metrics["Max_used_connections"] =  {id:"212:Max used connections:4",ratio:false};
metrics["Open_tables"] =  {id:"62:Open tables:4",ratio:false};
metrics["Qcache_hits"] =  {id:"190:Qcache hits/Sec:4",ratio:true};
metrics["Qcache_queries_in_cache"] = {id:"88:Queries in cache:4",ratio:false};
metrics["Questions"] = {id:"176:Questions/Sec:4",ratio:true};
metrics["Select_full_join"] = {id:"49:Full joins/Sec:4",ratio:true};
metrics["Slow_queries"] = {id:"145:Slow queries/Sec:4",ratio:true};
metrics["Table_locks_waited"] = {id:"172:Table locks waited/Sec:4",ratio:true};
metrics["Threads_connected"] = {id:"3:Threads connected:4",ratio:false};
metrics["Threads_running"] =  {id:"170:Threads running:4",ratio:false};
metrics["Uptime"] = {id:"80:Uptime:4",ratio:false}; 

metricsLength = 23;

var metricQuery = "SHOW /*!50002 GLOBAL */ STATUS";



// ############# INPUT ###################################
//START
(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof DatabaseConnectionError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	if(args.length === 5)
	{
		monitorInputProcess(args);
	}
	else
	{
		throw new InvalidParametersNumberError()
	}
}

/*
* Process the passed arguments and send them to monitor execution (monitorDatabasePerformance)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<HOST> 
	var hostname = args[0];
	
	//<METRIC_STATE> 
	var metricState = args[1].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(metricsLength);

	for(var i in tokens)
	{
		metricsExecution[i] = (tokens[i] === "1")
	}

	
	//<PORT> 
	var port = args[2];
	
	
	// <USER_NAME> 
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// <PASS_WORD>
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	
	//create request object to be executed
	var requests = []
	
	var request = new Object()
	request.hostname = hostname;
	request.metricsExecution = metricsExecution;
	request.port = port;
	request.username = username;
	request.passwd = passwd;
	
	requests.push(request);
	
	//call monitor
	monitorDatabasePerformance(requests);
	
}



// ################# DATABASE PERFORMANCE ###########################
/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorDatabasePerformance(requests) 
{
	var mysql = require('mysql');
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();
		
		//Create connection
		var connection = mysql.createConnection({
		  host : request.hostname,
		  port : request.port,
		  user : request.username,
		  password : request.passwd
		});
		
		//try connect
		connection.connect(function(err) 
		{
			if (err && err.code === 'ER_ACCESS_DENIED_ERROR') 
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else if(err)
			{
				var e = new DatabaseConnectionError();
				e.message = err.message;
				
				errorHandler(e);
			}
			
			//get data
			connection.query(metricQuery, function(err, results) {
				
				if(err)
				{
					var e = new DatabaseConnectionError();
					e.message = err.message;
				
					errorHandler(e);
				}
				
				var metricsName = Object.keys(metrics);
				
				var jsonString = "[";
				
				var dateTime = new Date().toISOString();
				
				var found = false;
				
				for(var i in metricsName)
				{
					found = false;
					
					if(request.metricsExecution[i])
					{	
						for(var j in results)
						{
							if(metricsName[i] === results[j].Variable_name)
							{
								found = true;
							
								jsonString += "{";
								
								jsonString += "\"variableName\":\""+results[j].Variable_name+"\",";
								jsonString += "\"metricUUID\":\""+metrics[metricsName[i]].id+"\",";
								jsonString += "\"timestamp\":\""+ dateTime +"\",";
								jsonString += "\"value\":\""+ results[j].Value +"\"";
								
								jsonString += "},";
								
								break;
							}
						}
						
						
						if(!found)
						{
							var newError = new MetricNotFoundError();
							newError.message = "Unable to collect metric " + metrics[metricsName[i]].id;
							errorHandler(error);
						}
					}
				}
				
				if(jsonString.length > 1)
					jsonString = jsonString.slice(0, jsonString.length-1);
				
				jsonString += "]";
				
				//send to process ratio values and save result in file
				processDeltas(request, jsonString);
			
				connection.end();
			
			});			
		});
	}
}


//################### OUTPUT METRICS ###########################
/*
* Send metrics to console
* Receive: metrics list to output
*/
function output(toOutput)
{
	for(var i in toOutput)
	{
		var out = "";
		
		out += toOutput[i].id + "|";
		out += toOutput[i].value;
		out += "|";
		
		console.log(out);
	}
}

//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof DatabaseConnectionError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof CreateTmpDirError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof WriteOnTmpFileError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof MetricNotFoundError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
	
}



// ##################### UTILS #####################
/*
* Process performance results
* Receive: 
* - request object containing configuration
* - retrived results
*/
function processDeltas(request, results)
{
	var file = getFile(request.hostname, request.port);
	
	var toOutput = [];
	
	if(file)
	{		
		var previousData = JSON.parse(file);
		var newData = JSON.parse(results);
			
		for(var i = 0; i < newData.length; i++)
		{
			var endMetric = newData[i];
			var initMetric = null;
			
			for(var j = 0; j < previousData.length; j++)
			{
				if(previousData[j].metricUUID === newData[i].metricUUID)
				{
					initMetric = previousData[j];
					break;
				}
			}
			
			if (initMetric != null)
			{
				var deltaValue = getDelta(initMetric, endMetric);
				
				var rateMetric = new Object();
				rateMetric.id = endMetric.metricUUID;
				rateMetric.timestamp = endMetric.timestamp;
				rateMetric.value = deltaValue;
				
				toOutput.push(rateMetric);
			}
			else
			{	
				var rateMetric = new Object();
				rateMetric.id = endMetric.metricUUID;
				rateMetric.timestamp = endMetric.timestamp;
				rateMetric.value = 0;
				
				toOutput.push(rateMetric);
			}
		}
		
		setFile(request.hostname, request.port, results);

		for (var m = 0; m < toOutput.length; m++)
		{
			for (var z = 0; z < newData.length; z++)
			{
				var systemMetric = metrics[newData[z].variableName];
				
				if (systemMetric.ratio === false && newData[z].metricUUID === toOutput[m].id)
				{
					toOutput[m].value = newData[z].value;
					break;
				}
			}
		}

		output(toOutput)
		
	}
	else
	{
		setFile(request.hostname, request.port, results);
		process.exit(0);
	}
}


/*
* Calculate ratio metric's value
* Receive: 
* - previous value
* - current value
* - 
*/
function getDelta(initMetric, endMetric)
{
	var deltaValue = 0;

	var decimalPlaces = 2;

	var date = new Date().toISOString();
	
	if (parseFloat(endMetric.value) < parseFloat(initMetric.value))
	{	
		deltaValue = parseFloat(endMetric.value).toFixed(decimalPlaces);
	}
	else
	{	
		var elapsedTime = (new Date(endMetric.timestamp).getTime() - new Date(initMetric.timestamp).getTime()) / 1000;	
		deltaValue = ((parseFloat(endMetric.value) - parseFloat(initMetric.value))/elapsedTime).toFixed(decimalPlaces);
	}
	
	return deltaValue;
}



/*
* Get last results if any saved
* Receive: 
* - mysql hostname or ip address
* - mysql port
*/
function getFile(hostname, port)
{
		var dirPath =  __dirname +  tempDir + "/";
		var filePath = dirPath + ".mysql_"+ hostname +"_"+ port +".dat";
		
		try
		{
			fs.readdirSync(dirPath);
			
			var file = fs.readFileSync(filePath, 'utf8');
			
			if (file.toString('utf8').trim())
			{
				return file.toString('utf8').trim();
			}
			else
			{
				return null;
			}
		}
		catch(e)
		{
			return null;
		}
}



/*
* Save current metrics values to be used to calculate ratios on next runs
* Receive: 
* - mysql hostname or ip address
* - mysql port
* - retrieved result
*/
function setFile(hostname, port, json)
{
	var dirPath =  __dirname +  tempDir + "/";
	var filePath = dirPath + ".mysql_"+ hostname +"_"+ port +".dat";
		
	if (!fs.existsSync(dirPath)) 
	{
		try
		{
			fs.mkdirSync( __dirname+tempDir);
		}
		catch(e)
		{
			var ex = new CreateTmpDirError(e.message);
			ex.message = e.message;
			errorHandler(ex);
		}
	}

	try
	{
		fs.writeFileSync(filePath, json);
	}
	catch(err)
	{
		var ex = new WriteOnTmpFileError(e.message);
		ex.message = err.message;
		errorHandler(ex);
	}
}



//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;


function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = "Invalid authentication.";
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;

function DatabaseConnectionError() {
	this.name = "DatabaseConnectionError";
    this.message = "";
	this.code = 11;
}
DatabaseConnectionError.prototype = Object.create(Error.prototype);
DatabaseConnectionError.prototype.constructor = DatabaseConnectionError;

function CreateTmpDirError()
{
	this.name = "CreateTmpDirError";
    this.message = "";
	this.code = 21;
}
CreateTmpDirError.prototype = Object.create(Error.prototype);
CreateTmpDirError.prototype.constructor = CreateTmpDirError;


function WriteOnTmpFileError()
{
	this.name = "WriteOnTmpFileError";
    this.message = "";
	this.code = 22;
}
WriteOnTmpFileError.prototype = Object.create(Error.prototype);
WriteOnTmpFileError.prototype.constructor = WriteOnTmpFileError;


function MetricNotFoundError() {
    this.name = "MetricNotFoundError";
    this.message = "";
	this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;
