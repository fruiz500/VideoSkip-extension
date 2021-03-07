//load this after a video is found
var prevAction = '', cuts = [], speedMode = 1, subsClass = '', switches = [], mutedSubs = false;

//subtitles in different services
var subsClasses = {
	youtube:'.caption-window',
	amazon:'.atvwebplayersdk-captions-text',
	imdb:'.atvwebplayersdk-captions-text',
	netflix:'.player-timedtext',
	sling:'.bmpui-ui-subtitle-overlay',
	redbox:'.cc-text-container',
	plex:'.libjass-subs',
	vudu:'.subtitles',
	hulu123:'.vjs-text-track-display',
	hulu:'.closed-caption-container',
	hbo:'.__player-cc-root',
	starz:'.cue-list',
	crackle:'.clpp-subtitles-container',
	epix:'.fp-captions',
	showtime:'.closed-captioning-text',
	pluto:'.captions',
	tubi:'#captionsComponent',		//actually not a class, but it should work
	roku:'.vjs-text-track-cue',
	peacock:'.video-player__subtitles',
	kanopy:'.vjs-text-track-cue',
	apple:'#mySubtitles'				//added by content1
};

for(var name in subsClasses){
	if(serviceName.includes(name)){
		subsClass = subsClasses[name];
		break
	}
}

//blanks/unblanks subtitles for different services
function blankSubs(isBlank){
	if(subsClass){
		if(serviceName == 'apple'){
			var subs = mySubtitles					//element defined in content1
		}else{
			var subs = document.querySelector(subsClass)			//special cases
		}
		if(subs) subs.style.opacity = isBlank ? 0 : ''

	}else if(myVideo.textTracks.length > 0){						//HTML5 general case
		myVideo.textTracks[0].mode = isBlank ? 'disabled' : 'showing'
	}
}

//for screenshots
var canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
var ctx = canvas.getContext('2d');

var allowShots = '';		//to avoid checking for tainted over and over
var shotRatio;				//of the screenshot

//to check when canvas is tainted, from Duncan @ StackOverflow	
function isTainted(ctx) {
    try {
		var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
			sum = 0;
		for(var i = 0; i < pixels.data.length; i+=4){				//add all the pixel values, excluding alpha channel; black screen will give zero
			sum += pixels.data[i] + pixels.data[i+1] + pixels.data[i+2]
		}	
        return !sum;
    } catch(err) {
        return true;
    }
}

//to send a shot out
function makeShot(){
	if(allowShots == 'no') return false;			//skip whole process if not allowed
	myVideo.pause();
	canvas.width = myVideo.videoWidth / myVideo.videoHeight * canvas.height;
	try {
		ctx.drawImage(myVideo, 0, 0, canvas.width, canvas.height)			//crashes rather than fails in Firefox, due to CORS
	} catch (err) {
		allowShots = 'no';
		return false
	}
	if(allowShots == 'yes') return canvas.toDataURL('image/jpeg');		//no need to check for tainted if it's allowed
	if(isTainted(ctx)){											//check that screenshots are allowed
		allowShots = 'no';
		return false
	}else{
		allowShots = 'yes';
		return canvas.toDataURL('image/jpeg') 					// can also use 'image/png' but the file is 10x bigger
	}
}

//get image data at current time; returns an array
function imageData(source){
	if(allowShots == 'no') return false;
	canvas.width = source.clientWidth / source.clientHeight * canvas.height;
	try {
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height)		//crashes in Firefox, for certain sites
	} catch (err) {
		allowShots = 'no';
		return false
	}
	if(allowShots == 'yes') return ctx.getImageData(0,0,canvas.width,canvas.height).data;
	
	if(isTainted(ctx)){
		allowShots = 'no';
		return false
	}else{
		allowShots = 'yes';
		return ctx.getImageData(0,0,canvas.width,canvas.height).data
	}
}

//get the absolute error between the screenShot and the video
function errorCalc(){
	var videoData = imageData(myVideo),
		length = Math.min(shotData.length,videoData.length);
	var	error = 0;
	if(!videoData) return false;				//in case the service does not allow screenshots
	for(var i = 0; i < length; i += 4){			//every pixel takes 4 data points: R, G, B, alpha, in the 0 to 255 range; alpha data ignored
		error += Math.abs(videoData[i] - shotData[i])+ Math.abs(videoData[i+1] - shotData[i+1]) + Math.abs(videoData[i+2] - shotData[i+2])	//all channels abs
	}
	return error / length
}

var	errorData = [[],[]],
	shotData,
	deltaT = 1/24,
	accel = 2;				//determined experimentally;

//process to get the error between the video and the screenshot as a double array of times and errors, starting 2 seconds before current video time, and move to best
function findShot(){
  if(!imageData(myVideo)){		//bail out early if it's not going to work
		chrome.runtime.sendMessage({message: "autosync_fail"})
  }else{
	shotData = imageData(VideoSkipShot);				//previously defined global variables
	errorData = [[],[]];
	var endTime = myVideo.currentTime,
		startTime = endTime - 1.5;
	goToTime(startTime);
	myVideo.muted = true;
	myVideo.playbackRate = accel;
	myVideo.play();
	var collection = setInterval(function () {							//collect data every deltaT seconds
		var error = errorCalc()
		if(error === false){							//no screenshots allowed so bail out and send message
			clearInterval(collection);
			chrome.runtime.sendMessage({message: "autosync_fail"});
			return
		}
		errorData[0].push(myVideo.currentTime);
		errorData[1].push(error)
	}, deltaT*1000/accel);
	setTimeout(function(){
		clearInterval(collection);
		myVideo.pause();
		myVideo.playbackRate = 1;
		goToTime(minTime(errorData) + deltaT/2*accel);					//scrub video to position of minimum error, plus extra time as fix
		myVideo.muted = false;
		chrome.runtime.sendMessage({message: "autosync_done"})
	},2500/accel)									//do all this for 2.5 seconds so it catches 1.5 second before and 1 after. Results will be in errorData array
  }
}

//find time for minimum error; errorData is a double list of errors and time
function minTime(errorData){
	var minError = 5000,						//sufficiently large to be larger than any error in errorData
		lastTime = errorData[0][0],
		minIndex = 0,
		lastIndex = errorData[0].length - 1;
	for(var i = 1; i <= lastIndex; i++){		//first find index for the minimum error in the array, ignoring first one
		if(errorData[1][i] < minError && errorData[0][i] != lastTime){
			minError = errorData[1][i];
			minIndex = i
		}
		lastTime = errorData[0][i]			//to get beyond stuck time at the beginning
	}
	return errorData[0][minIndex]				//time for minimum error in the data array
}

//moves play to requested time
function goToTime(time){
	if(serviceName == 'netflix'){		//Netflix will crash with the normal seek instruction. By Dmitry Paloskin at StackOverflow. Must be executed in page context
		executeOnPageSpace('videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;sessions = videoPlayer.getAllPlayerSessionIds();player = videoPlayer.getVideoPlayerBySessionId(sessions[sessions.length-1]);player.seek(' + time*1000 + ')')
	}else{								//everyone else is HTML5 compliant
		myVideo.currentTime = time
	}
}

//by Naveen at StackOverflow, we use it to execute seek on Netflix
function executeOnPageSpace(code){
  var script = document.createElement('script');
  script.id = 'tmpScript';
  script.textContent = 
  'document.getElementById("tmpScript").textContent = ' + code;
  document.documentElement.appendChild(script);
  var result = document.getElementById("tmpScript").textContent;
  script.remove();
  return result
}

//for interaction with the popup window
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    if(request.message == "skip_data"){		//got skip data from the popup, so put it in cuts and categories arrays
		cuts = request.cuts;
		switches = request.switches

	}else if(request.message == "need_time"){						//answer a request for time in the video
		if(myVideo) chrome.runtime.sendMessage({message: "video_time", time: myVideo.currentTime})
		
	}else if(request.message == "need_shot"){		//take a screenshot and send the data URL, along with the time
		if(myVideo){
			var dataURI = makeShot();
			if(dataURI){
				chrome.runtime.sendMessage({message: "video_shot", time: (request.needTime ? myVideo.currentTime : ''), dataURI: dataURI})
			}else{
				chrome.runtime.sendMessage({message: "video_shot", time: (request.needTime ? myVideo.currentTime : ''), dataURI: false})		//this for tainted canvas
			}
		}
		
	}else if(request.message == "change_time"){
		if(myVideo){									//conditional bacause of iframes etc. not containing video
			myVideo.pause();
			goToTime(request.time)
		}
	
	}else if(request.message == "shift_time"){
		if(myVideo){
			if(myVideo.paused){
				if(serviceName == 'netflix'){					//Netflix does not allow super-short increments
					var increment = request.timeShift;
					if(Math.abs(increment) < 0.1) increment = (increment < 0) ? -0.055 : 0.055;
					goToTime(myVideo.currentTime + increment);
					setTimeout(function(){myVideo.pause()},20)					//give time for the above to complete
				}else{
					goToTime(myVideo.currentTime + request.timeShift)
				}
			}else{
				myVideo.pause()
			}
		}
		
	}else if(request.message == "superimpose"){
		if(request.status){							//add overlay
			if(request.dataURI){
				VideoSkipShot.src = request.dataURI;
				var	videoRatio = myVideo.clientWidth / myVideo.clientHeight;
				shotRatio = request.ratio;
				if(videoRatio <= shotRatio){			//possible black bars at top and bottom
					VideoSkipShot.width = myVideo.clientWidth;
					VideoSkipShot.height = VideoSkipShot.width / shotRatio;
					VideoSkipShot.style.top = myVideo.offsetTop + myVideo.clientHeight/2 - VideoSkipShot.height/2 + 'px';
					VideoSkipShot.style.left = myVideo.offsetLeft + 'px'
				}else{									//possible black bars at left and right
					VideoSkipShot.height = myVideo.clientHeight
					VideoSkipShot.width = VideoSkipShot.height * shotRatio;
					VideoSkipShot.style.top = myVideo.offsetTop + 'px';
					VideoSkipShot.style.left = myVideo.offsetLeft + myVideo.clientWidth/2 - VideoSkipShot.width/2 + 'px'
				}	
				VideoSkipShot.style.display = ''
			}
		}else{											//remove overlay
			VideoSkipShot.style.display = 'none'
		}

	}else if(request.message == "fast_toggle"){
		if(myVideo.paused){							//if paused, restart at normal speed
			speedMode = 1;
			myVideo.muted = false;
			myVideo.playbackRate = 1
			myVideo.play()
		}else{											//if playing, toggle speed
			if(speedMode == 1){
				speedMode = 2;
				myVideo.muted = true;
				myVideo.playbackRate = 16
			}else{
				speedMode = 0;
				myVideo.muted = false;
				myVideo.playbackRate = 1;
				myVideo.pause()
			}
		}

	}else if(request.message == "move_shot"){		//move or resize superimposed screenshot
		var	isFine = request.isFine;					//small increments
		if(request.isAlt){							//move shot
			if(request.dir == 'up'){
				VideoSkipShot.style.top = parseInt(VideoSkipShot.style.top.slice(0,-2)) - (isFine ? 1 : 10) + 'px'
			}else if(request.dir == 'down'){
				VideoSkipShot.style.top = parseInt(VideoSkipShot.style.top.slice(0,-2)) + (isFine ? 1 : 10) + 'px'
			}else if(request.dir == 'left'){
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) - (isFine ? 1 : 10) + 'px'
			}else{
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) + (isFine ? 1 : 10) + 'px'
			}
		}else{											//resize shot
			var increment = isFine ? 1 : 5,
				increment2 = increment * shotRatio;
			if(request.dir == 'up'){
				VideoSkipShot.height += increment * 2;
				VideoSkipShot.style.top = parseInt(VideoSkipShot.style.top.slice(0,-2)) - increment + 'px';
				VideoSkipShot.width += increment2 * 2;		//also sideways
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) - increment2 + 'px'
			}else if(request.dir == 'down'){
				VideoSkipShot.height -= increment * 2;
				VideoSkipShot.style.top = parseInt(VideoSkipShot.style.top.slice(0,-2)) + increment + 'px'
				VideoSkipShot.width -= increment2 * 2;
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) + increment2 + 'px'
			}else if(request.dir == 'left'){
				VideoSkipShot.width -= increment * 2;
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) - increment + 'px'
			}else{
				VideoSkipShot.width += increment * 2;
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) + increment + 'px'
			}
		}

	}else if(request.message == "auto_find"){
		findShot()

	}
  }
)

//show filter settings as soon as the video goes full screen, and when the mouse is moved on fullscreen
window.onresize = function(){
	if(((screen.availWidth || screen.width-30) <= window.outerWidth) && VideoSkipControl){		//it's fullscreen now
		showSettings()
		var fadeTimer = setTimeout(function(){
			VideoSkipControl.style.display = 'none'
		},3300)
	}else if(VideoSkipControl){									//no longer fullscreen
		VideoSkipControl.style.display = 'none'
	}
}

window.onmousemove = function(){
	if(((screen.availWidth || screen.width-30) <= window.outerWidth) && VideoSkipControl){
		delete fadeTimer;
		showSettings();
		var fadeTimer = setTimeout(function(){
			VideoSkipControl.style.display = 'none'
		},3300)
	}
}

//this displays the filter settings on the full screen video
function showSettings(){
	VideoSkipControl.textContent = '';
	var spacer = document.createTextNode("\u00A0\u00A0");		//two non-breaking spaces
	if(cuts.length == 0){
		VideoSkipControl.appendChild(spacer);
		var text = document.createTextNode(chrome.i18n.getMessage('noEditsLoaded'));
		VideoSkipControl.appendChild(text);
		VideoSkipControl.appendChild(spacer);
	}else{
		var	keyWords = chrome.i18n.getMessage('categories').split(','),
			output = [];
		for(var i = 0; i < keyWords.length; i++){
			if(switches[i]) output.push(keyWords[i])
		}
		if(output.length == 0){
			VideoSkipControl.appendChild(spacer);
			var text = document.createTextNode(chrome.i18n.getMessage('noFiltersEngaged'));
			VideoSkipControl.appendChild(text);
			VideoSkipControl.appendChild(spacer);
		}else{
			VideoSkipControl.appendChild(spacer);
			var text = document.createTextNode(chrome.i18n.getMessage('VideoSkipOn'));
			VideoSkipControl.appendChild(text);
			VideoSkipControl.appendChild(spacer);
			var filters = document.createElement('b');
			filters.textContent = output.join(', ');
			VideoSkipControl.appendChild(filters);
			VideoSkipControl.appendChild(spacer);
		}
	}
	if(VideoSkipControl.style.top == '' || VideoSkipControl.style.top.includes('-')){
		VideoSkipControl.style.top = '100px';
		VideoSkipControl.style.left = '100px'
	}
	VideoSkipControl.style.display = ''
};

"end of injected content2"			//add this so it becomes the "result" and Firefox is happy
