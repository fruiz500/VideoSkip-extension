//load this after a video is found
var prevAction = '', cuts = [], speedMode = 1, subsClass = '', switches = [];
	
//this because different services do captions differently. Will add more as I get test accounts
var serviceName = window.location.hostname;
if(serviceName.includes('youtube')){ subsClass = '.caption-window'
}else if(serviceName.includes('amazon')){ subsClass = '.persistentPanel'
}else if(serviceName.includes('imdb')){ subsClass = '.persistentPanel'		//because it's Amazon
}else if(serviceName.includes('netflix')){ subsClass = '.player-timedtex'; serviceName = 'netflix' 
}else if(serviceName.includes('sling')){ subsClass = '.bmpui-ui-subtitle-overlay'
}else if(serviceName.includes('redbox')){ subsClass = '.cc-text-container'
}else if(serviceName.includes('plex')){ subsClass = '.libjass-subs'
}else if(serviceName.includes('vudu')){ subsClass = '.subtitles'
}else if(serviceName.includes('hulu123')){ subsClass = '.vjs-text-track-display'
}else if(serviceName.includes('hulu')){ subsClass = '.closed-caption-container'
}else if(serviceName.includes('hbo')){ subsClass = '.__player-cc-root'
}else if(serviceName.includes('starz')){ subsClass = '.cue-list'
}else if(serviceName.includes('crackle')){ subsClass = '.clpp-subtitles-container'
}else if(serviceName.includes('epix')){ subsClass = '.fp-captions'
}else if(serviceName.includes('showtime')){ subsClass = '.closed-captioning-text'
}else if(serviceName.includes('pluto')){ subsClass = '.captions'
}else if(serviceName.includes('tubi')){ subsClass = '#captionsComponent'		//actually not a class, but it should work
}

//blanks/unblanks subtitles for different services
function blankSubs(isBlank){
	if(subsClass){
		var subs = document.querySelector(subsClass);			//special cases
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

//to check when canvas is tainted, from Duncan @ StackOverflow	
function isTainted(ctx) {
    try {
		var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
			sum = 0;
		for(var i = 0; i < pixels.data.length; i++){				//add all the values; black screen will give zero
			sum += pixels.data[i]
		}	
        return !sum;
    } catch(err) {
        return (err.code === 18);
    }
}

//to send a shot out
function makeShot(){
	myVideo.pause();
	canvas.width = myVideo.videoWidth / myVideo.videoHeight * canvas.height;
	ctx.drawImage(myVideo, 0, 0, canvas.width, canvas.height);

	if(isTainted(ctx)){											//check first that screenshots are allowed
		return false
	}else{
		return canvas.toDataURL('image/jpeg'); 					// can also use 'image/png' but the file is 10x bigger
	}
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

if(myVideo) myVideo.ontimeupdate = function(){							//apply skips to video when it gets to them
	var action = '', startTime, endTime;
	for(var i = 0; i < cuts.length; i++){
		startTime = cuts[i].startTime;						//times in seconds
		endTime = cuts[i].endTime;
		if(myVideo.currentTime > startTime && myVideo.currentTime < endTime){
			action = cuts[i].action;
			break
		}else{
			action = ''
		}
	}
	if(action == prevAction){					//apply action to the DOM if there's a change
		return
	}else if(action == 'skip'){				//skip range
		goToTime(endTime)
	}else if(action == 'blank'){				//blank screeen
		myVideo.style.opacity =  0
	}else if(action == 'mute'){				//mute sound & subs
		myVideo.muted = true;
		blankSubs(myVideo.muted)
	}else{										//back to normal
		myVideo.style.opacity =  '';
		myVideo.muted = false;
		blankSubs(myVideo.muted)
	}
	prevAction = action
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
		if(request.isSize){							//resize shot
			if(request.dir == 'up'){
				VideoSkipShot.height -= isFine ? 1 : 10
			}else if(request.dir == 'down'){
				VideoSkipShot.height += isFine ? 1 : 10
			}else if(request.dir == 'left'){
				VideoSkipShot.width -= isFine ? 1 : 10
			}else{
				VideoSkipShot.width += isFine ? 1 : 10
			}
		}else{											//move shot
			if(request.dir == 'up'){
				VideoSkipShot.style.top = parseInt(VideoSkipShot.style.top.slice(0,-2)) - (isFine ? 1 : 10) + 'px'
			}else if(request.dir == 'down'){
				VideoSkipShot.style.top = parseInt(VideoSkipShot.style.top.slice(0,-2)) + (isFine ? 1 : 10) + 'px'
			}else if(request.dir == 'left'){
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) - (isFine ? 1 : 10) + 'px'
			}else{
				VideoSkipShot.style.left = parseInt(VideoSkipShot.style.left.slice(0,-2)) + (isFine ? 1 : 10) + 'px'
			}
		}		
	}
  }
)

//whow filter settings as soon as the video goes full screen, and when the mouse is moved on fullscreen
window.onresize = function(){
	if(((screen.availWidth || screen.width-30) <= window.innerWidth) && VideoSkipControl){		//it's fullscreen now
		showSettings()
		var fadeTimer = setTimeout(function(){
			VideoSkipControl.style.display = 'none'
		},3300)
	}else if(VideoSkipControl){									//no longer fullscreen
		VideoSkipControl.style.display = 'none'
	}
}

window.onmousemove = function(){
	if(((screen.availWidth || screen.width-30) <= window.innerWidth) && VideoSkipControl){
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
		var text = document.createTextNode("VideoSkip: no edits loaded");
		VideoSkipControl.appendChild(text);
		VideoSkipControl.appendChild(spacer);
	}else{
		var	keyWords = ['sex','violence','profanity','substance','intense','other'],
			output = [];
		for(var i = 0; i < keyWords.length; i++){
			if(switches[i]) output.push(keyWords[i])
		}
		if(output.length == 0){
			VideoSkipControl.appendChild(spacer);
			var text = document.createTextNode("VideoSkip: no filters engaged");
			VideoSkipControl.appendChild(text);
			VideoSkipControl.appendChild(spacer);
		}else{
			VideoSkipControl.appendChild(spacer);
			var text = document.createTextNode("VideoSkip on: ");
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
}