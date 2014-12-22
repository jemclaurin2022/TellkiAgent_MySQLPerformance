//node mysql_performance_monitor 192.168.69.3 1446 "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1" 3306 "xpto" "xpto"

	
//var metricsId = ["43:4", "192:4", "41:4", "162:4", "93:4", "193:4", "210:4", "100:4", "185:4", "131:4", "21:4", "144:4", "212:4", "62:4", "190:4", "88:4", "176:4", "49:4", "145:4", "172:4", "3:4", "170:4", "80:4"]

var fs = require('fs');

var tempDir = "/tmp";

var metricsId =[];

metricsId["Com_delete"] =  {id:"43:4",ratio:true};
metricsId["Com_insert"] =  {id:"192:4",ratio:true};
metricsId["Com_select"] =  {id:"41:4",ratio:true};
metricsId["Com_update"] =  {id:"162:4",ratio:true};
metricsId["Connections"] =  {id:"93:4",ratio:true};	
metricsId["Created_tmp_disk_tables"] = {id:"193:4",ratio:true};
metricsId["Handler_read_first"] = {id:"210:4",ratio:true};
metricsId["Innodb_buffer_pool_read_requests"] =  {id:"100:4",ratio:true};
metricsId["Innodb_buffer_pool_wait_free"] =  {id:"185:4",ratio:false};
metricsId["Innodb_data_pending_reads"] =  {id:"131:4",ratio:false};
metricsId["Innodb_rows_read"] =  {id:"21:4",ratio:true};
metricsId["Key_reads"] =  {id:"144:4",ratio:true};
metricsId["Max_used_connections"] =  {id:"212:4",ratio:false};
metricsId["Open_tables"] =  {id:"62:4",ratio:false};
metricsId["Qcache_hits"] =  {id:"190:4",ratio:true};
metricsId["Qcache_queries_in_cache"] = {id:"88:4",ratio:false};
metricsId["Questions"] = {id:"176:4",ratio:true};
metricsId["Select_full_join"] = {id:"49:4",ratio:true};
metricsId["Slow_queries"] = {id:"145:4",ratio:true};
metricsId["Table_locks_waited"] = {id:"172:4",ratio:true};
metricsId["Threads_connected"] = {id:"3:4",ratio:false};
metricsId["Threads_running"] =  {id:"170:4",ratio:false};
metricsId["Uptime"] = {id:"80:4",ratio:false}; 

metricsLength = 23;

var metricQuery = "SHOW /*!50002 GLOBAL */ STATUS";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid number of metrics.");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = ("Invalid authentication.");
}
InvalidAuthenticationError.prototype = Error.prototype;

// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	if(args.length === 6)
	{
		monitorInputProcess(args);
	}
	else
	{
		throw new InvalidParametersNumberError()
	}
}


function monitorInputProcess(args)
{
	//host
	var hostname = args[0];
	
	//target
	var targetUUID = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(metricsLength);

	if (tokens.length === metricsLength)
	{
		for(var i in tokens)
		{
			metricsExecution[i] = (tokens[i] === "1")
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	//port
	var port = args[3];
	
	
	// Username
	var username = args[4];
	username = username.length === 0 ? "" : username;
	
	// Password
	var passwd = args[5];
	passwd = passwd.length === 0 ? "" : passwd;
	
	var requests = []
	
	var request = new Object()
	request.hostname = hostname;
	request.targetUUID = targetUUID;
	request.metricsExecution = metricsExecution;
	request.port = port;
	request.username = username;
	request.passwd = passwd;
	
	requests.push(request)

	//console.log(JSON.stringify(requests));
	
	monitorDatabasePerformance(requests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += metric.id;
		out += "|";
		out += targetId;
		out += "|";
		out += metric.val;
		out += "\n";
	}
	
	console.log(out);
}


function errorHandler(err)
{
	if(err)
	{
		console.log(err.message);
		process.exit(1);
	}
}


// ################# MONITOR ###########################
function monitorDatabasePerformance(requests) 
{
	var mysql = require('mysql');
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();
		
		var connection = mysql.createConnection({
		  host : request.hostname,
		  port : request.port,
		  user : request.username,
		  password : request.passwd
		});
		
		connection.connect(function(err) 
		{
			if (err && err.code === 'ER_ACCESS_DENIED_ERROR') 
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else if(err)
			{
				errorHandler(new Error("Unknown host."));
			}
			
			connection.query(metricQuery, function(err, results) {
				
				if(err)
				{
					errorHandler(err);
				}
				
				
				var metricsName = Object.keys(metricsId);
	
				//var values = [];
				
				var jsonString = "[";
				
				var dateTime = new Date().toISOString();
				
				for(var i in metricsName)
				{
					if(request.metricsExecution[i])
					{	
						for(var j in results)
						{
							if(metricsName[i] === results[j].Variable_name)
							{
								jsonString += "{";
								
								jsonString += "\"variableName\":\""+results[j].Variable_name+"\",";
								jsonString += "\"metricUUID\":\""+metricsId[metricsName[i]].id+"\",";
								jsonString += "\"timestamp\":\""+ dateTime +"\",";
								jsonString += "\"value\":\""+ results[j].Value +"\"";
								
								jsonString += "},";
								
								//values.push(results[j].Value);
								break;
							}
						}
					}
				}
				
				if(jsonString.length > 1)
					jsonString = jsonString.slice(0, jsonString.length-1);
				
				jsonString += "]";
				
				processDeltas(request, jsonString);
			
				connection.end();
			
			});			
		});
	}
}


function processDeltas(request, results)
{
	var file = getFile(request.targetUUID);
	
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
				var deltaValue = getDelta(initMetric, endMetric, request);
				
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
		
		setFile(request.targetUUID, results);

		for (var m = 0; m < toOutput.length; m++)
		{
			for (var z = 0; z < newData.length; z++)
			{
				var systemMetric = metricsId[newData[z].variableName];
				
				if (systemMetric.ratio === false && newData[z].metricUUID === toOutput[m].id)
				{
					toOutput[m].value = newData[z].value;
					break;
				}
			}
		}

		processOutput(request, toOutput)
		
	}
	else
	{
		setFile(request.targetUUID, results);
		process.exit(0);
	}
}



function processOutput(request, toOutput)
{
	var date = new Date().toISOString();

	for(var i in toOutput)
	{
		var output = "";
		
		output += date + "|";
		output += toOutput[i].id + "|";
		output += request.targetUUID + "|";
		output += toOutput[i].value;
		
		console.log(output);
	}
}



function getDelta(initMetric, endMetric, request)
{
	var deltaValue = 0;

	var decimalPlaces = 2;
	//var deltaBD;

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





//########################################

function getFile(monitorId)
{
		var dirPath =  __dirname +  tempDir + "/";
		var filePath = dirPath + ".mysql_"+ monitorId+".dat";
		
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

function setFile(monitorId, json)
{
	var dirPath =  __dirname +  tempDir + "/";
	var filePath = dirPath + ".mysql_"+ monitorId+".dat";
		
	if (!fs.existsSync(dirPath)) 
	{
		try
		{
			fs.mkdirSync( __dirname+tempDir);
		}
		catch(e)
		{
			errorHandler(e);
		}
	}


	fs.writeFileSync(filePath, json);
	
	/*
	fs.writeFileSync(filePath, json, function(err, data) 
	{
		console.log("foda-se");
	
		if(err) 
		{
			errorHandler(err);
		}
		else
		{
			console.log("done: "+data)
		}
	}); 
	*/

}
