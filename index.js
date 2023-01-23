const { devices, HID } = require('node-hid');
const ViGEmClient = require('vigemclient');

let client = new ViGEmClient();
client.connect();

const DEBUG = true;

var hids = [];

/* Helper Functions */
const log = str => {
	if(!DEBUG) return;
	process.stdout.write(str + " ");
};

const padding = (str) => {
	var bin = str.toString(2);
	return "00000000".substr(bin.length) + bin;
};

const sendData = (hid, data) => {
	if (!hid.connected) return false;
	
	try{
		hid.write(data);
	} catch(err) {
		console.log("Could not write to controller, probably disconnected " + hid.index + " disconnecting...");
		console.warn(err);

		hid.controller.disconnect();
		hid.connected = false;
	};
};

const findDevices = () => {
	console.log(devices());
	for(var device of devices()){
		if(typeof(device) !== "object") continue;
		if(device.product == null) continue;
		if(device.product.toUpperCase().indexOf('RVL-CNT') === -1) continue;
	
		process.stdout.write("Found a WiiMote, creating HID Link... ");

		var hid = new HID(device.path);
		hid.index = hids.push(hid);
		hid.connected = true;
		console.log("Connected.");

		process.stdout.write("Creating virtual Xbox 360... ");
		hid.controller = client.createX360Controller();
		hid.controller.updateMode = 'manual';
		hid.controller.connect();
		console.log("Done.");

		console.log("Setting up LED");
		sendData(hid, [0x11, 16 * hid.index]);

		console.log("Setup done, over to reading buttons...");
		sendData(hid, [0x12, 0x00, 0x30]);

		/*
		0x21: Read Memory Data
		0x22: Acknowledge output report, return function result
		0x30: Core Buttons
		0x31: Core Buttons and Accelerometer
		0x32: Core Buttons with 8 Extension bytes
		0x33: Core Buttons and Accelerometer with 12 IR bytes
		0x34: Core Buttons with 19 Extension bytes
		0x35: Core Buttons and Accelerometer with 16 Extension Bytes
		0x36: Core Buttons with 10 IR bytes and 9 Extension Bytes
		0x37: Core Buttons and Accelerometer with 10 IR bytes and 6 Extension Bytes
		0x3e / 0x3f: Interleaved Core Buttons and Accelerometer with 36 IR bytes
		*/
	}

	return hids.length;
}

while(hids.length == 0){
	if(findDevices()) break;
	
	console.log("wiimote no found");
}

var acc = [0,0,0];

for(var i = 0; i < hids.length; i++){

	//shady injection cause js is js and this works™
	((hid) => {
		/*
		hid.controller.addListener("small motor", (val) => {
			sendData(hid, [0x11, (16 * hid.index) + val / 16]);
		});
		*/

		hid.on("data", (buffer) => {
			if(DEBUG) process.stdout.write("                        \r");
			/*for(var byteArray of e){
				process.stdout.write(padding(byteArray) + " ");
			}*/

			hid.buffer = buffer;

			/*
			for(buffer of hids){
				process.stdout.write("\n\b")
			}
			*/

			hid.controller.button.B.setValue(buffer[2] & 0x1);
			hid.controller.button.A.setValue(buffer[2] & 0x2);
			hid.controller.button.Y.setValue(buffer[2] & 0x4);
			hid.controller.button.X.setValue(buffer[2] & 0x8);

			hid.controller.button.RIGHT_SHOULDER.setValue(buffer[1] & 0x10);
			hid.controller.button.BACK.setValue(buffer[2] & 0x10);
			hid.controller.button.START.setValue(buffer[2] & 0x80);
			
			var updown = 0;
			if(buffer[1] & 0x4) updown += 1;
			if(buffer[1] & 0x8) updown -= 1;
			hid.controller.axis.leftX.setValue(updown);

			var rightleft = 0;
			if(buffer[1] & 0x1) rightleft -= 1;
			if(buffer[1] & 0x2) rightleft += 1;
			hid.controller.axis.leftY.setValue(rightleft);

			hid.controller.update();
		});
	})(hids[i]);
}

/*

accelometer 

var x = (buffer[3]/240-0.5) * 12;
var y = (buffer[5]/240-0.5) * 12;

if(Math.abs(x) < 0.3) x = 0;
if(Math.abs(y) < 0.3) y = 0;

if(x > 1) x = 1;
if(y > 1) y = 1;

if(x < -1) x = -1;
if(y < -1) y = -1;

log(x)
log(y)

hid.controller.axis.rightX.setValue(x);
hid.controller.axis.rightY.setValue(y);

*/

