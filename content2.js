//load this after a video is found
var prevAction = '',
    fileName = '',							//global variable with name of skip file, minus extension
    cuts = [],								//global variable containing the cuts, each array element is an object with this format {startTime,endTime,text,action}
    offsets = {},							//to contain offsets for different sources. Initialized with first time or screenshot
    speedMode = 1,
    subsClass = '',
    sliderValues = ['0','0','0','0','0','0'],
    fadeTimer;

const	deltaT = 1/24,			//seconds for one frame at 24 fps
        accel = 2;				//determined experimentally;

//directly defined global variables for DOM elements. Needed by Firefox
var VStabs = document.getElementById('VStabs'),
    VSloadLink = document.getElementById('VSloadLink'),
    VSsyncLink = document.getElementById('VSsyncLink'),
    VSfilterLink = document.getElementById('VSfilterLink'),
    VSeditLink = document.getElementById('VSeditLink'),
    VSLoadTab = document.getElementById('VSLoadTab'),
    VSsyncTab = document.getElementById('VSsyncTab'),
    VSfilterTab = document.getElementById('VSfilterTab'),
    VSeditTab = document.getElementById('VSeditTab'),
    VSlogo2 = document.getElementById('VSlogo2'),
    VSloadDone = document.getElementById('VSloadDone'),
    VSfineMode = document.getElementById('VSfineMode'),
    VSaltMode = document.getElementById('VSaltMode'),
    VSsyncDone = document.getElementById('VSsyncDone'),
    VSfilterDone = document.getElementById('VSfilterDone'),
    VSmsg1 = document.getElementById('VSmsg1'),
    VSmsg2 = document.getElementById('VSmsg2'),
    VSmsg3 = document.getElementById('VSmsg3'),
    VSmsg4 = document.getElementById('VSmsg4'),
    VSsyncMsg = document.getElementById('VSsyncMsg'),
    VSskipFile = document.getElementById('VSskipFile'),
    VSscreenShot = document.getElementById('VSscreenShot'),
    VSfilters = document.getElementById('VSfilters'),
    VSsexNum = document.getElementById('VSsexNum'),
    VSviolenceNum = document.getElementById('VSviolenceNum'),
    VScurseNum = document.getElementById('VScurseNum'),
    VSboozeNum = document.getElementById('VSboozeNum'),
    VSscareNum = document.getElementById('VSscareNum'),
    VSotherNum = document.getElementById('VSotherNum'),
    VSrubricText = document.getElementById('VSrubricText'),
    VSautoProfanity = document.getElementById('VSautoProfanity'),
    VSsubFile = document.getElementById('VSsubFile'),
    VSblockList = document.getElementById('VSblockList'),
    VSfineMode2 = document.getElementById('VSfineMode2'),
    VSshotFile = document.getElementById('VSshotFile'),
    VSshotFileBtn = document.getElementById('VSshotFileBtn'),
    VSshotFileLabel = document.getElementById('VSshotFileLabel'),
    VSsaveFile = document.getElementById('VSsaveFile'),
    VSskipBox = document.getElementById('VSskipBox');

//subtitles in different services
var subsClasses = {
    youtube:'.caption-window',
    amazon:'.atvwebplayersdk-captions-text',
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
    apple:'#mySubtitles',				//added by content1
    hoopla: '.clpp-text-cue',
    cwtv: '.jw-text-track-cue'
};

for(var service in subsClasses){
    if(serviceName.includes(service)){
        subsClass = subsClasses[service];
        break
    }
}

//blanks/unblanks subtitles for different services
function blankSubs(isBlank){
    if(subsClass){
        if(serviceName == 'apple'){
            var subs = mySubtitles					//element defined in content1
        }else{
            var subs = document.querySelector(subsClass)		//special cases
        }
        if(subs){
            subs.style.opacity = isBlank ? 0 : ''					//blank/unblank subs here
        }

    }else if(myVideo.textTracks.length > 0){						//HTML5 general case
        myVideo.textTracks[0].mode = isBlank ? 'disabled' : 'showing'
    }
}

//similar to jQuery ready(), from youmightnotneedjquery.com
function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

//for screenshots
var canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
var ctx = canvas.getContext('2d'),
    allowShots = '',		//to avoid checking for tainted over and over
    shotRatio;				//of the screenshot

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

//to make a screenshot
function makeShot(){
    if(allowShots == 'no') return false;										//skip whole process if not allowed
    myVideo.pause();
    canvas.width = myVideo.videoWidth / myVideo.videoHeight * canvas.height;
    try {
        ctx.drawImage(myVideo, 0, 0, canvas.width, canvas.height)			//crashes rather than fails in Firefox, due to CORS
    } catch (err) {
        allowShots = 'no';
        return false
    }
    if(allowShots == 'yes') return canvas.toDataURL('image/jpeg');			//no need to check for tainted if it's allowed
    if(isTainted(ctx)){														//check that screenshots are allowed
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
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)		//crashes in Firefox for certain sites
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
    if(!videoData) return false;					//in case the service does not allow screenshots
    for(var i = 0; i < length; i += 4){			//every pixel takes 4 data points: R, G, B, alpha, in the 0 to 255 range; alpha data ignored
        error += Math.abs(videoData[i] - shotData[i])+ Math.abs(videoData[i+1] - shotData[i+1]) + Math.abs(videoData[i+2] - shotData[i+2])	//all channels abs
    }
    return error / length
}

var	errorData = [[],[]],		//for automatic shot finding
    shotData;

//process to get the error between the video and the screenshot as a double array of times and errors, starting 2 seconds before current video time, and move to best
function findShot(){
    if(VSscreenShot.src == ''){
        VSmsg3.textContent = chrome.i18n.getMessage('screenshotFirst');
        return
    }
    if(!isSuper) toggleTopShot();
    if(!imageData(myVideo)){								//bail out early if it's not going to work
        VSautoBtn.disabled = true;
        VSmsg2.textContent = chrome.i18n.getMessage('autosyncFail')
    }else{
        shotData = imageData(VSshot);						//previously defined global variables
        errorData = [[],[]];
        var endTime = myVideo.currentTime,
            startTime = endTime - 1.5;
        goToTime(startTime);
        myVideo.volume = 0;
        myVideo.playbackRate = accel;
        myVideo.play();
        var collection = setInterval(function () {		//collect data every deltaT seconds
            var error = errorCalc()
            if(error === false){							//no screenshots allowed so bail out and send message
                clearInterval(collection);
                VSautoBtn.disabled = true;
                VSmsg2.textContent = chrome.i18n.getMessage('autosyncFail')
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
            myVideo.volume = 1;
            VSfineMode.checked = true;
            VSfineMode2.checked = true;
            VSmsg2.textContent = chrome.i18n.getMessage('autosyncDone')
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
//        executeOnPageSpace('videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;sessions = videoPlayer.getAllPlayerSessionIds();player = videoPlayer.getVideoPlayerBySessionId(sessions[sessions.length-1]);player.seek(' + time*1000 + ')')
        var script = document.createElement('script');
        script.src = chrome.runtime.getURL('go2netflix.js?') + new URLSearchParams({seconds: time});     //Manifest v3 admits injected scripts only via file
        document.documentElement.appendChild(script);
        script.remove();
    }else{								//everyone else is HTML5 compliant, except perhaps for ad time
        myVideo.currentTime = (badAds.indexOf(serviceName) != -1) ? time + adSeconds : time
    }
}

//show filter settings as soon as the video goes full screen, and when the mouse is moved on fullscreen
window.onresize = function(){
    if(((screen.availWidth || screen.width-30) <= window.outerWidth) && VSstatus){		//it's fullscreen now
        showSettings();
        fadeTimer = setTimeout(function(){
            VSstatus.style.display = 'none';
        },3300);
        ready(function(){
            var fullElement = document.fullscreenElement;
            if(fullElement && fullElement.firstChild != VSinterface){			//copy interface to fullscreen element if not done before
                document.getElementById('VSbox').remove();
                fullElement.appendChild(VSinterface);
            }
            replaceInterface();
            resetStyles();
            reBlackTxt()
        })
    }else{									//no longer fullscreen
        VSstatus.style.display = 'none';     
        ready(function(){
            document.getElementById('VSbox').remove();
            document.body.appendChild(VSinterface);
            replaceInterface();
            resetStyles()
        })
    }
    reGrayBtns();		//fixes kanopy bug
}

window.onmousemove = function(){
    if(((screen.availWidth || screen.width-30) <= window.outerWidth) && VSstatus){		//display selected filters in fullscreen
        clearTimeout(fadeTimer);
        fadeTimer = null;
        showSettings();
        if(VScontrol.style.display == 'none') VSlogo.style.display = 'block';
        if(!fadeTimer) fadeTimer = setTimeout(function(){
            VSstatus.style.display = 'none';
            VSlogo.style.display = 'none'
        },4000)
    }else if(VScontrol.style.display == 'none'){							//display button to load interface
        clearTimeout(fadeTimer);
        fadeTimer = null;
        VSlogo.style.display = 'block';
        if(!fadeTimer) fadeTimer = setTimeout(function(){
            VSlogo.style.display = 'none'
        },4000)
    }
}

//this displays the filter settings on the full screen video
function showSettings(){
    VSstatus.textContent = '';
    var spacer = document.createTextNode("\u00A0\u00A0");		//two non-breaking spaces
    if(cuts.length == 0){
        VSstatus.appendChild(spacer);
        var text = document.createTextNode(chrome.i18n.getMessage('noEditsLoaded'));
        VSstatus.appendChild(text);
        VSstatus.appendChild(spacer);
    }else{
        var	keyWords = chrome.i18n.getMessage('categories').split(','),
            output = [];
        for(var i = 0; i < keyWords.length; i++){
            if(sliderValues[i] != '0') output.push(keyWords[i])
        }
        if(output.length == 0){
            VSstatus.appendChild(spacer);
            var text = document.createTextNode(chrome.i18n.getMessage('noFiltersEngaged'));
            VSstatus.appendChild(text);
            VSstatus.appendChild(spacer);
        }else{
            VSstatus.appendChild(spacer);
            var text = document.createTextNode(chrome.i18n.getMessage('VideoSkipOn'));
            VSstatus.appendChild(text);
            VSstatus.appendChild(spacer);
            var filters = document.createElement('b');
            filters.textContent = output.join(', ');
            VSstatus.appendChild(filters);
            VSstatus.appendChild(spacer);
        }
    }
    VSstatus.style.display = ''
};

//move interface to good position
function replaceInterface(){
    VSstatus.style.top = '80px';																		//reposition elements
    VSstatus.style.left = ((serviceName == 'netflix') ? 0 : myVideo.offsetLeft) + myVideo.offsetWidth - VSwidth + 'px';
    document.getElementById('VSbox').style.top = '130px';
    document.getElementById('VSbox').style.left = ((serviceName == 'netflix') ? 0 : myVideo.offsetLeft) + myVideo.offsetWidth - VSwidth + 'px';
    if(VSlogo.style.display == 'none' && VScontrol.style.display == 'none') VSlogo.style.display = 'block'		//return from full screen
}

//to make elements draggable, from W3schools
function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    elmnt.onmousedown = dragMouseDown;

  elmnt.addEventListener('contextmenu', function(e) {					//disable right-click menu
        e.preventDefault();
        e.stopPropagation();
        return false;
  }, false);

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    e.stopPropagation();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    if((VSaltMode.checked != (!!e.altKey || e.button == 2)) && (elmnt == VSblurBox || elmnt == VSshot)){				//alt combinations or right-click resizes, regular moves
        document.onmousemove = elementResize
    }else{
        document.onmousemove = elementDrag
    }
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    e.stopPropagation();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    if(elmnt == VSlogo || elmnt == VStabs){			//drag whole interface
        VSinterface.style.top = (VSinterface.offsetTop - pos2) + "px";
        VSinterface.style.left = (VSinterface.offsetLeft - pos1) + "px";
    }else{
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
  }

  function elementResize(e) {
    e = e || window.event;
    e.preventDefault();
    e.stopPropagation();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    //get the element center
    var centerX = elmnt.offsetLeft + elmnt.clientWidth / 2,
        centerY = elmnt.offsetTop + elmnt.clientHeight / 2;
    // set the element's new size, four cases depending of where the mouse is:
    if(pos3 >= centerX && pos4 >= centerY){							//lower right
        elmnt.style.height = (elmnt.clientHeight - pos2) + "px";
        elmnt.style.width = (elmnt.clientWidth - pos1) + "px";
    }else if(pos3 < centerX && pos4 >= centerY){						//lower left
        elmnt.style.height = (elmnt.clientHeight - pos2) + "px";
        elmnt.style.width = (elmnt.clientWidth + pos1) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }else if(pos3 >= centerX && pos4 < centerY){						//upper right
        elmnt.style.height = (elmnt.clientHeight + pos2) + "px";
        elmnt.style.width = (elmnt.clientWidth - pos1) + "px";
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    }else{																//upper left
        elmnt.style.height = (elmnt.clientHeight + pos2) + "px";
        elmnt.style.width = (elmnt.clientWidth + pos1) + "px";
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

//apply the above to the blur box, the screenshot, and the interface
dragElement(VSblurBox);
dragElement(VSshot);
dragElement(VSlogo);
dragElement(VStabs);

//to close the interface panel from the X or the logo
function closePanel(){
    VSlogo.style.display = 'block';
    VScontrol.style.display = 'none';
    fadeTimer = setTimeout(function(){
        VSlogo.style.display = 'none'
    },4000)
}

//to open the interface panel
function openPanel(){
    VSlogo.style.display = 'none';
    VScontrol.style.display = 'block'
}
VSlogo.addEventListener('click',openPanel);

/////////code from former videoskip.js///////////

const sliders = VSfilters.querySelectorAll('input');		//slider elements as an array

const badAds = ["amazon", "pluto"];					//list of services that change video timing with their ads
if(badAds.indexOf(serviceName) != -1){
    alert(serviceName + chrome.i18n.getMessage('badAds'))	//warn user about movies with ads from this service
}

const badTrailers = ["apple"];					//list of services that change video timing with trailers
if(badTrailers.indexOf(serviceName) != -1){
    alert(serviceName + chrome.i18n.getMessage('badTrailers'))	//warn user about movies with trailers from this service
}

const ua = navigator.userAgent.toLowerCase(); 		//to choose fastest filter method, per https://jsben.ch/5qRcU
if (ua.indexOf('safari') != -1) {
  if (ua.indexOf('chrome') == -1){ var isSafari = true
  }else{ var isChrome = true }
}else if(typeof InstallTrigger !== 'undefined'){var isFirefox = true
}else if (document.documentMode || /Edge/.test(navigator.userAgent)){var isEdge = true
}

//loads the skips file
function loadFileAsURL(){
    var fileToLoad = VSskipFile.files[0],
        fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent){
        var URLFromFileLoaded = fileLoadedEvent.target.result;
        var extension = fileToLoad.name.slice(-4);
        if(extension == ".skp"){
            var data = URLFromFileLoaded.split('data:image/jpeg;base64,');			//separate skips from screenshot
            var data1 = data[0].split('{');											//separate skips from offsets
            fileName = fileToLoad.name.slice(0,-4).replace(/ \[[a-z0-9\-]*\]/,'');	//remove extension and service list
            VSskipBox.value = data1[0].trim();
            if(data1[1]) offsets = JSON.parse('{' + data1[1].trim());				//make offsets object
            if(data[1]) VSscreenShot.src = 'data:image/jpeg;base64,' + data[1];	    //extract screenshot
            resizedShot(VSscreenShot.src, 240, true);                               //remove black bands, if any
            if(!VSloadLink.textContent.match('✔')) VSloadLink.textContent += " ✔";
            VSloadDone.textContent = chrome.i18n.getMessage('tabDone');
            VSlogo2.style.display = 'none';
            ready(function(){								//give it some time to load before data is extracted to memory and sent; also set switches
                cuts = PF_SRT.parse(VSskipBox.value);
                setSliders();
                applyOffset()								//this includes setActions at the end
            })
        }else{
            VSmsg1.textContent = chrome.i18n.getMessage('wrongFile')
        }
        VSskipFile.type = '';
        VSskipFile.type = 'file'            //reset file input
    };
    fileReader.readAsText(fileToLoad)
}

//similar, to load subtitles for auto profanity filter
function loadSub(){
    var fileToLoad = VSsubFile.files[0],
        fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent){
        var URLFromFileLoaded = fileLoadedEvent.target.result;
        var extension = fileToLoad.name.slice(-4);
        if(extension == ".vtt" || extension == ".srt"){						//allow only .vtt and .srt formats
            var subs = URLFromFileLoaded;									//get subs in text format, to be edited
            subs = subs.replace(/(\d),(\d)/g,'$1.$2');						//convert decimal commas to periods
            autoBeepGen(subs)
        }
        VSssubFile.type = '';
        VSsubFile.type = 'file'            //reset file input
    };
    fileReader.readAsText(fileToLoad)
}

//makes silenced profanity skips timed to subtitles with words in blockList
function autoBeepGen(subs){
    var blockListExp = new RegExp(VSblockList.textContent.replace(/, +/g,'|'),"g");
    var subObj = PF_SRT.parse(subs);				//similar in structure to cuts, with keys: startTime, endTime, text, action (empty)
    writeIn('\n\n');
    for(var i = 0; i < subObj.length; i++){
        var word = subObj[i].text.toLowerCase().match(blockListExp);
        if(word){	//word found in block list; add extra .3s buffer in case there are two in a row
            writeIn(toHMS(subObj[i].startTime - 0.15) + ' --> ' + toHMS(subObj[i].endTime + 0.15) + '\nprofane word 1 (' + word[0] + ')\n\n',false)
        }
    }
    var	initialData = VSskipBox.value.trim().split('\n').slice(0,2);		//first two lines containing screenshot timing
    cuts = PF_SRT.parse(VSskipBox.value);
    cuts.sort(function(a, b){return a.startTime - b.startTime;});
    times2box();
    if(initalData) VSskipBox.value = initialData.join('\n') + '\n\n' + VSskipBox.value;
    VScurseNum.value = 3;
    setActions();
    makeTimeLabels()
}

//loads the screen shot from file, if the direct take didn't work
function loadShot(){
    var fileToLoad = VSshotFile.files[0],
        fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent){
        var URLFromFileLoaded = fileLoadedEvent.target.result;
        resizedShot(URLFromFileLoaded, 240, VSblackBands.checked)		//resize to standard height 240 px into screenshot, asynchronous function
    };
    if(fileToLoad){
        fileReader.readAsDataURL(fileToLoad);
        VSmsg4.textContent = chrome.i18n.getMessage('shotLoaded');
        VSsyncLink.style.display = '';
        VSsyncTab.style.display = ''
    }else{
        VSmsg4.textContent = chrome.i18n.getMessage('shotCanceled')
    }
}

// Takes a data URI and returns the Data URI corresponding to the resized image at the wanted size. Black band removal optional. Adapted from a function by Pierrick Martellière at StackOverflow
function resizedShot(dataURIin, wantedHeight, removeBands){		//width will be calculated to maintain aspect ratio
    // We create an image to receive the Data URI
    var img = document.createElement('img');

    // When the event "onload" is triggered we can resize the image.
    img.onload = function() {
    // We create a canvas and get its context.
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

    // We set the dimensions of the canvas.
        var inputWidth = this.width,
            inputHeight = this.height;
        canvas.width = inputWidth;
        canvas.height = inputHeight;

        ctx.drawImage(this, 0, 0, inputWidth, inputHeight);

    //Cropping process starts here
    if(removeBands){
        var inputData = ctx.getImageData(0,0,canvas.width,canvas.height),
            data = inputData.data,
            pixels = inputWidth * inputHeight,
            westIndex = pixels * 2,		//starting indices for pixels at cardinal points
            eastIndex = westIndex - 4,
            northIndex = inputWidth * 2,
            southIndex = pixels * 4 - inputWidth * 2,
            trueLeft = 0, trueRight = inputWidth,
            trueTop = 0, trueBottom = inputHeight,
            threshold = 5;					//top and bottom lines may have spurious content;

    //now scan middle horizontal line to determine true width; start on edges
        for(var i = 0; i < inputWidth / 2; i++){
            if(data[westIndex]+data[westIndex+1]+data[westIndex+2] > threshold) break;
            trueLeft++;
            westIndex += 4
        }
        for(var i = 0; i < inputWidth / 2; i++){
            if(data[eastIndex]+data[eastIndex+1]+data[eastIndex+2] > threshold) break;
            trueRight--;
            eastIndex -= 4
        }
    //same for height
        for(var i = 0; i < inputHeight / 2; i++){
            if(data[northIndex]+data[northIndex+1]+data[northIndex+2] > threshold) break;
            trueTop++;
            northIndex += inputWidth * 4
        }
        for(var i = 0; i < inputHeight / 2; i++){
            if(data[southIndex]+data[southIndex+1]+data[southIndex+2] > threshold) break;
            trueBottom--;
            southIndex -= inputWidth * 4
        }
    //these are the true dimensions
        var trueWidth = trueRight - trueLeft,
            trueHeight = trueBottom - trueTop;

    //resize canvas
        canvas.height = wantedHeight;
        canvas.width = wantedHeight * trueWidth / trueHeight;
        ctx.drawImage(img, trueLeft, trueTop, trueRight-trueLeft, trueBottom-trueTop, 0, 0, canvas.width, canvas.height)

    }else{																	//no black bars: only resize
        canvas.height = wantedHeight;
        canvas.width = wantedHeight * inputWidth / inputHeight;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }

        VSscreenShot.src = canvas.toDataURL('image/jpeg');
    };

    // We put the Data URI in the image's src attribute
    img.src = dataURIin;
}

//to download data to a file, from StackOverflow
function download(data, name, type) {
    var a = document.createElement("a");
    var file = new Blob([data], {"type": type}),
        url = URL.createObjectURL(file);
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
       document.body.removeChild(a);
       window.URL.revokeObjectURL(url);
    }, 0)
}

//to parse the content of the skip box in something close to .srt format, from StackOverflow
var PF_SRT = function() {
  //SRT format
  var pattern = /([\d:,.]+)\s*-*\>\s*([\d:,.]+)\s*\n([\s\S]*?(?=\n+\s*\d|\n{2}))?/gm;		//no item number, can use decimal dot instead of comma, malformed arrows, no extra lines
  var _regExp;

  var init = function() {
    _regExp = new RegExp(pattern);
  };
  var parse = function(f) {
    if (typeof(f) != "string")
      throw "Sorry, the parser accepts only strings";

    var result = [];
    if (f == null)
      return _subtitles;

    f = f.replace(/\r\n|\r|\n/g, '\n') + '\n\n';

    while ((matches = pattern.exec(f)) != null) {
      result.push(toLineObj(matches));
    }
    return result;
  }
  var toLineObj = function(group) {
    return {
      startTime: fromHMS(group[1]),			//load timings in seconds
      endTime: fromHMS(group[2]),
      text: group[3],
      action: ''				//no action by default, to be filled later
    };
  }
  init();
  return {
    parse: parse
  }
}();

//to put seconds into hour:minute:second format
function toHMS(seconds) {
    var hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    var minutes = Math.floor(seconds / 60);
    minutes = (minutes >= 10) ? minutes : "0" + minutes;
    seconds = Math.floor((seconds % 60) * 100) / 100;			//precision is 0.01 s
    seconds = (seconds >= 10) ? seconds : "0" + seconds;
    return hours + ":" + minutes + ":" + seconds;
}

//the opposite: hour:minute:second string to decimal seconds
function fromHMS(timeString){
    timeString = timeString.replace(/,/,".");			//in .srt format decimal seconds use a comma
    var time = timeString.split(":");
    if(time.length == 3){							//has hours
        return parseInt(time[0])*3600 + parseInt(time[1])*60 + parseFloat(time[2])
    }else if(time.length == 2){					//minutes and seconds
        return parseInt(time[0])*60 + parseFloat(time[1])
    }else{											//only seconds
        return parseFloat(time[0])
    }
}

const syncFix = 1/24;							//use a time that is actually 1 frame earlier than reported when dealing with the screenshot

//shift all times so the screenshot has correct timing in the video
function syncTimes(){
    if(timeLabels.length == 0){
        VSmsg2.textContent = chrome.i18n.getMessage('noTimeInBox');
        return
    }else if(timeLabels[0].length < 1){
        VSmsg2.textContent = chrome.i18n.getMessage('noTimeInBox');
        return
    }
    var	initialData = VSskipBox.value.trim().split('\n').slice(0,2),				//first two lines
        shotTime = fromHMS(initialData[0]),
        seconds = shotTime ? trueTime() - shotTime : 0;
    seconds -= syncFix;																//apply fix
    for(var i = 0; i < cuts.length; i++){
        cuts[i].startTime += seconds;
        cuts[i].endTime += seconds
    }
    times2box();														//put shifted times in the box
    if(shotTime != null){												//reconstruct initial data, if present
        initialData[0] = toHMS(shotTime + seconds);
        VSskipBox.value = initialData.join('\n') + '\n\n' + VSskipBox.value
    }
    for(var service in offsets){										//adjust offsets
        offsets[service] -= seconds;
        if(Math.abs(offsets[service]) < deltaT) offsets[service] = 0
    }
    offsets[serviceName] = 0;											//key for current source set to zero regardless
    ready(function(){
        setActions();
        makeTimeLabels();
        if(!VSsyncLink.textContent.match('✔')) VSsyncLink.textContent += " ✔";
        VSsyncDone.textContent = chrome.i18n.getMessage('tabDone');
        VSmsg3.textContent = chrome.i18n.getMessage('offsetApplied');
        VSfilterLink.click();											//go on to filter tab
        ready(save2file)
    })
}

//shift all times according to offset in loaded skip file; different enough from previous to justify a new function
function applyOffset(){
    var	initialData = VSskipBox.value.trim().split('\n').slice(0,2),			//first two lines
        shotTime = fromHMS(initialData[0]);
    var offset = offsets[serviceName];
    if(typeof offset != 'undefined'){									//there is an offset for the current source, so shift all times
        for(var i = 0; i < cuts.length; i++){
            cuts[i].startTime += offset;
            cuts[i].endTime += offset
        }
        times2box();													//put shifted times in the box
        if(shotTime){													//reconstruct initial data, if present, shifting the shot time as well
            initialData[0] = toHMS(shotTime + offset);
            VSskipBox.value = initialData.join('\n') + '\n\n' + VSskipBox.value
        }
        setActions();
        makeTimeLabels();
        VSsyncTab.style.display = 'none';								//close sync tab if it was open
        VSsyncLink.style.display = 'none';
        VSmsg3.textContent = chrome.i18n.getMessage('offsetApplied');
        for(var service in offsets){									//adjust offsets
            offsets[service] -= offset
        }
        VSfilterLink.click()											//open filter tab
    }else{																//no offset found, so scrub to shot time and superimpose
        offsets[serviceName] = 0;										//initialize offset
        setActions();
        makeTimeLabels();
        goToTime(shotTime);
        VSsyncTab.style.display = '';
        VSsyncLink.style.display = '';
        VSsyncMsg.textContent = initialData[1];
        VSsyncLink.click()												//go to sync tab
    }
}

//puts data from the cuts array into VSskipBox
function times2box(){
    var text = '';
    for(var i = 0; i < cuts.length; i++){
        text += toHMS(cuts[i].startTime) + ' --> ' + toHMS(cuts[i].endTime) + '\n' + cuts[i].text + '\n\n'
    }
    VSskipBox.value = text.trim()
}

//insert string in box, at cursor or replacing selection
function writeIn(string,isScrub){
    var start = VSskipBox.selectionStart,
        end = VSskipBox.selectionEnd,
        newEnd = start + string.length;
    VSskipBox.value = VSskipBox.value.slice(0,start) + string + VSskipBox.value.slice(end,VSskipBox.length);
    if(isScrub){
        VSskipBox.setSelectionRange(start,newEnd)
    }else{
        VSskipBox.setSelectionRange(newEnd,newEnd);
    }
    VSskipBox.focus();
    ready(function(){
        cuts = PF_SRT.parse(VSskipBox.value);
        setActions();
        makeTimeLabels()
    })
}

//insert things in box
function writeTime(){
    writeIn(toHMS(trueTime()),false)
}

//insert quick silence
function writeSilence(){
    writeIn(toHMS(trueTime() - 0.7) + ' --> ' + toHMS(trueTime()) + '\profane word 1\n\n',false)
}

//insert box position as percentage of video dimensions
function writePosition(){
    if(isBlur){
        var x = getBlurPos();
        for(var i = 0; i < 4; i++) x[i] = x[i].toPrecision(4);
        writeIn('[' + x[0] + ',' + x[1] + ',' + x[2] + ',' + x[3] + ']',false)
    }
}

//gets index of a particular HMS time in the box, by location; returns null if the cursor is not on a time label
function getTimeIndex(){
    var start = VSskipBox.selectionStart,
        end = VSskipBox.selectionEnd;
    for(var i = 0; i < timeLabels[0].length; i++){
        if(timeLabels[1][i] <= start && timeLabels[2][i] >= end) return i
    }
}

//scrub video by a given amount
function shiftTime(increment){
    if(myVideo.paused){
        if(serviceName == 'netflix'){										//Netflix does not allow super-short increments
            if(Math.abs(increment) < 0.1) increment = (increment < 0) ? -0.055 : 0.055;
            goToTime(trueTime() + increment);
            myVideo.pause()
        }else{
            goToTime(trueTime() + increment)
        }
    }else{
        myVideo.pause()
    }
}

//called by forward buttons
function fwdSkip(){
    if(VSaltMode.checked){										//special mode for shifting auto profanity skips, in case subtitle file was off
        shiftProfSkips(true)

    }else{
        if(VSskipBox.selectionStart != VSskipBox.selectionEnd){		//when a time is selected in the box, change that too
            var index = getTimeIndex(),
                tol = 0.02;
            if(index != null){
                VSskipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
                var selectedTime = fromHMS(timeLabels[0][index]);
                var timeShift = VSfineMode.checked ? deltaT : deltaT*12;
                shiftTime(timeShift);
                writeIn(toHMS(trueTime()),true);
                VSskipBox.focus()
            }
        }else{																//scrub by a small amount
            var timeShift = VSfineMode.checked ? deltaT : deltaT*12;
            shiftTime(timeShift);
        }
    }
}

//called by back buttons
function backSkip(){
    if(VSaltMode.checked){										//special mode for shifting auto profanity skips, in case subtitle file was off
        shiftProfSkips(true)

    }else{
        if(VSskipBox.selectionStart != VSskipBox.selectionEnd){		//when a time is selected in the box, change that too
            var index = getTimeIndex(),
                tol = 0.02;
            if(index != null){
                VSskipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
                var selectedTime = fromHMS(timeLabels[0][index]);
                var timeShift = VSfineMode.checked ? - deltaT : - deltaT*12;
                shiftTime(timeShift);
                writeIn(toHMS(trueTime()),true);
                VSskipBox.focus()
            }
        }else{																//scrub by a small amount
            var timeShift = VSfineMode.checked ? - deltaT : - deltaT*12;
            shiftTime(timeShift)
        }
    }
}

//called by fast forward buttons
function fFwdToggle(){
    VSskipBox.selectionStart = VSskipBox.selectionEnd;					//clear selection, if any
    if(myVideo.paused){													//if paused, restart at normal speed
        speedMode = 1;
        myVideo.volume = 1;
        myVideo.playbackRate = 1
        myVideo.play()
    }else{																	//if playing, toggle speed
        if(speedMode == 1){
            speedMode = 2;
            myVideo.volume = 0;
            myVideo.playbackRate = 16
        }else{
            speedMode = 0;
            myVideo.volume = 1;
            myVideo.playbackRate = 1;
            myVideo.pause()
        }
    }
    VSskipBox.focus();
}

//called by the above, to shift auto-generated profanity skips
function shiftProfSkips(isFwd){
    var timeShift = 0,
        isFine = VSfineMode.checked,
        initialData = VSskipBox.value.trim().split('\n').slice(0,2);	//first two lines
    for(var i = 0; i < cuts.length; i++){
        if(cuts[i].text.match(/profane word \(/)){						//do it only for auto-generated skips
            timeShift = (isFine ? deltaT : deltaT*12)*(isFwd ? 1 : -1);
            cuts[i].startTime += timeShift;
            cuts[i].endTime += timeShift
        }
    }
    times2box();
    if(initialData) VSskipBox.value = initialData.join('\n') + '\n\n' + VSskipBox.value
}

//scrub to first time in the box, unless a time is selected
function scrub2shot(){
    if(timeLabels.length == 0){
        VSmsg4.textContent = chrome.i18n.getMessage('noTimeInBox');
        return
    }else if(timeLabels[0].length < 1){
        VSmsg4.textContent = chrome.i18n.getMessage('noTimeInBox');
        return
    }
    var index = getTimeIndex();
    if(index != null){
        VSskipBox.setSelectionRange(timeLabels[2][index],timeLabels[2][index]);		//deselect if previously selected
        myVideo.pause();
        goToTime(fromHMS(timeLabels[0][index]));
        VSskipBox.focus()
    }else{																	//scrub to 1st time
        myVideo.pause();
        goToTime(fromHMS(timeLabels[0][0]))
    }
}

var isSuper = false;						//keeps track of whether or not there is a superimposed screenshot

//put the screenshot on top of the video so a perfect match can be found, and back
function toggleTopShot(){
    if(VSscreenShot.src == ''){
        isSuper = false;
        VSmsg2.textContent = chrome.i18n.getMessage('noSuperimpose');
    }
    if(!isSuper){															//add overlay
        isSuper = true;
        if(VSscreenShot.src){
            VSshot.src = VSscreenShot.src;
            var	videoRatio = myVideo.clientWidth / myVideo.clientHeight,
                shotRatio = VSscreenShot.width/VSscreenShot.height;
            if(videoRatio <= shotRatio){			//possible black bars at top and bottom
                VSshot.width = myVideo.clientWidth;
                VSshot.height = VSshot.width / shotRatio;
                VSshot.style.top = myVideo.offsetTop + myVideo.clientHeight/2 - VSshot.height/2 + 'px';
                VSshot.style.left = myVideo.offsetLeft + 'px'
            }else{									//possible black bars at left and right
                VSshot.height = myVideo.clientHeight
                VSshot.width = VSshot.height * shotRatio;
                VSshot.style.top = myVideo.offsetTop + 'px';
                VSshot.style.left = myVideo.offsetLeft + myVideo.clientWidth/2 - VSshot.width/2 + 'px'
            }
            VSshot.style.display = ''
        }
    }else{																	//remove overlay
        isSuper = false;
        VSshot.style.display = 'none'
    }
}

//similar to the previous, to put a blur box on the video. New in version 0.5
var isBlur = false;

function toggleBlurBox(){
    if(isBlur){
        isBlur = false;
        VSblurBox.style.display = 'none'
    }else{
        isBlur = true;
        VSblurBox.style.display = '';
        VSblurBox.style.height = myVideo.clientHeight / 3 + 'px';
        VSblurBox.style.width = VSblurBox.style.height;
        VSblurBox.style.top = myVideo.offsetTop + myVideo.clientHeight / 3 + 'px';
        VSblurBox.style.left = myVideo.offsetLeft + myVideo.clientWidth / 2 - parseInt(VSblurBox.style.width.slice(0,-2)) / 2 + 'px';
        if(serviceName == 'amazon'){
            VSblurBox.style.filter = "blur(20px)";
            VSblurBox.style.backgroundColor = 'black';
        }else{
            VSblurBox.style.backdropFilter = "blur(20px)"
        }
    }
}

var videoX1, videoX2, videoY1, videoY2;									//coordinates of the actual video corners without black bars

//get real video position, excluding black bars
function getVideoPos(){
    var	frameRatio = myVideo.clientWidth / myVideo.clientHeight,					//includes the bars
        trueRatio = myVideo.videoWidth / myVideo.videoHeight;						//without black bars
    if(frameRatio <= trueRatio){			//possible black bars at top and bottom
        videoX1 = myVideo.offsetLeft;
        videoX2 = videoX1 + myVideo.clientWidth;
        videoY1 = myVideo.offsetTop + myVideo.clientHeight / 2 - (myVideo.clientWidth / trueRatio) / 2;
        videoY2 = videoY1 + myVideo.clientWidth / trueRatio;
    }else{									//possible black bars at left and right
        videoY1 = myVideo.offsetTop;
        videoY2 = videoY1 + myVideo.clientHeight;
        videoX1 = myVideo.offsetLeft + myVideo.clientWidth / 2 - (myVideo.clientHeight * trueRatio) / 2;
        videoX2 = videoX1 + myVideo.clientHeight * trueRatio;
    }
}

//move blur box to relative position in array
function moveBlurBox(position){
    getVideoPos();							//first get the true position of the video, minus black bars
    VSblurBox.style.display = '';
    VSblurBox.style.height = (videoY2 - videoY1) * (position[3] - position[1]) / 100 + 'px';			//resize and move the box
    VSblurBox.style.width = (videoX2 - videoX1) * (position[2] - position[0]) / 100 + 'px';
    VSblurBox.style.top = videoY1 + (videoY2 - videoY1) * position[1] / 100 + 'px';
    VSblurBox.style.left = videoX1 + (videoX2 - videoX1) * position[0] / 100 + 'px'
}

var blurPos;			//array containing blur box position, so it stays when going back and forth from full screen

//gets position of blur box as percent of video dimensions
function getBlurPos(){
    getVideoPos();
    var x1 = parseInt(VSblurBox.style.left.slice(0,-2) - videoX1) / (videoX2 - videoX1) * 100,
        y1 = parseInt(VSblurBox.style.top.slice(0,-2) - videoY1) / (videoY2 - videoY1) * 100,
        x2 = x1 + parseInt(VSblurBox.style.width.slice(0,-2)) / (videoX2 - videoX1) * 100,
        y2 = y1 + parseInt(VSblurBox.style.height.slice(0,-2)) / (videoY2 - videoY1) * 100;
    return [x1,y1,x2,y2]
}
//end of new in 0.5

var timeLabels = [];

//remakes array timeLabels containing HMS times, plus their positions in the box [HMS time, start, end]
function makeTimeLabels(){
    timeLabels = [[],[],[]];						        //string, startPosition, endPosition
    var	text = VSskipBox.value,
        string, start, end = 0;
    var matches = text.replace(/\[.*\]/g,'').match(/\d+[\d:.]+/g);		//remove local blur positions
    if(matches){
        for(var i = 0; i < matches.length; i++){
            string = matches[i];
            timeLabels[0][i] = string;
            start = text.indexOf(string,end)
            timeLabels[1][i] = start;
            end = start + string.length;
            timeLabels[2][i] = end
        }
    }
    if(isSuper) toggleTopShot()
}

//make screenshot
function takeShot(){
    var dataURI = makeShot();
    if(dataURI){																//go ahead if the service allows it
        VSmsg4.textContent = chrome.i18n.getMessage('shotTaken');
        VSscreenShot.src = dataURI;
        VSsyncLink.style.display = '';
        VSsyncTab.style.display = ''
    }else{																		//this if the service refuses
        VSmsg4.textContent = chrome.i18n.getMessage('badService');
        VSshotFileLabel.style.display = 'inline-block';
        VSautoBtn.style.display = 'none'
    }
    writeIn(toHMS(trueTime() - syncFix),false);								//insert time regardless
    ready(makeTimeLabels)
}

//save skips to file
function save2file(){
    //first check that all skips have a category
	for(var i = 0; i < cuts.length; i++){
		if(!isContained(cuts[i].text.toLowerCase().replace(/\(.*\)/g,''),/sex|nud|vio|gor|pro|cur|hat|alc|dru|smo|fri|sca|int|oth|bor/)){
			VSmsg4.textContent = chrome.i18n.getMessage('skipNumber') + (i+1) + chrome.i18n.getMessage('noCategory');
			return
		}
	}
    if(VSscreenShot.src == '' && timeLabels.length == 0) return;
    if(typeof offsets[serviceName] == 'undefined') offsets[serviceName] = 0;
    var sourceList = Object.keys(offsets);
    sourceList.sort(function(a,b){return b.length - a.length;});				//sort offset services alphabetically
    if(!fileName) fileName = prompt(chrome.i18n.getMessage('fileName'));
    download(VSskipBox.value + '\n\n' + JSON.stringify(offsets) + '\n\n' + VSscreenShot.src, fileName + ' [' + sourceList.join('-') + '].skp', "text/plain");
    VSmsg4.textContent = chrome.i18n.getMessage('fileSaved') + fileName + ' [' + sourceList.join('-') + '].skp ' + chrome.i18n.getMessage('fileSaved2')
}

//to display as the mouse moves over the sliders
const rubric = JSON.parse(chrome.i18n.getMessage('rubric').replace(/'/g,'"'));

for(var i = 0; i < sliders.length; i++){
    sliders[i].addEventListener('mousemove',showRubric);
    sliders[i].addEventListener('mouseleave',hideRubric)
}

function showRubric(){
    var category = this.id.slice(2,-3),
        level = 3 - this.value;
    if(level >= 3){VSrubricText.textContent = '';return};
    VSrubricText.textContent = rubric[category][level]
}

function hideRubric(){
    VSrubricText.textContent = ''
}

//check the two Fine mode boxes as one
function fineSync(){
    if(this.checked){
        VSfineMode.checked = true;
        VSfineMode2.checked = true
    }else{
        VSfineMode.checked = false;
        VSfineMode2.checked = false
    }
}

//variables and functions for making tabs, by Matt Doyle 2009
var tabLinks = new Array(),
    contentDivs = new Array();

function initTabs(){

      // Grab the tab links and content divs from the page
      var tabListItems = document.getElementById('VStabs').childNodes;
      for( var i = 0; i < tabListItems.length; i++){
        if(tabListItems[i].nodeName == "LI"){
          var tabLink = getFirstChildWithTagName( tabListItems[i], 'A' );
          var id = getHash( tabLink.getAttribute('href'));
          tabLinks[id] = tabLink;
          contentDivs[id] = document.getElementById(id)
        }
      }

      // Assign onclick events to the tab links, and
      // highlight the first tab
      var i = 0;

      for(var id in tabLinks){
        tabLinks[id].onclick = showTab;
        tabLinks[id].onfocus = function(){ this.blur()};
        if (i == 0) tabLinks[id].className = 'selected';
        i++
      }

      // Hide all content divs except the first
      var i = 0;

      for(var id in contentDivs){
        if( i != 0 ) contentDivs[id].className = 'VStabContent hide';
        i++
      }
}

function showTab(){
      var selectedId = getHash( this.getAttribute('href'));

      // Highlight the selected tab, and dim all others.
      // Also show the selected content div, and hide all others.
      for(var id in contentDivs){
        if(id == selectedId){
          tabLinks[id].className = 'selected';
          contentDivs[id].className = 'VStabContent'
        }else{
          tabLinks[id].className = '';
          contentDivs[id].className = 'VStabContent hide'
        }
      }
      //display appropriate messages
      if(this.id == 'VSloadLink'){
          VSmsg1.textContent = fileName ? fileName + chrome.i18n.getMessage('fileLoaded') : chrome.i18n.getMessage('nowLoad');
      }else if(this.id == 'VSsyncLink'){
          VSmsg2.textContent = chrome.i18n.getMessage('nowSync');
      }else if(this.id == 'VSfilterLink'){
          VSmsg3.textContent = chrome.i18n.getMessage('nowFilter');
      }else if(this.id == 'VSeditLink'){
          VSmsg4.textContent = chrome.i18n.getMessage('nowEdit');
      }
      // Stop the browser following the link
      return false
}

function getFirstChildWithTagName(element, tagName){
      for(var i = 0; i < element.childNodes.length; i++){
        if(element.childNodes[i].nodeName == tagName) return element.childNodes[i]
      }
}

function getHash(url){
      var hashPos = url.lastIndexOf('#');
      return url.substring(hashPos + 1)
}
//end of tab functions

initTabs();

//done with formatting and buttons code

//faster way to check for content depending on browser; returns a Boolean; regex and stringArray content should match
function isContained(containerStr, regex){
    var result = false;
    if(isFirefox){
        result = containerStr.search(regex) != -1
    }else if(isSafari || isEdge || isChrome){								//below this won't be used in the extension, but left to see
        result = regex.test(containerStr)
    }else{
        result = !!containerStr.match(regex)
    }
    return result
}

//to decide whether a particular content is to be skipped, according to 3-level sliders. Allows alternative and incomplete keywords
function isSkipped(label){
    var nuMatches = label.match(/\d/),
        level = parseInt(nuMatches ? nuMatches[0] : 1);			//if no level is found, make it level 1
    level = level >= 3 ? 3 : level;								//highest level is 3
    if(isContained(label,/sex|nud/)){
        return (parseInt(VSsexNum.value) + level) > 3
    }else if(isContained(label,/vio|gor/)){
        return (parseInt(VSviolenceNum.value) + level) > 3
    }else if(isContained(label,/pro|cur|hat/)){
        return (parseInt(VScurseNum.value) + level) > 3
    }else if(isContained(label,/alc|dru|smo/)){
        return (parseInt(VSboozeNum.value) + level) > 3
    }else if(isContained(label,/fri|sca|int/)){
        return (parseInt(VSscareNum.value) + level) > 3
    }else if(isContained(label,/oth|bor/)){
        return (parseInt(VSotherNum.value) + level) > 3
    }else{
        return false
    }
}

//set switches for edits present in skip file; used only when a file is loaded
function setSliders(){
    for(var i = 0; i < 6; i++) sliders[i].value = 0;
    var noGrade = false;
    for(var i = 0; i < cuts.length; i++){
        if(cuts[i].text){
            var label = cuts[i].text.toLowerCase().replace(/\(.*\)/g,''),			//ignore text in parentheses
                grades = label.match(/\d/);
            if(!grades){
                noGrade = true;				//raise flag for ungraded edit
                var grade = 4					//assume 4 if ungraded
            }else{
                var grade = parseInt(grades[0])
            }
            if(isContained(label,/sex|nud/)) VSsexNum.value = Math.max( 4 - grade, VSsexNum.value);
            if(isContained(label,/vio|gor/)) VSviolenceNum.value = Math.max( 4 - grade, VSviolenceNum.value);
            if(isContained(label,/pro|cur|hat/)) VScurseNum.value = Math.max( 4 - grade, VScurseNum.value);
            if(isContained(label,/alc|dru|smo/)) VSboozeNum.value = Math.max( 4 - grade, VSboozeNum.value);
            if(isContained(label,/fri|sca|int/)) VSscareNum.value = Math.max( 4 - grade, VSscareNum.value);
            if(isContained(label,/oth|bor/)) VSotherNum.value = Math.max( 4 - grade, VSotherNum.value)
        }
    }
    for(var i = 0; i < 6; i++) sliderValues[i] = sliders[i].value;
    if(noGrade) ready(function(){
        VSmsg3.textContent = chrome.i18n.getMessage('unGraded')
    })
}

//fills the action field in object cuts, according to the position of the check boxes and the text at each time
function setActions(){
    for(var i = 0; i < cuts.length; i++){
        if(cuts[i].text){
            var ignore = cuts[i].text.includes('//'),										//ignore skip containing // in text
                label = cuts[i].text.toLowerCase().replace(/\(.*\)/g,''),				//ignore text in parentheses
                isAudio = isContained(label,/aud|sou|spe|wor|mut/),
                isVideo = isContained(label,/vid|ima|img|bla/),
                isBlurred = isContained(label,/blu/),
                isFast = isContained(label,/fas/),
                position = label.match(/\[.*\]/);				//position formatted as array within square brackets
            if(ignore){
                cuts[i].action = ''
            }else if(!isAudio && !isVideo && !isBlurred && !isFast){
                cuts[i].action = isSkipped(label) ? 'skip' : ''
            }else if(isAudio){
                cuts[i].action = isSkipped(label) ? 'mute' : ''
            }else if(isVideo){
                if(position){
                    cuts[i].action = isSkipped(label) ? 'blank ' + position[0]: ''		//localized blank
                }else{
                    cuts[i].action = isSkipped(label) ? 'blank' : ''
                }
            }else if(isBlurred){
                if(position){
                    cuts[i].action = isSkipped(label) ? 'blur ' + position[0]: ''		//localized blur
                }else{
                    cuts[i].action = isSkipped(label) ? 'blur' : ''
                }
            }else if(isFast){
                cuts[i].action = isSkipped(label) ? 'fast' : ''
            }
        }
    }
}

//shows checkmarks on Load tab if there is file contents
function showLoad(){
    if(fileName){
        if(!VSloadLink.textContent.match('✔')) VSloadLink.textContent += " ✔";
        VSloadDone.textContent = chrome.i18n.getMessage('tabDone');
        VSlogo2.style.display = 'none'
    }else{
        VSloadLink.textContent = VSloadLink.textContent.split(" ✔")[0];
        VSloadDone.textContent = '';
        VSlogo2.style.display = ''
    }
}

//checks that the other tabs are done and sends you there if not
function checkDone(){
    var	loadDone = !!VSloadLink.textContent.match('✔'),
        syncDone = !!VSsyncLink.textContent.match('✔'),
        filterDone = false;
    for(var i = 0; i < sliderValues.length; i++) filterDone = filterDone || (sliderValues[i] != '0');
    if(!loadDone){
        VSloadLink.click();
        ready(function(){VSmsg1.textContent = chrome.i18n.getMessage('moreLoad')})
    }else if(!syncDone && VSsyncLink.style.display != 'none'){
        VSsyncLink.click();
        ready(function(){VSmsg2.textContent = chrome.i18n.getMessage('moreSync')})
    }else if(!filterDone){
        ready(function(){VSmsg3.textContent = chrome.i18n.getMessage('moreFilter')})
    }else{
        VSfilterLink.textContent += " ✔"
        document.getElementById('VScheckBtn').style.display = 'none';
        VSfilterDone.style.display = ''
    }
}

//reset all styles inherited from host page
function resetStyles(){
    var allNodes = VSinterface.getElementsByTagName('*');
    for (var i = -1, l = allNodes.length; ++i < l;) {
        if(allNodes[i].id != 'VSblockList' && !allNodes[i].className.includes('VScenter')) allNodes[i].classList.add('VSreset')
    }
}

//reset text color in buttons
function reGrayBtns(){
    var elements = VSinterface.querySelectorAll('.VSbutton');
    for(var i = 0; i < elements.length; i++){elements[i].style.color = '#555555'; elements[i].style.background = '#dcdcdc'}
}
//same but for text
function reBlackTxt(){
    var elements = VSinterface.querySelectorAll('.VSp, .VStd, .VSmsg, .VSsmPrt');
    for(var i = 0; i < elements.length; i++){elements[i].style.color = 'black'}
}

//if the service is Amazon or Pluto, start 1-second timer to determine difference between myVideo.currentTime, which includes ads, and the time shown in the movie
if(badAds.indexOf(serviceName) != -1){
    setInterval(function(){
        if(serviceName == 'amazon'){
            adSeconds = myVideo.currentTime - fromHMS(document.querySelector('.atvwebplayersdk-timeindicator-text').textContent.split(' ')[0])
        }else if(serviceName == 'pluto'){
            adSeconds = myVideo.currentTime - fromHMS(document.querySelector("[class^=clock]").textContent)
        }
    },1000)                  //to be done once every second
}

//now connect functions to the buttons and do other tasks concerning the interface

//remove styles inherited from host page
resetStyles();

document.getElementById('VScloseBtn').addEventListener('click', closePanel);

VSlogo2.addEventListener('click', closePanel);

VSskipFile.addEventListener('change', loadFileAsURL);

//loads other websites from a select option list
function loadPage(){
    const urls = ['https://videoskip.org', 'https://albatenia.com'];
    if(this.value) window.open(urls[this.value])
}

VSwebsites.addEventListener('change', loadPage);

/*   //old exchange button with only one option
document.getElementById('VSexchangeBtn').addEventListener('click', function(){
    window.open('https://videoskip.org/exchange')
});
*/

VSshotFile.addEventListener('change', loadShot);

VSsubFile.addEventListener('change', loadSub);

document.getElementById('VStimeBtn').addEventListener('click', writeTime);

document.getElementById('VSarrowBtn').addEventListener('click', function(){writeIn(' --> ')},false);

document.getElementById('VSbeepBtn').addEventListener('click', writeSilence);

document.getElementById('VSposBtn').addEventListener('click', writePosition);

document.getElementById('VShelpBtn').addEventListener('click', function(){
    window.open(chrome.runtime.getURL('/_locales/' + chrome.i18n.getMessage('directory') + '/help.html'))
});

document.getElementById('VSshowList').addEventListener('click', function(){
    if(VSblockList.style.display == 'block'){
        VSblockList.style.display = 'none'
    }else{
        VSblockList.style.display = 'block'
    }
});

VSsaveFile.addEventListener('click', save2file);

VSskipBox.addEventListener('change', function(){
    cuts = PF_SRT.parse(VSskipBox.value);
    setActions();
    makeTimeLabels()
});

for(var i = 0; i < sliders.length; i++){
    sliders[i].addEventListener('change',function(){
        for(var j = 0; j < sliders.length; j++) sliderValues[j] = sliders[j].value;
        setActions()
    })
}

document.getElementById('VSshotBtn').addEventListener('click',takeShot);

document.getElementById('VSshotFileLabel').style.display = 'none';

document.getElementById('VSbackBtn').addEventListener('click',backSkip);

document.getElementById('VSfineMode').addEventListener('click',fineSync);

document.getElementById('VSfwdBtn').addEventListener('click',fwdSkip);

document.getElementById('VSfFwdBtn').addEventListener('click',fFwdToggle);

document.getElementById('VSbackBtn2').addEventListener('click',backSkip);

document.getElementById('VSfineMode2').addEventListener('click',fineSync);

document.getElementById('VSfwdBtn2').addEventListener('click',fwdSkip);

document.getElementById('VSfFwdBtn2').addEventListener('click',fFwdToggle);

document.getElementById('VSshotTimeBtn').addEventListener('click',scrub2shot);

document.getElementById('VSautoBtn').addEventListener('click',findShot);

document.getElementById('VSmoveBtn').addEventListener('click',toggleTopShot);

document.getElementById('VSsyncBtn').addEventListener('click',syncTimes);

document.getElementById('VSblurBoxBtn').addEventListener('click',toggleBlurBox);

document.getElementById('VSshowSyncBtn').addEventListener('click',function(){
    if(VSsyncTab.style.display == ''){
        VSsyncTab.style.display = 'none';
        VSsyncLink.style.display = 'none';
    }else{
        VSsyncTab.style.display = '';
        VSsyncLink.style.display = '';
        VSsyncLink.click()
    }
});

document.getElementById('VSshowEditBtn').addEventListener('click',function(){
    VSeditTab.style.display = '';
    VSeditLink.style.display = '';
    VSeditLink.click()
});

document.getElementById('VScheckBtn').addEventListener('click',checkDone);

VSsyncLink.style.display = 'none';
VSsyncTab.style.display = 'none';

VSeditLink.style.display = 'none';
VSeditTab.style.display = 'none';

VSblurBox.style.display = 'none';

VSfilterDone.style.display = 'none';

showLoad();		//resets checkmarks on tabs

document.getElementById('VSloadAutoProf').addEventListener('click',function(){
    VSautoProfanity.style.display = 'block';
    this.style.display = 'none'
});

document.getElementById('VSloadSync').addEventListener('click',function(){
    var	initialData = VSskipBox.value.trim().split('\n').slice(0,2),			//first two lines
        shotTime = fromHMS(initialData[0]);
    goToTime(shotTime);
    VSsyncTab.style.display = '';
    VSsyncLink.style.display = '';
    VSsyncMsg.textContent = initialData[1];
    this.style.display = 'none';
    VSsyncLink.click()
});

"end of injected content2"			//add this so it becomes the "result" and Firefox is happy
