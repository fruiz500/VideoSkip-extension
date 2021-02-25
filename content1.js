// this script executes as soon as the browser action button is clicked
var myVideo = null;

//returns true if an element is visible.
function isVisible (ele) {
	return (ele.offsetWidth > 0 && ele.offsetHeight > 0) && (ele.style.visibility != 'hidden')
}

var splitName = window.location.hostname.split('.');								//get the main name of the source
var serviceName = splitName[splitName.length - 2] == 'co' ? splitName[splitName.length - 3] : splitName[splitName.length - 2];
if(serviceName == '0' || serviceName == '') serviceName = 'local';

var myVideos = document.querySelectorAll("video");			//get all videos on page, make list of the visible ones
var visibleVideos = new Array;
for(var i = 0; i < myVideos.length; i++){
	if(isVisible(myVideos[i])){
		visibleVideos.push(myVideos[i])
	}
}
if(visibleVideos.length > 0) myVideo = visibleVideos[visibleVideos.length-1];		//select last video that is theoretically visible (Amazon Prime fix)

//hack for appleTV+
if(serviceName == 'apple'){
	myVideo = document.querySelector('apple-tv-plus-player').shadowRoot.querySelector('amp-video-player-internal').shadowRoot.querySelector('amp-video-player').shadowRoot.querySelector('video');
	mySubtitles = myVideo.nextSibling
}

chrome.runtime.sendMessage({message: "start_info", hasVideo: !!myVideo, isLoaded: typeof(blankSubs) != "undefined", serviceName: serviceName})		//just a Boolean confirming there's a video, so the popup loads, the second part is to avoid injecting the rest of the content script multiple times, plus some more info

//things that won't load well from the 2nd content script
if(!!myVideo){													//add overlay image for superimpose function
	myVideo.crossOrigin = 'anonymous';		//in case it helps
	var superimpose = false,									//flag for sending image when superimposing a screenshot
	VideoSkipShot = document.createElement('img');
	VideoSkipShot.style.position = 'absolute';
	VideoSkipShot.style.top = myVideo.style.top | 0;
	VideoSkipShot.style.left = myVideo.style.left | 0;
	VideoSkipShot.style.opacity = '50%';
	VideoSkipShot.style.zIndex = myVideo.style.zIndex + 1 | 1;
	VideoSkipShot.style.display = 'none';
	myVideo.parentNode.insertBefore(VideoSkipShot,myVideo);
	
	var VideoSkipControl = document.createElement('span');			//to display filter settings on fullscreen
	VideoSkipControl.style.position = 'absolute';
	VideoSkipControl.style.top = (myVideo.offsetTop + 200) + 'px';
	VideoSkipControl.style.left = (myVideo.offsetLeft + 200) + 'px';
	VideoSkipControl.style.zIndex = myVideo.style.zIndex + 1 | 1;
	VideoSkipControl.style.display = 'none';
	VideoSkipControl.textContent = "This is the control";
	VideoSkipControl.style.fontSize = "xx-large";
	VideoSkipControl.style.color = "white";
	VideoSkipControl.style.fontFamily = "sans-serif";
	VideoSkipControl.style.backgroundColor = "rgba(0, 0, 0, 0.33)";
	VideoSkipControl.style.zIndex = "999";
	myVideo.parentNode.insertBefore(VideoSkipControl,myVideo);
	
	myVideo.ontimeupdate = function(){					//apply skips to video when it gets to them
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

		if(action == 'mute'){				//mute/unmute subtitles regardless of previous action, in case the subs element changes in the middle of the interval
			blankSubs(true);
			mutedSubs = true
		}else if(action != 'mute' && mutedSubs){		//reset to normal
			blankSubs(false);
			mutedSubs = false
		}

		if(action == prevAction){					//apply action to the DOM if there's a change
			return
		}else if(action == 'skip'){				//skip range
			goToTime(endTime)
		}else if(action == 'blank'){				//blank screeen
			myVideo.style.opacity =  0
		}else if(action == 'mute'){				//mute sound & subs
			myVideo.muted = true
		}else{										//back to normal
			myVideo.style.opacity =  '';
			myVideo.muted = false
		}
		prevAction = action
  	}
};

//to keep the VS window alive
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	  if(request.message == "is_script_there"){			//confirm with popup window that script is loaded
		chrome.runtime.sendMessage({message: "script_here"})
	  }
  }
)

"end of injected content1"			//add this so it becomes the "result" and Firefox is happy
