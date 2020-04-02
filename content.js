// this script executes as soon as a page is loaded
var myVideo = null, cuts = [], categories = [], isFF = false, subsClass = '';

var ua = navigator.userAgent.toLowerCase(); 		//to add a fix for Safari and choose fastest filter method, per https://jsben.ch/5qRcU
if (ua.indexOf('safari') != -1) { 
  if (ua.indexOf('chrome') == -1){ var isSafari = true
  }else{ var isChrome = true
  }
}else if(typeof InstallTrigger !== 'undefined'){var isFirefox = true}

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
}

//blanks/unblanks subtitles for different services
function blankSubs(isBlank){
	if(subsClass){
		var subs = document.querySelector(subsClass);			//special cases
		subs.style.opacity = isBlank ? 0 : ''

	}else if(myVideo.textTracks.length > 0){						//HTML5 general case
		myVideo.textTracks[0].mode = isBlank ? 'disabled' : 'showing'
	}
}

//for screenshots
var canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
var ctx = canvas.getContext('2d');
var superimpose = false,											//flag for sending image when superimposing a screenshot
	VideoSkipShot = document.createElement('img');

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

//superimposes screenshot on myVideo
function formatTopShot(){
	if(VideoSkipShot.style.position != 'absolute'){				//newly added, so reformat, otherwise leave as is
		VideoSkipShot.height = myVideo.offsetHeight;
		VideoSkipShot.width = myVideo.offsetWidth;
		VideoSkipShot.style.position = 'absolute';
		VideoSkipShot.style.top = myVideo.style.top | 0;
		VideoSkipShot.style.left = myVideo.style.left | 0;
		VideoSkipShot.style.opacity = '50%';
		VideoSkipShot.style.zIndex = myVideo.style.zIndex + 1 | 1
	}
}

//moves play to requested time
function goToTime(time){
	if(serviceName == 'netflix'){		//Netflix will crash with the normal seek instruction. By Dmitry Paloskin at StackOverflow. Must be executed in page context
		executeOnPageSpace('videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;player = videoPlayer.getVideoPlayerBySessionId(videoPlayer.getAllPlayerSessionIds()[0]);player.seek(' + time*1000 + ')')
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

//returns true if an element is visible.
function isVisible (ele) {
	return (ele.offsetWidth > 0 && ele.offsetHeight > 0) && (ele.style.visibility != 'hidden')
}

//faster way to check for content depanding on browser; returns a Boolean; regex and stringArray content should match
function isContained(containerStr, stringArray, regex){
	var result = false;
	if(isChrome){
		for(var i = 0; i < stringArray.length; i++){
		result = result || containerStr.indexOf(stringArray[i]) != -1
		}
	}else if(isFirefox){
		result = containerStr.search(regex) != -1
	}else if(isSafari){								//below this won't be used in the extension, but left to see
		result = regex.test(containerStr)
	}else{
		result = !!containerStr.match(regex)
	}
	return result
}

//function to decide whether a particular content is to be skipped. Allows alternative and incomplete keywords
function isSkipped(label){
	if(isContained(label,['sex','nud'],/sex|nud/) && categories[0]){
		return true
	}else if(isContained(label,['vio','gor'],/vio|gor/) && categories[1]){
		return true
	}else if(isContained(label,['pro','cur','hat'],/pro|cur|hat/) && categories[2]){
		return true
	}else if(isContained(label,['alc','dru','smo'],/alc|dru|smo/) && categories[3]){
		return true
	}else if(isContained(label,['fri','sca','int'],/fri|sca|int/) && categories[4]){
		return true
	}else if(isContained(label,['oth','bor'],/oth|bor/) && categories[5]){
		return true
	}else{
		return false
	}
}

//for interaction with the popup window
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	 
    if(request.message == "start") {
		var myVideos = document.querySelectorAll("video");			//get all videos on page, stick with the first one that is visible
		for(var i = 0; i < myVideos.length; i++){
			if(isVisible(myVideos[i])){
				myVideo = myVideos[i];
				break
			}
		}
		if(!!myVideo){										//add overlay image for superimpose function
			myVideo.crossOrigin = 'anonymous';			//in case it helps
			formatTopShot();
			VideoSkipShot.style.display = 'none';
			myVideo.parentNode.insertBefore(VideoSkipShot,myVideo)
		}
		chrome.runtime.sendMessage({message: "start_info", hasVideo: !!myVideo})		//just a Boolean confirming there's a video, so the popup loads
		
		myVideo.ontimeupdate = function(){							//apply skips to video when it gets to them
			for(var i = 0; i < cuts.length; i++){
				var startTime = cuts[i].startTime,					//times in seconds
					endTime = cuts[i].endTime,
					label = cuts[i].text.toLowerCase(),
					isAudio = isContained(label,['aud','sou','spe','wor'],/aud|sou|spe|wor/),
					isVideo = isContained(label,['vid','ima','img'],/vid|ima|img/);
				if(!isAudio && !isVideo){
					if(myVideo.currentTime > startTime && myVideo.currentTime < endTime && isSkipped(label)) goToTime(endTime)							//skip range
				}else if(isAudio){
					myVideo.muted = myVideo.currentTime > startTime && myVideo.currentTime < endTime && isSkipped(label);								//mute range
		
					blankSubs(myVideo.muted)																													//blank subs
				}else{
					myVideo.style.opacity = (myVideo.currentTime > startTime && myVideo.currentTime < endTime && isSkipped(label)) ? "0" : ""			//blank range
				}
			}
		}
		
    }else if(request.message == "skip_data"){		//got skip data from the popup, so put it in cuts and categories arrays
		cuts = request.cuts;
		categories = request.categories

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
				goToTime(myVideo.currentTime + request.timeShift)
			}else{
				myVideo.pause()
			}
		}
		
	}else if(request.message == "superimpose"){
		if(request.status){							//add overlay
			if(request.dataURI){
				if(myVideo){
					formatTopShot();
					VideoSkipShot.src = request.dataURI;
					VideoSkipShot.style.display = ''
				}
			}
		}else{											//remove overlay
			VideoSkipShot.style.display = 'none'
		}
	
	}else if(request.message == "fast_toggle"){
		if(myVideo.paused){							//if paused, restart, no speed change
			myVideo.play()
		}else{											//if playing, toggle speed
			if(isFF){
				isFF = false;
				myVideo.muted = false;
				myVideo.playbackRate = 1
			}else{
				isFF = true;
				myVideo.muted = true;
				myVideo.playbackRate = 16
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