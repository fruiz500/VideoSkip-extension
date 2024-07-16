// this script is injected and executes as soon as the browser action button is clicked
var myVideo = null;
var isFirefox = typeof InstallTrigger !== 'undefined',
    VSheight = isFirefox ? 0 : 0,
    VSwidth = isFirefox ? 500 : 480;

//returns true if an element is visible.
function isVisible (ele) {
    return (ele.offsetWidth > 0 && ele.offsetHeight > 0) && (ele.style.visibility != 'hidden')
}

var splitName = window.location.hostname.split('.'),								//get the main name of the source
    serviceName = splitName[splitName.length - 2] == 'co' ? splitName[splitName.length - 3] : splitName[splitName.length - 2];
if(serviceName == '0' || serviceName == '') serviceName = 'local';

if(serviceName == 'disneyplus'){						//disney+ puts videos in shadow DOM, which requires this hack
	var myVideo = document.querySelector('disney-web-player').shadowRoot.querySelector('video')
}else{	
    //for all other services, find the video on the page proper, or inside 1st-level iframes
    var myVideos = new Array;
    myVideos.push(document.querySelectorAll("video"));			//top level
    var iframes = document.querySelectorAll("iframe");
    for(var i = 0; i < iframes.length; i++){				//look into each iframe, only one level down
        try{
            myVideos.push(iframes[i].contentWindow.document.querySelectorAll('video'))		//this will give an error is the iframe is crossorigin, hence the try statement
        }catch(err){}
    }

    //filter only the videos that are visible
    var visibleVideos = new Array;
    for(var i = 0; i < myVideos.length; i++){
        for(var j = 0; j < myVideos[i].length; j++){
            if(isVisible(myVideos[i][j])){
                visibleVideos.push(myVideos[i][j])
            }
        }
    }
    if(visibleVideos.length > 0){
        myVideo = visibleVideos[visibleVideos.length-1];		//select last video that is theoretically visible (Amazon Prime fix)
        if(serviceName == 'apple' || serviceName == 'disneyplus') var mySubtitles = myVideo.nextSibling    //apple does not use a special class for subtitles, neither does Disney+
    }
}

//puts interface at end of body DOM
function addInterface(){
    if(serviceName == 'amazon'){
        myVideo.closest(".webPlayerSDKContainer").appendChild(VSinterface);		//this one closer to the video, because amazon won't show it otherwise
    }else{
        document.body.appendChild(VSinterface)					//not necessarily next to the video
    }
}

//things that won't load well from the 2nd content script

if(!!myVideo){													//add overlay image for superimpose function
    myVideo.crossOrigin = 'anonymous';						//in case it helps

    //function to adjust for ad times
    var adSeconds = 0;
    function trueTime(){
     return (badAds.indexOf(serviceName) != -1) ? myVideo.currentTime - adSeconds : myVideo.currentTime
    }

    myVideo.ontimeupdate = function(){						//apply skips to video when it gets to them. THIS IS THE HEART OF THE EXTENSION
        if(typeof(cuts) == "undefined" || !cuts) return;
        var action = '', tempAction = '', startTime, endTime;
        for(var i = 0; i < cuts.length; i++){			//find out what action to take, according to timing and setting in cuts object
            startTime = cuts[i].startTime;
            endTime = cuts[i].endTime;
            if(trueTime() > startTime && trueTime() < endTime){
                tempAction = cuts[i].action
            }else{
                tempAction = ''
            }
            if(tempAction == 'skip'){					//retain the strongest action valid for the current time. Hierarchy: skip > fast > blank > blur > mute
                action = 'skip';
                break							//can't get any stronger, so stop looking for this time
            }else if(tempAction == 'fast'){
                action = (action == 'skip') ? 'skip' : 'fast'
            }else if(tempAction.includes('blank')){
                action = ((action == 'skip') || (action == 'fast')) ? action : tempAction
            }else if(tempAction.includes('blur')){
                action = ((action == 'skip') || (action == 'fast') || (action == 'blank')) ? action : tempAction			//may include position for local blur
            }else if(tempAction == 'mute'){
                action += 'mute'		//add mute rather than replace
            }
        }

        if(action.includes('mute')){				//mute/unmute subtitles regardless of previous action, in case the subs element changes in the middle of the interval
            blankSubs(true)
        }else{		                            //reset to normal
            blankSubs(false)
        }

        if(action == prevAction){					//apply action to the DOM if there's a change
            return
        }else if(action == 'skip' || action == 'skipmute'){				//skip range
            goToTime(endTime)
        }else if(action == 'blank' || action == 'blankmute'){				//blank whole screeen
            myVideo.style.opacity =  0
        }else if(action.includes('blank')){				//localized blank
            var position = action.match(/\[.*\]/);
            if(position) moveBlurBox(JSON.parse(position[0]));
            VSblurBox.style.backgroundColor = 'black'
        }else if(action == 'blur' || action == 'blurmute'){				//blur screeen
            myVideo.style.filter =  'blur(20px)'
        }else if(action.includes('blur')){				//localized blur
            var position = action.match(/\[.*\]/);
            if(position) moveBlurBox(JSON.parse(position[0]));
			if(serviceName == 'amazon') VSblurBox.style.backgroundColor = 'black';
            isBlur = true
        }else if(action == 'fast' || action == 'fastmute'){				//fast forward
            myVideo.playbackRate = 16
        }else{										//back to normal
            myVideo.style.opacity = '';
            myVideo.style.filter = '';
            myVideo.playbackRate = 1;
            VSblurBox.style.display = 'none';
            isBlur = false
        }
        if(action.includes('mute')){				//mute sound & subs, .muted tag doesn't work
            myVideo.volume = 0
        }else{
            myVideo.volume = 1
        }
        prevAction = action
      }

  if(!VSinterface){										//this is the interface, containing a clickable logo, and the interface proper
    var VSinterface = document.createElement('div');
    VSinterface.id = 'VSbox';
    VSinterface.style.position = 'fixed';
    VSinterface.style.top = '130px';
    VSinterface.style.left = (serviceName == "netflix" ? 0 : myVideo.offsetLeft) + myVideo.offsetWidth - VSwidth + 'px';
    VSinterface.style.zIndex = '9999';
    VSinterface.style.width = VSwidth + 'px';
    VSinterface.style.height = VSheight + 'px';
    VSinterface.style.fontSize = '12px';

    var VSlogo = document.createElement('img');					//clickable logo
    VSlogo.src = chrome.runtime.getURL('/img/icon64.png');
    VSlogo.title = chrome.i18n.getMessage('VSlogo');
    VSlogo.style.display = 'none';
    VSlogo.style.position = 'absolute';
    VSlogo.style.top = '73px';
    VSlogo.style.left = VSwidth - 94 + 'px';
    VSlogo.style.zIndex = '2';
    VSlogo.style.height = 'auto';
    VSinterface.appendChild(VSlogo);

    var VScontrol = document.createElement('div');				//this is the interface proper
    VScontrol.style.position = 'absolute';
    VScontrol.style.top = 0;
    VScontrol.style.left = 0;
    VScontrol.frameBorder = 0;
    VScontrol.style.width = '100%';
    VScontrol.style.height = '100%';

    var req = new XMLHttpRequest();								//this loads the interface DOM from localized file interface.html
    req.open("GET", chrome.runtime.getURL('/_locales/' + chrome.i18n.getMessage('directory') + '/interface.html'));
    req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
               VScontrol.innerHTML = req.responseText;
            VSinterface.appendChild(VScontrol);

            if(serviceName == 'amazon'){		//this one closer to the video, because amazon won't show it otherwise
                myVideo.closest(".webPlayerSDKContainer").appendChild(VSshot);
                myVideo.closest(".webPlayerSDKContainer").appendChild(VSblurBox)
            }

            addInterface();                     //not necessarily close to the video; being at the end tends to be on top

//now tell the popup to inject the CSS and the rest of the script; the last key is to avoid injecting the rest of the script multiple times
            chrome.runtime.sendMessage({message: "video_found", isLoaded: typeof(blankSubs) != "undefined"})
        }
    };
    req.send(null)
  }else{
      chrome.runtime.sendMessage({message: "video_found", isLoaded: typeof(blankSubs) != "undefined"})
  }

  if(!VSshot){
    var VSshot = document.createElement('img');				//superimposed screenshot
    VSshot.style.position = 'absolute';
    VSshot.style.top = myVideo.style.top | 0;
    VSshot.style.left = myVideo.style.left | 0;
    VSshot.style.opacity = '50%';
    VSshot.style.zIndex = myVideo.style.zIndex + 1 | 1;
    VSshot.style.display = 'none';
    if(serviceName != 'amazon') myVideo.parentNode.insertBefore(VSshot,myVideo)
  }

  if(!VSstatus){
    var VSstatus = document.createElement('span');			//to display filter settings on fullscreen
    VSstatus.style.position = 'absolute';
    VSstatus.style.zIndex = myVideo.style.zIndex + 2 | 2;
    VSstatus.style.display = 'none';
    VSstatus.textContent = "This is the status";
    VSstatus.style.fontSize = "xx-large";
    VSstatus.style.color = "white";
    VSstatus.style.fontFamily = "sans-serif";
    VSstatus.style.backgroundColor = "rgba(0, 0, 0, 0.33)";
    myVideo.parentNode.insertBefore(VSstatus,myVideo)
  }

  if(!VSblurBox){
    var VSblurBox = document.createElement('div');			//for local blur and blank
    VSblurBox.style.position = 'absolute';
    VSblurBox.style.zIndex = myVideo.style.zIndex + 2 | 2;
    VSblurBox.style.border = "none";
    VSblurBox.style.borderRadius = "500px";
    VSblurBox.style.overflow = "overlay";
    if(serviceName == 'amazon'){
        VSblurBox.style.backgroundColor = 'black'
    }else{
        VSblurBox.style.backdropFilter = "blur(20px)"
    }
    if(serviceName != 'amazon') myVideo.parentNode.insertBefore(VSblurBox,myVideo)
  }

  if(typeof(openPanel) != "undefined") openPanel()
}

"end of injected content1"			//add this so it becomes the "result" of the injected code and Firefox is happy
